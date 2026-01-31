/**
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
