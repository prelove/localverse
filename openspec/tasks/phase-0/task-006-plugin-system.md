# Task 006: 插件系统开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | task-006-plugin-system |
| 阶段 | Phase 0 - 基础设施 |
| 优先级 | P0 (最高) |
| 预估工时 | 12 小时 |
| 依赖 | task-005-authentication |
| 产出 | 插件框架 |

## 目标

开发插件系统框架：
1. 插件加载和生命周期管理
2. 统一的插件 API
3. 权限系统
4. 插件间通信

## 详细需求

### 1. 插件生命周期

```
发现插件
    ↓
读取 manifest.json
    ↓
验证 manifest
    ↓
检查依赖
    ↓
加载入口模块
    ↓
创建上下文
    ↓
实例化插件
    ↓
onInstall (首次)
    ↓
onActivate
    ↓
运行中...
    ↓
onDeactivate
    ↓
onUninstall (卸载时)
```

### 2. manifest.json 结构

```json
{
  "id": "plugin-id",
  "name": { "zh": "名称", "en": "Name" },
  "version": "1.0.0",
  "entry": "./index.js",
  "style": "./style.css",
  "permissions": ["database:read", "database:write"],
  "dependencies": {
    "services": ["DatabaseService"],
    "plugins": []
  },
  "settings": {
    "option1": { "type": "boolean", "default": true }
  }
}
```

### 3. 插件上下文

```typescript
interface PluginContext {
  manifest: PluginManifest;
  services: ServiceMap;
  eventBus: EventBus;
  storage: PluginStorage;
  settings: PluginSettings;
  i18n: I18n;
  ui: UIHelper;
}
```

## 技术规格

### 文件结构

```
src/frontend/desktop/core/
├── plugin/
│   ├── index.js                 # 主入口
│   ├── plugin-loader.js         # 加载器
│   ├── plugin-base.js           # 基类
│   ├── plugin-context.js        # 上下文
│   ├── plugin-storage.js        # 存储
│   ├── plugin-settings.js       # 设置
│   ├── permission-manager.js    # 权限
│   └── event-bus.js             # 事件总线
```

## 实现步骤

### Step 1: 插件基类 (2h)

```javascript
// plugin/plugin-base.js

export class Plugin {
  static id = 'base';
  
  constructor(context) {
    this.context = context;
    this.id = this.constructor.id;
    this.manifest = context.manifest;
    this.services = context.services;
    this.eventBus = context.eventBus;
    this.storage = context.storage;
    this.settings = context.settings;
    this.i18n = context.i18n;
    
    this._state = {};
    this._mounted = false;
    this._shadowRoot = null;
  }
  
  // ========== 生命周期 ==========
  
  async onInstall() {}
  async onUninstall() {}
  async onActivate() {}
  async onDeactivate() {}
  async onSettingsChange(key, value, oldValue) {}
  
  // ========== 渲染 ==========
  
  render() {
    return '<div>Plugin content</div>';
  }
  
  styles() {
    return '';
  }
  
  mount(container) {
    this._container = container;
    
    // 创建 Shadow DOM
    this._shadowRoot = container.attachShadow({ mode: 'open' });
    
    this._mounted = true;
    this._render();
    this.bindEvents();
  }
  
  unmount() {
    if (this._container && this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
    }
    this._mounted = false;
  }
  
  _render() {
    if (!this._shadowRoot) return;
    
    this._shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
  }
  
  // ========== 状态管理 ==========
  
  get state() {
    return this._state;
  }
  
  setState(newState) {
    this._state = { ...this._state, ...newState };
    if (this._mounted) {
      this._render();
      this.bindEvents();
    }
  }
  
  // ========== DOM 工具 ==========
  
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }
  
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  }
  
  // ========== 事件 ==========
  
  bindEvents() {}
  
  emit(event, data) {
    this.eventBus.emit(`${this.id}:${event}`, data);
  }
  
  on(event, handler) {
    return this.eventBus.on(event, handler);
  }
  
  // ========== 服务调用 ==========
  
  async callService(serviceName, method, ...args) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    if (typeof service[method] !== 'function') {
      throw new Error(`Method not found: ${serviceName}.${method}`);
    }
    return service[method](...args);
  }
  
  // ========== 国际化 ==========
  
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }
  
  // ========== 设置 ==========
  
  getSetting(key) {
    return this.settings.get(key);
  }
  
  async setSetting(key, value) {
    return this.settings.set(key, value);
  }
  
  // ========== 工具 ==========
  
  generateId(prefix = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix ? `${prefix}_${id}` : id;
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  getCurrentUserId() {
    return window.app?.user?.id || 'unknown';
  }
  
  getCurrentUserName() {
    return window.app?.user?.name || 'Unknown';
  }
}

export default Plugin;
```

