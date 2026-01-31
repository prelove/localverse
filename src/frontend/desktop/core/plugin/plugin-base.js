/**
 * Plugin Base Class
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
    this.router = context.router;
    
    this._state = {};
    this._mounted = false;
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
  
  /**
   * Unmount plugin from container
   */
  unmount() {
    if (this._container) {
      this._container.innerHTML = '';
    }
    this._mounted = false;
  }
  
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
