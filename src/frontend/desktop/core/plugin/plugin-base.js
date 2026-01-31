/**
 * Plugin Base Class
 * 插件基类 - 所有插件必须继承此类
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
