/**
 * PluginI18n - Internationalization for plugins
 * Loads and manages plugin translations
 * Plugin I18n
 * Provides internationalization for plugins
 * Plugin Internationalization
 * Manages plugin localization
 * Plugin I18n
 * 插件国际化支持
 * 
 * Internationalization support for plugins.
 * Loads locale files and provides translation functions.
 */

export class PluginI18n {
  constructor(manifest) {
    this.pluginId = manifest.id;
    this.locale = document.documentElement.lang || 'zh';
    this.fallbackLocale = 'en';
    this.messages = {};
    
    // Sync with global language changes
    this._syncLocale();
    
    // Note: Locales are loaded asynchronously via loadLocales()
  }
  
  /**
   * Sync locale with document language
   */
  _syncLocale() {
    // Update locale when document language changes
    const observer = new MutationObserver(() => {
      const newLocale = document.documentElement.lang;
      if (newLocale && newLocale !== this.locale) {
        this.locale = newLocale;
      }
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });
  }

  /**
   * Load locale files for the plugin
   * @param {string} pluginDir - Plugin directory path
   * @returns {Promise<void>}
   */
  async loadLocales(pluginDir) {
    const locales = ['zh', 'en', 'ja'];
    this.loadLocales(manifest);
  }

  /**
   * Load locale files
   * @param {Object} manifest - Plugin manifest
   * @private
   */
    // Load locales asynchronously
    this.loadLocales(manifest).catch(err => {
      console.warn(`Failed to load locales for plugin ${this.pluginId}:`, err);
    });
  }

  /**
   * Load locale messages
   * @param {Object} manifest
   */
    this.loadLocales(manifest);
  }
  
  async loadLocales(manifest) {
    const locales = ['zh', 'ja', 'en'];
    
    for (const locale of locales) {
      try {
        const response = await fetch(
          `${pluginDir}/locales/${locale}.json`
          `/plugins/${this.pluginId}/locales/${locale}.json`
        );
        if (response.ok) {
          this.messages[locale] = await response.json();
        }
      } catch {
        // Ignore loading failures
        // Ignore load failures
      }
    }
  }

  /**
   * Set current locale
   * @param {string} locale - Locale code
   * @param {string} locale - Locale code (e.g., 'zh', 'en')
   * @param {string} locale
   */
  setLocale(locale) {
    this.locale = locale;
  }

  /**
   * Get current locale
   * @returns {string} Current locale
   */
  getLocale() {
    return this.locale;
  }

  /**
   * Translate a key
   * @param {string} key - Translation key
   * @param {Object} params - Template parameters
   * @returns {string} Translated text
   */
  t(key, params = {}) {
   * Translate key with parameters
   * @param {string} key - Translation key (dot notation supported)
   * @param {Object} params - Parameters to replace in template
   * @returns {string} Translated text
   * @param {string} key - Translation key
   * @param {Object} params - Parameters for interpolation
   * @returns {string}
   */
  t(key, params = {}) {
    // Try current locale
    let text = this.getNestedValue(this.messages[this.locale], key);
    
    // Fallback to default locale
        // 忽略加载失败
        // Ignore loading failures
      }
    }
  }
  
  setLocale(locale) {
    this.locale = locale;
  }
  
  t(key, params = {}) {
    // 尝试当前语言
    let text = this.getNestedValue(this.messages[this.locale], key);
    
    // 回退到默认语言
    // Try current language
    let text = this.getNestedValue(this.messages[this.locale], key);
    
    // Fallback to default language
    if (text === undefined) {
      text = this.getNestedValue(this.messages[this.fallbackLocale], key);
    }
    
    // 找不到返回 key
    // Return key if not found
    if (text === undefined) {
      console.warn(`Missing translation: ${this.pluginId}.${key}`);
      return key;
    }
    
    // 替换参数
    // Replace parameters
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${param}}`, 'g'), String(value));
    }
    
    return text;
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Object to search
   * @param {string} key - Dot-separated key path
   * @returns {*} Value or undefined
   */
   * Get nested value from object by path
   * @param {Object} obj - Object to traverse
   * @param {string} key - Dot-separated path
   * @returns {*} Value at path
   * @private
   */
   * Get nested value from object using dot notation
   * @param {Object} obj
   * @param {string} key
   * @returns {any}
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
   * @returns {boolean} Whether translation exists
   */
   * @returns {boolean} True if translation exists
   */
   * @param {string} key
   * @returns {boolean}
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
