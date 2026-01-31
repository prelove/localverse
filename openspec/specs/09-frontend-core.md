# 09 - 前端核心规格

## 概述

前端核心是 Localverse 的 UI 层，采用原生技术栈：
1. HTML5 + CSS3 + ES2022
2. 无框架依赖（可选 lit-html 做模板）
3. Web Components 组件化
4. Service Worker 离线支持

## 设计原则

- **轻量**：核心代码 < 100KB（压缩后）
- **快速**：首屏加载 < 1s
- **响应式**：适配 PC 和移动端
- **可访问**：符合 WCAG 2.1 AA 标准

## 目录结构

```
src/frontend/
├── index.html                   # 主入口
├── desktop/                     # PC 端
│   ├── index.html
│   ├── app.js                   # 主程序
│   ├── style.css                # 主样式
│   ├── core/                    # 核心模块
│   │   ├── app.js               # 应用启动
│   │   ├── router.js            # 路由
│   │   ├── state.js             # 状态管理
│   │   ├── events.js            # 事件总线
│   │   └── i18n.js              # 国际化
│   ├── components/              # 通用组件
│   │   ├── header.js
│   │   ├── sidebar.js
│   │   ├── modal.js
│   │   ├── toast.js
│   │   ├── dropdown.js
│   │   └── ...
│   ├── services/                # 前端服务
│   │   ├── api.js               # API 封装
│   │   ├── storage.js           # 本地存储
│   │   ├── comm.js              # 通信层
│   │   └── ...
│   ├── themes/                  # 主题
│   │   ├── light.css
│   │   ├── dark.css
│   │   └── variables.css
│   └── utils/                   # 工具函数
│       ├── dom.js
│       ├── format.js
│       └── ...
│
├── mobile/                      # 移动端
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── ...
│
├── shared/                      # 共享代码
│   ├── constants.js
│   ├── types.js
│   └── utils.js
│
└── sw.js                        # Service Worker
```

## 应用启动流程

```javascript
// app.js

class LocalverseApp {
  constructor() {
    this.config = null;
    this.mode = null;  // full | light | pure
    this.services = {};
    this.plugins = [];
    this.ready = false;
  }
  
  async init() {
    try {
      // 1. 显示加载画面
      this.showSplash();
      
      // 2. 检测运行环境
      this.mode = await this.detectMode();
      this.updateSplash('检测环境完成...');
      
      // 3. 加载配置
      this.config = await this.loadConfig();
      this.updateSplash('加载配置完成...');
      
      // 4. 初始化服务
      await this.initServices();
      this.updateSplash('初始化服务完成...');
      
      // 5. 认证
      const user = await this.authenticate();
      if (!user) {
        this.showSetup();
        return;
      }
      this.updateSplash('认证完成...');
      
      // 6. 初始化数据库
      await this.initDatabase();
      this.updateSplash('数据库就绪...');
      
      // 7. 加载插件
      await this.loadPlugins();
      this.updateSplash('插件加载完成...');
      
      // 8. 渲染 UI
      this.render();
      
      // 9. 隐藏加载画面
      this.hideSplash();
      
      // 10. 后台任务
      this.startBackgroundTasks();
      
      this.ready = true;
      this.emit('ready');
      
    } catch (error) {
      console.error('App init failed:', error);
      this.showError(error);
    }
  }
  
  async detectMode() {
    const jarAvailable = await this.checkJarService();
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
      const response = await fetch('/wasm/sqlite.dat');
      const buffer = await response.arrayBuffer();
      await WebAssembly.compile(buffer);
      return true;
    } catch {
      return false;
    }
  }
}

// 启动应用
const app = new LocalverseApp();
document.addEventListener('DOMContentLoaded', () => app.init());
```

## Web Components 组件系统

### 组件基类

