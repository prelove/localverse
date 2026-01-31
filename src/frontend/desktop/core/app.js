/**
 * Localverse Application Main Class
 * Handles application lifecycle and initialization
 */

import { Router } from './router.js';
import store from './state.js';
import { I18n } from './i18n.js';
import { ThemeManager } from './theme.js';

class LocalverseApp {
  constructor() {
    this.mode = null;
    this.user = null;
    this.services = {};
    this.plugins = null;
    this.ready = false;
    
    this.router = new Router();
    this.store = store;
    this.i18n = new I18n();
    this.theme = new ThemeManager();
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      this.showSplash();
      
      // 1. Detect mode
      this.mode = await this.detectMode();
      this.store.set('mode', this.mode);
      this.updateSplash(this.i18n.t('splash.detecting'));
      
      // 2. Load configuration
      await this.loadConfig();
      this.updateSplash(this.i18n.t('splash.loading_config'));
      
      // 3. Initialize i18n
      await this.i18n.init();
      
      // 4. Initialize theme
      this.theme.init();
      
      // 5. Setup routes
      this.setupRoutes();
      
      // 6. Render UI
      this.render();
      
      // 7. Hide splash
      setTimeout(() => this.hideSplash(), 500);
      
      this.ready = true;
      this.dispatchEvent('app:ready');
      
    } catch (error) {
      console.error('App init failed:', error);
      this.showError(error);
    }
  }

  /**
   * Detect running mode (full/light/pure)
   * @returns {Promise<string>} Mode name
   */
  async detectMode() {
    const jarAvailable = await this.checkJarService();
    const wasmAvailable = await this.checkWasmSupport();
    
    if (jarAvailable && wasmAvailable) {
      return 'full';
    } else if (wasmAvailable) {
      return 'light';
    } else {
      return 'pure';
    }
  }

  /**
   * Check if JAR service is available
   * @returns {Promise<boolean>}
   */
  async checkJarService() {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch('http://127.0.0.1:8765/api/local/health', {
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if WASM is supported
   * @returns {Promise<boolean>}
   */
  async checkWasmSupport() {
    try {
      if (typeof WebAssembly !== 'object') return false;
      
      // Test basic WASM support
      const bytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
      ]);
      await WebAssembly.compile(bytes);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    const stored = localStorage.getItem('localverse_config');
    if (stored) {
      try {
        const config = JSON.parse(stored);
        this.store.set('config', config);
      } catch {
        // Use default config
      }
    }
  }

  /**
   * Setup routing
   */
  setupRoutes() {
    this.router.register('/', () => this.showHome());
    this.router.register('/plugin/:id', (params) => this.showPlugin(params.id));
    this.router.register('/settings', () => this.showSettings());
    this.router.register('*', () => this.show404());
  }

  /**
   * Render main UI
   */
  render() {
    const root = document.getElementById('app');
    root.innerHTML = `
      <lv-header mode="${this.mode}"></lv-header>
      <div class="main-container">
        <lv-sidebar></lv-sidebar>
        <main id="content" class="content"></main>
      </div>
      <lv-toast-container></lv-toast-container>
    `;
    
    // Import and initialize components
    this.initComponents();
    
    // Handle current route
    this.router.handleRoute();
  }

  /**
   * Initialize components
   */
  async initComponents() {
    // Import components dynamically
    await import('./components/header.js');
    await import('./components/sidebar.js');
    await import('./components/toast.js');
  }

  /**
   * Show home page
   */
  showHome() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="home-page">
        <h1>${this.i18n.t('home.welcome')}</h1>
        <p>${this.i18n.t('home.subtitle')}</p>
        <div class="mode-info">
          <p>Current Mode: <strong>${this.i18n.t('mode.' + this.mode)}</strong></p>
        </div>
      </div>
    `;
  }

  /**
   * Show plugin page
   * @param {string} pluginId - Plugin ID
   */
  showPlugin(pluginId) {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="plugin-page">
        <h1>Plugin: ${pluginId}</h1>
        <p>Plugin functionality coming soon...</p>
      </div>
    `;
  }

  /**
   * Show settings page
   */
  showSettings() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="settings-page">
        <h1>Settings</h1>
        <div class="settings-section">
          <h2>Theme</h2>
          <select id="themeSelect">
            <option value="light" ${this.theme.getTheme() === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.theme.getTheme() === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="high-contrast" ${this.theme.getTheme() === 'high-contrast' ? 'selected' : ''}>High Contrast</option>
          </select>
        </div>
        <div class="settings-section">
          <h2>Language</h2>
          <select id="languageSelect">
            <option value="zh" ${this.i18n.getLocale() === 'zh' ? 'selected' : ''}>中文</option>
            <option value="en" ${this.i18n.getLocale() === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
      </div>
    `;
    
    // Bind event handlers
    const themeSelect = document.getElementById('themeSelect');
    themeSelect?.addEventListener('change', (e) => {
      this.theme.setTheme(e.target.value);
    });
    
    const languageSelect = document.getElementById('languageSelect');
    languageSelect?.addEventListener('change', async (e) => {
      await this.i18n.setLocale(e.target.value);
      this.showSettings(); // Re-render
    });
  }

  /**
   * Show 404 page
   */
  show404() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="not-found">
        <h1>404</h1>
        <p>${this.i18n.t('error.not_found')}</p>
      </div>
    `;
  }

  /**
   * Show splash screen
   */
  showSplash() {
    document.getElementById('splash')?.classList.remove('hidden');
  }

  /**
   * Hide splash screen
   */
  hideSplash() {
    const splash = document.getElementById('splash');
    splash?.classList.add('fade-out');
    setTimeout(() => splash?.classList.add('hidden'), 300);
  }

  /**
   * Update splash screen message
   * @param {string} message - Status message
   */
  updateSplash(message) {
    const status = document.querySelector('#splash .splash-status');
    if (status) status.textContent = message;
  }

  /**
   * Show error page
   * @param {Error} error - Error object
   */
  showError(error) {
    document.getElementById('app').innerHTML = `
      <div class="error-page">
        <h1>${this.i18n.t('error.startup_failed')}</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()">${this.i18n.t('error.retry')}</button>
      </div>
    `;
  }

  /**
   * Dispatch custom event
   * @param {string} event - Event name
   * @param {*} detail - Event detail
   */
  dispatchEvent(event, detail = null) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

// Create global app instance
const app = new LocalverseApp();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Export for global access
window.app = app;
export default app;
