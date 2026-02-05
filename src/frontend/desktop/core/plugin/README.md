# Plugin System

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

## 插件目录结构

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
