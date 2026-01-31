/**
 * Permission Module
 * 
 * Handles role-based permissions and data access control.
 * Supports three roles: admin, user, guest
 */

/**
 * Role definitions with permissions
 */
const ROLES = {
  admin: {
    name: '管理员',
    permissions: ['*']  // All permissions
  },
  user: {
    name: '普通用户',
    permissions: [
      'card:create', 'card:read', 'card:update', 'card:delete',
      'task:create', 'task:read', 'task:update', 'task:delete',
      'file:create', 'file:read', 'file:delete',
      'chat:send', 'chat:read',
      'vote:create', 'vote:read', 'vote:vote',
      'calendar:create', 'calendar:read', 'calendar:update'
    ]
  },
  guest: {
    name: '访客',
    permissions: [
      'card:read',
      'task:read',
      'file:read',
      'chat:read',
      'vote:read',
      'calendar:read'
    ]
  }
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with role property
 * @param {string} permission - Permission string (e.g., 'card:create')
 * @returns {boolean} True if user has permission
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  
  const role = ROLES[user.role];
  if (!role) return false;
  
  // Admin has all permissions
  if (role.permissions.includes('*')) return true;
  
  // Check specific permission
  return role.permissions.includes(permission);
}

/**
 * Decorator for requiring permissions on methods
 * @param {string} permission - Required permission
 * @returns {Function} Decorator function
 */
export function requirePermission(permission) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const { authService } = await import('./auth-service.js');
      const user = authService.getCurrentUser();
      
      if (!hasPermission(user, permission)) {
        throw new Error(`Permission denied: ${permission}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Check if user can access specific data
 * @param {Object} user - User object
 * @param {Object} data - Data object with metadata
 * @returns {boolean} True if user can access
 */
export function canAccessData(user, data) {
  if (!user) return false;
  
  // Admin can access all data
  if (user.role === 'admin') return true;
  
  // Own data
  if (data.created_by === user.id) return true;
  
  // Same department data
  if (data.department === user.department) return true;
  
  // Public data
  if (data.visibility === 'public') return true;
  
  // Explicitly shared data
  if (data.shared_with?.includes(user.id)) return true;
  
  return false;
}

/**
 * Get role display name
 * @param {string} roleKey - Role key (admin, user, guest)
 * @returns {string} Display name
 */
export function getRoleName(roleKey) {
  return ROLES[roleKey]?.name || '未知';
}

/**
 * Get all permissions for a role
 * @param {string} roleKey - Role key
 * @returns {Array<string>} List of permissions
 */
export function getRolePermissions(roleKey) {
  return ROLES[roleKey]?.permissions || [];
}
