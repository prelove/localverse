# Task 001: 前端核心开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase1-task-001-frontend-core |
| 阶段 | Phase 1 - 核心应用 |
| 优先级 | P0 (最高) |
| 预估工时 | 16 小时 |
| 依赖 | Phase 0 所有任务 |
| 产出 | 前端核心框架 |
| 状态 | ✅ 已完成 |

## 目标

开发前端核心框架：
1. 应用启动和初始化
2. 路由系统
3. 状态管理
4. 通用 UI 组件
5. 主题系统

## 详细需求

### 1. 应用启动流程

```
显示 Splash Screen
    ↓
检测运行模式 (full/light/pure)
    ↓
加载配置
    ↓
初���化服务
    ↓
认证检查
    ├─ 未认证 → 显示配置界面
    └─ 已认证 → 继续
    ↓
初始化数据库
    ↓
加载插件
    ↓
渲染主界面
    ↓
隐藏 Splash Screen
    ↓
启动后台任务
```

### 2. 核心组件

- Header: 顶部导航栏
- Sidebar: 侧边栏（插件列表）
- Modal: 模态对话框
- Toast: 消息提示
- Dropdown: 下拉菜单
- Tooltip: 提示框

### 3. 路由系统

```javascript
// 路由定义
router.register('/', HomePage);
router.register('/plugin/:id', PluginPage);
router.register('/settings', SettingsPage);
router.register('*', NotFoundPage);
```

## 实现步骤

### Step 1: 目录结构 (1h)

```
src/frontend/desktop/
├── index.html
├── app.js
├── style.css
├── core/
│   ├── app.js
│   ├── router.js
│   ├── state.js
│   ├── i18n.js
│   └── theme.js
├── components/
│   ���── base.js
│   ├── header.js
│   ├── sidebar.js
│   ├── modal.js
│   ├── toast.js
│   ├── dropdown.js
│   └── tooltip.js
├── pages/
│   ├── home.js
│   ├── plugin.js
│   └── settings.js
├── services/
│   └── (已完成)
├── themes/
│   ├── variables.css
│   ├── light.css
│   └── dark.css
└── utils/
    ├── dom.js
    └── format.js
```

### Step 2: 应用主类 (3h)

