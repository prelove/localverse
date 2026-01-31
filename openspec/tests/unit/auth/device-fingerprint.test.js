/**
 * Device Fingerprint Tests
 * 
 * Tests for device fingerprint generation and platform detection.
 */

import { generateDeviceId, detectPlatform } from '../../../../src/frontend/desktop/services/auth/device-fingerprint.js';

/**
 * Test device fingerprint generation
 */
export async function testDeviceFingerprintGeneration() {
  console.log('Testing device fingerprint generation...');
  
  const deviceId = await generateDeviceId();
  
  // Check format
  if (!deviceId.startsWith('d_')) {
    throw new Error('Device ID should start with "d_"');
  }
  
  // Check length (d_ + 16 hex chars)
  if (deviceId.length !== 18) {
    throw new Error(`Device ID length should be 18, got ${deviceId.length}`);
  }
  
  // Check hex format
  const hexPart = deviceId.substring(2);
  if (!/^[0-9a-f]+$/.test(hexPart)) {
    throw new Error('Device ID should contain only hex characters after prefix');
  }
  
  console.log('✓ Device ID format is correct:', deviceId);
}

/**
 * Test device fingerprint stability
 */
export async function testDeviceFingerprintStability() {
  console.log('Testing device fingerprint stability...');
  
  const deviceId1 = await generateDeviceId();
  const deviceId2 = await generateDeviceId();
  
  if (deviceId1 !== deviceId2) {
    throw new Error('Device ID should be stable across multiple calls');
  }
  
  console.log('✓ Device fingerprint is stable');
}

/**
 * Test platform detection
 */
export function testPlatformDetection() {
  console.log('Testing platform detection...');
  
  const platform = detectPlatform();
  
  const validPlatforms = ['windows', 'macos', 'linux', 'android', 'ios', 'unknown'];
  if (!validPlatforms.includes(platform)) {
    throw new Error(`Invalid platform: ${platform}`);
  }
  
  console.log('✓ Platform detected:', platform);
}

/**
 * Run all device fingerprint tests
 */
export async function runDeviceFingerprintTests() {
  console.log('\n=== Device Fingerprint Tests ===\n');
  
  try {
    await testDeviceFingerprintGeneration();
    await testDeviceFingerprintStability();
    testPlatformDetection();
    
    console.log('\n✓ All device fingerprint tests passed\n');
    return true;
  } catch (error) {
    console.error('\n✗ Device fingerprint tests failed:', error.message, '\n');
    return false;
  }
}
