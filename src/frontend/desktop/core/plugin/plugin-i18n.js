/**
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
   * @param {string} locale
   */
  setLocale(locale) {
    this.locale = locale;
  }

  /**
   * Translate key with parameters
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
   * @param {string} key
   * @returns {boolean}
   */
  
  has(key) {
    return this.getNestedValue(this.messages[this.locale], key) !== undefined ||
           this.getNestedValue(this.messages[this.fallbackLocale], key) !== undefined;
  }
}

export default PluginI18n;
