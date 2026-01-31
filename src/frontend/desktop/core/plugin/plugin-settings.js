/**
 * Plugin Settings Manager
 * Manages plugin configuration with validation
 */

export class PluginSettings {
  constructor(manifest) {
    this.pluginId = manifest.id;
    this.schema = manifest.settings || {};
    this.values = {};
    this.listeners = [];
    
    this.loadDefaults();
    this.loadFromStorage();
  }

  /**
   * Load default values from schema
   */
  loadDefaults() {
    for (const [key, config] of Object.entries(this.schema)) {
      this.values[key] = config.default;
    }
  }

  /**
   * Load settings from localStorage
   */
  loadFromStorage() {
    const stored = localStorage.getItem(`plugin_settings_${this.pluginId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.values = { ...this.values, ...parsed };
      } catch {
        // Ignore invalid data
      }
    }
  }

  /**
   * Save settings to localStorage
   */
  saveToStorage() {
    localStorage.setItem(
      `plugin_settings_${this.pluginId}`,
      JSON.stringify(this.values)
    );
  }

  /**
   * Get setting value
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    if (key in this.values) {
      return this.values[key];
    }
    
    const config = this.schema[key];
    return config?.default;
  }

  /**
   * Set setting value
   * @param {string} key
   * @param {any} value
   */
  async set(key, value) {
    const config = this.schema[key];
    if (!config) {
      throw new Error(`Unknown setting: ${key}`);
    }
    
    // Validate
    if (!this.validate(key, value, config)) {
      throw new Error(`Invalid value for setting: ${key}`);
    }
    
    const oldValue = this.values[key];
    this.values[key] = value;
    this.saveToStorage();
    
    // Notify listeners
    for (const listener of this.listeners) {
      try {
        await listener(key, value, oldValue);
      } catch (error) {
        console.error('Settings listener error:', error);
      }
    }
  }

  /**
   * Validate setting value
   * @param {string} key
   * @param {any} value
   * @param {Object} config
   * @returns {boolean}
   */
  validate(key, value, config) {
    switch (config.type) {
      case 'boolean':
        return typeof value === 'boolean';
        
      case 'number':
        if (typeof value !== 'number') return false;
        if (config.min !== undefined && value < config.min) return false;
        if (config.max !== undefined && value > config.max) return false;
        return true;
        
      case 'string':
        if (typeof value !== 'string') return false;
        if (config.pattern && !new RegExp(config.pattern).test(value)) return false;
        return true;
        
      case 'select':
        return config.options?.includes(value);
        
      case 'array':
        return Array.isArray(value);
        
      default:
        return true;
    }
  }

  /**
   * Get all settings
   * @returns {Object}
   */
  getAll() {
    return { ...this.values };
  }

  /**
   * Reset setting to default
   * @param {string} key - Optional, if not provided resets all
   */
  async reset(key) {
    if (key) {
      const config = this.schema[key];
      if (config) {
        await this.set(key, config.default);
      }
    } else {
      // Reset all
      this.loadDefaults();
      this.saveToStorage();
    }
  }

  /**
   * Listen for setting changes
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get settings schema
   * @returns {Object}
   */
  getSchema() {
    return this.schema;
  }
}

export default PluginSettings;
