/**
 * Internationalization System
 * Provides multi-language support
 */

class I18n {
  constructor() {
    this.locale = 'zh';
    this.messages = {};
    this.fallbackLocale = 'en';
  }

  /**
   * Initialize i18n system
   */
  async init() {
    // Try to load user's preferred locale from localStorage
    const savedLocale = localStorage.getItem('localverse_locale');
    if (savedLocale) {
      await this.setLocale(savedLocale);
    } else {
      // Use browser's language
      const browserLang = navigator.language.split('-')[0];
      await this.setLocale(browserLang);
    }
  }

  /**
   * Load language messages
   * @param {string} locale - Locale code (e.g., 'zh', 'en')
   */
  async load(locale) {
    if (this.messages[locale]) return;
    
    try {
      // Try to load from server
      const response = await fetch(`/locales/${locale}.json`);
      if (response.ok) {
        this.messages[locale] = await response.json();
      } else {
        // Fallback to embedded messages
        this.messages[locale] = this.getEmbeddedMessages(locale);
      }
    } catch (error) {
      console.warn(`Failed to load locale: ${locale}`);
      // Use embedded messages
      this.messages[locale] = this.getEmbeddedMessages(locale);
    }
  }

  /**
   * Get embedded default messages
   * @param {string} locale - Locale code
   * @returns {Object} Messages object
   */
  getEmbeddedMessages(locale) {
    const messages = {
      zh: {
        app: {
          name: 'Localverse',
          loading: '正在启动...',
          ready: '准备就绪'
        },
        splash: {
          detecting: '检测环境完成...',
          loading_config: '加载配置完成...',
          loading_services: '服务加载完成...',
          authenticating: '认证完成...',
          init_services: '服务初始化完成...',
          loading_plugins: '插件加载完成...'
        },
        home: {
          welcome: '欢迎使用 Localverse',
          subtitle: '请从左侧选择一个模块开始'
        },
        error: {
          startup_failed: '启动失败',
          not_found: '页面未找到',
          retry: '重试'
        },
        mode: {
          full: '完整模式',
          light: '轻量模式',
          pure: '纯浏览器模式'
        }
      },
      en: {
        app: {
          name: 'Localverse',
          loading: 'Loading...',
          ready: 'Ready'
        },
        splash: {
          detecting: 'Environment detected...',
          loading_config: 'Configuration loaded...',
          loading_services: 'Services loaded...',
          authenticating: 'Authenticated...',
          init_services: 'Services initialized...',
          loading_plugins: 'Plugins loaded...'
        },
        home: {
          welcome: 'Welcome to Localverse',
          subtitle: 'Please select a module from the sidebar'
        },
        error: {
          startup_failed: 'Startup Failed',
          not_found: 'Page Not Found',
          retry: 'Retry'
        },
        mode: {
          full: 'Full Mode',
          light: 'Light Mode',
          pure: 'Pure Browser Mode'
        }
      }
    };
    
    return messages[locale] || messages[this.fallbackLocale] || {};
  }

  /**
   * Set current locale
   * @param {string} locale - Locale code
   */
  async setLocale(locale) {
    await this.load(locale);
    this.locale = locale;
    document.documentElement.lang = locale;
    localStorage.setItem('localverse_locale', locale);
    
    // Trigger locale change event
    window.dispatchEvent(new CustomEvent('locale-change', { 
      detail: { locale } 
    }));
  }

  /**
   * Translate a key
   * @param {string} key - Translation key (e.g., 'app.name')
   * @param {Object} params - Replacement parameters
   * @returns {string} Translated text
   */
  t(key, params = {}) {
    const messages = this.messages[this.locale] || this.messages[this.fallbackLocale] || {};
    
    let text = key.split('.').reduce((obj, k) => obj && obj[k], messages);
    
    if (text === undefined) {
      console.warn(`Missing translation: ${key}`);
      return key;
    }
    
    // Replace parameters
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
    }
    
    return text;
  }

  /**
   * Handle pluralization
   * @param {string} key - Base translation key
   * @param {number} count - Count for pluralization
   * @param {Object} params - Additional parameters
   * @returns {string} Translated text
   */
  plural(key, count, params = {}) {
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    return this.t(pluralKey, { ...params, count });
  }

  /**
   * Get current locale
   * @returns {string} Current locale code
   */
  getLocale() {
    return this.locale;
  }

  /**
   * Get available locales
   * @returns {string[]} Array of locale codes
   */
  getAvailableLocales() {
    return Object.keys(this.messages);
  }
}

export { I18n };
export default I18n;
