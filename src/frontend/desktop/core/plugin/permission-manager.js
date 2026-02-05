/**
 * PermissionManager - Manages plugin permissions
 */

// Permission definitions
export const PERMISSIONS = {
  // Database
  'database:read': { level: 1, description: 'Read database' },
  'database:write': { level: 2, description: 'Write database' },
  'database:delete': { level: 3, description: 'Delete database data' },
  'database:*': { level: 4, description: 'Full database access' },
  
  // Filesystem
  'filesystem:read': { level: 1, description: 'Read files' },
  'filesystem:write': { level: 2, description: 'Write files' },
  'filesystem:delete': { level: 3, description: 'Delete files' },
  'filesystem:*': { level: 4, description: 'Full filesystem access' },
  
  // Network
  'network:local': { level: 1, description: 'Access local network' },
  'network:external': { level: 2, description: 'Access external network' },
  'network:*': { level: 3, description: 'Full network access' },
  
  // UI
  'ui:notification': { level: 1, description: 'Show notifications' },
  'ui:modal': { level: 1, description: 'Show modals' },
  'ui:theme': { level: 2, description: 'Change theme' },
  
  // System
  'system:process': { level: 3, description: 'Execute processes' },
  'system:config': { level: 3, description: 'Modify system config' },
  '*': { level: 5, description: 'All permissions' }
};

export class PermissionManager {
  constructor() {
    this.grants = new Map(); // pluginId -> Set<permission>
  }
  
  /**
   * Grant permission to a plugin
   */
  grant(pluginId, permission) {
    if (!this.grants.has(pluginId)) {
      this.grants.set(pluginId, new Set());
    }
    this.grants.get(pluginId).add(permission);
  }
  
  /**
   * Grant multiple permissions
   */
  grantMultiple(pluginId, permissions) {
    for (const perm of permissions) {
      this.grant(pluginId, perm);
    }
  }
  
  /**
   * Revoke a permission
   */
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }
  
  /**
   * Revoke all permissions for a plugin
   */
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }
  
  /**
   * Check if plugin has a permission
   */
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // Check wildcard (all permissions)
    if (grants.has('*')) return true;
    
    // Check exact permission
    if (grants.has(permission)) return true;
    
    // Check parent permission (e.g., database:* includes database:read)
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }
  
  /**
   * Check permission - throws if not granted
   */
  require(pluginId, permission) {
    if (!this.hasPermission(pluginId, permission)) {
      throw new Error(`Plugin "${pluginId}" does not have permission: ${permission}`);
    }
  }
  
  /**
   * Check if plugin has all specified permissions
   */
  hasAll(pluginId, permissions) {
    return permissions.every(perm => this.hasPermission(pluginId, perm));
  }
  
  /**
   * Check if plugin has any of the specified permissions
   */
  hasAny(pluginId, permissions) {
    return permissions.some(perm => this.hasPermission(pluginId, perm));
  }
  
  /**
   * Get all granted permissions for a plugin
   */
  getPermissions(pluginId) {
    const grants = this.grants.get(pluginId);
    return grants ? Array.from(grants) : [];
  }
  
  /**
   * Get permission description
   */
  getDescription(permission) {
    const def = PERMISSIONS[permission];
    return def ? def.description : permission;
  }
  
  /**
   * Get permission level
   */
  getLevel(permission) {
    const def = PERMISSIONS[permission];
    return def ? def.level : 0;
  }
  
  /**
   * Validate permission string
   */
  validate(permission) {
    return PERMISSIONS.hasOwnProperty(permission);
  }
  
  /**
   * Get all available permissions
   */
  getAllPermissions() {
    return Object.keys(PERMISSIONS);
  }
  
  /**
   * Clear all grants
   */
  clear() {
    this.grants.clear();
  }
}

// Create singleton instance
export const permissionManager = new PermissionManager();
export default PermissionManager;