### Step 2: 插件加载器 (3h)

```javascript
// plugin/plugin-loader.js

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || '/plugins';
    this.services = options.services || {};
    this.eventBus = options.eventBus;
    
    this.manifests = new Map();
    this.instances = new Map();
    this.installedVersions = new Map();
  }
  
  async loadAll() {
    const pluginIds = await this.discoverPlugins();
    
    for (const id of pluginIds) {
      try {
        await this.load(id);
      } catch (error) {
        console.error(`Failed to load plugin: ${id}`, error);
      }
    }
  }
  
  async discoverPlugins() {
    // 从配置或目录获取插件列表
    // 这里假设有一个 plugins.json 文件
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      const data = await response.json();
      return data.plugins || [];
    } catch {
      // 默认插件列表
      return ['finder', 'wiki', 'chat', 'task'];
    }
  }
  
  async load(pluginId) {
    const pluginDir = `${this.pluginsDir}/${pluginId}`;
    
    // 1. 读取 manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. 验证
    this.validateManifest(manifest);
    
    // 3. 检查依赖
    await this.checkDependencies(manifest);
    
    // 4. 加载样式
    if (manifest.style) {
      await this.loadStyle(`${pluginDir}/${manifest.style}`, manifest.id);
    }
    
    // 5. 加载入口模块
    const module = await import(`${pluginDir}/${manifest.entry}`);
    const PluginClass = module.default;
    
    // 6. 创建上下文
    const context = this.createContext(manifest);
    
    // 7. 实例化
    const instance = new PluginClass(context);
    
    // 8. 注册
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. 安装/激活
    const installed = await this.isInstalled(manifest.id);
    if (!installed) {
      await instance.onInstall();
      await this.markInstalled(manifest.id, manifest.version);
    } else {
      // 检查版本更新
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        // 可以触发迁移逻辑
        console.log(`Plugin ${manifest.id} updated: ${installedVersion} → ${manifest.version}`);
      }
    }
    
    await instance.onActivate();
    
    // 10. 发送事件
    this.eventBus?.emit('plugin:loaded', { id: manifest.id, manifest });
    
    return instance;
  }
  
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    await instance.onDeactivate();
    
    // 移除样式
    this.unloadStyle(pluginId);
    
    // 移除注册
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }
  
  async loadManifest(pluginDir) {
    const response = await fetch(`${pluginDir}/manifest.json`);
    if (!response.ok) {
      throw new Error(`Failed to load manifest from ${pluginDir}`);
    }
    return await response.json();
  }
  
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'entry'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
      throw new Error(`Invalid plugin id: ${manifest.id}`);
    }
  }
  
  async checkDependencies(manifest) {
    const deps = manifest.dependencies || {};
    
    // 检查服务依赖
    for (const serviceName of deps.services || []) {
      if (!this.
      
      
 # Task 006: 插件系统开发（续）

### Step 2: 插件加载器（续）

```javascript
// plugin/plugin-loader.js (continued)

  async checkDependencies(manifest) {
    const deps = manifest.dependencies || {};
    
    // 检查服务依赖
    for (const serviceName of deps.services || []) {
      if (!this.services[serviceName]) {
        throw new Error(`Missing service dependency: ${serviceName}`);
      }
    }
    
    // 检查插件依赖
    for (const pluginId of deps.plugins || []) {
      if (!this.instances.has(pluginId)) {
        // 尝试加载依赖插件
        await this.load(pluginId);
      }
    }
  }
  
  createContext(manifest) {
    // 根据权限过滤服务
    const allowedServices = this.filterServicesByPermissions(
      manifest.permissions || []
    );
    
    return {
      manifest,
      services: allowedServices,
      eventBus: this.eventBus,
      storage: new PluginStorage(manifest.id),
      settings: new PluginSettings(manifest),
      i18n: new PluginI18n(manifest),
      ui: this.createUIHelper()
    };
  }
  
  filterServicesByPermissions(permissions) {
    const allowed = {};
    
    // 基础服务始终可用
    const baseServices = ['NotificationService'];
    for (const name of baseServices) {
      if (this.services[name]) {
        allowed[name] = this.services[name];
      }
    }
    
    // 根据权限添加服务
    const permissionServiceMap = {
      'database:read': 'DatabaseService',
      'database:write': 'DatabaseService',
      'filesystem:read': 'FileSystemService',
      'filesystem:write': 'FileSystemService',
      'network:sync': 'CommunicationLayer',
      'search': 'SearchService'
    };
    
    for (const permission of permissions) {
      const serviceName = permissionServiceMap[permission];
      if (serviceName && this.services[serviceName]) {
        allowed[serviceName] = this.services[serviceName];
      }
    }
    
    return allowed;
  }
  
  async loadStyle(stylePath, pluginId) {
    const response = await fetch(stylePath);
    if (!response.ok) return;
    
    const css = await response.text();
    
    const style = document.createElement('style');
    style.id = `plugin-style-${pluginId}`;
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  unloadStyle(pluginId) {
    const style = document.getElementById(`plugin-style-${pluginId}`);
    if (style) {
      style.remove();
    }
  }
  
  async isInstalled(pluginId) {
    try {
      const db = this.services.DatabaseService;
      if (!db) return false;
      
      const record = await db.queryOne(
        'SELECT version FROM plugin_installs WHERE plugin_id = ?',
        [pluginId]
      );
      
      if (record) {
        this.installedVersions.set(pluginId, record.version);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  
  async markInstalled(pluginId, version) {
    try {
      const db = this.services.DatabaseService;
      if (!db) return;
      
      await db.run(
        `INSERT OR REPLACE INTO plugin_installs (plugin_id, version, installed_at)
         VALUES (?, ?, ?)`,
        [pluginId, version, Date.now()]
      );
      
      this.installedVersions.set(pluginId, version);
    } catch (error) {
      console.error('Failed to mark plugin installed:', error);
    }
  }
  
  createUIHelper() {
    return {
      showModal: (options) => window.app?.showModal(options),
      showToast: (message, type) => window.app?.showToast(message, type),
      showConfirm: (message) => window.app?.showConfirm(message),
      showPrompt: (message, defaultValue) => window.app?.showPrompt(message, defaultValue)
    };
  }
  
  // ========== 公共 API ==========
  
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  getAll() {
    return Array.from(this.instances.values());
  }
  
  getManifest(pluginId) {
    return this.manifests.get(pluginId);
  }
  
  getAllManifests() {
    return Array.from(this.manifests.values());
  }
  
  async call(pluginId, method, ...args) {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    const manifest = this.manifests.get(pluginId);
    const exports = manifest.exports || {};
    
    if (!exports[method]) {
      throw new Error(`Method not exported: ${pluginId}.${method}`);
    }
    
    const methodName = exports[method];
    if (typeof instance[methodName] !== 'function') {
      throw new Error(`Method not found: ${pluginId}.${methodName}`);
    }
    
    return instance[methodName](...args);
  }
}
```

### Step 3: 事件总线 (1h)

```javascript
// plugin/event-bus.js

export class EventBus {
  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Map();
  }
  
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    
    // 返回取消函数
    return () => this.off(event, handler);
  }
  
  once(event, handler) {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event).add(handler);
  }
  
  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
    }
  }
  
  emit(event, data) {
    // 普通监听器
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error [${event}]:`, error);
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
          console.error(`Once handler error [${event}]:`, error);
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
          console.error('Wildcard handler error:', error);
        }
      }
    }
  }
  
  async emitAsync(event, data) {
    const handlers = this.handlers.get(event) || new Set();
    const onceHandlers = this.onceHandlers.get(event) || new Set();
    
    const allHandlers = [...handlers, ...onceHandlers];
    
    await Promise.all(
      allHandlers.map(async handler => {
        try {
          await handler(data);
        } catch (error) {
          console.error(`Async handler error [${event}]:`, error);
        }
      })
    );
    
    this.onceHandlers.delete(event);
  }
  
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
  
  clear() {
    this.handlers.clear();
    this.onceHandlers.clear();
  }
}

export default EventBus;
```

### Step 4: 插件存储 (1h)

```javascript
// plugin/plugin-storage.js

export class PluginStorage {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.dbName = `localverse_plugin_${pluginId}`;
    this.storeName = 'data';
    this.db = null;
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async ensureDb() {
    if (!this.db) {
      await this.init();
    }
  }
  
  async get(key) {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).get(key);
      
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
  
  async set(key, value) {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(value, key);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  
  async remove(key) {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  
  async clear() {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  
  async keys() {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).getAllKeys();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async getAll() {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      
      tx.oncomplete = () => {
        const result = {};
        keysRequest.result.forEach((key, i) => {
          result[key] = valuesRequest.result[i];
        });
        resolve(result);
      };
      
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

### Step 5: 插件设置 (1h)

```javascript
// plugin/plugin-settings.js

export class PluginSettings {
  constructor(manifest) {
    this.pluginId = manifest.id;
    this.schema = manifest.settings || {};
    this.values = {};
    this.listeners = [];
    
    this.loadDefaults();
    this.loadFromStorage();
  }
  
  loadDefaults() {
    for (const [key, config] of Object.entries(this.schema)) {
      this.values[key] = config.default;
    }
  }
  
  loadFromStorage() {
    const stored = localStorage.getItem(`plugin_settings_${this.pluginId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.values = { ...this.values, ...parsed };
      } catch {
        // 忽略无效数据
      }
    }
  }
  
  saveToStorage() {
    localStorage.setItem(
      `plugin_settings_${this.pluginId}`,
      JSON.stringify(this.values)
    );
  }
  
  get(key) {
    if (key in this.values) {
      return this.values[key];
    }
    
    const config = this.schema[key];
    return config?.default;
  }
  
  async set(key, value) {
    const config = this.schema[key];
    if (!config) {
      throw new Error(`Unknown setting: ${key}`);
    }
    
    // 验证
    if (!this.validate(key, value, config)) {
      throw new Error(`Invalid value for setting: ${key}`);
    }
    
    const oldValue = this.values[key];
    this.values[key] = value;
    this.saveToStorage();
    
    // 通知监听器
    for (const listener of this.listeners) {
      try {
        await listener(key, value, oldValue);
      } catch (error) {
        console.error('Settings listener error:', error);
      }
    }
  }
  
  validate(key, value, config) {
    switch (config.type) {
      case 'boolean':
        return typeof value === 'boolean';
        
      case 'number':
        if (typeof value !== 'number') return false;
        if (config.min !== undefined && value < config.min) return false;
        if (config.max !== undefined && value > config.max) return false;
        return true;
        
      case 'string':
        if (typeof value !== 'string') return false;
        if (config.pattern && !new RegExp(config.pattern).test(value)) return false;
        return true;
        
      case 'select':
        return config.options?.includes(value);
        
      case 'array':
        return Array.isArray(value);
        
      default:
        return true;
    }
  }
  
  getAll() {
    return { ...this.values };
  }
  
  async reset(key) {
    if (key) {
      const config = this.schema[key];
      if (config) {
        await this.set(key, config.default);
      }
    } else {
      // 重置所有
      this.loadDefaults();
      this.saveToStorage();
    }
  }
  
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  getSchema() {
    return this.schema;
  }
}
```

### Step 6: 插件国际化 (1h)

```javascript
// plugin/plugin-i18n.js

export class PluginI18n {
  constructor(manifest) {
    this.pluginId = manifest.id;
    this.locale = document.documentElement.lang || 'zh';
    this.fallbackLocale = 'en';
    this.messages = {};
    
    this.loadLocales(manifest);
  }
  
  async loadLocales(manifest) {
    const locales = ['zh', 'ja', 'en'];
    
    for (const locale of locales) {
      try {
        const response = await fetch(
          `/plugins/${this.pluginId}/locales/${locale}.json`
        );
        if (response.ok) {
          this.messages[locale] = await response.json();
        }
      } catch {
        // 忽略加载失败
      }
    }
  }
  
  setLocale(locale) {
    this.locale = locale;
  }
  
  t(key, params = {}) {
    // 尝试当前语言
    let text = this.getNestedValue(this.messages[this.locale], key);
    
    // 回退到默认语言
    if (text === undefined) {
      text = this.getNestedValue(this.messages[this.fallbackLocale], key);
    }
    
    // 找不到返回 key
    if (text === undefined) {
      console.warn(`Missing translation: ${this.pluginId}.${key}`);
      return key;
    }
    
    // 替换参数
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${param}}`, 'g'), String(value));
    }
    
    return text;
  }
  
  getNestedValue(obj, key) {
    if (!obj) return undefined;
    
    return key.split('.').reduce((current, part) => {
      return current && current[part];
    }, obj);
  }
  
  has(key) {
    return this.getNestedValue(this.messages[this.locale], key) !== undefined ||
           this.getNestedValue(this.messages[this.fallbackLocale], key) !== undefined;
  }
}
```

### Step 7: 权限管理器 (1h)

```javascript
// plugin/permission-manager.js

