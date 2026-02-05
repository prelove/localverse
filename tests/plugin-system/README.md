# Plugin System Tests

## Overview

This directory contains tests for the Localverse plugin system.

## Test Files

- `basic-tests.js` - Unit tests for core plugin system components

## Running Tests

Since the plugin system is browser-based, tests need to run in a browser environment or Node.js with appropriate polyfills.

### Browser Testing

Open the test file in a browser with ES6 module support:

```html
<script type="module" src="./basic-tests.js"></script>
```

### Node.js Testing

If using Node.js with ES modules:

```bash
node --experimental-modules tests/plugin-system/basic-tests.js
```

Note: IndexedDB tests require a browser environment or jsdom.

## Test Coverage

### EventBus
- ✓ Event emission and handling
- ✓ Once-only handlers
- ✓ Handler removal
- ✓ Wildcard event handling

### PluginSettings
- ✓ Default value loading
- ✓ Setting validation (boolean, number, string, etc.)
- ✓ Min/max validation for numbers
- ✓ Pattern validation for strings

### PermissionManager
- ✓ Permission granting
- ✓ Permission checking
- ✓ Wildcard permissions
- ✓ Permission revocation

## Future Tests

- [ ] PluginLoader integration tests
- [ ] PluginStorage IndexedDB tests
- [ ] Plugin lifecycle tests
- [ ] Inter-plugin communication tests
- [ ] Permission filtering tests
- [ ] Plugin dependency resolution tests

## Notes

- Tests should be browser-compatible
- Mock browser APIs when necessary
- Keep tests isolated and independent
- Use descriptive test names
- Add new tests when fixing bugs
