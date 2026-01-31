# Localverse Plugin System

## Overview

The plugin system enables extensibility of Localverse OS through modular, isolated components.

## Quick Start

### Creating a Plugin

1. Create a plugin directory under `/plugins/<plugin-id>/`
2. Add `manifest.json` with plugin metadata
3. Create `index.js` with your plugin class
4. Optionally add `style.css` and `locales/*.json`

### Example Plugin Structure

```
plugins/
└── my-plugin/
    ├── manifest.json
    ├── index.js
    ├── style.css
    ├── icon.svg
    └── locales/
        ├── en.json
        ├── zh.json
        └── ja.json
```

### Minimal Plugin

```javascript
import { Plugin } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

class MyPlugin extends Plugin {
  static id = 'my-plugin';
  
  render() {
    return '<div>Hello from My Plugin!</div>';
  }
}

export default MyPlugin;
```

### Manifest.json

```json
{
  "id": "my-plugin",
  "name": { "en": "My Plugin" },
  "version": "1.0.0",
  "entry": "./index.js",
  "permissions": []
}
```

## Plugin Lifecycle

1. **onInstall()** - Called once when first installed
2. **onActivate()** - Called every time app starts
3. **onDeactivate()** - Called when plugin is deactivated
4. **onUninstall()** - Called when plugin is removed

## API Reference

### Plugin Base Class

#### Lifecycle Methods
- `onInstall()` - First install
- `onActivate()` - Activation
- `onDeactivate()` - Deactivation
- `onUninstall()` - Removal

#### Rendering
- `render()` - Return HTML string
- `styles()` - Return CSS string
- `mount(container)` - Mount to DOM
- `unmount()` - Remove from DOM

#### State Management
- `state` - Get current state
- `setState(newState)` - Update state and re-render

#### DOM Utilities
- `$(selector)` - Query selector in shadow root
- `$$(selector)` - Query all in shadow root

#### Events
- `emit(event, data)` - Emit plugin event
- `on(event, handler)` - Listen to event

#### Services
- `callService(serviceName, method, ...args)` - Call system service

#### Internationalization
- `t(key, params)` - Translate text

#### Settings
- `getSetting(key)` - Get setting value
- `setSetting(key, value)` - Set setting value

### Plugin Context

Available in `this.context`:
- `manifest` - Plugin manifest
- `services` - Available services (filtered by permissions)
- `eventBus` - Event bus instance
- `storage` - Plugin storage (IndexedDB)
- `settings` - Settings manager
- `i18n` - Internationalization
- `ui` - UI helpers (modals, toasts, etc.)

## Permissions

Available permissions:
- `database:read` - Read from database
- `database:write` - Write to database
- `filesystem:read` - Read files
- `filesystem:write` - Write files
- `network:local` - Local network access
- `network:sync` - Sync server access
- `notification` - Show notifications
- `clipboard:read` - Read clipboard
- `clipboard:write` - Write clipboard
- `search` - Use search service

## Plugin Storage

Each plugin has isolated IndexedDB storage:

```javascript
// Store data
await this.storage.set('key', value);

// Retrieve data
const value = await this.storage.get('key');

// Remove data
await this.storage.remove('key');

// Clear all
await this.storage.clear();
```

## Settings

Define settings in manifest:

```json
{
  "settings": {
    "option1": {
      "type": "boolean",
      "default": true,
      "label": { "en": "Enable feature" }
    }
  }
}
```

Access in plugin:

```javascript
const value = this.getSetting('option1');
await this.setSetting('option1', false);
```

## Inter-Plugin Communication

### Events

```javascript
// Plugin A: Emit event
this.emit('data_changed', { id: 123 });

// Plugin B: Listen to event
this.on('plugin-a:data_changed', (data) => {
  console.log('Data changed:', data);
});
```

### Exported Methods

Define in manifest:

```json
{
  "exports": {
    "search": "performSearch"
  }
}
```

Call from another plugin:

```javascript
const results = await this.context.pluginLoader.call('finder', 'search', 'query');
```

## Example: Hello Plugin

See `/plugins/hello/` for a complete working example that demonstrates:
- Lifecycle hooks
- Rendering and styles
- State management
- Settings
- Events
- Internationalization

## Testing

Test your plugin by:
1. Adding it to `/plugins/plugins.json`
2. Reloading the application
3. Navigating to `/plugin/your-plugin-id`

Check console for lifecycle logs and errors.

## Best Practices

1. **Use Shadow DOM** - Styles are automatically isolated
2. **Validate inputs** - Always sanitize user input
3. **Handle errors** - Use try-catch in async methods
4. **Clean up** - Remove listeners in `onDeactivate()`
5. **Test permissions** - Request only needed permissions
6. **Internationalize** - Support multiple languages
7. **Document** - Add README for your plugin

## Troubleshooting

### Plugin not loading
- Check console for errors
- Verify manifest.json is valid JSON
- Ensure plugin ID matches directory name
- Check entry file path is correct

### Permission errors
- Add required permissions to manifest
- Check permission spelling

### Storage not working
- Ensure IndexedDB is available
- Check browser console for errors

## Resources

- [Plugin System Spec](../openspec/specs/08-plugin-system.md)
- [Task Documentation](../openspec/tasks/phase-0/task-006-plugin-system.md)
- [Example Plugins](../openspec/specs/plugins/)