```javascript
// components/base.js

class LVComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = {};
    this._mounted = false;
  }
  
  connectedCallback() {
    this._mounted = true;
    this.render();
    this.onMount();
  }
  
  disconnectedCallback() {
    this._mounted = false;
    this.onUnmount();
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.onAttributeChange(name, newValue, oldValue);
      this.render();
    }
  }
  
  // 生命周期钩子
  onMount() {}
  onUnmount() {}
  onAttributeChange(name, newValue, oldValue) {}
  
  // 状态管理
  get state() {
    return this._state;
  }
  
  setState(newState) {
    this._state = { ...this._state, ...newState };
    if (this._mounted) {
      this.render();
    }
  }
  
  // 渲染
  render() {
    this.shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.template()}
    `;
    this.bindEvents();
  }
  
  // 子类实现
  styles() { return ''; }
  template() { return ''; }
  bindEvents() {}
  
  // 工具方法
  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }
  
  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }
  
  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, {
      bubbles: true,
      composed: true,
      detail
    }));
  }
}

export default LVComponent;
```

### Header 组件

```javascript
// components/header.js

import LVComponent from './base.js';

class LVHeader extends LVComponent {
  static get observedAttributes() {
    return ['title', 'mode'];
  }
  
  constructor() {
    super();
    this._state = {
      searchQuery: '',
      showSearch: false
    };
  }
  
  styles() {
    return `
      :host {
        display: block;
        height: 48px;
        background: var(--header-bg, #fff);
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      
      .header {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 16px;
      }
      
      .logo {
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-color, #1976d2);
      }
      
      .search-box {
        flex: 1;
        max-width: 400px;
        margin: 0 24px;
      }
      
      .search-input {
        width: 100%;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 4px;
        outline: none;
      }
      
      .search-input:focus {
        border-color: var(--primary-color, #1976d2);
      }
      
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--status-color, #4caf50);
      }
      
      .status-indicator.offline { background: #9e9e9e; }
      .status-indicator.connecting { background: #ff9800; }
      .status-indicator.error { background: #f44336; }
      
      .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--primary-color, #1976d2);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        cursor: pointer;
      }
    `;
  }
  
  template() {
    const mode = this.getAttribute('mode') || 'full';
    const modeIcons = {
      full: '🟢',
      light: '🟡',
      pure: '🟠',
      offline: '⚫'
    };
    
    return `
      <header class="header">
        <div class="logo">Localverse</div>
        
        <div class="search-box">
          <input type="text" 
                 class="search-input" 
                 placeholder="搜索... (Ctrl+K)"
                 value="${this.state.searchQuery}">
        </div>
        
        <div class="actions">
          <span class="mode-indicator" title="${mode} 模式">
            ${modeIcons[mode]}
          </span>
          
          <div class="status-indicator" id="statusIndicator"></div>
          
          <div class="user-avatar" id="userAvatar">
            ${this.getUserInitial()}
          </div>
        </div>
      </header>
    `;
  }
  
  bindEvents() {
    const searchInput = this.$('.search-input');
    searchInput?.addEventListener('input', (e) => {
      this.setState({ searchQuery: e.target.value });
      this.emit('search', { query: e.target.value });
    });
    
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.emit('search-submit', { query: e.target.value });
      }
    });
    
    this.$('#userAvatar')?.addEventListener('click', () => {
      this.emit('user-menu');
    });
  }
  
  getUserInitial() {
    // 从全局状态获取用户名
    const userName = window.app?.user?.name || 'U';
    return userName.charAt(0).toUpperCase();
  }
  
  updateConnectionStatus(status) {
    const indicator = this.$('#statusIndicator');
    if (indicator) {
      indicator.className = `status-indicator ${status}`;
    }
  }
}

customElements.define('lv-header', LVHeader);
export default LVHeader;
```

### Sidebar 组件

```javascript
// components/sidebar.js

import LVComponent from './base.js';

