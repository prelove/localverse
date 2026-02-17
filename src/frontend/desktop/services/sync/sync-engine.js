import { SyncStatusStore } from './sync-status.js';
import { SyncQueue } from './sync-queue.js';
import { ChangeTracker } from './change-tracker.js';
import { PushService } from './push-service.js';
import { PullService } from './pull-service.js';
import { ConflictResolver } from './conflict-resolver.js';

/**
 * SyncEngine（Phase 2 / task-002）
 *
 * 当前实现目标：
 * 1) 提供客户端同步生命周期骨架（start/stop/syncNow）；
 * 2) 接入通信层在线状态与远端变更通知；
 * 3) 实现本地 queue + push/pull 服务协作；
 * 4) 向 eventBus 输出同步过程事件，便于 UI/调试观测。
 */
export class SyncEngine {
  constructor(options = {}) {
    this.comm = options.communicationLayer;
    this.eventBus = options.eventBus ?? null;

    this.config = {
      pullInterval: 30000,
      pushDebounce: 800,
      entityTypes: ['cards', 'tasks', 'chat_messages', 'files'],
      pushBatchSize: 50,
      ...options.config
    };

    this.statusStore = new SyncStatusStore();

    // 核心子模块：支持外部注入（便于后续在业务侧替换为更强实现）。
    this.syncQueue = options.syncQueue ?? new SyncQueue(options.queueOptions);
    this.changeTracker = options.changeTracker ?? new ChangeTracker({ syncQueue: this.syncQueue });
    this.pushService = options.pushService ?? new PushService({
      communicationLayer: this.comm,
      syncQueue: this.syncQueue,
      batchSize: this.config.pushBatchSize
    });
    this.pullService = options.pullService ?? new PullService({
      communicationLayer: this.comm
    });
    this.conflictResolver = options.conflictResolver ?? new ConflictResolver();

    this.pullTimer = null;
    this.pushDebounceTimer = null;

    // 统一缓存绑定后的监听器，stop 时可以可靠解绑。
    this.onConnectedBound = () => {
      this.onOnline().catch((error) => this.emit('sync:error', error));
    };
    this.onDisconnectedBound = () => this.onOffline();
    this.onSyncUpdatedBound = (event) => this.onRemoteSyncUpdated(event);
  }

  /**
   * 启动同步引擎。
   */
  async start() {
    if (this.statusStore.snapshot().running) {
      return;
    }

    await this.syncQueue.init();
    await this.refreshQueueStats();

    this.statusStore.patch({
      running: true,
      online: Boolean(this.comm?.isOnline?.())
    });

    this.bindCommEvents();

    // 在线时立即执行一次同步，避免首次进入时看到过旧数据。
    if (this.comm?.isOnline?.()) {
      await this.syncNow();
    }

    this.startPullTimer();
    this.emit('sync:started', this.getStatus());
  }

  /**
   * 停止同步引擎。
   */
  stop() {
    const status = this.statusStore.snapshot();
    if (!status.running) {
      return;
    }

    this.unbindCommEvents();
    this.stopPullTimer();
    this.stopPushDebounce();

    this.statusStore.patch({
      running: false,
      syncing: false
    });

    this.emit('sync:stopped', this.getStatus());
  }

  /**
   * 业务层记录本地变更入口。
   */
  async trackLocalChange(change) {
    const record = await this.changeTracker.trackChange(change);
    await this.refreshQueueStats();
    this.requestPush();
    return record;
  }

  /**
   * 立即执行一次“先推后拉”的同步流程。
   */
  async syncNow() {
    const status = this.statusStore.snapshot();
    if (!status.running || status.syncing || !this.comm?.isOnline?.()) {
      return;
    }

    this.statusStore.patch({ syncing: true, lastError: null });
    this.emit('sync:start', this.getStatus());

    try {
      await this.pushPending();
      await this.pullAll();
      await this.refreshQueueStats();
      this.emit('sync:complete', this.getStatus());
    } catch (error) {
      this.statusStore.patch({
        failedCount: this.statusStore.snapshot().failedCount + 1,
        lastError: String(error?.message ?? error)
      });
      this.emit('sync:error', error);
    } finally {
      this.statusStore.patch({ syncing: false });
    }
  }

