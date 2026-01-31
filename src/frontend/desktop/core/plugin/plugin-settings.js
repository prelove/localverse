/**
 * Plugin Settings
 * Manages plugin settings with validation and persistence
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
   * @private
   */
  loadDefaults() {
    for (const [key, config] of Object.entries(this.schema)) {
      this.values[key] = config.default;
    }
  }

  /**
   * Load values from localStorage
   * @private
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
   * Save values to localStorage
   * @private
   */
  saveToStorage() {
    localStorage.setItem(
      `plugin_settings_${this.pluginId}`,
      JSON.stringify(this.values)
    );
  }

  /**
   * Get setting value
   * @param {string} key - Setting key
   * @returns {*} Setting value
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
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @returns {Promise<void>}
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
   * @param {string} key - Setting key
   * @param {*} value - Value to validate
   * @param {Object} config - Setting configuration
   * @returns {boolean} True if valid
   * @private
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
   * @returns {Object} All setting values
   */
  getAll() {
    return { ...this.values };
  }

  /**
   * Reset setting(s) to default
   * @param {string} [key] - Setting key to reset (resets all if omitted)
   * @returns {Promise<void>}
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
      
      // Notify listeners for all settings
      for (const [settingKey, value] of Object.entries(this.values)) {
        for (const listener of this.listeners) {
          try {
            await listener(settingKey, value, undefined);
          } catch (error) {
            console.error('Settings listener error:', error);
          }
        }
      }
    }
  }

  /**
   * Register change listener
   * @param {Function} callback - Callback function (key, value, oldValue) => void
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
   * @returns {Object} Settings schema
   */
  getSchema() {
    return this.schema;
  }

  /**
   * Generate settings form HTML
   * @returns {string} HTML form
   */
  generateForm() {
    const entries = Object.entries(this.schema);
    if (entries.length === 0) {
      return '<p>此插件无可配置项</p>';
    }

    return `
      <div class="plugin-settings-form">
        ${entries.map(([key, config]) => this.generateField(key, config)).join('')}
      </div>
    `;
  }

  /**
   * Generate form field HTML
   * @param {string} key - Setting key
   * @param {Object} config - Setting configuration
   * @returns {string} HTML field
   * @private
   */
  generateField(key, config) {
    const value = this.get(key);
    const label = config.label?.zh || config.label?.en || key;
    const description = config.description?.zh || config.description?.en || '';

    let input = '';
    switch (config.type) {
      case 'boolean':
        input = `<input type="checkbox" id="setting-${key}" ${value ? 'checked' : ''}>`;
        break;
      case 'number':
        input = `<input type="number" id="setting-${key}" value="${value}" 
                  min="${config.min || ''}" max="${config.max || ''}">`;
        break;
      case 'select':
        input = `<select id="setting-${key}">
          ${config.options.map(opt => 
            `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
          ).join('')}
        </select>`;
        break;
      case 'string':
      default:
        input = `<input type="text" id="setting-${key}" value="${value}">`;
    }

    return `
      <div class="setting-field">
        <label for="setting-${key}">${label}</label>
        ${input}
        ${description ? `<small>${description}</small>` : ''}
      </div>
    `;
  }
}

export default PluginSettings;
