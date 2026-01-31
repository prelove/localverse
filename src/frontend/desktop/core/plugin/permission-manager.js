/**
 * Permission Manager
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
