/**
 * Authentication Service Tests
 * 
 * Tests for the main authentication service.
 */

import { AuthService } from '../../../../src/frontend/desktop/services/auth/auth-service.js';

/**
 * Test service initialization
 */
export async function testServiceInitialization() {
  console.log('Testing service initialization...');
  
  const authService = new AuthService();
  await authService.init();
  
  if (!authService.deviceId) {
    throw new Error('Device ID should be initialized');
  }
  
  if (!authService.deviceId.startsWith('d_')) {
    throw new Error('Device ID should have correct format');
  }
  
  console.log('✓ Service initialized correctly');
}

/**
 * Test user setup
 */
export async function testUserSetup() {
  console.log('Testing user setup...');
  
  const authService = new AuthService();
  const userData = {
    userId: 'testuser',
    userName: '测试用户',
    department: 'dev',
    role: 'user'
  };
  
  const user = await authService.setup(userData);
  
  if (!user) {
    throw new Error('Setup should return user object');
  }
  if (user.id !== userData.userId) {
    throw new Error('User ID should match');
  }
  if (user.name !== userData.userName) {
    throw new Error('User name should match');
  }
  if (user.department !== userData.department) {
    throw new Error('Department should match');
  }
  
  // Check if authenticated
  if (!authService.isAuthenticated()) {
    throw new Error('User should be authenticated after setup');
  }
  
  // Cleanup
  await authService.logout();
  
  console.log('✓ User setup works correctly');
}

/**
 * Test authentication flow
 */
export async function testAuthenticationFlow() {
  console.log('Testing authentication flow...');
  
  const authService = new AuthService();
  
  // First, setup a user
  const userData = {
    userId: 'testuser2',
    userName: '测试用户2',
    department: 'qa',
    role: 'user'
  };
  await authService.setup(userData);
  
  // Create a new service instance to simulate app restart
  const newAuthService = new AuthService();
  const authenticatedUser = await newAuthService.authenticate();
  
  if (!authenticatedUser) {
    throw new Error('User should be authenticated');
  }
  if (authenticatedUser.id !== userData.userId) {
    throw new Error('Authenticated user ID should match');
  }
  
  // Cleanup
  await newAuthService.logout();
  
  console.log('✓ Authentication flow works correctly');
}

/**
 * Test logout
 */
export async function testLogout() {
  console.log('Testing logout...');
  
  const authService = new AuthService();
  
  // Setup a user
  const userData = {
    userId: 'testuser3',
    userName: '测试用户3',
    department: 'ops',
    role: 'user'
  };
  await authService.setup(userData);
  
  // Verify authenticated
  if (!authService.isAuthenticated()) {
    throw new Error('User should be authenticated');
  }
  
  // Logout
  await authService.logout();
  
  // Verify not authenticated
  if (authService.isAuthenticated()) {
    throw new Error('User should not be authenticated after logout');
  }
  if (authService.getCurrentUser() !== null) {
    throw new Error('Current user should be null after logout');
  }
  
  console.log('✓ Logout works correctly');
}

/**
 * Test auth headers
 */
export async function testAuthHeaders() {
  console.log('Testing auth headers...');
  
  const authService = new AuthService();
  
  // Without authentication
  const emptyHeaders = await authService.getAuthHeader();
  if (Object.keys(emptyHeaders).length > 0) {
    throw new Error('Headers should be empty without authentication');
  }
  
  // With authentication
  const userData = {
    userId: 'testuser4',
    userName: '测试用户4',
    department: 'product',
    role: 'user'
  };
  await authService.setup(userData);
  
  const headers = await authService.getAuthHeader();
  if (!headers.Authorization) {
    throw new Error('Authorization header should be present');
  }
  if (!headers.Authorization.startsWith('Bearer ')) {
    throw new Error('Authorization header should start with Bearer');
  }
  if (!headers['X-Device-Id']) {
    throw new Error('X-Device-Id header should be present');
  }
  
  // Cleanup
  await authService.logout();
  
  console.log('✓ Auth headers work correctly');
}

/**
 * Run all authentication service tests
 */
export async function runAuthServiceTests() {
  console.log('\n=== Authentication Service Tests ===\n');
  
  try {
    await testServiceInitialization();
    await testUserSetup();
    await testAuthenticationFlow();
    await testLogout();
    await testAuthHeaders();
    
    console.log('\n✓ All authentication service tests passed\n');
    return true;
  } catch (error) {
    console.error('\n✗ Authentication service tests failed:', error.message, '\n');
    return false;
  }
}
