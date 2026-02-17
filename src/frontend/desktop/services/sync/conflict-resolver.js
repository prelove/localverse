/**
 * ConflictResolver
 *
 * 管理同步冲突列表，当前阶段提供最小可用的创建/查询/标记已解决能力。
 */
export class ConflictResolver {
  constructor(options = {}) {
    this.conflicts = [];
    this.now = options.now ?? (() => Date.now());
  }

  async createConflict(conflict) {
    const item = {
      id: `conf_${this.now()}_${Math.random().toString(16).slice(2, 8)}`,
      createdAt: this.now(),
      resolved: false,
      ...conflict
    };

    this.conflicts.push(item);
    return { ...item };
  }

  async listConflicts() {
    return this.conflicts.filter((x) => !x.resolved).map((x) => ({ ...x }));
  }

  async getConflictCount() {
    return this.conflicts.filter((x) => !x.resolved).length;
  }

  async markResolved(conflictId) {
    for (const conflict of this.conflicts) {
      if (conflict.id === conflictId) {
        conflict.resolved = true;
      }
    }
  }
}
