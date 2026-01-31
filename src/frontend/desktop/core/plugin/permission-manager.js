/**
 * Permission Manager
 * Manages plugin permissions and access control
 */

const PERMISSIONS = {
  'database:read': {
    name: '读取数据库',
    description: '允许读取本地数据库中的数据',
    risk: 'low'
  },
  'database:write': {
    name: '写入数据库',
    description: '允许向本地数据库写入数据',
    risk: 'medium'
  },
  'filesystem:read': {
    name: '读取文件',
    description: '允许读取本地文件内容',
    risk: 'medium'
  },
  'filesystem:write': {
    name: '写入文件',
    description: '允许创建和修改本地文件',
    risk: 'high'
  },
  'filesystem:watch': {
    name: '监视文件',
    description: '允许监视文件系统变化',
    risk: 'low'
  },
  'network:local': {
    name: '本地网络',
    description: '允许访问本地 JAR 服务',
    risk: 'low'
  },
  'network:sync': {
    name: '同步服务',
    description: '允许访问同步服务器',
    risk: 'medium'
  },
  'notification': {
    name: '发送通知',
    description: '允许发送桌面通知',
    risk: 'low'
  },
  'clipboard:read': {
    name: '读取剪贴板',
    description: '允许读取剪贴板内容',
    risk: 'medium'
  },
  'clipboard:write': {
    name: '写入剪贴板',
    description: '允许写入剪贴板',
    risk: 'low'
  }
};

export class PermissionManager {
  constructor() {
    this.grants = new Map(); // pluginId -> Set<permission>
  }

  /**
   * Grant permissions to plugin
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
   * Revoke permission from plugin
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
   * Revoke all permissions from plugin
   * @param {string} pluginId - Plugin ID
   */
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }

  /**
   * Check if plugin has permission
   * @param {string} pluginId - Plugin ID
   * @param {string} permission - Permission to check
   * @returns {boolean} True if plugin has permission
   */
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // Check wildcard
    if (grants.has('*')) return true;
    
    // Check exact permission
    if (grants.has(permission)) return true;
    
    // Check parent permission (e.g., database:* includes database:read)
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }

  /**
   * Get granted permissions for plugin
   * @param {string} pluginId - Plugin ID
   * @returns {string[]} Array of granted permissions
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
    return PERMISSIONS[permission] || { 
      name: permission, 
      description: '',
      risk: 'unknown' 
    };
  }

  /**
   * Get all available permissions
   * @returns {Object} All permissions with info
   */
  getAllPermissions() {
    return PERMISSIONS;
  }

  /**
   * Create permission proxy for services
   * @param {string} pluginId - Plugin ID
   * @param {Object} target - Target object to proxy
   * @param {Object} permissionMap - Method -> Permission mapping
   * @returns {Proxy} Proxied object with permission checks
   */
  createProxy(pluginId, target, permissionMap) {
    const self = this;
    
    return new Proxy(target, {
      get(obj, prop) {
        const permission = permissionMap[prop];
        if (permission && !self.hasPermission(pluginId, permission)) {
          throw new Error(`Permission denied: ${permission} for ${pluginId}`);
        }
        return obj[prop];
      }
    });
  }

  /**
   * Check multiple permissions
   * @param {string} pluginId - Plugin ID
   * @param {string[]} permissions - Permissions to check
   * @returns {boolean} True if plugin has all permissions
   */
  hasAllPermissions(pluginId, permissions) {
    return permissions.every(p => this.hasPermission(pluginId, p));
  }

  /**
   * Check if plugin has any of the permissions
   * @param {string} pluginId - Plugin ID
   * @param {string[]} permissions - Permissions to check
   * @returns {boolean} True if plugin has at least one permission
   */
  hasAnyPermission(pluginId, permissions) {
    return permissions.some(p => this.hasPermission(pluginId, p));
  }
}

export default PermissionManager;
export { PERMISSIONS };
