/**
 * ChangeTracker
 *
 * 本地变更追踪器：
 * 1) 接收业务层 CRUD 变更；
 * 2) 归一化为同步队列条目；
 * 3) 转交 SyncQueue 持久化与排队。
 */
export class ChangeTracker {
  constructor(options = {}) {
    this.syncQueue = options.syncQueue;
  }

  /**
   * 记录一条变更。
   */
  async trackChange(change) {
    this.validate(change);

    return this.syncQueue.enqueue({
      entityType: change.entityType,
      entityId: change.entityId,
      operation: change.operation,
      payload: change.payload ?? {},
      baseVersion: change.baseVersion ?? 0
    });
  }

  validate(change) {
    if (!this.syncQueue) {
      throw new Error('ChangeTracker requires syncQueue');
    }

    if (!change || typeof change !== 'object') {
      throw new Error('Invalid change payload');
    }

    const requiredFields = ['entityType', 'entityId', 'operation'];
    for (const field of requiredFields) {
      if (!change[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
}