class LVSidebar extends LVComponent {
  constructor() {
    super();
    this._state = {
      collapsed: false,
      activePlugin: null,
      plugins: []
    };
  }
  
  styles() {
    return `
      :host {
        display: block;
        width: var(--sidebar-width, 60px);
        height: 100%;
        background: var(--sidebar-bg, #f5f5f5);
        border-right: 1px solid var(--border-color, #e0e0e0);
        transition: width 0.2s;
      }
      
      :host([expanded]) {
        width: var(--sidebar-expanded-width, 240px);
      }
      
      .sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      
      .nav-list {
        flex: 1;
        padding: 8px;
        overflow-y: auto;
      }
      
      .nav-item {
        display: flex;
        align-items: center;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .nav-item:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      .nav-item.active {
        background: var(--active-bg, rgba(25, 118, 210, 0.1));
        color: var(--primary-color, #1976d2);
      }
      
      .nav-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }
      
      .nav-label {
        margin-left: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      :host(:not([expanded])) .nav-label {
        display: none;
      }
      
      .sidebar-footer {
        padding: 8px;
        border-top: 1px solid var(--border-color, #e0e0e0);
      }
      
      .toggle-btn {
        width: 100%;
        padding: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
      }
      
      .toggle-btn:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
    `;
  }
  
  template() {
    const plugins = this.state.plugins;
    const activeId = this.state.activePlugin;
    
    return `
      <nav class="sidebar">
        <div class="nav-list">
          ${plugins.map(plugin => `
            <div class="nav-item ${plugin.id === activeId ? 'active' : ''}"
                 data-plugin="${plugin.id}">
              <span class="nav-icon">${plugin.icon}</span>
              <span class="nav-label">${plugin.name}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="sidebar-footer">
          <button class="toggle-btn" id="toggleBtn">
            ${this.hasAttribute('expanded') ? '◀' : '▶'}
          </button>
        </div>
      </nav>
    `;
  }
  
  bindEvents() {
    this.$$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const pluginId = item.dataset.plugin;
        this.setState({ activePlugin: pluginId });
        this.emit('plugin-select', { pluginId });
      });
    });
    
    this.$('#toggleBtn')?.addEventListener('click', () => {
      this.toggleAttribute('expanded');
      this.render();
    });
  }
  
  setPlugins(plugins) {
    this.setState({ plugins });
  }
  
  setActive(pluginId) {
    this.setState({ activePlugin: pluginId });
  }
}

customElements.define('lv-sidebar', LVSidebar);
export default LVSidebar;
```

### Modal 组件

```javascript
// components/modal.js

import LVComponent from './base.js';

class LVModal extends LVComponent {
  static get observedAttributes() {
    return ['open', 'title', 'size'];
  }
  
  styles() {
    return `
      :host {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
      }
      
      :host([open]) {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
      }
      
      .modal {
        position: relative;
        background: var(--modal-bg, #fff);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        animation: modalIn 0.2s ease-out;
      }
      
      @keyframes modalIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      :host([size="small"]) .modal { width: 400px; }
      :host([size="medium"]) .modal { width: 600px; }
      :host([size="large"]) .modal { width: 800px; }
      :host([size="full"]) .modal { width: 90vw; height: 90vh; }
      
      .modal-header {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      
      .modal-title {
        flex: 1;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }
      
      .modal-close {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        font-size: 20px;
      }
      
      .modal-close:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      .modal-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
      }
      
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid var(--border-color, #e0e0e0);
      }
    `;
  }
  
  template() {
    const title = this.getAttribute('title') || '';
    
    return `
      <div class="overlay" id="overlay"></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" id="closeBtn">×</button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
  
  bindEvents() {
    this.$('#overlay')?.addEventListener('click', () => this.close());
    this.$('#closeBtn')?.addEventListener('click', () => this.close());
    
    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.hasAttribute('open')) {
        this.close();
      }
    });
  }
  
  open() {
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    this.emit('open');
  }
  
  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
    this.emit('close');
  }
}

