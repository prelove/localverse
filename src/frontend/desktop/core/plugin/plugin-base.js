/**
 * Plugin Base Class
 * All plugins must extend this class
 */

export class PluginBase {
  /**
   * Plugin ID (must be overridden by subclasses)
   * @type {string}
   */
  static id = 'base-plugin';

  /**
   * @param {Object} context - Plugin context
   */
  constructor(context) {
    this.context = context;
    this.id = this.constructor.id;
    this.manifest = context?.manifest || {};
    this.services = context?.services || {};
    this.eventBus = context?.eventBus;
    this.storage = context?.storage;
    this.settings = context?.settings;
    this.i18n = context?.i18n;
    this.ui = context?.ui;
    
    this._state = {};
    this._mounted = false;
    this._activated = false;
    this._shadowRoot = null;
  }

  /**
   * Called when plugin is installed (first time only)
   */
  async onInstall() {
    // Override in subclass
  }

  /**
   * Called when plugin is activated
   */
  async onActivate() {
    // Override in subclass
    this._activated = true;
  }

  /**
   * Called when plugin is deactivated
   */
  async onDeactivate() {
    // Override in subclass
    this._activated = false;
  }

  /**
   * Mount the plugin to a DOM element
   * @param {HTMLElement} container - Container element
   */
  mount(container) {
    if (this._mounted) {
      console.warn(`Plugin ${this.id} is already mounted`);
      return;
    }

    this._container = container;
    this._shadowRoot = container.attachShadow({ mode: 'open' });
    this._mounted = true;

    this._render();
    this.bindEvents?.(this._shadowRoot);
  }

  /**
   * Unmount the plugin
   */
  unmount() {
    if (!this._mounted) return;
    
    this._mounted = false;
    
    if (this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
    }
  }

  /**
   * Render the plugin UI
   * @returns {string|HTMLElement} HTML string or DOM element
   */
  render() {
    // Override in subclass
    return `<div class="plugin-${this.id}">Plugin ${this.id}</div>`;
  }

  /**
   * Render plugin styles
   */
  styles() {
    return '';
  }

  /**
   * Set state
   * @param {string} key - State key
   * @param {any} value - State value
   */
  setState(key, value) {
    if (key && typeof key === 'object') {
      this._state = { ...this._state, ...key };
    } else {
      this._state[key] = value;
    }

    if (this._mounted) {
      this._render();
      this.bindEvents?.(this._shadowRoot);
    }
  }

  /**
   * Get state
   * @param {string} key - State key
   * @returns {any} State value
   */
  getState(key) {
    return this._state[key];
  }

  /**
   * Get all state
   * @returns {Object} All state
   */
  getAllState() {
    return { ...this._state };
  }

  /**
   * Get state
   */
  get state() {
    return this._state;
  }

  /**
   * Check if plugin is mounted
   * @returns {boolean}
   */
  isMounted() {
    return this._mounted;
  }

  /**
   * Check if plugin is activated
   * @returns {boolean}
   */
  isActivated() {
    return this._activated;
  }

  /**
   * Find element in shadow root
   */
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }

  /**
   * Find elements in shadow root
   */
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  }

  /**
   * Render and attach styles
   * @private
   */
  _render() {
    if (!this._shadowRoot) return;
    const content = this.render();
    const styles = this.styles?.() || '';

    if (typeof content === 'string') {
      this._shadowRoot.innerHTML = `
        <style>${styles}</style>
        ${content}
      `;
    } else {
      this._shadowRoot.innerHTML = `<style>${styles}</style>`;
      if (content instanceof Node) {
        this._shadowRoot.appendChild(content);
      }
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message
   * @param {string} type - Type (info, success, warning, error)
   */
  toast(message, type = 'info') {
    if (this.context?.app?.showToast) {
      this.context.app.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Navigate to a route
   * @param {string} path - Route path
   */
  navigate(path) {
    if (this.context?.router) {
      this.context.router.navigate(path);
    }
  }

  /**
   * Emit an event
   */
  emit(event, data) {
    return this.eventBus?.emit(`${this.id}:${event}`, data);
  }

  /**
   * Subscribe to an event
   */
  on(event, handler) {
    return this.eventBus?.on(event, handler);
  }

  /**
   * Call a service method
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

  /**
   * Get a setting value
   */
  getSetting(key, defaultValue = null) {
    return this.settings?.get?.(key, defaultValue);
  }

  /**
   * Set a setting value
   */
  async setSetting(key, value) {
    return this.settings?.set?.(key, value);
  }

  /**
   * Translate a key
   */
  t(key, params) {
    return this.i18n?.t?.(key, params) ?? key;
  }

  /**
   * Log helper
   */
  log(level, message, data) {
    const prefix = `[Plugin:${this.id}]`;
    if (level === 'error') {
      console.error(prefix, message, data);
    } else if (level === 'warn') {
      console.warn(prefix, message, data);
    } else {
      console.log(prefix, message, data);
    }
  }
}

// Alias for backward compatibility
export class Plugin extends PluginBase {}
export default PluginBase;
