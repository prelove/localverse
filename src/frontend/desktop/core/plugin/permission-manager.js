/**
 * 权限管理器
 * 
 * 功能：
 * 1. 插件权限声明和检查
 * 2. 与认证系统集成
 * 3. 细粒度权限控制
 */

/**
 * 权限定义
 */
export const PERMISSIONS = {
  // 数据库权限
  'database:read': { level: 1, description: '读取数据库' },
  'database:write': { level: 2, description: '写入数据库' },
  'database:delete': { level: 3, description: '删除数据库数据' },
  'database:*': { level: 4, description: '完全数据库访问' },

  // 文件系统权限
  'filesystem:read': { level: 1, description: '读取文件' },
  'filesystem:write': { level: 2, description: '写入文件' },
  'filesystem:delete': { level: 3, description: '删除文件' },
  'filesystem:watch': { level: 2, description: '监视文件变化' },
  'filesystem:*': { level: 4, description: '完全文件系统访问' },

  // 网络权限
  'network:fetch': { level: 2, description: '网络请求' },
  'network:websocket': { level: 2, description: 'WebSocket 连接' },
  'network:*': { level: 3, description: '完全网络访问' },

  // UI 权限
  'ui:render': { level: 1, description: '渲染 UI' },
  'ui:modal': { level: 2, description: '显示模态框' },
  'ui:notification': { level: 1, description: '显示通知' },
  'ui:*': { level: 2, description: '完全 UI 访问' },

  // 剪贴板权限
  'clipboard:read': { level: 2, description: '读取剪贴板' },
  'clipboard:write': { level: 1, description: '写入剪贴板' },

  // 存储权限
  'storage:read': { level: 1, description: '读取存储' },
  'storage:write': { level: 1, description: '写入存储' },

  // 系统权限
  'system:shell': { level: 4, description: '执行系统命令' },
  'system:process': { level: 4, description: '管理进程' },
};

export class PermissionManager {
  constructor() {
    this._pluginPermissions = new Map(); // pluginId -> Set<permission>
    this._authService = null;
  }

  /**
   * 设置认证服务（可选，用于用户权限检查）
   * @param {Object} authService - 认证服务
   */
  setAuthService(authService) {
    this._authService = authService;
  }

  /**
   * 注册插件权限
   * @param {string} pluginId - 插件ID
   * @param {string[]} permissions - 权限列表
   */
  register(pluginId, permissions = []) {
    if (!Array.isArray(permissions)) {
      throw new TypeError('Permissions must be an array');
    }

    // 验证权限
    for (const perm of permissions) {
      if (!this._isValidPermission(perm)) {
        throw new Error(`Invalid permission: ${perm}`);
      }
    }

    this._pluginPermissions.set(pluginId, new Set(permissions));
  }

  /**
   * 注销插件权限
   * @param {string} pluginId - 插件ID
   */
  unregister(pluginId) {
    this._pluginPermissions.delete(pluginId);
  }

  /**
   * 检查插件是否有权限
   * @param {string} pluginId - 插件ID
   * @param {string} permission - 权限名
   * @returns {boolean}
   */
  check(pluginId, permission) {
    const pluginPerms = this._pluginPermissions.get(pluginId);
    if (!pluginPerms) return false;

    // 精确匹配
    if (pluginPerms.has(permission)) return true;

    // 通配符匹配
    const [category] = permission.split(':');
    if (pluginPerms.has(`${category}:*`)) return true;

    return false;
  }

  /**
   * 要求权限（无权限则抛出错误）
   * @param {string} pluginId - 插件ID
   * @param {string} permission - 权限名
   * @throws {Error} - 无权限时抛出
   */
  require(pluginId, permission) {
    if (!this.check(pluginId, permission)) {
      throw new Error(
        `Plugin "${pluginId}" does not have permission: ${permission}`
      );
    }
  }

  /**
   * 批量检查权限
   * @param {string} pluginId - 插件ID
   * @param {string[]} permissions - 权限列表
   * @returns {boolean} - 是否全部具有
   */
  checkAll(pluginId, permissions) {
    return permissions.every(perm => this.check(pluginId, perm));
  }

  /**
   * 检查任意权限
   * @param {string} pluginId - 插件ID
   * @param {string[]} permissions - 权限列表
   * @returns {boolean} - 是否至少有一个
   */
  checkAny(pluginId, permissions) {
    return permissions.some(perm => this.check(pluginId, perm));
  }

  /**
   * 获取插件的所有权限
   * @param {string} pluginId - 插件ID
   * @returns {string[]}
   */
  getPermissions(pluginId) {
    const perms = this._pluginPermissions.get(pluginId);
    return perms ? Array.from(perms) : [];
  }

  /**
   * 获取权限描述
   * @param {string} permission - 权限名
   * @returns {string}
   */
  getDescription(permission) {
    const def = PERMISSIONS[permission];
    return def ? def.description : permission;
  }

  /**
   * 获取权限级别
   * @param {string} permission - 权限名
   * @returns {number}
   */
  getLevel(permission) {
    const def = PERMISSIONS[permission];
    return def ? def.level : 0;
  }

  /**
   * 检查用户权限（需要设置 authService）
   * @param {Object} user - 用户对象
   * @param {string} permission - 权限名
   * @returns {boolean}
   */
  checkUserPermission(user, permission) {
    if (!this._authService) {
      console.warn('AuthService not set, skipping user permission check');
      return true;
    }

    // 管理员有所有权限
    if (user && user.role === 'admin') return true;

    // 根据权限级别判断
    const level = this.getLevel(permission);
    
    if (level >= 4) {
      // 高级权限只有管理员
      return user && user.role === 'admin';
    } else if (level >= 3) {
      // 删除权限需要 user 或 admin
      return user && (user.role === 'user' || user.role === 'admin');
    } else if (level >= 2) {
      // 写入权限需要登录
      return user && user.role !== 'guest';
    } else {
      // 读取权限所有人都有
      return true;
    }
  }

  /**
   * 验证权限格式
   * @private
   */
  _isValidPermission(permission) {
    // 已定义的权限
    if (PERMISSIONS[permission]) return true;

    // 通配符权限
    if (permission.endsWith(':*')) {
      const category = permission.slice(0, -2);
      return Object.keys(PERMISSIONS).some(p => p.startsWith(`${category}:`));
    }

    return false;
  }

  /**
   * 清除所有权限
   */
  clear() {
    this._pluginPermissions.clear();
  }

  /**
   * 获取所有已注册插件
   * @returns {string[]}
   */
  getPlugins() {
    return Array.from(this._pluginPermissions.keys());
  }

  /**
   * 导出权限配置（用于调试）
   * @returns {Object}
   */
  export() {
    const result = {};
    for (const [pluginId, permissions] of this._pluginPermissions) {
      result[pluginId] = Array.from(permissions);
    }
    return result;
  }
}

// 创建全局实例
export const permissionManager = new PermissionManager();