customElements.define('lv-modal', LVModal);
export default LVModal;
```

## 路由系统

```javascript
// core/router.js

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};
    
    window.addEventListener('popstate', () => this.handleRoute());
    window.addEventListener('hashchange', () => this.handleRoute());
  }
  
  /**
   * 注册路由
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }
  
  /**
   * 导航到���定路径
   */
  navigate(path, params = {}) {
    this.params = params;
    window.history.pushState(params, '', `#${path}`);
    this.handleRoute();
  }
  
  /**
   * 替换当前路由
   */
  replace(path, params = {}) {
    this.params = params;
    window.history.replaceState(params, '', `#${path}`);
    this.handleRoute();
  }
  
  /**
   * 处理路由变化
   */
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
  
  /**
   * 匹配路由模式
   */
  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        // 动态参数
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return { params };
  }
  
  /**
   * 获取当前参数
   */
  getParams() {
    return this.params;
  }
  
  /**
   * 返回上一页
   */
  back() {
    window.history.back();
  }
}

export default new Router();
```

## 状态管理

```javascript
// core/state.js

class Store {
  constructor(initialState = {}) {
    this._state = initialState;
    this._listeners = new Map();
    this._middlewares = [];
  }
  
  /**
   * 获取状态
   */
  get(path) {
    if (!path) return this._state;
    
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key];
    }, this._state);
  }
  
  /**
   * 设置状态
   */
  set(path, value) {
    const oldValue = this.get(path);
    
    // 运行中间件
    for (const middleware of this._middlewares) {
      const result = middleware({ path, value, oldValue });
      if (result === false) return;
      if (result !== undefined) value = result;
    }
    
    // 更新状态
    if (!path) {
      this._state = value;
    } else {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {};
        return obj[key];
      }, this._state);
      target[lastKey] = value;
    }
    
    // 通知监听器
    this._notify(path, value, oldValue);
  }
  
  /**
   * 订阅状态变化
   */
  subscribe(path, listener) {
    if (!this._listeners.has(path)) {
      this._listeners.set(path, new Set());
    }
    this._listeners.get(path).add(listener);
    
    return () => {
      this._listeners.get(path).delete(listener);
    };
  }
  
  /**
   * 通知监听器
   */
  _notify(path, value, oldValue) {
    // 精确匹配
    const listeners = this._listeners.get(path);
    if (listeners) {
      listeners.forEach(listener => listener(value, oldValue));
    }
    
    // 通配符匹配
    const wildcardListeners = this._listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => listener({ path, value, oldValue }));
    }
    
    // 父路径匹配
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      const parentListeners = this._listeners.get(parentPath + '.*');
      if (parentListeners) {
        parentListeners.forEach(listener => listener({ path, value, oldValue }));
      }
    }
  }
  
  /**
   * 添加中间件
   */
  use(middleware) {
    this._middlewares.push(middleware);
  }
  
  /**
   * 批量更新
   */
  batch(updates) {
    const oldState = { ...this._state };
    
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
  }
}

// 创建全局 store
const store = new Store({
  user: null,
  mode: 'full',
  theme: 'light',
  language: 'zh',
  connection: {
    status: 'disconnected',
    transport: null,
    latency: 0
  },
  sync: {
    pending: 0,
    conflicts: 0,
    lastSync: null
  },
  plugins: [],
  activePlugin: null
});

export default store;
```

## 国际化

```javascript
// core/i18n.js

class I18n {
  constructor() {
    this.locale = 'zh';
    this.messages = {};
    this.fallbackLocale = 'en';
  }
  
  /**
   * 加载语言包
   */
  async load(locale) {
    if (this.messages[locale]) return;
    
    try {
      const response = await fetch(`/locales/${locale}.json`);
      this.messages[locale] = await response.json();
    } catch (error) {
      console.warn(`Failed to load locale: ${locale}`);
    }
  }
  
