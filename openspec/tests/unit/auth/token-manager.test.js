/**
 * Token Manager Tests
 * 
 * Tests for token generation, validation, and storage.
 */

import { TokenManager } from '../../../../src/frontend/desktop/services/auth/token-manager.js';

/**
 * Test token generation
 */
export async function testTokenGeneration() {
  console.log('Testing token generation...');
  
  const tokenManager = new TokenManager();
  const userData = {
    userId: 'testuser',
    userName: '测试用户',
    department: 'dev',
    role: 'user'
  };
  const deviceId = 'd_test1234567890ab';
  
  const token = await tokenManager.generateToken(userData, deviceId);
  
  // Verify token structure
  if (!token.userId || token.userId !== userData.userId) {
    throw new Error('Token should contain userId');
  }
  if (!token.userName || token.userName !== userData.userName) {
    throw new Error('Token should contain userName');
  }
  if (!token.department || token.department !== userData.department) {
    throw new Error('Token should contain department');
  }
  if (!token.role || token.role !== userData.role) {
    throw new Error('Token should contain role');
  }
  if (!token.deviceId || token.deviceId !== deviceId) {
    throw new Error('Token should contain deviceId');
  }
  if (!token.signature || !token.signature.startsWith('sha256:')) {
    throw new Error('Token should have a valid signature');
  }
  if (!token.createdAt || typeof token.createdAt !== 'number') {
    throw new Error('Token should have createdAt timestamp');
  }
  if (!token.expiresAt || typeof token.expiresAt !== 'number') {
    throw new Error('Token should have expiresAt timestamp');
  }
  
  console.log('✓ Token generated correctly');
}

/**
 * Test token signature verification
 */
export async function testSignatureVerification() {
  console.log('Testing signature verification...');
  
  const tokenManager = new TokenManager();
  const userData = {
    userId: 'testuser',
    userName: '测试用户',
    department: 'dev',
    role: 'user'
  };
  const deviceId = 'd_test1234567890ab';
  
  const token = await tokenManager.generateToken(userData, deviceId);
  
  // Verify valid signature
  const isValid = await tokenManager.verifySignature(token);
  if (!isValid) {
    throw new Error('Valid token signature should verify');
  }
  
  // Test invalid signature
  const tamperedToken = { ...token, userId: 'attacker' };
  const isInvalid = await tokenManager.verifySignature(tamperedToken);
  if (isInvalid) {
    throw new Error('Tampered token should not verify');
  }
  
  console.log('✓ Signature verification works correctly');
}

/**
 * Test token expiration checking
 */
export async function testTokenExpiration() {
  console.log('Testing token expiration...');
  
  const tokenManager = new TokenManager();
  
  // Create a valid token
  const validToken = {
    userId: 'testuser',
    deviceId: 'd_test',
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 // 1 hour from now
  };
  
  if (tokenManager.isTokenExpired(validToken)) {
    throw new Error('Valid token should not be expired');
  }
  
  // Create an expired token
  const expiredToken = {
    userId: 'testuser',
    deviceId: 'd_test',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 31, // 31 days ago
    expiresAt: Date.now() - 1000 * 60 * 60 * 24 // 1 day ago
  };
  
  if (!tokenManager.isTokenExpired(expiredToken)) {
    throw new Error('Expired token should be detected');
  }
  
  console.log('✓ Token expiration checking works correctly');
}

/**
 * Test token refresh logic
 */
export async function testTokenRefresh() {
  console.log('Testing token refresh logic...');
  
  const tokenManager = new TokenManager();
  
  // Token expiring in 5 days (should refresh)
  const tokenNeedingRefresh = {
    userId: 'testuser',
    deviceId: 'd_test',
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000
  };
  
  if (!tokenManager.shouldRefreshToken(tokenNeedingRefresh)) {
    throw new Error('Token expiring in 5 days should need refresh');
  }
  
  // Token expiring in 15 days (should not refresh)
  const tokenNotNeedingRefresh = {
    userId: 'testuser',
    deviceId: 'd_test',
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 24 * 60 * 60 * 1000
  };
  
  if (tokenManager.shouldRefreshToken(tokenNotNeedingRefresh)) {
    throw new Error('Token expiring in 15 days should not need refresh');
  }
  
  console.log('✓ Token refresh logic works correctly');
}

/**
 * Test localStorage save and load
 */
export async function testLocalStoragePersistence() {
  console.log('Testing localStorage persistence...');
  
  const tokenManager = new TokenManager();
  const userData = {
    userId: 'testuser',
    userName: '测试用户',
    department: 'dev',
    role: 'user'
  };
  const deviceId = 'd_test1234567890ab';
  
  // Generate and save token
  const token = await tokenManager.generateToken(userData, deviceId);
  await tokenManager.saveToken(token);
  
  // Load token
  const loadedToken = await tokenManager.loadToken();
  
  if (!loadedToken) {
    throw new Error('Token should be loaded from storage');
  }
  
  if (JSON.stringify(token) !== JSON.stringify(loadedToken)) {
    throw new Error('Loaded token should match saved token');
  }
  
  // Clear token
  await tokenManager.clearToken();
  const clearedToken = await tokenManager.loadToken();
  
  if (clearedToken) {
    throw new Error('Token should be cleared from storage');
  }
  
  console.log('✓ localStorage persistence works correctly');
}

/**
 * Run all token manager tests
 */
export async function runTokenManagerTests() {
  console.log('\n=== Token Manager Tests ===\n');
  
  try {
    await testTokenGeneration();
    await testSignatureVerification();
    await testTokenExpiration();
    await testTokenRefresh();
    await testLocalStoragePersistence();
    
    console.log('\n✓ All token manager tests passed\n');
    return true;
  } catch (error) {
    console.error('\n✗ Token manager tests failed:', error.message, '\n');
    return false;
  }
}
