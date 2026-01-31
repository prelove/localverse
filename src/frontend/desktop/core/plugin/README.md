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
```

## Testing

Run tests with:

```bash
npm test
```

Or open `tests/plugin-system.test.html` in browser.

## License

MIT