  /**
   * 设置当前语言
   */
  async setLocale(locale) {
    await this.load(locale);
    this.locale = locale;
    document.documentElement.lang = locale;
    
    // 触发更新
    window.dispatchEvent(new CustomEvent('locale-change', { detail: { locale } }));
  }
  
  /**
   * 翻译
   */
  t(key, params = {}) {
    const messages = this.messages[this.locale] || this.messages[this.fallbackLocale] || {};
    
    let text = key.split('.').reduce((obj, k) => obj && obj[k], messages);
    
    if (text === undefined) {
      console.warn(`Missing translation: ${key}`);
      return key;
    }
    
    // 替换参数
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${param}}`, 'g'), value);
    }
    
    return text;
  }
  
  /**
   * 复数处理
   */
  plural(key, count, params = {}) {
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    return this.t(pluralKey, { ...params, count });
  }
}

export default new I18n();
```

## 主题系统

```css
/* themes/variables.css */

:root {
  /* 颜色 */
  --primary-color: #1976d2;
  --primary-light: #42a5f5;
  --primary-dark: #1565c0;
  
  --secondary-color: #9c27b0;
  
  --success-color: #4caf50;
  --warning-color: #ff9800;
  --error-color: #f44336;
  --info-color: #2196f3;
  
  /* 灰度 */
  --gray-50: #fafafa;
  --gray-100: #f5f5f5;
  --gray-200: #eeeeee;
  --gray-300: #e0e0e0;
  --gray-400: #bdbdbd;
  --gray-500: #9e9e9e;
  --gray-600: #757575;
  --gray-700: #616161;
  --gray-800: #424242;
  --gray-900: #212121;
  
  /* 尺寸 */
  --header-height: 48px;
  --sidebar-width: 60px;
  --sidebar-expanded-width: 240px;
  
  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.1);
  
  /* 动画 */
  --transition-fast: 0.1s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s ease;
}

/* 浅色主题 */
[data-theme="light"] {
  --bg-color: #ffffff;
  --surface-color: #ffffff;
  --text-color: #212121;
  --text-secondary: #757575;
  --border-color: #e0e0e0;
  --hover-bg: rgba(0, 0, 0, 0.05);
  --active-bg: rgba(25, 118, 210, 0.1);
}

/* 深色主题 */
[data-theme="dark"] {
  --bg-color: #121212;
  --surface-color: #1e1e1e;
  --text-color: #ffffff;
  --text-secondary: #b0b0b0;
  --border-color: #333333;
  --hover-bg: rgba(255, 255, 255, 0.05);
  --active-bg: rgba(25, 118, 210, 0.2);
}
```

## Service Worker

```javascript
// sw.js

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `localverse-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/wasm/sqlite.dat',
  '/lib/monaco/editor.js',
  '/lib/echarts/echarts.min.js'
];

// 安装
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('localverse-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // API 请求不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // 缓存优先策略
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          // 后台更新
          fetch(event.request)
            .then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, response));
              }
            });
          return cached;
        }
        
        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, clone));
            }
            return response;
          });
      })
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'sync-start' });
  });
}

// 推送通知
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: data.data
    })
  );
});

// 通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
```

## 测试要点

### 单元测试

1. **组件测试**
   - 生命周期
   - 属性变化
   - 事件触发

2. **路由测试**
   - 路由匹配
   - 参数解析
   - 导航

3. **状态管理**
   - 读写
   - 订阅
   - 批量更新

### 集成测试

1. **应用启动**
2. **模式检测和降级**
3. **插件加载和渲染**

### E2E 测试

1. **用户流程**
2. **离线功能**
3. **响应式布局**

## 相关规格

- `08-plugin-system.md` - 插件系统
- `10-mobile.md` - 移动端

## 相关任务

- `tasks/phase-1/task-001-frontend-core.md`