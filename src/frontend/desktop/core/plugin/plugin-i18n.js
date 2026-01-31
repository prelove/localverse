/**
 * PluginI18n - Internationalization for plugins
 * Loads and manages plugin translations
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
    
    for (const locale of locales) {
      try {
        const response = await fetch(
          `${pluginDir}/locales/${locale}.json`
        );
        if (response.ok) {
          this.messages[locale] = await response.json();
        }
      } catch {
        // Ignore loading failures
      }
    }
  }

  /**
   * Set current locale
   * @param {string} locale - Locale code
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
    // Try current language
    let text = this.getNestedValue(this.messages[this.locale], key);
    
    // Fallback to default language
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
   * Get nested value from object
   * @param {Object} obj - Object to search
   * @param {string} key - Dot-separated key path
   * @returns {*} Value or undefined
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
  has(key) {
    return this.getNestedValue(this.messages[this.locale], key) !== undefined ||
           this.getNestedValue(this.messages[this.fallbackLocale], key) !== undefined;
  }
}

export default PluginI18n;
