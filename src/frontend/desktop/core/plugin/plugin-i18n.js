/**
 * Plugin I18n
 * Provides internationalization for plugins
 */

export class PluginI18n {
  constructor(manifest) {
    this.pluginId = manifest.id;
    this.locale = document.documentElement.lang || 'zh';
    this.fallbackLocale = 'en';
    this.messages = {};
    
    this.loadLocales(manifest);
  }

  /**
   * Load locale files
   * @param {Object} manifest - Plugin manifest
   * @private
   */
  async loadLocales(manifest) {
    const locales = ['zh', 'ja', 'en'];
    
    for (const locale of locales) {
      try {
        const response = await fetch(
          `/plugins/${this.pluginId}/locales/${locale}.json`
        );
        if (response.ok) {
          this.messages[locale] = await response.json();
        }
      } catch {
        // Ignore load failures
      }
    }
  }

  /**
   * Set current locale
   * @param {string} locale - Locale code (e.g., 'zh', 'en')
   */
  setLocale(locale) {
    this.locale = locale;
  }

  /**
   * Translate key with parameters
   * @param {string} key - Translation key (dot notation supported)
   * @param {Object} params - Parameters to replace in template
   * @returns {string} Translated text
   */
  t(key, params = {}) {
    // Try current locale
    let text = this.getNestedValue(this.messages[this.locale], key);
    
    // Fallback to default locale
    if (text === undefined) {
      text = this.getNestedValue(this.messages[this.fallbackLocale], key);
    }
    
    // Return key if not found
    if (text === undefined) {
      console.warn(`Missing translation: ${this.pluginId}.${key}`);
      return key;
    }
    
    // Replace parameters
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${param}}`, 'g'), String(value));
    }
    
    return text;
  }

  /**
   * Get nested value from object by path
   * @param {Object} obj - Object to traverse
   * @param {string} key - Dot-separated path
   * @returns {*} Value at path
   * @private
   */
  getNestedValue(obj, key) {
    if (!obj) return undefined;
    
    return key.split('.').reduce((current, part) => {
      return current && current[part];
    }, obj);
  }

  /**
   * Check if translation exists
   * @param {string} key - Translation key
   * @returns {boolean} True if translation exists
   */
  has(key) {
    return this.getNestedValue(this.messages[this.locale], key) !== undefined ||
           this.getNestedValue(this.messages[this.fallbackLocale], key) !== undefined;
  }

  /**
   * Get current locale
   * @returns {string} Current locale code
   */
  getLocale() {
    return this.locale;
  }

  /**
   * Get all messages for current locale
   * @returns {Object} Messages object
   */
  getMessages() {
    return this.messages[this.locale] || {};
  }
}

export default PluginI18n;
