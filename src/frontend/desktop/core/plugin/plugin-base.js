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
    this._mounted = true;

    // Render the plugin
    const content = this.render();
    if (content) {
      if (typeof content === 'string') {
        container.innerHTML = content;
      } else if (content instanceof Node) {
        container.appendChild(content);
      }
    }

    // Bind events
    this.bindEvents?.(container);
  }

  /**
   * Unmount the plugin
   */
  unmount() {
    if (!this._mounted) return;
    
    this._mounted = false;
    
    if (this._container) {
      this._container.innerHTML = '';
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
   * Set state
   * @param {string} key - State key
   * @param {any} value - State value
   */
  setState(key, value) {
    this._state[key] = value;
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
}

// Alias for backward compatibility
export class Plugin extends PluginBase {}
export default PluginBase;
