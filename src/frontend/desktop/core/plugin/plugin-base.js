/**
 * Plugin - Base class for all Localverse plugins
 * Provides lifecycle hooks, state management, and utilities
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
   * @returns {Promise<void>}
   */
  async onInstall() {}
  
  /**
   * Called when plugin is uninstalled
   * @returns {Promise<void>}
   */
  async onUninstall() {}
  
  /**
   * Called when plugin is activated
   * @returns {Promise<void>}
   */
  async onActivate() {}
  
  /**
   * Called when plugin is deactivated
   * @returns {Promise<void>}
   */
  async onDeactivate() {}
  
  /**
   * Called when a setting changes
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @param {*} oldValue - Old value
   * @returns {Promise<void>}
   */
  async onSettingsChange(key, value, oldValue) {}
  
  // ========== Rendering ==========
  
  /**
   * Render plugin content
   * @returns {string} HTML content
   */
  render() {
    return '<div>Plugin content</div>';
  }
  
  /**
   * Plugin styles
   * @returns {string} CSS styles
   */
  styles() {
    return '';
  }
  
  /**
   * Mount plugin to a container
   * @param {HTMLElement} container - Container element
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
   * Unmount plugin from container
   */
  unmount() {
    if (this._container && this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
    }
    this._mounted = false;
  }
  
  /**
   * Internal render method
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
   * @returns {Object} Current state
   */
  get state() {
    return this._state;
  }
  
  /**
   * Update plugin state and re-render
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
   * Query selector in shadow root
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Element or null
   */
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }
  
  /**
   * Query selector all in shadow root
   * @param {string} selector - CSS selector
   * @returns {NodeList} Node list
   */
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  }
  
  // ========== Event Handling ==========
  
  /**
   * Bind event handlers (override in subclass)
   */
  bindEvents() {}
  
  /**
   * Emit a plugin event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    this.eventBus.emit(`${this.id}:${event}`, data);
  }
  
  /**
   * Listen to an event
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
   * @returns {Promise<*>} Method result
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
   * @param {Object} params - Template parameters
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
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    return this.settings.set(key, value);
  }
  
  // ========== Utilities ==========
  
  /**
   * Generate a unique ID
   * @param {string} prefix - Optional prefix
   * @returns {string} Unique ID
   */
  generateId(prefix = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix ? `${prefix}_${id}` : id;
  }
  
  /**
   * Escape HTML to prevent XSS
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
}

export default Plugin;
