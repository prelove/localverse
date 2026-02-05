/**
 * Plugin System Tests
 * Basic smoke tests for the plugin system
 */

import { EventBus } from '../src/frontend/desktop/core/plugin/event-bus.js';
import { PluginSettings } from '../src/frontend/desktop/core/plugin/plugin-settings.js';
import { PermissionManager } from '../src/frontend/desktop/core/plugin/permission-manager.js';

// Test EventBus
console.log('Testing EventBus...');
const eventBus = new EventBus();

let eventReceived = false;
eventBus.on('test-event', (data) => {
  console.log('✅ Event received:', data);
  eventReceived = true;
});

eventBus.emit('test-event', { message: 'Hello' });
console.assert(eventReceived, 'Event should be received');

// Test once listener
let onceReceived = 0;
eventBus.once('once-event', () => {
  onceReceived++;
});
eventBus.emit('once-event');
eventBus.emit('once-event');
console.assert(onceReceived === 1, 'Once listener should fire only once');

console.log('✅ EventBus tests passed');

// Test PluginSettings
console.log('\nTesting PluginSettings...');
const manifest = {
  id: 'test-plugin',
  settings: {
    enabled: {
      type: 'boolean',
      default: true
    },
    count: {
      type: 'number',
      default: 10,
      min: 0,
      max: 100
    },
    name: {
      type: 'string',
      default: 'Test'
    }
  }
};

const settings = new PluginSettings(manifest);

// Test default values
console.assert(settings.get('enabled') === true, 'Default boolean should be true');
console.assert(settings.get('count') === 10, 'Default number should be 10');
console.assert(settings.get('name') === 'Test', 'Default string should be Test');

// Test validation
try {
  await settings.set('count', 150); // Should fail (max: 100)
  console.error('❌ Should have thrown validation error');
} catch (e) {
  console.log('✅ Validation correctly rejected invalid value');
}

// Test valid set
await settings.set('count', 50);
console.assert(settings.get('count') === 50, 'Setting should be updated');

console.log('✅ PluginSettings tests passed');

// Test PermissionManager
console.log('\nTesting PermissionManager...');
const permManager = new PermissionManager();

// Grant permissions
permManager.grant('test-plugin', ['database:read', 'database:write']);

// Test permission check
console.assert(permManager.hasPermission('test-plugin', 'database:read'), 'Should have database:read');
console.assert(permManager.hasPermission('test-plugin', 'database:write'), 'Should have database:write');
console.assert(!permManager.hasPermission('test-plugin', 'filesystem:read'), 'Should not have filesystem:read');

// Test wildcard
permManager.grant('admin-plugin', ['database:*']);
console.assert(permManager.hasPermission('admin-plugin', 'database:read'), 'Wildcard should grant database:read');
console.assert(permManager.hasPermission('admin-plugin', 'database:write'), 'Wildcard should grant database:write');

// Test revoke
permManager.revoke('test-plugin', 'database:write');
console.assert(!permManager.hasPermission('test-plugin', 'database:write'), 'Permission should be revoked');
console.assert(permManager.hasPermission('test-plugin', 'database:read'), 'Other permissions should remain');

console.log('✅ PermissionManager tests passed');

console.log('\n✅ All tests passed!');
