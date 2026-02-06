/**
 * PluginI18n - Internationalization for plugins
 */

export class PluginI18n {
  constructor(manifest) {
    this.pluginId = manifest?.id || 'unknown';
    this.locale = document.documentElement.lang || 'zh';
    this.fallbackLocale = manifest?.i18n?.fallback || 'en';
    this.messages = {};
    this._loaded = new Set();
  }

  /**
   * Load locale files for the plugin
   */
  async loadLocales(basePath = '/plugins') {
    const locales = ['zh', 'en', 'ja'];

    if (this.isFileProtocol()) {
      const { embeddedLocales } = await import('./embedded-plugin-data.js');
      const embedded = embeddedLocales[this.pluginId];
      if (embedded) {
        for (const locale of locales) {
          if (embedded[locale]) {
            this.messages[locale] = embedded[locale];
            this._loaded.add(locale);
          }
        }
      }
      return;
    }
    
    for (const locale of locales) {
      try {
        const response = await fetch(new URL(`${this.pluginId}/locales/${locale}.json`, basePath).href);
        if (response.ok) {
          this.messages[locale] = await response.json();
          this._loaded.add(locale);
        }
      } catch {
        // Ignore loading failures
      }
    }
  }

  /**
   * Translate a key
   * @param {string} key - Translation key (supports dot notation like "menu.file.open")
   * @param {Object} params - Parameters for interpolation
   * @returns {string} Translated text or key if not found
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
      return key;
    }
    
    // Replace parameters
    if (typeof text === 'string' && Object.keys(params).length > 0) {
      text = text.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
      });
    }
    
    return text;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Get current locale
   */
  getLocale() {
    return this.locale;
  }

  /**
   * Set current locale
   */
  setLocale(locale) {
    this.locale = locale;
  }

  /**
   * Get available locales
   */
  getAvailableLocales() {
    return Array.from(this._loaded);
  }

  isFileProtocol() {
    return typeof window !== 'undefined' && window.location?.protocol === 'file:';
  }

  /**
   * Check if a key exists
   */
  has(key) {
    return this.getNestedValue(this.messages[this.locale], key) !== undefined ||
           this.getNestedValue(this.messages[this.fallbackLocale], key) !== undefined;
  }
}

export default PluginI18n;
