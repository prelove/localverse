/**
 * ConflictResolver
 *
 * 管理同步冲突列表，提供：
 * 1) 冲突创建与查询；
 * 2) 简单冲突自动合并（字段不重叠）；
 * 3) 手动标记解决能力。
 */
export class ConflictResolver {
  constructor(options = {}) {
    this.conflicts = [];
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * 创建冲突记录。
   * 若满足“简单可合并”条件，则直接自动解决并返回 resolved=true。
   */
  async createConflict(conflict) {
    const autoResolution = this.tryAutoResolve(conflict);

    const item = {
      id: `conf_${this.now()}_${Math.random().toString(16).slice(2, 8)}`,
      createdAt: this.now(),
      resolved: Boolean(autoResolution),
      resolutionType: autoResolution ? 'auto-merged' : 'manual-required',
      mergedPayload: autoResolution?.mergedPayload ?? null,
      ...conflict
    };

    this.conflicts.push(item);
    return { ...item };
  }

  /**
   * 简单自动合并策略：
   * - 本地与服务端 payload 均为对象；
   * - 两边字段键集合不重叠。
   *
   * 满足时返回合并结果，否则返回 null。
   */
  tryAutoResolve(conflict) {
    const localPayload = conflict?.localChange?.payload;
    const remotePayload = conflict?.serverChange?.payload;

    if (!this.isPlainObject(localPayload) || !this.isPlainObject(remotePayload)) {
      return null;
    }

    const localKeys = Object.keys(localPayload);
    const remoteKeys = Object.keys(remotePayload);

    const hasOverlap = localKeys.some((key) => remoteKeys.includes(key));
    if (hasOverlap) {
      return null;
    }

    return {
      mergedPayload: {
        ...remotePayload,
        ...localPayload
      }
    };
  }

  async listConflicts() {
    return this.conflicts.filter((x) => !x.resolved).map((x) => ({ ...x }));
  }

  async listResolvedConflicts() {
    return this.conflicts.filter((x) => x.resolved).map((x) => ({ ...x }));
  }

  /**
   * 按 ID 查询冲突。
   */
  async getConflictById(conflictId) {
    const hit = this.conflicts.find((x) => x.id === conflictId);
    return hit ? { ...hit } : null;
  }

  async getConflictCount() {
    return this.conflicts.filter((x) => !x.resolved).length;
  }

  /**
   * 手动解决冲突。
   */
  async resolveConflict(conflictId, mergedPayload = null) {
    for (const conflict of this.conflicts) {
      if (conflict.id === conflictId) {
        conflict.resolved = true;
        conflict.resolutionType = 'manual-resolved';
        conflict.mergedPayload = mergedPayload;
        conflict.resolvedAt = this.now();
      }
    }
  }

  isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
