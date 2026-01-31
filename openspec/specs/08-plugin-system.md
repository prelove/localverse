# 08 - 插件系统规格

## 概述

插件系统是 Localverse 的核心架构，支持：
1. 功能模块化封装
2. 动态加载和卸载
3. 插件间通信
4. 独立数据隔离

## 设计原则

- **松耦合**：插件之间独立，互不影响
- **热插拔**：运行时加��/卸载
- **标准化**：统一的插件接口和规范
- **安全性**：权限声明和沙箱隔离

## 插件目录结构

```
plugins/
├── finder/                      # 文件搜索插件
│   ├── manifest.json            # 插件清单（必需）
│   ├── index.js                 # 主入口（必需）
│   ├── style.css                # 样式（可选）
│   ├── icon.svg                 # 图标（可选）
│   ├── worker.js                # Web Worker（可选）
│   ├── locales/                 # 多语言（可选）
│   │   ├── zh.json
│   │   ├── ja.json
│   │   └── en.json
│   └── README.md                # 说明文档
│
├── wiki/
├── chat/
├── task/
└── ...
```

## manifest.json 规范

```json
{
  "$schema": "https://localverse.dev/schemas/plugin-manifest.json",
  "id": "finder",
  "name": {
    "zh": "文件搜索",
    "ja": "ファイル検索",
    "en": "Finder"
  },
  "version": "1.0.0",
  "description": {
    "zh": "快速搜索本地文件，支持全文检索",
    "ja": "ローカルファイルを高速検索",
    "en": "Fast local file search with full-text support"
  },
  "author": "Localverse Team",
  "license": "MIT",
  "homepage": "https://github.com/localverse/plugin-finder",
  
  "icon": "./icon.svg",
  "category": "productivity",
  "tags": ["search", "files", "fulltext"],
  
  "entry": "./index.js",
  "style": "./style.css",
  "worker": "./worker.js",
  
  "minAppVersion": "1.0.0",
  "maxAppVersion": "2.0.0",
  
  "location": {
    "sidebar": {
      "enabled": true,
      "order": 1,
      "icon": "search"
    },
    "toolbar": {
      "enabled": false
    },
    "contextMenu": {
      "enabled": true,
      "items": [
        {
          "id": "search-in-folder",
          "label": { "zh": "在此文件夹搜索", "en": "Search in folder" },
          "context": ["folder"]
        }
      ]
    },
    "shortcut": {
      "global": "Ctrl+Shift+F",
      "local": "Ctrl+F"
    }
  },
  
  "permissions": [
    "database:read",
    "database:write",
    "filesystem:read",
    "filesystem:watch",
    "notification",
    "clipboard:read"
  ],
  
  "dependencies": {
    "services": ["DatabaseService", "FileSystemService", "SearchService"],
    "plugins": []
  },
  
  "settings": {
    "maxResults": {
      "type": "number",
      "default": 100,
      "min": 10,
      "max": 1000,
      "label": { "zh": "最大结果数", "en": "Max results" }
    },
    "indexHidden": {
      "type": "boolean",
      "default": false,
      "label": { "zh": "索引隐藏文件", "en": "Index hidden files" }
    },
    "watchPaths": {
      "type": "array",
      "itemType": "string",
      "default": [],
      "label": { "zh": "监视路径", "en": "Watch paths" }
    }
  },
  
  "hooks": {
    "onInstall": "onInstall",
    "onUninstall": "onUninstall",
    "onActivate": "onActivate",
    "onDeactivate": "onDeactivate",
    "onSettingsChange": "onSettingsChange"
  },
  
  "exports": {
    "search": "search",
    "indexFile": "indexFile"
  }
}
```

## 插件基类

