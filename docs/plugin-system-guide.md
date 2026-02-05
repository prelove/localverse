# Plugin System Implementation Guide

## Overview

The Localverse Plugin System provides a complete framework for building modular, extensible applications. It includes lifecycle management, sandboxing, inter-plugin communication, persistent storage, and configurable settings.

## Architecture

```
Plugin System
├── Core Components
│   ├── Plugin (Base Class)
│   ├── PluginLoader (Lifecycle Manager)
│   ├── EventBus (Inter-plugin Communication)
│   ├── PluginStorage (IndexedDB Persistence)
│   ├── PluginSettings (Configuration Management)
│   ├── PluginI18n (Internationalization)
│   └── PermissionManager (Access Control)
└── Example Plugins
    └── hello-world (Demo Plugin)
```

## Creating a Plugin

### 1. Plugin Structure

Every plugin must follow this structure:

```
my-plugin/
├── manifest.json       # Plugin metadata
├── index.js           # Main entry point
├── style.css          # Optional global styles
└── locales/           # Optional i18n
    ├── zh.json
    ├── en.json
    └── ja.json
```

### 2. Manifest.json

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
    "option1": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "选项1", "en": "Option 1" }
    }
  },
  "exports": {
    "myMethod": "publicMethod"
  }
}
```

### 3. Plugin Class

```javascript
import { Plugin } from '../../core/plugin/plugin-base.js';

class MyPlugin extends Plugin {
  static id = 'my-plugin';
  
  // Lifecycle hooks
  async onInstall() {
    // Called on first installation
    console.log('Plugin installed');
  }
  
  async onActivate() {
    // Called when plugin is activated
    console.log('Plugin activated');
  }
  
  async onDeactivate() {
    // Called when plugin is deactivated
    console.log('Plugin deactivated');
  }
  
  async onUninstall() {
    // Called when plugin is uninstalled
    console.log('Plugin uninstalled');
  }
  
  async onSettingsChange(key, value, oldValue) {
    // Called when settings change
    console.log(`Setting ${key} changed:`, oldValue, '→', value);
  }
  
  // Render UI
  render() {
    return `
      <div class="my-plugin">
        <h1>Hello from My Plugin!</h1>
        <button class="btn-action">Click Me</button>
      </div>
    `;
  }
  
  // Plugin styles (scoped to Shadow DOM)
  styles() {
    return `
      .my-plugin {
        padding: 20px;
      }
      button {
        padding: 10px 20px;
      }
    `;
  }
  
  // Bind event handlers
  bindEvents() {
    const btn = this.$('.btn-action');
    if (btn) {
      btn.onclick = () => this.handleAction();
    }
  }
  
  async handleAction() {
    // Your action handler
    alert('Button clicked!');
  }
}

export default MyPlugin;
```

## Plugin API

### Context Properties

Every plugin receives a context object with:

```javascript
{
  manifest,      // Plugin manifest
  services,      // Allowed services based on permissions
  eventBus,      // Event bus for inter-plugin communication
  storage,       // IndexedDB storage (scoped to plugin)
  settings,      // Settings manager
  i18n,          // Internationalization helper
  ui             // UI helpers (modal, toast, etc.)
}
```

### Base Class Methods

#### State Management
- `setState(newState)` - Update component state and re-render
- `state` - Access current state

#### DOM Access
- `$(selector)` - Query single element in Shadow DOM
- `$$(selector)` - Query all elements in Shadow DOM

#### Events
- `emit(event, data)` - Emit plugin-scoped event
- `on(event, handler)` - Listen to events
- `eventBus.emit(event, data)` - Emit global event

#### Services
- `callService(serviceName, method, ...args)` - Call service methods

#### Settings
- `getSetting(key)` - Get setting value
- `setSetting(key, value)` - Update setting value

#### Storage
- `storage.get(key)` - Get data from IndexedDB
- `storage.set(key, value)` - Save data to IndexedDB
- `storage.remove(key)` - Delete data
- `storage.clear()` - Clear all plugin data

#### Utilities
- `generateId(prefix)` - Generate unique ID
- `escapeHtml(text)` - Escape HTML entities
- `getCurrentUserId()` - Get current user ID
- `getCurrentUserName()` - Get current user name
- `t(key, params)` - Translate text

## Permissions

Available permissions:

| Permission | Description | Risk Level |
|------------|-------------|------------|
| `database:read` | Read from database | Low |
| `database:write` | Write to database | Medium |
| `filesystem:read` | Read files | Medium |
| `filesystem:write` | Write files | High |
| `filesystem:watch` | Watch file changes | Low |
| `network:local` | Access local network | Low |
| `network:sync` | Access sync server | Medium |
| `notification` | Send notifications | Low |
| `clipboard:read` | Read clipboard | Medium |
| `clipboard:write` | Write clipboard | Low |
| `search` | Use search service | Low |

## Loading Plugins

### Initialize Plugin System

```javascript
import { PluginLoader, EventBus } from './core/plugin/index.js';

