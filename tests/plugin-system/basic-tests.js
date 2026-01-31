/**
 * Plugin System Integration Test
 * Tests basic plugin loading and functionality
 */

// Test setup
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`);
  }
}

// Import plugin system components
import { EventBus } from '../../src/frontend/desktop/core/plugin/event-bus.js';
import { PluginStorage } from '../../src/frontend/desktop/core/plugin/plugin-storage.js';
import { PluginSettings } from '../../src/frontend/desktop/core/plugin/plugin-settings.js';
import { PermissionManager } from '../../src/frontend/desktop/core/plugin/permission-manager.js';

// Test EventBus
test('EventBus - emit and on', () => {
  const bus = new EventBus();
  let received = null;
  
  bus.on('test', (data) => { received = data; });
  bus.emit('test', { value: 42 });
  
  assertEquals(received.value, 42, 'Event data should be received');
});

test('EventBus - once handler', () => {
  const bus = new EventBus();
  let count = 0;
  
  bus.once('test', () => { count++; });
  bus.emit('test');
  bus.emit('test');
  
  assertEquals(count, 1, 'Once handler should only fire once');
});

test('EventBus - off removes handler', () => {
  const bus = new EventBus();
  let received = false;
  const handler = () => { received = true; };
  
  bus.on('test', handler);
  bus.off('test', handler);
  bus.emit('test');
  
  assertEquals(received, false, 'Handler should not fire after off()');
});

test('EventBus - wildcard handler', () => {
  const bus = new EventBus();
  let wildcardReceived = null;
  
  bus.on('*', (data) => { wildcardReceived = data; });
  bus.emit('anything', { test: true });
  
  assertEquals(wildcardReceived.event, 'anything', 'Wildcard should receive event name');
  assertEquals(wildcardReceived.data.test, true, 'Wildcard should receive event data');
});

// Test PluginSettings
test('PluginSettings - default values', () => {
  const manifest = {
    id: 'test',
    settings: {
      enabled: { type: 'boolean', default: true },
      count: { type: 'number', default: 10 }
    }
  };
  
  const settings = new PluginSettings(manifest);
  
  assertEquals(settings.get('enabled'), true, 'Should return default value');
  assertEquals(settings.get('count'), 10, 'Should return default value');
});

test('PluginSettings - validation', () => {
  const manifest = {
    id: 'test',
    settings: {
      port: { type: 'number', min: 1, max: 65535, default: 8080 }
    }
  };
  
  const settings = new PluginSettings(manifest);
  const config = manifest.settings.port;
  
  assertEquals(settings.validate('port', 8080, config), true, 'Valid number should pass');
  assertEquals(settings.validate('port', 0, config), false, 'Number below min should fail');
  assertEquals(settings.validate('port', 70000, config), false, 'Number above max should fail');
  assertEquals(settings.validate('port', 'abc', config), false, 'String should fail for number type');
});

// Test PermissionManager
test('PermissionManager - grant and check', () => {
  const pm = new PermissionManager();
  
  pm.grant('test-plugin', ['database:read', 'database:write']);
  
  assertEquals(pm.hasPermission('test-plugin', 'database:read'), true, 'Should have granted permission');
  assertEquals(pm.hasPermission('test-plugin', 'database:write'), true, 'Should have granted permission');
  assertEquals(pm.hasPermission('test-plugin', 'filesystem:read'), false, 'Should not have ungranted permission');
});

test('PermissionManager - wildcard permissions', () => {
  const pm = new PermissionManager();
  
  pm.grant('test-plugin', ['database:*']);
  
  assertEquals(pm.hasPermission('test-plugin', 'database:read'), true, 'Wildcard should grant sub-permissions');
  assertEquals(pm.hasPermission('test-plugin', 'database:write'), true, 'Wildcard should grant sub-permissions');
  assertEquals(pm.hasPermission('test-plugin', 'filesystem:read'), false, 'Wildcard should not grant unrelated permissions');
});

test('PermissionManager - revoke', () => {
  const pm = new PermissionManager();
  
  pm.grant('test-plugin', ['database:read']);
  assertEquals(pm.hasPermission('test-plugin', 'database:read'), true, 'Should have permission');
  
  pm.revoke('test-plugin', 'database:read');
  assertEquals(pm.hasPermission('test-plugin', 'database:read'), false, 'Should not have revoked permission');
});

// Print results
console.log('\n========== Test Results ==========');
console.log(`Total: ${testResults.passed + testResults.failed}`);
console.log(`Passed: ${testResults.passed}`);
console.log(`Failed: ${testResults.failed}`);
console.log('==================================\n');

if (testResults.failed > 0) {
  console.log('Failed tests:');
  testResults.tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  - ${t.name}: ${t.error}`);
  });
  process.exit(1);
} else {
  console.log('All tests passed! ✓');
  process.exit(0);
}