```javascript
/**
 * 插件基类
 * 所有插件必须继承此类
 */
class Plugin {
  /**
   * 插件 ID（必须与 manifest.id 一致）
   */
  static id = 'base';
  
  /**
   * 构造函数
   * @param {PluginContext} context - 插件上下文
   */
  constructor(context) {
    this.context = context;
    this.id = this.constructor.id;
    this.manifest = context.manifest;
    this.services = context.services;
    this.eventBus = context.eventBus;
    this.storage = context.storage;
    this.settings = context.settings;
    this.i18n = context.i18n;
  }
  
  // ============ 生命周期钩子 ============
  
  /**
   * 插件安装时调用（仅首次安装）
   * 用于初始化数据库表、默认配置等
   */
  async onInstall() {}
  
  /**
   * 插件卸载时调用
   * 用于清理数据、释放资源
   */
  async onUninstall() {}
  
  /**
   * 插件激活时调用（每次打开应用）
   * 用于注册事件监听、启动后台任务
   */
  async onActivate() {}
  
  /**
   * 插件停用时调用
   * 用于移除事件监��、停止后台任务
   */
  async onDeactivate() {}
  
  /**
   * 设置变更时调用
   * @param {string} key - 变更的设置项
   * @param {any} value - 新值
   * @param {any} oldValue - 旧值
   */
  async onSettingsChange(key, value, oldValue) {}
  
  // ============ UI 渲染 ============
  
  /**
   * 渲染主界面
   * @returns {string} HTML 字符串
   */
  render() {
    return '<div>Plugin content</div>';
  }
  
  /**
   * 渲染侧边栏图标（如果 manifest 中启用）
   * @returns {string} SVG 或 HTML
   */
  renderSidebarIcon() {
    return this.manifest.icon;
  }
  
  /**
   * 渲染设置界面
   * @returns {string} HTML 字符串
   */
  renderSettings() {
    return this.generateSettingsForm();
  }
  
  // ============ 辅助方法 ============
  
  /**
   * 获取国际化文本
   */
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }
  
  /**
   * 获取设置值
   */
  getSetting(key) {
    return this.settings.get(key);
  }
  
  /**
   * 设置值
   */
  setSetting(key, value) {
    return this.settings.set(key, value);
  }
  
  /**
   * 发送事件
   */
  emit(event, data) {
    this.eventBus.emit(`${this.id}:${event}`, data);
  }
  
  /**
   * 监听事件
   */
  on(event, handler) {
    this.eventBus.on(event, handler);
  }
  
  /**
   * 调用服务
   */
  async callService(serviceName, method, ...args) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    return service[method](...args);
  }
}
```

## 插件上下文

```typescript
interface PluginContext {
  // 基本信息
  manifest: PluginManifest;
  
  // 系统服务（根据权限注入）
  services: {
    DatabaseService?: DatabaseService;
    FileSystemService?: FileSystemService;
    SearchService?: SearchService;
    CryptoService?: CryptoService;
    NotificationService?: NotificationService;
    // ...
  };
  
  // 事件总线
  eventBus: EventBus;
  
  // 插件专属存储（隔离的 IndexedDB）
  storage: PluginStorage;
  
  // 设置管理
  settings: PluginSettings;
  
  // 国际化
  i18n: I18n;
  
  // UI 工具
  ui: {
    showModal(options: ModalOptions): Promise<any>;
    showToast(message: string, type?: ToastType): void;
    showConfirm(message: string): Promise<boolean>;
    showPrompt(message: string, defaultValue?: string): Promise<string | null>;
  };
  
  // 路由
  router: {
    navigate(path: string): void;
    getParams(): Record<string, string>;
  };
}

interface PluginStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

interface PluginSettings {
  get<T>(key: string): T;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Record<string, any>;
  reset(key?: string): Promise<void>;
  onChange(callback: (key: string, value: any) => void): void;
}
```

## 插件加载器

