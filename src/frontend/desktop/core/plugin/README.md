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
# 插件系统

Localverse OS 的核心插件框架，支持动态加载、生命周期管理和插件间通信。

## 特性

- ✅ **动态加载**：运行时加载/卸载插件
- ✅ **生命周期管理**：install → activate → deactivate → uninstall
- ✅ **权限系统**：细粒度权限控制
- ✅ **事件总线**：插件间通信
- ✅ **独立存储**：每个插件有独立的 IndexedDB 存储空间
- ✅ **样式隔离**：Shadow DOM 实现样式隔离
- ✅ **依赖管理**：插件依赖检查和版本管理

## 快速开始

### 1. 初始化插件管理器

```javascript
import { PluginManager } from './core/plugin/index.js';

const pluginManager = new PluginManager({
  database: databaseService,
  filesystem: filesystemService,
  // ... 其他服务
});

await pluginManager.init({
  i18n: i18nService,
  authService: authService,
  pluginBasePath: './plugins/'
});
```

### 2. 注册并加载插件

```javascript
// 注册插件元数据
pluginManager.register({
  id: 'finder',
  enabled: true
});

// 加载插件
await pluginManager.load('finder');

// 激活插件
await pluginManager.activate('finder');
```

### 3. 创建插件

```javascript
// plugins/demo/index.js
import { PluginBase } from '../../core/plugin/plugin-base.js';

export default class DemoPlugin extends PluginBase {
  static id = 'demo';

  async onActivate() {
    console.log('Demo plugin activated!');
    
    // 订阅事件
    this.on('file:change', (data) => {
      console.log('File changed:', data);
    });
  }

  async onDeactivate() {
    console.log('Demo plugin deactivated!');
  }

  render() {
    return `
      <div class="demo-plugin">
        <h2>Demo Plugin</h2>
        <p>This is a demo plugin.</p>
      </div>
    `;
  }

  styles() {
    return `
      .demo-plugin {
        padding: 20px;
        background: #f5f5f5;
        border-radius: 8px;
      }
    `;
  }
}
```

### 4. 插件 Manifest

```json
{
  "id": "demo",
  "name": {
    "zh": "示例插件",
    "en": "Demo Plugin"
  },
  "version": "1.0.0",
  "description": {
    "zh": "这是一个示例插件",
    "en": "This is a demo plugin"
  },
  "author": "Your Name",
  "entry": "./index.js",
  "permissions": [
    "database:read",
    "ui:render"
  ],
  "dependencies": {
    "services": ["DatabaseService"],
    "plugins": []
  }
}
```

## 核心组件

### PluginManager

插件管理器，负责插件的注册、加载、激活、停用和卸载。

```javascript
const manager = new PluginManager(services);

// 生命周期
await manager.load('plugin-id');      // 加载插件
await manager.activate('plugin-id');  // 激活插件
await manager.deactivate('plugin-id'); // 停用插件
await manager.unload('plugin-id');    // 卸载插件

// 查询
const plugin = manager.get('plugin-id');
const all = manager.getAll();
const active = manager.getActive();
const isActive = manager.isActive('plugin-id');
```

### PluginBase

插件基类，所有插件必须继承。

```javascript
class MyPlugin extends PluginBase {
  static id = 'my-plugin';

  // 生命周期钩子
  async onInstall() {}
  async onUninstall() {}
  async onActivate() {}
  async onDeactivate() {}
  async onSettingsChange(key, value, oldValue) {}

  // UI 渲染
  render() { return '<div>...</div>'; }
  styles() { return '.class { ... }'; }

  // 工具方法
  getSetting(key, defaultValue)
  async setSetting(key, value)
  emit(eventName, data)
  on(eventName, handler)
  t(key, params)
  log(level, message, data)
}
```

### EventBus

事件总线，用于插件间通信。

```javascript
import { eventBus } from './core/plugin/event-bus.js';

// 订阅
const unsubscribe = eventBus.on('file:change', (data) => {
  console.log('File changed:', data);
});

// 订阅一次
eventBus.once('app:ready', () => {
  console.log('App is ready!');
});

// 发布
await eventBus.emit('file:change', { path: '/foo.txt' });

// 通配符订阅
eventBus.on('file:*', (data, eventName) => {
  console.log(`File event: ${eventName}`, data);
});

// 取消订阅
unsubscribe();
eventBus.off('file:change');
eventBus.offNamespace('my-plugin');
```

### PermissionManager

权限管理器。

