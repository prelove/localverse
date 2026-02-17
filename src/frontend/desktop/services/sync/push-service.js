/**
 * PushService
 *
 * 负责将本地 queue 中的 pending 变更批量推送至服务端。
 */
export class PushService {
  constructor(options = {}) {
    this.comm = options.communicationLayer;
    this.syncQueue = options.syncQueue;
    this.batchSize = options.batchSize ?? 50;
  }

  async pushAll() {
    const pending = await this.syncQueue.getPendingBatch(this.batchSize);
    if (pending.length === 0) {
      return {
        accepted: 0,
        conflicts: [],
        failed: 0,
        remaining: 0
      };
    }

    const ids = pending.map((x) => x.id);
    await this.syncQueue.markSending(ids);

    try {
      const response = await this.comm.sendAndWait({
        type: 'event',
        action: 'sync:push',
        payload: {
          changes: pending.map((item) => ({
            id: item.entityId,
            operation: item.operation,
            payload: item.payload,
            entityType: item.entityType,
            baseVersion: item.baseVersion
          }))
        }
      });

      const detail = this.extractDetail(response);
      const conflicts = detail?.payload?.conflictDetails ?? detail?.conflictDetails ?? [];
      const conflictEntityIds = new Set(conflicts.map((x) => x?.change?.id).filter(Boolean));

      const successIds = pending
        .filter((x) => !conflictEntityIds.has(x.entityId))
        .map((x) => x.id);
      const conflictIds = pending
        .filter((x) => conflictEntityIds.has(x.entityId))
        .map((x) => x.id);

      if (successIds.length > 0) {
        await this.syncQueue.markDone(successIds);
      }
      if (conflictIds.length > 0) {
        await this.syncQueue.markConflict(conflictIds, conflicts);
      }

      const stats = await this.syncQueue.getStats();
      return {
        accepted: successIds.length,
        conflicts,
        failed: 0,
        remaining: stats.pending
      };
    } catch (error) {
      await this.syncQueue.markFailed(ids, String(error?.message ?? error));
      const stats = await this.syncQueue.getStats();
      return {
        accepted: 0,
        conflicts: [],
        failed: ids.length,
        remaining: stats.pending
      };
    }
  }

  extractDetail(response) {
    if (!response) {
      return null;
    }

    if (typeof response === 'object' && 'detail' in response) {
      return response.detail;
    }

    return response;
  }
}
