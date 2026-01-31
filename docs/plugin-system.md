# Localverse Plugin System

## Overview

The Localverse plugin system provides a powerful, secure framework for extending the application with custom functionality. Plugins run in isolated contexts with controlled access to system services.

## Architecture

### Core Components

1. **Plugin Base Class** - Abstract base class all plugins extend from
2. **PluginLoader** - Discovers, loads, and manages plugin lifecycle
3. **EventBus** - Inter-plugin and plugin-app communication
4. **PluginStorage** - Isolated IndexedDB storage per plugin
5. **PluginSettings** - Schema-validated configuration management
6. **PluginI18n** - Multi-language translation support
7. **PermissionManager** - Fine-grained access control

## Creating a Plugin

### 1. Plugin Structure

```
my-plugin/
├── manifest.json       # Plugin metadata and configuration
├── index.js           # Main plugin code
├── style.css          # Optional styles
└── locales/           # Optional translations
    ├── zh.json
    └── en.json
```

### 2. Manifest File

```json
{
  "id": "my-plugin",
  "name": {
    "zh": "我的插件",
    "en": "My Plugin"
  },
  "version": "1.0.0",
  "description": {
    "zh": "插件描述",
    "en": "Plugin description"
  },
  "author": "Your Name",
  "entry": "./index.js",
  "style": "./style.css",
  "permissions": [
    "database:read",
    "database:write",
    "notification"
  ],
  "dependencies": {
    "services": ["DatabaseService"],
    "plugins": []
  },
  "settings": {
    "enabled": {
      "type": "boolean",
      "default": true
    }
  },
  "exports": {
    "publicMethod": "internalMethod"
  }
}
```

### 3. Plugin Code

```javascript
import { Plugin } from '../../core/plugin/plugin-base.js';

export default class MyPlugin extends Plugin {
  static id = 'my-plugin';
  
  async onActivate() {
    // Called when plugin is activated
  }
  
  render() {
    return `<div>My Plugin Content</div>`;
  }
  
  styles() {
    return `
      .my-plugin { padding: 20px; }
    `;
  }
  
  bindEvents() {
    // Bind DOM event handlers
  }
}
```

## Plugin Lifecycle

1. **Discovery** - PluginLoader finds plugin via plugins.json
2. **Load Manifest** - Read and validate manifest.json
3. **Check Dependencies** - Ensure required services/plugins exist
4. **Load Module** - Import plugin JavaScript module
5. **Create Context** - Initialize storage, settings, i18n
6. **Instantiate** - Create plugin instance
7. **Install** - Call `onInstall()` (first time only)
8. **Activate** - Call `onActivate()`
9. **Run** - Plugin is active and mounted
10. **Deactivate** - Call `onDeactivate()` when unloading

## API Reference

### Lifecycle Hooks

- `onInstall()` - First-time installation
- `onUninstall()` - Plugin removal
- `onActivate()` - Plugin activation
- `onDeactivate()` - Plugin deactivation
- `onSettingsChange(key, value, oldValue)` - Setting changed

### Rendering

- `render()` - Return HTML string
- `styles()` - Return CSS string
- `mount(container)` - Mount plugin to DOM
- `unmount()` - Unmount plugin from DOM

### State Management

- `state` - Get current state
- `setState(updates)` - Update state and re-render

### DOM Utilities

- `$(selector)` - Query selector in shadow root
- `$$(selector)` - Query all in shadow root
- `bindEvents()` - Bind event handlers

### Events

- `emit(event, data)` - Emit plugin event
- `on(event, handler)` - Listen to event

### Services

- `callService(name, method, ...args)` - Call service method

### Storage

- `storage.get(key)` - Get stored value
- `storage.set(key, value)` - Store value
- `storage.remove(key)` - Remove value
- `storage.clear()` - Clear all data

### Settings

- `getSetting(key)` - Get setting value
- `setSetting(key, value)` - Update setting

### Internationalization

- `t(key, params)` - Translate text

### Utilities

- `generateId(prefix)` - Generate unique ID
- `escapeHtml(text)` - Escape HTML (XSS prevention)
- `getCurrentUserId()` - Get current user ID
- `getCurrentUserName()` - Get current user name

## Permissions

Available permissions:

- `database:read` - Read from database
- `database:write` - Write to database
- `filesystem:read` - Read files
- `filesystem:write` - Write files
- `filesystem:watch` - Watch file changes
- `network:local` - Local network access
- `network:sync` - Sync server access
- `notification` - Show notifications
- `clipboard:read` - Read clipboard
- `clipboard:write` - Write clipboard

## Example Plugin

See `src/frontend/desktop/plugins/example/` for a complete working example.

## Loading Plugins

Plugins are automatically loaded from `/plugins` directory. Create a `plugins.json` file to list available plugins:

```json
{
  "plugins": ["example", "wiki", "finder"]
}
```

## Security

- Plugins run in Shadow DOM for style isolation
- Services filtered by declared permissions
- Settings validated against schema
- No eval() or unsafe code execution
- XSS protection via escapeHtml()

## Best Practices

1. Always declare required permissions
2. Use Shadow DOM for style isolation
3. Validate all user input
4. Handle errors gracefully
5. Clean up resources in onDeactivate()
6. Use semantic versioning
7. Provide translations for all text
8. Test with different themes
9. Document exported methods
10. Follow JavaScript naming conventions

## Troubleshooting

### Plugin won't load
- Check manifest.json syntax
- Verify entry file exists
- Check browser console for errors
- Ensure dependencies are satisfied

### Styles not applied
- Verify shadow DOM rendering
- Check CSS syntax
- Ensure styles() method returns string

### Settings not persisting
- Check localStorage availability
- Verify setting schema
- Ensure validation passes

## Further Reading

- [Plugin System Spec](../../openspec/specs/08-plugin-system.md)
- [Task 006: Plugin System](../../openspec/tasks/phase-0/task-006-plugin-system.md)
- [Example Plugin Source](./plugins/example/)
