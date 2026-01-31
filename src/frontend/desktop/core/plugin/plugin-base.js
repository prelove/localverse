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
    this.ui = context.ui;
    
    this._state = {};
    this._mounted = false;
    this._shadowRoot = null;
    this._container = null;
  }
  
  // ========== Lifecycle Hooks ==========
  
  /**
   * Called when plugin is installed (first time only)
   * Use for database table creation, default configuration, etc.
   */
  async onInstall() {}
  
  /**
   * Called when plugin is uninstalled
   * Use for cleanup, data removal, etc.
   */
  async onUninstall() {}
  
  /**
   * Called when plugin is activated (every app launch)
   * Use for event registration, background tasks, etc.
   */
  async onActivate() {}
  
  /**
   * Called when plugin is deactivated
   * Use for event removal, stopping tasks, etc.
   */
  async onDeactivate() {}
  
  /**
   * Called when settings change
   * @param {string} key - Changed setting key
   * @param {*} value - New value
   * @param {*} oldValue - Old value
   */
  async onSettingsChange(key, value, oldValue) {}
  
  // ========== Rendering ==========
  
  /**
   * Render main UI
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
    
    // Create Shadow DOM
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
   * Render content to Shadow DOM
   * @private
   */
  _render() {
    if (!this._shadowRoot) return;
    
    this._shadowRoot.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
  }
  
  /**
   * Force re-render
   */
  forceUpdate() {
    if (this._mounted) {
      this._render();
      this.bindEvents();
    }
  }
  
  // ========== State Management ==========
  
  /**
   * Get current state
   * @returns {Object} Current state
   */
  get state() {
    return this._state;
  }
  
  /**
   * Update state and re-render
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
   * Query selector in Shadow DOM
   * @param {string} selector - CSS selector
   * @returns {Element|null} Matched element
   */
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }
  
  /**
   * Query all in Shadow DOM
   * @param {string} selector - CSS selector
   * @returns {NodeList} Matched elements
   */
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  }
  
  // ========== Event Handling ==========
  
  /**
   * Bind DOM events (override in subclass)
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
   * Listen to event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    return this.eventBus.on(event, handler);
  }
  
  /**
   * Listen to event once
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  once(event, handler) {
    return this.eventBus.once(event, handler);
  }
  
  // ========== Service Calls ==========
  
  /**
   * Call service method
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
   * Translate key
   * @param {string} key - Translation key
   * @param {Object} params - Parameters
   * @returns {string} Translated text
   */
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }
  
  // ========== Settings ==========
  
  /**
   * Get setting value
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  getSetting(key) {
    return this.settings.get(key);
  }
  
  /**
   * Set setting value
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    return this.settings.set(key, value);
  }
  
  // ========== Utilities ==========
  
  /**
   * Generate unique ID
   * @param {string} prefix - ID prefix
   * @returns {string} Unique ID
   */
  generateId(prefix = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix ? `${prefix}_${id}` : id;
  }
  
  /**
   * Escape HTML
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
   * Show toast notification
   * @param {string} message - Message text
   * @param {string} type - Toast type (info, success, warning, error)
   */
  showToast(message, type = 'info') {
    if (this.ui && this.ui.showToast) {
      this.ui.showToast(message, type);
    }
  }
  
  /**
   * Show modal dialog
   * @param {Object} options - Modal options
   * @returns {Promise<*>} Modal result
   */
  showModal(options) {
    if (this.ui && this.ui.showModal) {
      return this.ui.showModal(options);
    }
    return Promise.resolve(null);
  }
  
  /**
   * Show confirm dialog
   * @param {string} message - Confirm message
   * @returns {Promise<boolean>} True if confirmed
   */
  showConfirm(message) {
    if (this.ui && this.ui.showConfirm) {
      return this.ui.showConfirm(message);
    }
    return Promise.resolve(false);
  }
}

export default Plugin;
