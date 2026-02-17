/**
 * SyncStatusStore
 *
 * 维护同步引擎的轻量运行时状态，并提供可序列化快照。
 * 该类先提供最小可用能力，后续可在 task-002 中继续扩展为持久化状态。
 */
export class SyncStatusStore {
  constructor() {
    this.state = {
      running: false,
      syncing: false,
      online: false,
      lastPullTime: 0,
      lastPushTime: 0,
      pendingCount: 0,
      conflictCount: 0,
      failedCount: 0,
      lastError: null
    };
  }

  /**
   * 更新状态字段（浅合并）。
   * @param {Partial<typeof this.state>} patch
   */
  patch(patch) {
    this.state = {
      ...this.state,
      ...patch
    };
  }

  /**
   * 返回状态快照，避免调用方直接修改内部对象。
   */
  snapshot() {
    return { ...this.state };
  }
}
