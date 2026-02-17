/**
 * ChangeTracker
 *
 * task-002 后续将接入具体实体 CRUD 钩子。
 * 当前先保留接口契约，方便同步引擎先完成生命周期联调。
 */
export class ChangeTracker {
  async trackChange() {
    // TODO(task-002): 持久化本地变更并写入 sync queue。
  }
}
