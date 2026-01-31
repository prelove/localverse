# Plugin System

Localverse plugin system provides a complete framework for building and loading plugins.

## Features

- ✅ Plugin lifecycle management (install, activate, deactivate, uninstall)
- ✅ Isolated storage per plugin (IndexedDB)
- ✅ Settings with schema validation
- ✅ Event bus for plugin communication
- ✅ Permission-based access control
- ✅ Internationalization support
- ✅ Dependency resolution
- ✅ Shadow DOM for UI isolation

## Usage

### Creating a Plugin

```javascript
import { Plugin } from '../core/plugin/index.js';

export default class MyPlugin extends Plugin {
  static id = 'my-plugin';
  
  async onActivate() {
    console.log('Plugin activated!');
    
    // Use storage
    await this.storage.set('lastVisit', Date.now());
    
    // Listen to events
    this.on('some-event', (data) => {
      console.log('Received event:', data);
    });
  }
  
  render() {
    return `
      <div class="my-plugin">
        <h2>${this.t('title')}</h2>
        <button id="action-btn">
          ${this.t('action')}
        </button>
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
      .my-plugin {
        padding: 20px;
        background: var(--bg-primary);
      }
      button {
        padding: 10px 20px;
        background: var(--accent-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;
  }
  
  bindEvents() {
    const btn = this.$('#action-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.handleAction();
      });
    }
  }
  
  async handleAction() {
    const value = await this.getSetting('enabled');
    console.log('Setting value:', value);
    
    // Call a service
    const results = await this.callService('SearchService', 'search', 'query');
    console.log('Search results:', results);
    
    // Emit an event
    this.emit('action-performed', { timestamp: Date.now() });
  }
}
```

### Plugin Manifest (manifest.json)

```json
{
  "id": "my-plugin",
  "name": {
    "zh": "我的插件",
    "en": "My Plugin"
  },
  "version": "1.0.0",
  "entry": "./index.js",
  "style": "./style.css",
  "permissions": [
    "database:read",
    "database:write",
    "search"
  ],
  "dependencies": {
    "services": ["DatabaseService", "SearchService"],
    "plugins": []
  },
  "settings": {
    "enabled": {
      "type": "boolean",
      "default": true
    },
    "maxItems": {
      "type": "number",
      "min": 1,
      "max": 100,
      "default": 10
    }
  },
  "exports": {
    "search": "doSearch"
  }
}
```

### Loading Plugins

```javascript
import { PluginLoader, EventBus } from './core/plugin/index.js';

// Create event bus
const eventBus = new EventBus();

// Create plugin loader
const pluginLoader = new PluginLoader({
  pluginsDir: '/plugins',
  services: {
    DatabaseService: dbService,
    SearchService: searchService
  },
  eventBus
});

// Load all plugins
await pluginLoader.loadAll();

// Get a specific plugin
const myPlugin = pluginLoader.get('my-plugin');

// Mount plugin to container
const container = document.getElementById('plugin-container');
myPlugin.mount(container);

// Call exported method
const results = await pluginLoader.call('my-plugin', 'search', 'query');
```

## API Reference

### Plugin Base Class

#### Lifecycle Hooks

- `async onInstall()` - Called when plugin is installed for the first time
- `async onActivate()` - Called when plugin is activated
- `async onDeactivate()` - Called when plugin is deactivated
- `async onUninstall()` - Called when plugin is uninstalled
- `async onSettingsChange(key, value, oldValue)` - Called when settings change

#### Rendering

- `render()` - Return HTML string for plugin UI
- `styles()` - Return CSS string for plugin styles
- `mount(container)` - Mount plugin to DOM container
- `unmount()` - Unmount plugin from DOM

#### State Management

- `get state()` - Get current state
- `setState(newState)` - Update state and re-render

#### DOM Utilities

- `$(selector)` - Query single element in shadow root
- `$$(selector)` - Query all elements in shadow root

#### Events

- `emit(event, data)` - Emit plugin event
- `on(event, handler)` - Listen to event

#### Services

- `async callService(serviceName, method, ...args)` - Call a service method

#### Storage

- `storage.get(key)` - Get value from storage
- `storage.set(key, value)` - Set value in storage
- `storage.remove(key)` - Remove value from storage
- `storage.clear()` - Clear all storage

#### Settings

- `getSetting(key)` - Get setting value
- `async setSetting(key, value)` - Set setting value

#### I18n

- `t(key, params)` - Translate a key

#### Utilities

- `generateId(prefix)` - Generate unique ID
- `escapeHtml(text)` - Escape HTML text
- `getCurrentUserId()` - Get current user ID
- `getCurrentUserName()` - Get current user name

### PluginLoader

- `async loadAll()` - Load all plugins
- `async load(pluginId)` - Load specific plugin
- `async unload(pluginId)` - Unload plugin
- `get(pluginId)` - Get plugin instance
- `getAll()` - Get all plugin instances
- `getManifest(pluginId)` - Get plugin manifest
- `getAllManifests()` - Get all manifests
- `async call(pluginId, method, ...args)` - Call exported method

### EventBus

- `on(event, handler)` - Listen to event
- `once(event, handler)` - Listen to event once
- `off(event, handler)` - Remove event listener
- `emit(event, data)` - Emit event
- `async emitAsync(event, data)` - Emit event asynchronously
- `wait(event, timeout)` - Wait for event

### PermissionManager

- `grant(pluginId, permissions)` - Grant permissions
- `revoke(pluginId, permission)` - Revoke permission
- `revokeAll(pluginId)` - Revoke all permissions
- `hasPermission(pluginId, permission)` - Check permission
- `getGranted(pluginId)` - Get granted permissions
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
- `network:local` - Access local network
- `network:sync` - Access sync server
- `notification` - Send notifications
- `clipboard:read` - Read clipboard
- `clipboard:write` - Write clipboard
- `search` - Use search service

## Plugin Directory Structure

```
plugins/
├── plugins.json          # List of available plugins
├── my-plugin/
│   ├── manifest.json     # Plugin manifest
│   ├── index.js          # Entry point
│   ├── style.css         # Styles (optional)
│   └── locales/          # Translations (optional)
│       ├── zh.json
│       ├── en.json
│       └── ja.json
└── another-plugin/
    └── ...
```

## Examples

See the `/plugins/demo` directory for a complete example plugin.

## Database Schema

Plugins require this database table:

```sql
CREATE TABLE IF NOT EXISTS plugin_installs (
  plugin_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  updated_at INTEGER
);
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

Run tests with:

```bash
npm test
```

Or open `tests/plugin-system.test.html` in browser.

## License

MIT
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
