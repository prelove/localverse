/**
 * Permission Tests
 * 
 * Tests for permission checking and role-based access control.
 */

import { 
  hasPermission, 
  canAccessData, 
  getRoleName, 
  getRolePermissions 
} from '../../../../src/frontend/desktop/services/auth/permission.js';

/**
 * Test admin permissions
 */
export function testAdminPermissions() {
  console.log('Testing admin permissions...');
  
  const adminUser = { role: 'admin', id: 'admin1', department: 'admin' };
  
  // Admin should have all permissions
  if (!hasPermission(adminUser, 'card:create')) {
    throw new Error('Admin should have card:create permission');
  }
  if (!hasPermission(adminUser, 'task:delete')) {
    throw new Error('Admin should have task:delete permission');
  }
  if (!hasPermission(adminUser, 'any:permission')) {
    throw new Error('Admin should have any permission');
  }
  
  console.log('✓ Admin permissions work correctly');
}

/**
 * Test user permissions
 */
export function testUserPermissions() {
  console.log('Testing user permissions...');
  
  const regularUser = { role: 'user', id: 'user1', department: 'dev' };
  
  // User should have standard permissions
  if (!hasPermission(regularUser, 'card:create')) {
    throw new Error('User should have card:create permission');
  }
  if (!hasPermission(regularUser, 'task:read')) {
    throw new Error('User should have task:read permission');
  }
  
  // User should not have non-existent permissions
  if (hasPermission(regularUser, 'system:admin')) {
    throw new Error('User should not have system:admin permission');
  }
  
  console.log('✓ User permissions work correctly');
}

/**
 * Test guest permissions
 */
export function testGuestPermissions() {
  console.log('Testing guest permissions...');
  
  const guestUser = { role: 'guest', id: 'guest1', department: 'guest' };
  
  // Guest should have read-only permissions
  if (!hasPermission(guestUser, 'card:read')) {
    throw new Error('Guest should have card:read permission');
  }
  if (!hasPermission(guestUser, 'task:read')) {
    throw new Error('Guest should have task:read permission');
  }
  
  // Guest should not have write permissions
  if (hasPermission(guestUser, 'card:create')) {
    throw new Error('Guest should not have card:create permission');
  }
  if (hasPermission(guestUser, 'task:delete')) {
    throw new Error('Guest should not have task:delete permission');
  }
  
  console.log('✓ Guest permissions work correctly');
}

/**
 * Test data access control
 */
export function testDataAccessControl() {
  console.log('Testing data access control...');
  
  const user1 = { role: 'user', id: 'user1', department: 'dev' };
  const user2 = { role: 'user', id: 'user2', department: 'qa' };
  const adminUser = { role: 'admin', id: 'admin1', department: 'admin' };
  
  // Own data
  const ownData = { created_by: 'user1' };
  if (!canAccessData(user1, ownData)) {
    throw new Error('User should access own data');
  }
  if (canAccessData(user2, ownData)) {
    throw new Error('Other user should not access private data');
  }
  
  // Department data
  const deptData = { created_by: 'user3', department: 'dev' };
  if (!canAccessData(user1, deptData)) {
    throw new Error('User should access department data');
  }
  if (canAccessData(user2, deptData)) {
    throw new Error('User from other department should not access department data');
  }
  
  // Public data
  const publicData = { created_by: 'user3', visibility: 'public' };
  if (!canAccessData(user1, publicData)) {
    throw new Error('User should access public data');
  }
  if (!canAccessData(user2, publicData)) {
    throw new Error('User should access public data');
  }
  
  // Shared data
  const sharedData = { created_by: 'user3', shared_with: ['user1'] };
  if (!canAccessData(user1, sharedData)) {
    throw new Error('User should access shared data');
  }
  if (canAccessData(user2, sharedData)) {
    throw new Error('User should not access data not shared with them');
  }
  
  // Admin access
  if (!canAccessData(adminUser, ownData)) {
    throw new Error('Admin should access all data');
  }
  if (!canAccessData(adminUser, deptData)) {
    throw new Error('Admin should access all data');
  }
  
  console.log('✓ Data access control works correctly');
}

/**
 * Test role name retrieval
 */
export function testRoleName() {
  console.log('Testing role name retrieval...');
  
  if (getRoleName('admin') !== '管理员') {
    throw new Error('Admin role name should be "管理员"');
  }
  if (getRoleName('user') !== '普通用户') {
    throw new Error('User role name should be "普通用户"');
  }
  if (getRoleName('guest') !== '访客') {
    throw new Error('Guest role name should be "访客"');
  }
  if (getRoleName('invalid') !== '未知') {
    throw new Error('Invalid role should return "未知"');
  }
  
  console.log('✓ Role name retrieval works correctly');
}

/**
 * Test role permissions retrieval
 */
export function testRolePermissions() {
  console.log('Testing role permissions retrieval...');
  
  const adminPerms = getRolePermissions('admin');
  if (!adminPerms.includes('*')) {
    throw new Error('Admin should have wildcard permission');
  }
  
  const userPerms = getRolePermissions('user');
  if (!userPerms.includes('card:create')) {
    throw new Error('User permissions should include card:create');
  }
  
  const guestPerms = getRolePermissions('guest');
  if (!guestPerms.includes('card:read')) {
    throw new Error('Guest permissions should include card:read');
  }
  if (guestPerms.includes('card:create')) {
    throw new Error('Guest permissions should not include card:create');
  }
  
  console.log('✓ Role permissions retrieval works correctly');
}

/**
 * Run all permission tests
 */
export async function runPermissionTests() {
  console.log('\n=== Permission Tests ===\n');
  
  try {
    testAdminPermissions();
    testUserPermissions();
    testGuestPermissions();
    testDataAccessControl();
    testRoleName();
    testRolePermissions();
    
    console.log('\n✓ All permission tests passed\n');
    return true;
  } catch (error) {
    console.error('\n✗ Permission tests failed:', error.message, '\n');
    return false;
  }
}