```javascript
class PluginLoader {
  constructor(options) {
    this.pluginsDir = options.pluginsDir;
    this.services = options.services;
    this.eventBus = options.eventBus;
    this.plugins = new Map();
    this.instances = new Map();
  }
  
  /**
   * 扫描并加载所有插件
   */
  async loadAll() {
    const pluginDirs = await this.scanPluginDirs();
    
    for (const dir of pluginDirs) {
      try {
        await this.load(dir);
      } catch (error) {
        console.error(`Failed to load plugin: ${dir}`, error);
      }
    }
  }
  
  /**
   * 加载单个插件
   */
  async load(pluginDir) {
    // 1. 读取 manifest
    const manifestPath = `${pluginDir}/manifest.json`;
    const manifest = await this.loadManifest(manifestPath);
    
    // 2. 验证 manifest
    this.validateManifest(manifest);
    
    // 3. 检查依赖
    await this.checkDependencies(manifest);
    
    // 4. 加载入口模块
    const entryPath = `${pluginDir}/${manifest.entry}`;
    const PluginClass = await this.loadModule(entryPath);
    
    // 5. 创建上下文
    const context = this.createContext(manifest);
    
    // 6. 实例化插件
    const instance = new PluginClass(context);
    
    // 7. 注册插件
    this.plugins.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 8. 加载样式
    if (manifest.style) {
      await this.loadStyle(`${pluginDir}/${manifest.style}`, manifest.id);
    }
    
    // 9. 触发安装/激活
    const installed = await this.isInstalled(manifest.id);
    if (!installed) {
      await instance.onInstall();
      await this.markInstalled(manifest.id);
    }
    await instance.onActivate();
    
    // 10. 发送事件
    this.eventBus.emit('plugin:loaded', { id: manifest.id });
    
    return instance;
  }
  
  /**
   * 卸载插件
   */
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    // 1. 停用
    await instance.onDeactivate();
    
    // 2. 移除样式
    this.unloadStyle(pluginId);
    
    // 3. 移除注册
    this.plugins.delete(pluginId);
    this.instances.delete(pluginId);
    
    // 4. 发送事件
    this.eventBus.emit('plugin:unloaded', { id: pluginId });
  }
  
  /**
   * 创建插件上下文
   */
  createContext(manifest) {
    // 根据权限过滤服务
    const allowedServices = {};
    for (const permission of manifest.permissions) {
      if (permission.startsWith('service:')) {
        const serviceName = permission.split(':')[1];
        if (this.services[serviceName]) {
          allowedServices[serviceName] = this.services[serviceName];
        }
      }
    }
    
    // 添加基础服务
    const baseServices = ['DatabaseService', 'NotificationService'];
    for (const serviceName of baseServices) {
      if (this.services[serviceName]) {
        allowedServices[serviceName] = this.services[serviceName];
      }
    }
    
    return {
      manifest,
      services: allowedServices,
      eventBus: this.eventBus,
      storage: new PluginStorage(manifest.id),
      settings: new PluginSettings(manifest),
      i18n: new I18n(manifest.locales),
      ui: this.createUIHelper(),
      router: this.createRouter(manifest.id)
    };
  }
  
  /**
   * 获取插件实例
   */
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  /**
   * 获取所有插件
   */
  getAll() {
    return Array.from(this.instances.values());
  }
  
  /**
   * 调用插件导出的方法
   */
  async call(pluginId, method, ...args) {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    const manifest = this.plugins.get(pluginId);
    if (!manifest.exports || !manifest.exports[method]) {
      throw new Error(`Method not exported: ${pluginId}.${method}`);
    }
    
    const methodName = manifest.exports[method];
    return instance[methodName](...args);
  }
}
```

## 权限系统

### 权限定义

```javascript
const PERMISSIONS = {
  // 数据库权限
  'database:read': {
    name: '读取数据库',
    description: '允许读取本地数据库中的数据',
    risk: 'low'
  },
  'database:write': {
    name: '写入数据库',
    description: '允许向本地数据库写入数据',
    risk: 'medium'
  },
  
  // 文件系统权限
  'filesystem:read': {
    name: '读取文件',
    description: '允许读取本地文件内容',
    risk: 'medium'
  },
  'filesystem:write': {
    name: '写入文件',
    description: '允许创建和修改本地文件',
    risk: 'high'
  },
  'filesystem:watch': {
    name: '监视文件',
    description: '允许监视文件系统变化',
    risk: 'low'
  },
  
  // 网络权限
  'network:local': {
    name: '本地网络',
    description: '允许访问本地 JAR 服务',
    risk: 'low'
  },
  'network:sync': {
    name: '同步服务',
    description: '允许访问同步服务器',
    risk: 'medium'
  },
  
  // 系统权限
  'notification': {
    name: '发送通知',
    description: '允许发送桌面通知',
    risk: 'low'
  },
  'clipboard:read': {
    name: '读取剪贴板',
    description: '允许读取剪贴板内容',
    risk: 'medium'
  },
  'clipboard:write': {
    name: '写入剪贴板',
    description: '允许写入剪贴板',
    risk: 'low'
  }
};
```

