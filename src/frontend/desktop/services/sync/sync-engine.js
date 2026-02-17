import { SyncStatusStore } from './sync-status.js';

/**
 * SyncEngine（Phase 2 / task-002）
 *
 * 当前实现目标：
 * 1) 提供客户端同步生命周期骨架（start/stop/syncNow）；
 * 2) 接入通信层在线状态与远端变更通知；
 * 3) 提供 push 防抖触发与 pull 定时调度；
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
      ...options.config
    };

    this.statusStore = new SyncStatusStore();

    this.pullTimer = null;
    this.pushDebounceTimer = null;

    // 统一缓存绑定后的监听器，stop 时可以可靠解绑。
    this.onConnectedBound = () => this.onOnline();
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
    const pending = this.statusStore.snapshot().pendingCount + 1;
    this.statusStore.patch({ pendingCount: pending });

    this.stopPushDebounce();
    this.pushDebounceTimer = setTimeout(() => {
      this.syncNow();
    }, this.config.pushDebounce);
  }

  /**
   * 推送本地待同步数据。
   * 当前为引擎骨架：通过通信层 action=sync:push 调用，后续接入真正 queue/tracker。
   */
  async pushPending() {
    const pendingCount = this.statusStore.snapshot().pendingCount;
    if (pendingCount <= 0) {
      return;
    }

    await this.comm.sendAndWait({
      type: 'event',
      action: 'sync:push',
      payload: {
        batchSize: pendingCount
      }
    });

    this.statusStore.patch({
      pendingCount: 0,
      lastPushTime: Date.now()
    });
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
    await this.comm.sendAndWait({
      type: 'event',
      action: 'sync:pull',
      payload: { entityType }
    });
  }

  /**
   * 通信层在线回调。
   */
  onOnline() {
    this.statusStore.patch({ online: true });
    this.syncNow();
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
   * 暴露当前状态快照。
   */
  getStatus() {
    return this.statusStore.snapshot();
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
