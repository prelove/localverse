/**
 * 权限管理器
 * 
 * 功能：
 * 1. 插件权限声明和检查
 * 2. 与认证系统集成
 * 3. 细粒度权限控制
 */

/**
 * Permission Definitions
 */
export const PERMISSIONS = {
  // Database permissions
  'database:read': { level: 1, description: 'Read database' },
  'database:write': { level: 2, description: 'Write database' },
  'database:delete': { level: 3, description: 'Delete database data' },
  'database:*': { level: 4, description: 'Full database access' },

  // Filesystem permissions
  'filesystem:read': { level: 1, description: 'Read files' },
  'filesystem:write': { level: 2, description: 'Write files' },
  'filesystem:delete': { level: 3, description: 'Delete files' },
  'filesystem:watch': { level: 2, description: 'Watch file changes' },
  'filesystem:*': { level: 4, description: 'Full filesystem access' },

  // Network permissions
  'network:fetch': { level: 2, description: 'Network requests' },
  'network:websocket': { level: 2, description: 'WebSocket connections' },
  'network:*': { level: 3, description: 'Full network access' },

  // UI permissions
  'ui:render': { level: 1, description: 'Render UI' },
  'ui:modal': { level: 2, description: 'Show modals' },
  'ui:notification': { level: 1, description: 'Show notifications' },
  'ui:*': { level: 2, description: 'Full UI access' },

  // Clipboard permissions
  'clipboard:read': { level: 2, description: 'Read clipboard' },
  'clipboard:write': { level: 1, description: 'Write clipboard' },

  // Storage permissions
  'storage:read': { level: 1, description: 'Read storage' },
  'storage:write': { level: 1, description: 'Write storage' },

  // System permissions
  'system:shell': { level: 4, description: 'Execute system commands' },
  'system:process': { level: 4, description: 'Manage processes' },
 * Permission Manager
 * 
 * Manages plugin permissions and access control.
 */

const PERMISSIONS = {
  'database:read': {
    name: '读取数据库',
    risk: 'low'
  },
  'database:write': {
    name: '写入数据库',
    risk: 'medium'
  },
  'filesystem:read': {
    name: '读取文件',
    risk: 'medium'
  },
  'filesystem:write': {
    name: '写入文件',
    risk: 'high'
  },
  'filesystem:watch': {
    name: '监视文件',
    risk: 'low'
  },
  'network:local': {
    name: '本地网络',
    risk: 'low'
  },
  'network:sync': {
    name: '同步服务',
    risk: 'medium'
  },
  'notification': {
    name: '发送通知',
    risk: 'low'
  },
  'clipboard:read': {
    name: '读取剪贴板',
    risk: 'medium'
  },
  'clipboard:write': {
    name: '写入剪贴板',
    risk: 'low'
  },
  'search': {
    name: '搜索',
    risk: 'low'
  }
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
    this.grants = new Map(); // pluginId -> Set<permission>
  }
  
  grant(pluginId, permissions) {
    let grants = this.grants.get(pluginId);
    if (!grants) {
      grants = new Set();
      this.grants.set(pluginId, grants);
    }
    
    for (const permission of permissions) {
      grants.add(permission);
    }
  }
  
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }
  
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }
  
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // Check wildcard
    if (grants.has('*')) return true;
    
    // Check specific permission
    if (grants.has(permission)) return true;
    
    // Check parent permission (e.g., database:* includes database:read)
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }
  
  getGranted(pluginId) {
    const grants = this.grants.get(pluginId);
    return grants ? Array.from(grants) : [];
  }
  
  getPermissionInfo(permission) {
    return PERMISSIONS[permission] || { name: permission, risk: 'unknown' };
  }
  
  getAllPermissions() {
    return PERMISSIONS;
  }
}

export default PermissionManager;
 * Handles plugin permission validation and enforcement
 */

export class PermissionManager {
  constructor() {
    this.permissions = new Map();
  }

  /**
   * Register plugin permissions
   * @param {string} pluginId - Plugin ID
   * @param {string[]} permissions - Array of permission strings
   */
  register(pluginId, permissions) {
    this.permissions.set(pluginId, new Set(permissions));
  }

  /**
   * Unregister plugin permissions
   * @param {string} pluginId - Plugin ID
   */
  unregister(pluginId) {
    this.permissions.delete(pluginId);
  }

  /**
   * Check if plugin has permission
   * @param {string} pluginId - Plugin ID
   * @param {string} permission - Permission string (e.g., "database:read")
   * @param {Set} [pluginPermissions] - Optional pre-fetched permissions
   * @returns {boolean} True if has permission
   */
  check(pluginId, permission, pluginPermissions = null) {
    const perms = pluginPermissions || this.permissions.get(pluginId);
    if (!perms) return false;

    // Check exact match
    if (perms.has(permission)) return true;

    // Check wildcard permissions (e.g., "database:*" for "database:read")
    const [scope, action] = permission.split(':');
    if (perms.has(`${scope}:*`)) return true;
    if (perms.has('*')) return true;

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
   * Get all permissions for a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Set<string>} Set of permissions
   */
  get(pluginId) {
    return this.permissions.get(pluginId) || new Set();
  }

  /**
   * Validate permission string format
   * @param {string} permission - Permission string
   * @returns {boolean} True if valid
   */
  validate(permission) {
    // Valid formats: "scope:action" or "scope:*" or "*"
    if (permission === '*') return true;
    
    const parts = permission.split(':');
    if (parts.length !== 2) return false;
    
    const [scope, action] = parts;
    if (!scope || !action) return false;
    
    return true;
  }

  /**
   * Get all registered plugins and their permissions
   * @returns {Object} Map of pluginId -> permissions
   */
  getAll() {
    const result = {};
    for (const [pluginId, perms] of this.permissions.entries()) {
      result[pluginId] = Array.from(perms);
    }
    return result;
  }
}

// 创建全局实例
export const permissionManager = new PermissionManager();
