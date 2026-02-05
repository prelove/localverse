/**
 * PluginSettings - Manages plugin configuration with validation
 */

export class PluginSettings {
  constructor(manifest) {
    this.pluginId = manifest?.id || 'unknown';
    this.schema = manifest?.settings || {};
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
      this.values[key] = config?.default;
    }
  }

  /**
   * Load saved settings from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(`plugin_settings_${this.pluginId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate each loaded value against schema
        for (const [key, value] of Object.entries(parsed)) {
          const config = this.schema[key];
          if (config && this.validate(key, value, config)) {
            this.values[key] = value;
          }
        }
      }
    } catch {
      // Ignore invalid data
    }
  }

  /**
   * Save settings to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(
        `plugin_settings_${this.pluginId}`,
        JSON.stringify(this.values)
      );
    } catch (e) {
      console.error(`Failed to save settings for plugin ${this.pluginId}:`, e);
    }
  }

  /**
   * Get a setting value
   */
  get(key, defaultValue = null) {
    return this.values.hasOwnProperty(key) ? this.values[key] : defaultValue;
  }

  /**
   * Set a setting value
   */
  set(key, value) {
    const config = this.schema[key];
    if (config && !this.validate(key, value, config)) {
      throw new Error(`Invalid value for setting ${key}: ${value}`);
    }
    
    this.values[key] = value;
    this.saveToStorage();
    this.notify(key, value);
  }

  /**
   * Get all settings
   */
  getAll() {
    return { ...this.values };
  }

  /**
   * Set multiple settings
   */
  setMultiple(values) {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.values = {};
    this.loadDefaults();
    this.saveToStorage();
    this.notifyAll();
  }

  /**
   * Validate a value against schema
   */
  validate(key, value, config) {
    if (!config) return true;
    
    // Type validation
    if (config.type && typeof value !== config.type) {
      return false;
    }
    
    // Enum validation
    if (config.enum && !config.enum.includes(value)) {
      return false;
    }
    
    // Number range
    if (config.type === 'number') {
      if (config.min !== undefined && value < config.min) return false;
      if (config.max !== undefined && value > config.max) return false;
    }
    
    // String pattern
    if (config.type === 'string' && config.pattern) {
      const regex = new RegExp(config.pattern);
      if (!regex.test(value)) return false;
    }
    
    return true;
  }

  /**
   * Subscribe to setting changes
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners of a change
   */
  notify(key, value) {
    for (const listener of this.listeners) {
      try {
        listener(key, value, this.values);
      } catch (e) {
        console.error('Settings change listener error:', e);
      }
    }
  }

  /**
   * Notify listeners of all changes
   */
  notifyAll() {
    for (const listener of this.listeners) {
      try {
        listener(null, null, this.values);
      } catch (e) {
        console.error('Settings change listener error:', e);
      }
    }
  }

  /**
   * Get setting schema
   */
  getSchema() {
    return { ...this.schema };
  }

  /**
   * Check if setting exists
   */
  has(key) {
    return this.schema.hasOwnProperty(key);
  }

  /**
   * Remove a setting
   */
  remove(key) {
    delete this.values[key];
    this.saveToStorage();
    this.notify(key, undefined);
  }
}

export default PluginSettings;