const eventBus = new EventBus();
const pluginLoader = new PluginLoader({
  pluginsDir: '/plugins',
  services: {
    DatabaseService: dbService,
    SearchService: searchService,
    // ... other services
  },
  eventBus
});

// Load all plugins
await pluginLoader.loadAll();

// Load specific plugin
await pluginLoader.load('my-plugin');

// Get plugin instance
const plugin = pluginLoader.get('my-plugin');

// Mount plugin to DOM
const container = document.getElementById('plugin-container');
plugin.mount(container);
```

### Unload Plugin

```javascript
// Unload plugin
await pluginLoader.unload('my-plugin');
```

## Inter-Plugin Communication

### Event Bus

```javascript
// Plugin A - emit event
this.eventBus.emit('data:updated', { id: 123, value: 'new' });

// Plugin B - listen to event
this.eventBus.on('data:updated', (data) => {
  console.log('Data updated:', data);
});

// Wait for event
const data = await this.eventBus.wait('data:loaded', 5000);
```

### Plugin-to-Plugin Calls

```javascript
// In manifest.json, export methods:
{
  "exports": {
    "getData": "fetchData"
  }
}

// Other plugins can call:
const result = await pluginLoader.call('my-plugin', 'getData', arg1, arg2);
```

## Database Schema

Plugins use two tables:

```sql
-- Plugin installation tracking
CREATE TABLE plugin_installs (
  plugin_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Plugin configuration storage
CREATE TABLE plugin_config (
  plugin_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, key)
);
```

## Testing

### Unit Test Example

```javascript
import { Plugin } from './plugin-base.js';
import { EventBus } from './event-bus.js';

describe('Plugin System', () => {
  it('should create plugin instance', () => {
    const eventBus = new EventBus();
    const context = {
      manifest: { id: 'test', name: 'Test' },
      services: {},
      eventBus,
      storage: {},
      settings: {},
      i18n: {},
      ui: {}
    };
    
    const plugin = new Plugin(context);
    expect(plugin.id).toBe('test');
  });
});
```

## Best Practices

1. **Always use Shadow DOM** - Prevents style conflicts
2. **Clean up resources** - Clear timers in `unmount()` or `onDeactivate()`
3. **Handle errors gracefully** - Use try-catch in async methods
4. **Declare permissions** - Only request needed permissions
5. **Use settings for configuration** - Don't hardcode values
6. **Emit events for actions** - Allow other plugins to react
7. **Validate user input** - Always sanitize and validate
8. **Use i18n** - Support multiple languages
9. **Test thoroughly** - Write unit and integration tests

## Example: Hello World Plugin

See `/src/frontend/desktop/plugins/hello-world/` for a complete working example that demonstrates:

- ✅ Lifecycle hooks
- ✅ State management
- ✅ Event handling
- ✅ Settings management
- ✅ Storage persistence
- ✅ Shadow DOM rendering
- ✅ Internationalization

## Security Considerations

1. **Sandboxing** - Plugins run in Shadow DOM
2. **Permission System** - Fine-grained access control
3. **Service Filtering** - Only allowed services are accessible
4. **XSS Prevention** - Use `escapeHtml()` for user content
5. **Storage Isolation** - Each plugin has its own IndexedDB

## Next Steps

1. Create your plugin following the structure above
2. Add it to `/src/frontend/desktop/plugins/your-plugin/`
3. Register it in `/plugins/plugins.json`:
   ```json
   {
     "plugins": ["hello-world", "your-plugin"]
   }
   ```
4. Test loading and functionality
5. Document your plugin's API if it exports methods

## Support

- See task spec: `openspec/tasks/phase-0/task-006-plugin-system.md`
- Check example: `src/frontend/desktop/plugins/hello-world/`
- Plugin system code: `src/frontend/desktop/core/plugin/`