```javascript
// core/app.js

import { Router } from './router.js';
import { Store } from './state.js';
import { I18n } from './i18n.js';
import { ThemeManager } from './theme.js';
import { DatabaseServiceFactory } from '../services/database/index.js';
import { CommunicationLayer } from '../services/comm/index.js';
import { authService } from '../services/auth/index.js';
import { PluginLoader } from './plugin/index.js';
import { EventBus } from './plugin/event-bus.js';

export class LocalverseApp {
  constructor() {
    this.mode = null;
    this.user = null;
    this.services = {};
    this.plugins = null;
    this.ready = false;
    
    this.router = new Router();
    this.store = new Store();
    this.i18n = new I18n();
    this.theme = new ThemeManager();
    this.eventBus = new EventBus();
  }
  
  async init() {
    try {
      this.showSplash();
      
      // 1. 检测模式
      this.mode = await this.detectMode();
      this.updateSplash('检测环境完成...');
      
      // 2. 加载配置
      await this.loadConfig();
      this.updateSplash('加载配置完成...');
      
      // 3. 初始化国际化
      await this.i18n.init();
      
      // 4. 初始化主题
      this.theme.init();
      
      // 5. 认证
      this.user = await authService.authenticate();
      if (!this.user) {
        this.hideSplash();
        this.showSetup();
        return;
      }
      this.updateSplash('认证完成...');
      
      // 6. 初始化服务
      await this.initServices();
      this.updateSplash('服务初始化完成...');
      
      // 7. 加载插件
      await this.loadPlugins();
      this.updateSplash('插件加载完成...');
      
      // 8. 设置路由
      this.setupRoutes();
      
      // 9. 渲染
      this.render();
      
      // 10. 隐藏 Splash
      this.hideSplash();
      
      // 11. 后台任务
      this.startBackgroundTasks();
      
      this.ready = true;
      this.eventBus.emit('app:ready');
      
    } catch (error) {
      console.error('App init failed:', error);
      this.showError(error);
    }
  }
  
  async detectMode() {
    // 检测 JAR 服务
    const jarAvailable = await this.checkJarService();
    
    // 检测 WASM 支持
    const wasmAvailable = await this.checkWasmSupport();
    
    if (jarAvailable && wasmAvailable) {
      return 'full';
    } else if (wasmAvailable) {
      return 'light';
    } else {
      return 'pure';
    }
  }
  
  async checkJarService() {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch('http://127.0.0.1:8765/api/local/health', {
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async checkWasmSupport() {
    try {
      if (typeof WebAssembly !== 'object') return false;
      
      // 测试基本 WASM 支持
      const bytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
      ]);
      await WebAssembly.compile(bytes);
      return true;
    } catch {
      return false;
    }
  }
  
  async loadConfig() {
    // 从本地存储加载配置
    const stored = localStorage.getItem('localverse_config');
    if (stored) {
      try {
        const config = JSON.parse(stored);
        this.store.set('config', config);
      } catch {
        // 使用默认配置
      }
    }
  }
  
  async initServices() {
    // 数据库服务
    this.services.DatabaseService = await DatabaseServiceFactory.create(this.mode);
    
    // 通信层
    if (this.mode === 'full') {
      this.services.CommunicationLayer = new CommunicationLayer({
        serverUrl: 'http://127.0.0.1:8765'
      });
      await this.services.CommunicationLayer.connect();
    }
    
    // 其他服务...
  }
  
  async loadPlugins() {
    this.plugins = new PluginLoader({
      pluginsDir: '/plugins',
      services: this.services,
      eventBus: this.eventBus
    });
    
    await this.plugins.loadAll();
    
    // 更新 store
    this.store.set('plugins', this.plugins.getAllManifests());
  }
  
  setupRoutes() {
    this.router.register('/', () => this.showHome());
    this.router.register('/plugin/:id', (params) => this.showPlugin(params.id));
    this.router.register('/settings', () => this.showSettings());
    this.router.register('*', () => this.show404());
  }
  
  render() {
    const root = document.getElementById('app');
    root.innerHTML = `
      <lv-header></lv-header>
      <div class="main-container">
        <lv-sidebar></lv-sidebar>
        <main id="content" class="content"></main>
      </div>
      <lv-toast-container></lv-toast-container>
    `;
    
    // 初始化组件
    this.initComponents();
    
    // 处理当前路由
    this.router.handleRoute();
  }
  
  initComponents() {
    // 设置 Header
    const header = document.querySelector('lv-header');
    header?.setAttribute('mode', this.mode);
    
    // 设置 Sidebar
    const sidebar = document.querySelector('lv-sidebar');
    sidebar?.setPlugins(this.plugins.getAllManifests().map(m => ({
      id: m.id,
      name: m.name[this.i18n.locale] || m.name.en || m.id,
      icon: m.icon || '📦'
    })));
    
    // 监听插件选择
    sidebar?.addEventListener('plugin-select', (e) => {
      this.router.navigate(`/plugin/${e.detail.pluginId}`);
    });
  }
  
  showPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      this.show404();
      return;
    }
    
    const content = document.getElementById('content');
    content.innerHTML = '<div id="plugin-container"></div>';
    
    const container = document.getElementById('plugin-container');
    plugin.mount(container);
    
    // 更新 sidebar 激活状态
    document.querySelector('lv-sidebar')?.setActive(pluginId);
  }
  
  showHome() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="home-page">
        <h1>欢迎使用 Localverse</h1>
        <p>请从左侧选择一个模块开始</p>
      </div>
    `;
  }
  
  showSettings() {
    const content = document.getElementById('content');
    content.innerHTML = `<lv-settings></lv-settings>`;
  }
  
  show404() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="not-found">
        <h1>404</h1>
        <p>页面未找到</p>
      </div>
    `;
  }
  
  showSetup() {
    const { SetupUI } = await import('../services/auth/setup-ui.js');
    const root = document.getElementById('app');
    
    const setupUI = new SetupUI(root);
    setupUI.onComplete = async (userData) => {
      this.user = await authService.setup(userData);
      await this.initServices();
      await this.loadPlugins();
      this.setupRoutes();
      this.render();
      this.startBackgroundTasks();
      this.ready = true;
    };
    
    setupUI.render();
  }
  
  startBackgroundTasks() {
    // 同步任务
    if (this.services.CommunicationLayer) {
      setInterval(() => {
        // 处理同步队列
      }, 30000);
    }
  }
  
  // ========== Splash ==========
  
  showSplash() {
    document.getElementById('splash')?.classList.remove('hidden');
  }
  
  hideSplash() {
    const splash = document.getElementById('splash');
    splash?.classList.add('fade-out');
    setTimeout(() => splash?.classList.add('hidden'), 300);
  }
  
  updateSplash(message) {
    const status = document.querySelector('#splash .status');
    if (status) status.textContent = message;
  }
  
  showError(error) {
    document.getElementById('app').innerHTML = `
      <div class="error-page">
        <h1>启动失败</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()">重试</button>
      </div>
    `;
  }
  
  // ========== UI 工具 ==========
  
  showToast(message, type = 'info') {
    const container = document.querySelector('lv-toast-container');
    container?.show(message, type);
  }
  
  async showConfirm(message) {
    return new Promise((resolve) => {
      // 简单实现，可以用 Modal 替换
      resolve(window.confirm(message));
    });
  }
  
  async showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      resolve(window.prompt(message, defaultValue));
    });
  }
  
  async showModal(options) {
    // TODO: 实现 Modal
  }
}

// 创建全局实例
window.app = new LocalverseApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
```

