/**
 * PermissionManager - Manages plugin permissions
 * Controls access to sensitive APIs
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
  }
};

export class PermissionManager {
  constructor() {
    this.grants = new Map(); // pluginId -> Set<permission>
  }

  /**
   * Grant permissions to a plugin
   * @param {string} pluginId - Plugin ID
   * @param {string[]} permissions - Permissions to grant
   */
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

  /**
   * Revoke a permission from a plugin
   * @param {string} pluginId - Plugin ID
   * @param {string} permission - Permission to revoke
   */
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }

  /**
   * Revoke all permissions from a plugin
   * @param {string} pluginId - Plugin ID
   */
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }

  /**
   * Check if plugin has a permission
   * @param {string} pluginId - Plugin ID
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether plugin has permission
   */
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // Check wildcard
    if (grants.has('*')) return true;
    
    // Check specific permission
    if (grants.has(permission)) return true;
    
    // Check parent permission (e.g. database:* includes database:read)
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }

  /**
   * Get all granted permissions for a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {string[]} Array of permissions
   */
  getGranted(pluginId) {
    const grants = this.grants.get(pluginId);
    return grants ? Array.from(grants) : [];
  }

  /**
   * Get permission information
   * @param {string} permission - Permission name
   * @returns {Object} Permission info
   */
  getPermissionInfo(permission) {
    return PERMISSIONS[permission] || { name: permission, risk: 'unknown' };
  }

  /**
   * Get all available permissions
   * @returns {Object} All permissions
   */
  getAllPermissions() {
    return PERMISSIONS;
  }
}

export default PermissionManager;
