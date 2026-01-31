/**
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