### Step 3: 路由系统 (2h)

```javascript
// core/router.js

export class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};
    
    window.addEventListener('popstate', () => this.handleRoute());
    window.addEventListener('hashchange', () => this.handleRoute());
  }
  
  register(path, handler) {
    this.routes.set(path, handler);
  }
  
  navigate(path, params = {}) {
    this.params = params;
    window.history.pushState(params, '', `#${path}`);
    this.handleRoute();
  }
  
  replace(path, params = {}) {
    this.params = params;
    window.history.replaceState(params, '', `#${path}`);
    this.handleRoute();
  }
  
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    
    // 解析查询参数
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((value, key) => {
        this.params[key] = value;
      });
    }
    
    // 匹配路由
    for (const [pattern, handler] of this.routes) {
      const match = this.matchRoute(pattern, path);
      if (match) {
        this.currentRoute = pattern;
        this.params = { ...this.params, ...match.params };
        handler(this.params);
        return;
      }
    }
    
    // 404
    const notFoundHandler = this.routes.get('*');
    if (notFoundHandler) {
      notFoundHandler(this.params);
    }
  }
  
  matchRoute(pattern, path) {
    if (pattern === '*') {
      return { params: {} };
    }
    
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return { params };
  }
  
  getParams() {
    return this.params;
  }
  
  back() {
    window.history.back();
  }
  
  forward() {
    window.history.forward();
  }
}

export default Router;
```

### Step 4-8: 其他组件

由于篇幅限制，这里列出需要实现的其他组件：

- **Step 4: 状态管理** (core/state.js) - 2h
- **Step 5: 通用组件基类** (components/base.js) - 1h
- **Step 6: Header 组件** (components/header.js) - 2h
- **Step 7: Sidebar 组件** (components/sidebar.js) - 2h
- **Step 8: Modal/Toast 组件** - 3h

## 测试要点

1. 应用正常启动
2. 模式检测正确
3. 路由切换正常
4. 插件加载和显示
5. 主题切换

## 验收标准

- [x] 应用正常启动
- [x] 三种模式正确检测
- [x] 首次配置流程完整
- [x] 路由系统工作
- [x] 插件正确加载和渲染
- [x] UI 组件正常显示
- [x] 主题切换正常

## 下一步

完成后进入 `task-003-finder-plugin.md` - Finder 插件开发（可与 Wiki 插件并行）