### 权限检查

```javascript
class PermissionManager {
  constructor() {
    this.grants = new Map();  // pluginId -> Set<permission>
  }
  
  /**
   * 检查插件是否有权限
   */
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    return grants.has(permission) || grants.has('*');
  }
  
  /**
   * 授予权限
   */
  grant(pluginId, permissions) {
    let grants = this.grants.get(pluginId);
    if (!grants) {
      grants = new Set();
      this.grants.set(pluginId, grants);
    }
    
    for (const p of permissions) {
      grants.add(p);
    }
  }
  
  /**
   * 撤销权限
   */
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }
  
  /**
   * 创建权限代理
   */
  createProxy(pluginId, target, requiredPermissions) {
    const self = this;
    
    return new Proxy(target, {
      get(obj, prop) {
        const permission = requiredPermissions[prop];
        if (permission && !self.hasPermission(pluginId, permission)) {
          throw new Error(`Permission denied: ${permission}`);
        }
        return obj[prop];
      }
    });
  }
}
```

## 事件总线

```javascript
class EventBus {
  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Map();
  }
  
  /**
   * 注册事件监听
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    
    return () => this.off(event, handler);
  }
  
  /**
   * 注册一次性事件监听
   */
  once(event, handler) {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event).add(handler);
  }
  
  /**
   * 移除事件监听
   */
  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * 触发事件
   */
  emit(event, data) {
    // 普通监听器
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error: ${event}`, error);
        }
      }
    }
    
    // 一次性监听器
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Once handler error: ${event}`, error);
        }
      }
      this.onceHandlers.delete(event);
    }
    
    // 通配符监听器
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler({ event, data });
        } catch (error) {
          console.error(`Wildcard handler error`, error);
        }
      }
    }
  }
  
  /**
   * 等待事件
   */
  wait(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event timeout: ${event}`));
      }, timeout);
      
      this.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
}
```

## 插件间通信

```javascript
// 插件 A 导出方法
class FinderPlugin extends Plugin {
  static id = 'finder';
  
  // 在 manifest.exports 中声明
  async search(query, options) {
    // 搜索逻辑
    return results;
  }
}

// 插件 B 调用插件 A
class WikiPlugin extends Plugin {
  static id = 'wiki';
  
  async searchRelatedFiles(keyword) {
    // 通过插件加载器调用
    const results = await this.context.pluginLoader.call(
      'finder',  // 插件 ID
      'search',  // 方法名
      keyword,   // 参数
      { limit: 10 }
    );
    
    return results;
  }
}

// 事件通信
class TaskPlugin extends Plugin {
  async onActivate() {
    // 监听其他插件的事件
    this.on('wiki:card_linked', (data) => {
      // 处理卡片关联事件
      this.handleCardLinked(data);
    });
  }
  
  async completeTask(taskId) {
    // 完成任务后发送事件
    this.emit('task_completed', { taskId });
  }
}
```

## 测试要点

### 单元测试

1. **插件加载**
   - manifest 解析
   - 依赖检查
   - 实例化

2. **生命周期**
   - onInstall
   - onActivate
   - onDeactivate
   - onUninstall

3. **权限检查**
   - 权限授予
   - 权限拒绝
   - 权限代理

### 集成测试

1. **插件间调用**
2. **事件通信**
3. **服务调用**

### 安全测试

1. **越权访问**
2. **沙箱隔离**
3. **存储隔离**

## 相关规格

- `09-frontend-core.md` - 前端核心
- `plugins/*.md` - 各插件详细规格

## 相关任务

- `tasks/phase-0/task-006-plugin-system.md`