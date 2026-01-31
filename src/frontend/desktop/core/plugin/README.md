# Plugin System Documentation

## Overview

The Localverse plugin system provides a comprehensive framework for extending the application with modular, isolated features. Plugins can:

- Have their own UI, styles, and logic
- Access system services (with permissions)
- Store data persistently
- Communicate with other plugins via events
- Be loaded/unloaded dynamically

## Architecture

### Core Components

1. **PluginLoader** - Manages plugin discovery, loading, and lifecycle
2. **Plugin (Base Class)** - Base class all plugins extend from
3. **EventBus** - Pub/sub system for plugin communication
4. **PluginStorage** - IndexedDB-based persistent storage per plugin
5. **PluginSettings** - Configuration management with validation

### Plugin Lifecycle

```
Discovery → Load Manifest → Validate → Check Dependencies
    ↓
Load Styles → Load Module → Create Context → Instantiate
    ↓
onInstall (first time) → onActivate → Running
    ↓
onDeactivate → onUninstall (removal)
```

## Creating a Plugin

### Directory Structure

```
plugins/
└── your-plugin/
    ├── manifest.json    # Plugin metadata (required)
    ├── index.js         # Entry point (required)
    ├── style.css        # Styles (optional)
    ├── icon.svg         # Icon (optional)
    └── locales/         # Translations (optional)
        ├── zh.json
        ├── en.json
        └── ja.json
```

### 1. Create manifest.json

```json
{
  "id": "your-plugin",
  "name": {
    "zh": "你的插件",
    "en": "Your Plugin",
    "ja": "あなたのプラグイン"
  },
  "version": "1.0.0",
  "description": {
    "zh": "插件描述",
    "en": "Plugin description",
    "ja": "プラグインの説明"
  },
  "author": "Your Name",
  "license": "MIT",
  
  "entry": "./index.js",
  "style": "./style.css",
  
  "minAppVersion": "1.0.0",
  
  "permissions": [
    "database:read",
    "database:write"
  ],
  
  "dependencies": {
    "services": ["DatabaseService"],
    "plugins": []
  },
  
  "settings": {
    "optionName": {
      "type": "boolean",
      "default": true,
      "label": {
        "zh": "选项名称",
        "en": "Option Name"
      }
    }
  },
  
  "exports": {
    "publicMethod": "methodName"
  }
}
```

### 2. Create index.js

```javascript
import { Plugin } from '../../desktop/core/plugin/plugin-base.js';

export default class YourPlugin extends Plugin {
  static id = 'your-plugin';
  
  // Lifecycle hooks
  async onInstall() {
    // First-time setup (create DB tables, etc.)
  }
  
  async onActivate() {
    // Called when plugin becomes active
  }
  
  async onDeactivate() {
    // Called when plugin is deactivated
  }
  
  async onUninstall() {
    // Cleanup when plugin is removed
  }
  
  async onSettingsChange(key, value, oldValue) {
    // React to setting changes
  }
  
  // Rendering
  render() {
    return `
      <div class="your-plugin">
        <h2>Your Plugin</h2>
        <button id="myButton">Click Me</button>
        <div id="content"></div>
      </div>
    `;
  }
  
  styles() {
    return `
      .your-plugin {
        padding: 20px;
      }
    `;
  }
  
  // Event binding
  bindEvents() {
    const btn = this.$('#myButton');
    if (btn) {
      btn.onclick = () => this.handleClick();
    }
  }
  
  handleClick() {
    alert('Button clicked!');
  }
}
```

### 3. Register Plugin

Add your plugin ID to `plugins/plugins.json`:

```json
{
  "plugins": ["your-plugin", "demo"]
}
```

## Plugin API

### Context

Each plugin receives a context object with:

```javascript
{
  manifest,      // Plugin manifest
  services,      // Allowed services (based on permissions)
  eventBus,      // Event system
  storage,       // Persistent storage
  settings,      // Settings manager
  i18n,          // Internationalization
  router         // Router for navigation
}
```

### Base Class Methods

#### Lifecycle
- `async onInstall()` - First-time installation
- `async onActivate()` - Plugin activated
- `async onDeactivate()` - Plugin deactivated
- `async onUninstall()` - Plugin removed
- `async onSettingsChange(key, value, oldValue)` - Setting changed

#### Rendering
- `render()` - Return HTML string
- `styles()` - Return CSS string
- `mount(container)` - Mount to DOM element
- `unmount()` - Remove from DOM
- `setState(newState)` - Update state and re-render

#### DOM Utilities
- `$(selector)` - Query single element in plugin container
- `$$(selector)` - Query all elements in plugin container

#### Events
- `emit(event, data)` - Emit plugin event
- `on(event, handler)` - Subscribe to event
- `bindEvents()` - Override to bind DOM events

#### Services
- `callService(serviceName, method, ...args)` - Call service method

#### Storage
- Via `this.storage`:
  - `get(key)` - Get value
  - `set(key, value)` - Set value
  - `remove(key)` - Remove value
  - `clear()` - Clear all data

#### Settings
- `getSetting(key)` - Get setting value
- `setSetting(key, value)` - Update setting

#### Utilities
- `t(key, params)` - Translate text
- `generateId(prefix)` - Generate unique ID
- `escapeHtml(text)` - Escape HTML
- `getCurrentUserId()` - Get current user ID
- `getCurrentUserName()` - Get current user name
- `navigate(path)` - Navigate to route

## Permissions

Available permissions:

- `database:read` - Read from database
- `database:write` - Write to database
- `filesystem:read` - Read files
- `filesystem:write` - Write files
- `filesystem:watch` - Watch file changes
- `network:local` - Local network access
- `network:sync` - Sync server access
- `notification` - Send notifications
- `clipboard:read` - Read clipboard
- `clipboard:write` - Write clipboard

## Events

### System Events

- `plugin:loaded` - Plugin loaded
- `plugin:unloaded` - Plugin unloaded
- `app:ready` - Application ready

### Plugin Events

Plugins can emit custom events:

```javascript
// Emit
this.emit('myEvent', { data: 'value' });

// Listen
this.on('plugin-id:myEvent', (data) => {
  console.log('Event received:', data);
});
```

## Testing

Test your plugin:

1. Open `src/frontend/plugin-test.html` in a browser
2. Click "Load Plugins"
3. Click "Show Demo Plugin"
4. Check console for logs

## Examples

See the demo plugin in `src/frontend/plugins/demo/` for a complete working example.

## Best Practices

1. **Validate input** - Always validate and sanitize user input
2. **Error handling** - Use try-catch for async operations
3. **Clean up** - Release resources in onDeactivate/onUninstall
4. **Performance** - Avoid heavy operations in render()
5. **Security** - Request only needed permissions
6. **I18n** - Support multiple languages
7. **Testing** - Test plugin in isolation
8. **Documentation** - Document your plugin's API

## Troubleshooting

### Plugin not loading

1. Check manifest.json is valid JSON
2. Verify plugin ID matches directory name
3. Check console for errors
4. Ensure dependencies are available

### Services not available

1. Check permissions in manifest
2. Verify service exists in app
3. Check service initialization

### Storage not working

1. Check IndexedDB is supported
2. Verify no browser restrictions
3. Check for errors in console

## Next Steps

- Create Finder plugin (file browser)
- Create Wiki plugin (knowledge base)
- Add plugin marketplace
- Implement hot-reload for development
