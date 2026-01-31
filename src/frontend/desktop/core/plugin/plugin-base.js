/**
 * Plugin Base Class
 * All plugins must extend this class
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
    this._container = null;
  }
  
  // ========== Lifecycle Hooks ==========
  
  /**
   * Called when plugin is first installed
   */
  async onInstall() {}
  
  /**
   * Called when plugin is uninstalled
   */
  async onUninstall() {}
  
  /**
   * Called when plugin is activated (every app start)
   */
  async onActivate() {}
  
  /**
   * Called when plugin is deactivated
   */
  async onDeactivate() {}
  
  /**
   * Called when settings change
   * @param {string} key
   * @param {any} value
   * @param {any} oldValue
   */
  async onSettingsChange(key, value, oldValue) {}
  
  // ========== Rendering ==========
  
  /**
   * Render plugin content
   * @returns {string} HTML string
   */
  render() {
    return '<div>Plugin content</div>';
  }
  
  /**
   * Plugin styles
   * @returns {string} CSS string
   */
  styles() {
    return '';
  }
  
  /**
   * Mount plugin to container
   * @param {HTMLElement} container
   */
  mount(container) {
    this._container = container;
    
    // Create Shadow DOM for style isolation
    this._shadowRoot = container.attachShadow({ mode: 'open' });
    
    this._mounted = true;
    this._render();
    this.bindEvents();
  }
  
  /**
   * Unmount plugin
   */
  unmount() {
    if (this._container && this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
    }
    this._mounted = false;
  }
  
  /**
   * Internal render
   */
  _render() {
    if (!this._shadowRoot) return;
    
    this._shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
  }
  
  // ========== State Management ==========
  
  /**
   * Get plugin state
   */
  get state() {
    return this._state;
  }
  
  /**
   * Update plugin state and re-render
   * @param {Object} newState
   */
  setState(newState) {
    this._state = { ...this._state, ...newState };
    if (this._mounted) {
      this._render();
      this.bindEvents();
    }
  }
  
  // ========== DOM Utilities ==========
  
  /**
   * Query selector in shadow root
   * @param {string} selector
   * @returns {HTMLElement}
   */
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }
  
  /**
   * Query all in shadow root
   * @param {string} selector
   * @returns {NodeList}
   */
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  }
  
  // ========== Event Binding ==========
  
  /**
   * Bind DOM events (override in subclass)
   */
  bindEvents() {}
  
  /**
   * Emit plugin event
   * @param {string} event
   * @param {any} data
   */
  emit(event, data) {
    this.eventBus.emit(`${this.id}:${event}`, data);
  }
  
  /**
   * Listen to event
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    return this.eventBus.on(event, handler);
  }
  
  // ========== Service Calls ==========
  
  /**
   * Call service method
   * @param {string} serviceName
   * @param {string} method
   * @param  {...any} args
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
   * Translate text
   * @param {string} key
   * @param {Object} params
   * @returns {string}
   */
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }
  
  // ========== Settings ==========
  
  /**
   * Get setting value
   * @param {string} key
   */
  getSetting(key) {
    return this.settings.get(key);
  }
  
  /**
   * Set setting value
   * @param {string} key
   * @param {any} value
   */
  async setSetting(key, value) {
    return this.settings.set(key, value);
  }
  
  // ========== Utilities ==========
  
  /**
   * Generate unique ID
   * @param {string} prefix
   * @returns {string}
   */
  generateId(prefix = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix ? `${prefix}_${id}` : id;
  }
  
  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Get current user ID
   * @returns {string}
   */
  getCurrentUserId() {
    return window.app?.user?.id || 'unknown';
  }
  
  /**
   * Get current user name
   * @returns {string}
   */
  getCurrentUserName() {
    return window.app?.user?.name || 'Unknown';
  }
}

export default Plugin;
