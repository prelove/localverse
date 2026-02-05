/**
 * 插件基类
 * 
 * 所有插件必须继承此基类
 */

export class PluginBase {
  /**
   * 插件ID（子类必须覆盖）
   * @type {string}
   */
  static id = 'base-plugin';

  /**
   * @param {PluginContext} context - 插件上下文
   */
 * Plugin Base Class
 * 
 * Base class for all Localverse plugins.
 * Provides lifecycle hooks, state management, event handling, and UI utilities.
 * All plugins should extend this class
 */

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
    
    this._state = 'inactive'; // inactive | active | error
    this._mounted = false;
    this._container = null;
    this._shadowRoot = null;
    this._cleanupFns = [];
  }

  // ========== 生命周期钩子 ==========

  /**
   * 安装时调用（仅首次安装）
   * 用于初始化数据、创建索引等
   */
  async onInstall() {
    // 子类实现
  }

  /**
   * 卸载时调用
   * 用于清理数据、删除索引等
   */
  async onUninstall() {
    // 子类实现
  }

  /**
   * 激活时调用
   * 用于启动服务、注册监听器等
   */
  async onActivate() {
    // 子类实现
  }

  /**
   * 停用时调用
   * 用于停止服务、取消监听器等
   */
  async onDeactivate() {
    // 子类实现
  }

  /**
   * 设置变更时调用
   * @param {string} key - 设置键
   * @param {any} value - 新值
   * @param {any} oldValue - 旧值
   */
  async onSettingsChange(key, value, oldValue) {
    // 子类实现
  }

  // ========== 状态管理 ==========

  /**
   * 获取当前状态
   */
  getState() {
    return this._state;
  }

  /**
   * 设置状态
   * @param {string} state - 新状态
   */
  setState(state) {
    const oldState = this._state;
    this._state = state;
    this.eventBus.emitSync(`plugin:${this.id}:state-change`, {
      pluginId: this.id,
      oldState,
      newState: state
    });
  }

  /**
   * 检查是否已激活
   */
  isActive() {
    return this._state === 'active';
  }

  // ========== UI 渲染 ==========

  /**
   * 渲染插件 UI（子类可覆盖）
   * @returns {string} HTML 字符串
   */
  render() {
    return `
      <div class="plugin-container">
        <h2>${this.manifest.name.zh || this.manifest.name.en}</h2>
        <p>${this.manifest.description?.zh || this.manifest.description?.en || ''}</p>
      </div>
    `;
  }

  /**
   * 获取插件样式（子类可覆盖）
   * @returns {string} CSS 字符串
   */
  styles() {
    return `
      .plugin-container {
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .plugin-container h2 {
        margin: 0 0 10px 0;
        font-size: 24px;
      }
    `;
  }

  /**
   * 挂载到 DOM
   * @param {HTMLElement} container - 容器元素
   */
  mount(container) {
    if (this._mounted) {
      console.warn(`Plugin "${this.id}" is already mounted`);
      return;
    }

    this._container = container;

    // 创建 Shadow DOM 实现样式隔离
    this._shadowRoot = container.attachShadow({ mode: 'open' });

    // 添加样式
    const styleEl = document.createElement('style');
    styleEl.textContent = this.styles();
    this._shadowRoot.appendChild(styleEl);

    // 渲染内容
    const contentEl = document.createElement('div');
    contentEl.innerHTML = this.render();
    this._shadowRoot.appendChild(contentEl);

    this._mounted = true;
    this.onMount();
  }

  /**
   * 卸载 DOM
   */
  unmount() {
    if (!this._mounted) return;

    this.onUnmount();

    if (this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
    }
    this._container = null;
    this._shadowRoot = null;
    this._mounted = false;
  }

  /**
   * 挂载后回调（子类可覆盖）
   */
  onMount() {
    // 子类实现
  }

  /**
   * 卸载前回调（子类可覆盖）
   */
  onUnmount() {
    // 子类实现
  }

  /**
   * 更新 UI
   */
  update() {
    if (!this._mounted || !this._shadowRoot) return;

    const contentEl = this._shadowRoot.querySelector('div');
    if (contentEl) {
      contentEl.innerHTML = this.render();
    }
  }

  // ========== 工具方法 ==========

  /**
   * 获取设置值
   * @param {string} key - 设置键
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  getSetting(key, defaultValue = null) {
    return this.settings.get(key, defaultValue);
  }

  /**
   * 设置值
   * @param {string} key - 设置键
   * @param {any} value - 值
   */
  async setSetting(key, value) {
    return this.settings.set(key, value);
  }

  /**
   * 发布事件
   * @param {string} eventName - 事件名
   * @param {any} data - 事件数据
   */
  emit(eventName, data = null) {
    return this.eventBus.emit(`plugin:${this.id}:${eventName}`, data);
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名
   * @param {Function} handler - 处理函数
   * @returns {Function} - 取消订阅函数
   */
  on(eventName, handler) {
    const unsubscribe = this.eventBus.on(eventName, handler, {
      namespace: this.id
    });
    this._cleanupFns.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * 订阅一次性事件
   */
  once(eventName, handler) {
    return this.eventBus.once(eventName, handler, {
      namespace: this.id
    });
  }

  /**
   * 注册清理函数（停用时自动调用）
   * @param {Function} fn - 清理函数
   */
  registerCleanup(fn) {
    this._cleanupFns.push(fn);
  }

  /**
   * 执行所有清理函数
   */
  async cleanup() {
    for (const fn of this._cleanupFns) {
      try {
        await fn();
      } catch (error) {
        console.error(`Cleanup error in plugin "${this.id}":`, error);
      }
    }
    this._cleanupFns = [];
    
    // 取消所有事件订阅
    this.eventBus.offNamespace(this.id);
  }

  /**
   * 获取翻译文本
   * @param {string} key - 翻译键
   * @param {Object} params - 参数
   * @returns {string}
   */
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别 (info|warn|error)
   * @param {string} message - 消息
   * @param {any} data - 附加数据
   */
  log(level, message, data = null) {
    const logData = {
      pluginId: this.id,
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    console[level](`[Plugin:${this.id}]`, message, data);
    
    // 发布日志事件
    this.eventBus.emitSync('plugin:log', logData);
  }

  /**
   * 错误处理
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  handleError(error, context = '') {
    this.log('error', `Error in ${context || 'plugin'}:`, error);
    this.setState('error');
    
    // 发布错误事件
    this.eventBus.emitSync(`plugin:${this.id}:error`, {
      error,
      context
    });
    this._state = {};
    this._mounted = false;
    this._shadowRoot = null;
    this.router = context.router;
    
    this._state = {};
    this._mounted = false;
    this._container = null;
  }
  
  // ========== Lifecycle Hooks ==========
  
  async onInstall() {}
  async onUninstall() {}
  async onActivate() {}
  async onDeactivate() {}
  /**
   * Called when plugin is first installed
   */
  async onInstall() {}
  
  /**
   * Called when plugin is uninstalled
   */
  async onUninstall() {}
  
  /**
   * Called when plugin is activated
   */
  async onActivate() {}
  
  /**
   * Called when plugin is deactivated
   */
  async onDeactivate() {}
  
  /**
   * Called when a setting changes
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @param {*} oldValue - Old value
   */
  async onSettingsChange(key, value, oldValue) {}
  
  // ========== Rendering ==========
  
  render() {
    return '<div>Plugin content</div>';
  }
  
  /**
   * Render plugin content
   * @returns {string} HTML string
   */
  render() {
    return '<div class="plugin-content">Plugin content</div>';
  }
  
  /**
   * Get plugin styles
   * @returns {string} CSS string
   */
  styles() {
    return '';
  }
  
  mount(container) {
    this._container = container;
    
    // Create Shadow DOM
    this._shadowRoot = container.attachShadow({ mode: 'open' });
    
  /**
   * Mount plugin to container
   * @param {HTMLElement} container - Container element
   */
  mount(container) {
    this._container = container;
    this._mounted = true;
    this._render();
    this.bindEvents();
  }
  
  unmount() {
    if (this._container && this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
  /**
   * Unmount plugin from container
   */
  unmount() {
    if (this._container) {
      this._container.innerHTML = '';
    }
    this._mounted = false;
  }
  
  _render() {
    if (!this._shadowRoot) return;
    
    this._shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
  /**
   * Internal render method
   */
  _render() {
    if (!this._container) return;
    
    const html = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
    
    this._container.innerHTML = html;
  }
  
  // ========== State Management ==========
  
  /**
   * Get plugin state
   * @returns {Object} Current state
   */
  get state() {
    return this._state;
  }
  
  /**
   * Update plugin state
   * @param {Object} newState - State updates
   */
  setState(newState) {
    this._state = { ...this._state, ...newState };
    if (this._mounted) {
      this._render();
      this.bindEvents();
    }
  }
  
  // ========== DOM Utilities ==========
  
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }
  
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  /**
   * Query selector in container
   * @param {string} selector - CSS selector
   * @returns {HTMLElement} Element or null
   */
  $(selector) {
    return this._container?.querySelector(selector);
  }
  
  /**
   * Query selector all in container
   * @param {string} selector - CSS selector
   * @returns {NodeList} Elements
   */
  $$(selector) {
    return this._container?.querySelectorAll(selector) || [];
  }
  
  // ========== Event Handling ==========
  
  bindEvents() {}
  
  /**
   * Bind event listeners
   * Override this method to add event listeners
   */
  bindEvents() {}
  
  /**
   * Emit plugin event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    this.eventBus.emit(`${this.id}:${event}`, data);
  }
  
  /**
   * Subscribe to event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    return this.eventBus.on(event, handler);
  }
  
  // ========== Service Calls ==========
  
  /**
   * Call a service method
   * @param {string} serviceName - Service name
   * @param {string} method - Method name
   * @param {...*} args - Method arguments
   * @returns {Promise<*>} Result
   */
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
  
  // ========== Internationalization ==========
  
  /**
   * Translate a key
   * @param {string} key - Translation key
   * @param {Object} params - Parameters
   * @returns {string} Translated text
   */
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }
  
  // ========== Settings ==========
  
  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  getSetting(key) {
    return this.settings.get(key);
  }
  
  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {*} value - New value
   */
  async setSetting(key, value) {
    return this.settings.set(key, value);
  }
  
  // ========== Utilities ==========
  
  /**
   * Generate a unique ID
   * @param {string} prefix - ID prefix
   * @returns {string} Unique ID
   */
  generateId(prefix = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix ? `${prefix}_${id}` : id;
  }
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Get current user ID
   * @returns {string} User ID
   */
  getCurrentUserId() {
    return window.app?.user?.id || 'unknown';
  }
  
  getCurrentUserName() {
    return window.app?.user?.name || 'Unknown';
  }
}

export default Plugin;
  /**
   * Get current user name
   * @returns {string} User name
   */
  getCurrentUserName() {
    return window.app?.user?.name || 'Unknown';
  }
  
  /**
   * Navigate to a route
   * @param {string} path - Route path
   */
  navigate(path) {
    if (this.router) {
      this.router.navigate(path);
    }
  }
}

export default Plugin;
 * Base Plugin Class
 * All plugins should extend this class
 */

export class PluginBase {
  constructor(context) {
    this.context = context;
    this.manifest = context.manifest;
    this.id = this.manifest.id;
    this.name = this.manifest.name;
    this.version = this.manifest.version;
    
    this.activated = false;
    this.installed = false;
  }

  /**
   * Called when plugin is first installed
   * Override in subclass for custom installation logic
   */
  async onInstall() {
    // Default: no-op
    console.log(`[Plugin ${this.id}] Installed`);
    this.installed = true;
  }

  /**
   * Called when plugin is activated
   * Override in subclass to initialize plugin
   */
  async onActivate() {
    // Default: no-op
    console.log(`[Plugin ${this.id}] Activated`);
    this.activated = true;
  }

  /**
   * Called when plugin is deactivated
   * Override in subclass to cleanup resources
   */
  async onDeactivate() {
    // Default: no-op
    console.log(`[Plugin ${this.id}] Deactivated`);
    this.activated = false;
  }

  /**
   * Called when plugin is uninstalled
   * Override in subclass to cleanup persistent data
   */
  async onUninstall() {
    // Default: no-op
    console.log(`[Plugin ${this.id}] Uninstalled`);
    this.installed = false;
  }

  /**
   * Called when plugin receives a message
   * Override in subclass to handle messages
   * @param {Object} message - Message object
   */
  async onMessage(message) {
    console.log(`[Plugin ${this.id}] Received message:`, message);
  }

  /**
   * Render plugin UI
   * Override in subclass to provide custom UI
   * @returns {string|HTMLElement} HTML string or DOM element
   */
  render() {
    return `
      <div class="plugin-default">
        <h2>${this.getName()}</h2>
        <p>Plugin: ${this.id}</p>
        <p>Version: ${this.version}</p>
      </div>
    `;
  }

  /**
   * Get localized plugin name
   * @param {string} [lang] - Language code (defaults to current language)
   * @returns {string} Localized name
   */
  getName(lang) {
    const currentLang = lang || this.context.i18n.currentLang;
    return this.name[currentLang] || this.name.en || this.id;
  }

  /**
   * Get localized plugin description
   * @param {string} [lang] - Language code
   * @returns {string} Localized description
   */
  getDescription(lang) {
    if (!this.manifest.description) return '';
    const currentLang = lang || this.context.i18n.currentLang;
    return this.manifest.description[currentLang] || this.manifest.description.en || '';
  }

  /**
   * Emit event to plugin event bus
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   */
  emit(event, ...args) {
    this.context.eventBus.emit(`plugin:${this.id}:${event}`, ...args);
    this.context.eventBus.emit('plugin:*', this.id, event, ...args);
  }

  /**
   * Subscribe to event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    return this.context.eventBus.on(`plugin:${this.id}:${event}`, callback, this);
  }

  /**
   * Subscribe to event once
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    return this.context.eventBus.once(`plugin:${this.id}:${event}`, callback, this);
  }

  /**
   * Get plugin storage
   * @returns {Object} Storage API
   */
  get storage() {
    return this.context.storage;
  }

  /**
   * Get plugin settings
   * @returns {Object} Settings API
   */
  get settings() {
    return this.context.settings;
  }

  /**
   * Get service by name
   * @param {string} name - Service name
   * @returns {Object} Service instance
   */
  getService(name) {
    return this.context.services[name];
  }

  /**
   * Check if plugin has permission
   * @param {string} permission - Permission string (e.g., "database:read")
   * @returns {boolean} True if has permission
   */
  hasPermission(permission) {
    return this.context.permissions.has(permission);
  }
}
