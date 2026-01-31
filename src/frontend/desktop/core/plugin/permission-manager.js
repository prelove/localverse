/**
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