const PERMISSIONS = {
  'database:read': {
    name: '读取数据库',
    risk: 'low'
  },
  'database:write': {
    name: '写入数据库',
    risk: 'medium'
  },
  'filesystem:read': {
    name: '读取文件',
    risk: 'medium'
  },
  'filesystem:write': {
    name: '写入文件',
    risk: 'high'
  },
  'filesystem:watch': {
    name: '监视文件',
    risk: 'low'
  },
  'network:local': {
    name: '本地网络',
    risk: 'low'
  },
  'network:sync': {
    name: '同步服务',
    risk: 'medium'
  },
  'notification': {
    name: '发送通知',
    risk: 'low'
  },
  'clipboard:read': {
    name: '读取剪贴板',
    risk: 'medium'
  },
  'clipboard:write': {
    name: '写入剪贴板',
    risk: 'low'
  }
};

export class PermissionManager {
  constructor() {
    this.grants = new Map(); // pluginId -> Set<permission>
  }
  
  grant(pluginId, permissions) {
    let grants = this.grants.get(pluginId);
    if (!grants) {
      grants = new Set();
      this.grants.set(pluginId, grants);
    }
    
    for (const permission of permissions) {
      grants.add(permission);
    }
  }
  
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }
  
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }
  
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // 检查通配符
    if (grants.has('*')) return true;
    
    // 检查具体权限
    if (grants.has(permission)) return true;
    
    // 检查父权限（例如 database:* 包含 database:read）
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }
  
  getGranted(pluginId) {
    const grants = this.grants.get(pluginId);
    return grants ? Array.from(grants) : [];
  }
  
  getPermissionInfo(permission) {
    return PERMISSIONS[permission] || { name: permission, risk: 'unknown' };
  }
  
  getAllPermissions() {
    return PERMISSIONS;
  }
}

