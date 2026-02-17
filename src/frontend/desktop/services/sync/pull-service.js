/**
 * PullService
 *
 * 负责按实体类型执行增量拉取，并维护本地 lastVersion 游标。
 */
export class PullService {
  constructor(options = {}) {
    this.comm = options.communicationLayer;
    this.entityVersions = new Map();
  }

  getLastVersion(entityType) {
    return this.entityVersions.get(entityType) ?? 0;
  }

  async pullEntity(entityType, options = {}) {
    const since = options.sinceVersion ?? this.getLastVersion(entityType);
    const limit = options.limit ?? 100;

    const response = await this.comm.sendAndWait({
      type: 'event',
      action: 'sync:pull',
      payload: {
        entityType,
        since,
        limit
      }
    });

    const detail = this.extractDetail(response);
    const changes = detail?.payload?.changes ?? detail?.changes ?? [];

    // 推进本地版本游标：取返回变更中的最大 version。
    let latestVersion = since;
    for (const change of changes) {
      const version = Number(change?.version ?? 0);
      if (version > latestVersion) {
        latestVersion = version;
      }
    }

    this.entityVersions.set(entityType, latestVersion);

    return {
      entityType,
      since,
      latestVersion,
      count: changes.length,
      changes
    };
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