  /**
   * 记录“有本地变更待推送”，并进行防抖合并。
   */
  requestPush() {
    this.stopPushDebounce();
    this.pushDebounceTimer = setTimeout(() => {
      this.syncNow();
    }, this.config.pushDebounce);
  }

  /**
   * 推送本地待同步数据。
   */
  async pushPending() {
    const result = await this.pushService.pushAll();

    // 将服务端冲突明细转交冲突处理器。
    for (const conflict of result.conflicts) {
      await this.conflictResolver.createConflict(conflict);
    }

    const conflictCount = await this.conflictResolver.getConflictCount();
    this.statusStore.patch({
      conflictCount,
      lastPushTime: Date.now(),
      failedCount: this.statusStore.snapshot().failedCount + result.failed
    });

    return result;
  }

  /**
   * 拉取所有实体类型的增量。
   */
  async pullAll() {
    for (const entityType of this.config.entityTypes) {
      await this.pullEntity(entityType);
    }

    this.statusStore.patch({ lastPullTime: Date.now() });
  }

  /**
   * 拉取单个实体类型。
   * @param {string} entityType
   */
  async pullEntity(entityType) {
    return this.pullService.pullEntity(entityType);
  }

  /**
   * 通信层在线回调。
   */
  async onOnline() {
    // 重连后先将 failed 回退为 pending，再统一触发一次同步。
    await this.syncQueue.retryFailed();
    await this.refreshQueueStats();
    this.statusStore.patch({ online: true });
    await this.syncNow();
  }

  /**
   * 通信层离线回调。
   */
  onOffline() {
    this.statusStore.patch({ online: false });
  }

  /**
   * 收到服务端广播时，按实体做一次定向拉取。
   */
  onRemoteSyncUpdated(event) {
    const detail = this.extractDetail(event);
    const entity = detail?.payload?.entity || detail?.entity;
    if (!entity) {
      return;
    }

    // 广播通知只触发“定向拉取”，避免每次都全量轮询。
    this.pullEntity(String(entity)).catch((error) => {
      this.emit('sync:error', error);
    });
  }


  /**
   * 查询未解决冲突列表。
   */
  async listConflicts() {
    return this.conflictResolver.listConflicts();
  }

  /**
   * 手动解决冲突，并刷新冲突计数。
   */
  async resolveConflict(conflictId, mergedPayload = null) {
    await this.conflictResolver.resolveConflict(conflictId, mergedPayload);
    const conflictCount = await this.conflictResolver.getConflictCount();
    this.statusStore.patch({ conflictCount });
  }

  /**
   * 暴露当前状态快照。
   */
  getStatus() {
    return this.statusStore.snapshot();
  }

  async refreshQueueStats() {
    const stats = await this.syncQueue.getStats();
    this.statusStore.patch({
      pendingCount: stats.pending,
      failedCount: stats.failed
    });
  }

  bindCommEvents() {
    if (!this.comm?.on) {
      return;
    }

    this.comm.on('connected', this.onConnectedBound);
    this.comm.on('disconnected', this.onDisconnectedBound);
    this.comm.on('sync-updated', this.onSyncUpdatedBound);
  }

  unbindCommEvents() {
    if (!this.comm?.off) {
      return;
    }

    this.comm.off('connected', this.onConnectedBound);
    this.comm.off('disconnected', this.onDisconnectedBound);
    this.comm.off('sync-updated', this.onSyncUpdatedBound);
  }

  startPullTimer() {
    this.stopPullTimer();

    this.pullTimer = setInterval(() => {
      if (this.comm?.isOnline?.()) {
        this.pullAll().catch((error) => this.emit('sync:error', error));
      }
    }, this.config.pullInterval);
  }

  stopPullTimer() {
    if (this.pullTimer) {
      clearInterval(this.pullTimer);
      this.pullTimer = null;
    }
  }

  stopPushDebounce() {
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
      this.pushDebounceTimer = null;
    }
  }

  /**
   * 从 EventTarget/Emitter 两种事件风格中提取 detail。
   */
  extractDetail(event) {
    if (!event) {
      return null;
    }

    if (typeof event === 'object' && 'detail' in event) {
      return event.detail;
    }

    return event;
  }

  emit(eventName, detail) {
    if (this.eventBus?.emit) {
      this.eventBus.emit(eventName, detail);
    }
  }
}
