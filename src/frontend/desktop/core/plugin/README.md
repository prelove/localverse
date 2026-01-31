# Plugin System

Plugin system framework for Localverse OS 2.0.

## Components

- **plugin-base.js** - Base class for all plugins
- **plugin-loader.js** - Plugin discovery and lifecycle management
- **event-bus.js** - Event system for plugin communication
- **plugin-storage.js** - Isolated IndexedDB storage for plugins
- **plugin-settings.js** - Settings management with validation
- **plugin-i18n.js** - Internationalization support
- **permission-manager.js** - Permission system and access control

## Usage

```javascript
import { PluginLoader, EventBus, PermissionManager } from './core/plugin/index.js';

// Create instances
const eventBus = new EventBus();
const permissionManager = new PermissionManager();

// Create plugin loader
const pluginLoader = new PluginLoader({
  pluginsDir: '/plugins',
  services: {
    DatabaseService: databaseService,
    FileSystemService: fileSystemService,
    // ... other services
  },
  eventBus,
  permissionManager
});

// Load all plugins
await pluginLoader.loadAll();

// Get plugin instance
const myPlugin = pluginLoader.get('my-plugin-id');

// Call exported method
const result = await pluginLoader.call('my-plugin-id', 'search', 'query');
```

## Creating a Plugin

See `/plugins/hello-world/` for a complete example.

### Directory Structure

```
plugins/my-plugin/
├── manifest.json    # Plugin metadata (required)
├── index.js         # Plugin entry point (required)
├── style.css        # Plugin styles (optional)
├── locales/         # Translations (optional)
│   ├── zh.json
│   ├── en.json
│   └── ja.json
└── README.md        # Documentation (optional)
```

### manifest.json

```json
{
  "id": "my-plugin",
  "name": { "zh": "我的插件", "en": "My Plugin" },
  "version": "1.0.0",
  "entry": "./index.js",
  "style": "./style.css",
  "permissions": ["database:read", "notification"],
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
    "search": "search"
  }
}
```

### index.js

```javascript
import { Plugin } from '../../core/plugin/plugin-base.js';

class MyPlugin extends Plugin {
  static id = 'my-plugin';
  
  async onInstall() {
    console.log('Plugin installed');
  }
  
  async onActivate() {
    console.log('Plugin activated');
  }
  
  render() {
    return `<div>Hello from ${this.t('name')}</div>`;
  }
  
  // Exported method
  async search(query) {
    return [];
  }
}

export default MyPlugin;
```

## Events

- `plugin:loaded` - Emitted when plugin is loaded
- `plugin:unloaded` - Emitted when plugin is unloaded
- `{pluginId}:{event}` - Custom plugin events

## Permissions

- `database:read` - Read database
- `database:write` - Write database
- `filesystem:read` - Read files
- `filesystem:write` - Write files
- `filesystem:watch` - Watch file changes
- `network:local` - Access local JAR service
- `network:sync` - Access sync server
- `notification` - Send notifications
- `clipboard:read` - Read clipboard
- `clipboard:write` - Write clipboard

## See Also

- [Task 006 Specification](../../../../openspec/tasks/phase-0/task-006-plugin-system.md)
- [Plugin System Specification](../../../../openspec/specs/08-plugin-system.md)
