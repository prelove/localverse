/**
 * Plugin I18n
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
        // Ignore loading failures
      }
    }
  }
  
  setLocale(locale) {
    this.locale = locale;
  }
  
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
  
  getNestedValue(obj, key) {
    if (!obj) return undefined;
    
    return key.split('.').reduce((current, part) => {
      return current && current[part];
    }, obj);
  }
  
  has(key) {
    return this.getNestedValue(this.messages[this.locale], key) !== undefined ||
           this.getNestedValue(this.messages[this.fallbackLocale], key) !== undefined;
  }
}

export default PluginI18n;
