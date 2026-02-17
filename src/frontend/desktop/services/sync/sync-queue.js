/**
 * SyncQueue
 *
 * 提供本地同步队列：
 * 1) pending/sending/failed/conflict 状态流转；
 * 2) localStorage 持久化（浏览器环境可用）；
 * 3) 在无 localStorage 环境下自动退化为内存队列（便于 Node 单测）。
 */
export class SyncQueue {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'localverse.sync.queue';
    this.storage = options.storage ?? globalThis.localStorage ?? null;
    this.now = options.now ?? (() => Date.now());

    this.items = [];
  }

  /**
   * 初始化队列，尝试恢复历史缓存。
   */
  async init() {
    this.items = this.loadFromStorage();
  }

  /**
   * 入队一条本地变更。
   */
  async enqueue(change) {
    const item = {
      id: this.createId(),
      entityType: change.entityType,
      entityId: change.entityId,
      operation: change.operation,
      payload: change.payload,
      baseVersion: Number(change.baseVersion ?? 0),
      createdAt: this.now(),
      updatedAt: this.now(),
      status: 'pending',
      retries: 0,
      error: null
    };

    this.items.push(item);
    this.persist();
    return { ...item };
  }

  /**
   * 取出待发送批次（不会立即改状态）。
   */
  async getPendingBatch(limit = 50) {
    return this.items
      .filter((x) => x.status === 'pending')
      .slice(0, Math.max(1, limit))
      .map((x) => ({ ...x }));
  }

  /**
   * 标记为发送中。
   */
  async markSending(ids) {
    this.updateByIds(ids, (item) => {
      item.status = 'sending';
      item.updatedAt = this.now();
      item.error = null;
    });
    this.persist();
  }

  /**
   * 标记发送成功并移出队列。
   */
  async markDone(ids) {
    const idSet = new Set(ids);
    this.items = this.items.filter((item) => !idSet.has(item.id));
    this.persist();
  }

  /**
   * 标记发送失败并回到 pending，等待重试。
   */
  async markFailed(ids, errorMessage) {
    this.updateByIds(ids, (item) => {
      item.status = 'pending';
      item.retries += 1;
      item.updatedAt = this.now();
      item.error = errorMessage || 'unknown_error';
    });
    this.persist();
  }

  /**
   * 标记冲突，交由冲突处理器后续处理。
   */
  async markConflict(ids, conflictDetails = null) {
    this.updateByIds(ids, (item) => {
      item.status = 'conflict';
      item.updatedAt = this.now();
      item.error = conflictDetails ? JSON.stringify(conflictDetails) : 'conflict';
    });
    this.persist();
  }

  async getStats() {
    const stats = {
      pending: 0,
      sending: 0,
      failed: 0,
      conflict: 0,
      total: this.items.length
    };

    for (const item of this.items) {
      if (item.status === 'pending') stats.pending += 1;
      if (item.status === 'sending') stats.sending += 1;
      if (item.status === 'failed') stats.failed += 1;
      if (item.status === 'conflict') stats.conflict += 1;
    }

    return stats;
  }

  async clear() {
    this.items = [];
    this.persist();
  }

  createId() {
    return `q_${this.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  updateByIds(ids, updater) {
    const idSet = new Set(ids);
    for (const item of this.items) {
      if (idSet.has(item.id)) {
        updater(item);
      }
    }
  }

  loadFromStorage() {
    if (!this.storage?.getItem) {
      return [];
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  persist() {
    if (!this.storage?.setItem) {
      return;
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch {
      // 存储失败时静默降级为内存模式，避免阻塞主流程。
    }
  }
}