export default PermissionManager;
```

### Step 8: 主入口和测试 (2h)

```javascript
// plugin/index.js

export { Plugin } from './plugin-base.js';
export { PluginLoader } from './plugin-loader.js';
export { EventBus } from './event-bus.js';
export { PluginStorage } from './plugin-storage.js';
export { PluginSettings } from './plugin-settings.js';
export { PluginI18n } from './plugin-i18n.js';
export { PermissionManager } from './permission-manager.js';
```

## 数据库表

```sql
-- 插件安装记录
CREATE TABLE IF NOT EXISTS plugin_installs (
  plugin_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  updated_at INTEGER
);
```

## 测试要点

### 单元测试
1. 插件加载和卸载
2. 生命周期钩子调用
3. 事件总线
4. 存储操作
5. 设置验证

### 集成测试
1. 插件依赖加载
2. 权限过滤
3. 插件间通信

## 验收标准

- [ ] 插件加载正常
- [ ] 生命周期正确触发
- [ ] 权限系统工作
- [ ] 事件总线正常
- [ ] 插件存储正常
- [ ] 设置系统正常
- [ ] 国际化正常

## 参考规格

- `specs/08-plugin-system.md` - 插件系统详细规格

## 下一步

完成 Phase 0 所有任务后，进入 Phase 1：
- `tasks/phase-1/task-001-frontend-core.md` - 前端核心开发