```javascript
import { permissionManager } from './core/plugin/permission-manager.js';

// 注册权限
permissionManager.register('my-plugin', [
  'database:read',
  'database:write',
  'filesystem:read'
]);

// 检查权限
if (permissionManager.check('my-plugin', 'database:read')) {
  // 有权限
}

// 要求权限（无权限抛出错误）
permissionManager.require('my-plugin', 'database:write');

// 批量检查
if (permissionManager.checkAll('my-plugin', ['database:read', 'database:write'])) {
  // 都有
}
```

### PluginStorage

插件存储，每个插件独立的 IndexedDB 存储空间。

```javascript
const storage = new PluginStorage('my-plugin');

// CRUD
await storage.set('key', { foo: 'bar' });
const value = await storage.get('key', defaultValue);
await storage.remove('key');
await storage.clear();

// 查询
const keys = await storage.keys();
const all = await storage.getAll();
const hasKey = await storage.has('key');
const size = await storage.size();

// 清理
storage.close();
```

## 权限列表

### 数据库权限
- `database:read` - 读取数据库
- `database:write` - 写入数据库
- `database:delete` - 删除数据
- `database:*` - 完全访问

### 文件系统权限
- `filesystem:read` - 读取文件
- `filesystem:write` - 写入文件
- `filesystem:delete` - 删除文件
- `filesystem:watch` - 监视文件变化
- `filesystem:*` - 完全访问

### 网络权限
- `network:fetch` - 网络请求
- `network:websocket` - WebSocket 连接
- `network:*` - 完全访问

### UI 权限
- `ui:render` - 渲染 UI
- `ui:modal` - 显示模态框
- `ui:notification` - 显示通知
- `ui:*` - 完全访问

### 其他权限
- `clipboard:read` - 读取剪贴板
- `clipboard:write` - 写入剪贴板
- `storage:read` - 读取存储
- `storage:write` - 写入存储
- `system:shell` - 执行系统命令
- `system:process` - 管理进程

## 事件列表

### 插件管理器事件
- `plugin-manager:init` - 管理器初始化
- `plugin:registered` - 插件注册
- `plugin:loaded` - 插件加载
- `plugin:activated` - 插件激活
- `plugin:deactivated` - 插件停用
- `plugin:unloaded` - 插件卸载
- `plugin:uninstalled` - 插件卸载
- `plugin:enabled` - 插件启用
- `plugin:disabled` - 插件禁用

### 插件事件
- `plugin:{id}:state-change` - 插件状态变更
- `plugin:{id}:error` - 插件错误
- `plugin:{id}:{custom}` - 插件自定义事件

## 最佳实践

### 1. 错误处理

```javascript
async onActivate() {
  try {
    // 初始化逻辑
  } catch (error) {
    this.handleError(error, 'onActivate');
    throw error; // 重新抛出让管理器知道失败
  }
}
```

### 2. 清理资源

```javascript
async onDeactivate() {
  // 所有在 onActivate 中创建的资源都应在这里清理
  if (this.timer) {
    clearInterval(this.timer);
  }
  
  // 不需要手动取消事件订阅，cleanup() 会自动处理
}
```

### 3. 使用 registerCleanup

```javascript
async onActivate() {
  const timer = setInterval(() => {
    // ...
  }, 1000);
  
  // 注册清理函数
  this.registerCleanup(() => {
    clearInterval(timer);
  });
}
```

### 4. 权限检查

```javascript
async someAction() {
  // 在执行操作前检查权限
  if (!this.context.permissionManager.check(this.id, 'database:write')) {
    throw new Error('No permission to write database');
  }
  
  // 执行操作
  await this.services.database.insert(...);
}
```

### 5. 设置管理

```javascript
async onActivate() {
  // 读取设置
  const maxResults = await this.getSetting('maxResults', 100);
  
  // 使用设置
  const results = await this.search(query, { limit: maxResults });
}

async onSettingsChange(key, value, oldValue) {
  if (key === 'maxResults') {
    console.log(`Max results changed from ${oldValue} to ${value}`);
    // 重新加载或刷新 UI
    this.update();
  }
}
```

## 示例插件

完整示例请参考：
- `examples/plugins/demo-plugin/` - 基础示例插件
- `plugins/finder/` - 文件搜索插件
- `plugins/wiki/` - 知识库插件

## API 文档

详细 API 文档请参考：
- [插件系统规格](../../openspec/specs/08-plugin-system.md)
- [插件开发任务](../../openspec/tasks/phase-0/task-006-plugin-system.md)

## 许可证

MIT
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

## See Also

- [Task 006 Specification](../../../../openspec/tasks/phase-0/task-006-plugin-system.md)
- [Plugin System Specification](../../../../openspec/specs/08-plugin-system.md)
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
