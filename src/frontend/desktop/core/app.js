/**
 * Localverse Application Main Class
 * Handles application lifecycle and initialization
 */

import { Router } from './router.js';
import store from './state.js';
import { I18n } from './i18n.js';
import { ThemeManager } from './theme.js';
import { PluginLoader, EventBus, PermissionManager } from './plugin/index.js';
import { PluginLoader, EventBus } from './plugin/index.js';

class LocalverseApp {
  constructor() {
    this.mode = null;
    this.user = null;
    this.services = {};
    this.pluginLoader = null;
    this.eventBus = null;
    this.permissionManager = null;
    this.eventBus = new EventBus();
    this.permissionManager = new PermissionManager();
    this.ready = false;
    
    this.router = new Router();
    this.store = store;
    this.i18n = new I18n();
    this.theme = new ThemeManager();
    this.eventBus = new EventBus();
    this.permissionManager = new PermissionManager();
    this.pluginLoader = null;
    this.pluginLoader = new PluginLoader(this);
    this.eventBus = eventBus;
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
      
      // 5. Initialize plugin system
      await this.initPluginSystem();
      this.updateSplash(this.i18n.t('splash.loading_plugins'));
      
      // 6. Setup routes
      this.setupRoutes();
      
      // 7. Render UI
      this.render();
      
      // 8. Hide splash
      // 5. Initialize services
      await this.initServices();
      this.updateSplash(this.i18n.t('splash.loading_services'));
      
      // 6. Initialize plugin system
      await this.initPluginSystem();
      this.updateSplash('Loading services...');
      
      // 6. Initialize plugins
      await this.initPlugins();
      this.updateSplash('Loading plugins...');
      // 5. Initialize services (mock for now)
      await this.initServices();
      this.updateSplash(this.i18n.t('splash.init_services'));
      
      // 6. Load plugins
      await this.loadPlugins();
      this.updateSplash(this.i18n.t('splash.loading_plugins'));
      
      // 7. Setup routes
      this.setupRoutes();
      
      // 8. Render UI
      this.render();
      
      // 9. Hide splash
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
   * Initialize plugin system
   */
  async initPluginSystem() {
    try {
      this.plugins = new PluginLoader({
      // Create event bus
      this.eventBus = new EventBus();
      
      // Create permission manager
      this.permissionManager = new PermissionManager();
      
      // Create plugin loader
      this.pluginLoader = new PluginLoader({
        pluginsDir: '/plugins',
        services: this.services,
        eventBus: this.eventBus,
        permissionManager: this.permissionManager
      });
      
      // Load all available plugins
      await this.plugins.loadAll();
      
      console.log(`Loaded ${this.plugins.getAll().length} plugins`);
    } catch (error) {
      console.error('Plugin system init failed:', error);
      // Non-fatal error, continue without plugins
   * Initialize services
   */
  async initServices() {
    // Import and initialize services based on mode
    try {
      // Always load communication layer
      const { CommunicationLayer } = await import('../services/comm/index.js');
      this.services.CommunicationLayer = new CommunicationLayer();
      
      // Load database service
      const { default: DatabaseService } = await import('../services/database/index.js');
      this.services.DatabaseService = DatabaseService;
      
      // Load search service if available
      try {
        const { SearchService } = await import('../services/search/index.js');
        this.services.SearchService = new SearchService();
      } catch {
        console.log('Search service not available');
      }
      
      // Load auth service
      try {
        const { AuthService } = await import('../services/auth/index.js');
        this.services.AuthService = new AuthService();
      } catch {
        console.log('Auth service not available');
      }
      
    // Import services dynamically based on mode
    try {
      const { DatabaseService } = await import('../services/database/index.js');
      const { SearchService } = await import('../services/search/index.js');
      const { CommunicationLayer } = await import('../services/comm/index.js');
      
      this.services.DatabaseService = new DatabaseService({ mode: this.mode });
      this.services.SearchService = new SearchService();
      this.services.CommunicationLayer = new CommunicationLayer();
      
      // Initialize database
      await this.services.DatabaseService.init();
      
      console.log('Services initialized:', Object.keys(this.services));
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }

  /**
   * Initialize plugin system
   */
  async initPluginSystem() {
  async initPlugins() {
    try {
      this.pluginLoader = new PluginLoader({
        pluginsDir: '/plugins',
        services: this.services,
        eventBus: this.eventBus
        eventBus: this.eventBus,
        router: this.router,
        databaseService: this.services.DatabaseService
      });
      
      // Load all plugins
      await this.pluginLoader.loadAll();
      
      console.log('Plugin system initialized:', this.pluginLoader.getAll().length, 'plugins loaded');
      
      // Listen to plugin events
      this.eventBus.on('plugin:loaded', (data) => {
        console.log('Plugin loaded:', data.id);
      });
      
      this.eventBus.on('plugin:unloaded', (data) => {
        console.log('Plugin unloaded:', data.id);
      });
      
    } catch (error) {
      console.error('Failed to initialize plugin system:', error);
      console.log('Plugins loaded:', this.pluginLoader.getAllManifests().map(m => m.id));
    } catch (error) {
      console.error('Failed to initialize plugin system:', error);
      // Store plugin loader reference
      this.plugins = this.pluginLoader;
      this.store.set('plugins', this.pluginLoader.getAllManifests());
      
      console.log('Plugins loaded:', this.pluginLoader.getAllManifests().map(m => m.id));
    } catch (error) {
      console.error('Failed to initialize plugins:', error);
    // Initialize mock services for now
    // In full mode, these would connect to JAR backend
    this.services = {
      database: { query: () => Promise.resolve([]) },
      filesystem: { list: () => Promise.resolve([]) },
      search: { search: (query) => Promise.resolve([]) }
    };
  }

  /**
   * Load plugins
   */
  async loadPlugins() {
    try {
      const result = await this.pluginLoader.loadAll();
      console.log(`[App] Plugins loaded: ${result.success}/${result.total}`);
      this.store.set('plugins', this.pluginLoader.getAllPlugins());
    } catch (error) {
      console.error('[App] Failed to load plugins:', error);
      // Continue without plugins
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
    await import('../components/header.js');
    await import('../components/sidebar.js');
    await import('../components/toast.js');
    
    // Initialize sidebar with plugins
    const sidebar = document.querySelector('lv-sidebar');
    if (sidebar) {
      const pluginManifests = this.pluginLoader.getAllPlugins().map(id => {
        const manifest = this.pluginLoader.getManifest(id);
        return {
          id: manifest.id,
          name: manifest.name[this.i18n.currentLang] || manifest.name.en || manifest.id,
          icon: manifest.icon || '📦'
        };
      });
      sidebar.setPlugins(pluginManifests);
      
      // Handle plugin selection
      sidebar.addEventListener('plugin-select', (event) => {
        const { pluginId } = event.detail;
        this.router.navigate(`/plugin/${pluginId}`);
      });
    }
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
  async showPlugin(pluginId) {
    const content = document.getElementById('content');
    
    if (!this.plugins) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin System Not Available</h1>
          <p>Plugin system is not initialized.</p>
    if (!this.pluginLoader) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin system not initialized</h1>
    // Check if plugin exists
    const plugin = this.pluginLoader?.get(pluginId);
    if (!plugin) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin not found: ${pluginId}</h1>
          <p>The requested plugin is not installed or could not be loaded.</p>
    if (!this.pluginLoader) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin System</h1>
          <p>Plugin system is not initialized yet...</p>
        </div>
      `;
      return;
    }
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin Not Found</h1>
          <p>Plugin '${pluginId}' is not installed or loaded.</p>
    const plugin = this.pluginLoader.get(pluginId);
    // Try to get plugin instance
    const plugin = this.pluginLoader.getPlugin(pluginId);
    
    if (!plugin) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin not found: ${this.escapeHtml(pluginId)}</h1>
          <p>Available plugins:</p>
          <ul>
            ${this.pluginLoader.getAllManifests().map(m => 
              `<li><a href="#/plugin/${m.id}">${m.name.zh || m.name.en || m.id}</a></li>`
            ).join('')}
          </ul>
          <h1>Plugin Not Found</h1>
          <p>Plugin "${pluginId}" is not available.</p>
          <p>Available plugins: ${this.pluginLoader.getAllManifests().map(m => m.id).join(', ')}</p>
          <p>Plugin "${pluginId}" is not loaded.</p>
          <a href="#/">← Back to Home</a>
        </div>
      `;
      return;
    }
    
    // Clear content and mount plugin
    content.innerHTML = '<div id="plugin-container"></div>';
    const container = document.getElementById('plugin-container');
    plugin.mount(container);
    // Create container for plugin
    content.innerHTML = `
      <div class="plugin-page">
        <div class="plugin-header">
          <h1>${plugin.manifest.name.zh || plugin.manifest.name.en || plugin.manifest.id}</h1>
          <p class="plugin-description">${plugin.manifest.description?.zh || plugin.manifest.description?.en || ''}</p>
        </div>
        <div id="plugin-container-${pluginId}" class="plugin-container"></div>
    // Create plugin container
    content.innerHTML = `
      <div class="plugin-page">
        <div id="plugin-${pluginId}" class="plugin-container"></div>
      </div>
    `;
    
    // Mount plugin
    const container = document.getElementById(`plugin-container-${pluginId}`);
    if (container) {
      plugin.mount(container);
    }
    const container = document.getElementById(`plugin-${pluginId}`);
    if (container) {
      plugin.mount(container);
    }
    content.innerHTML = '<div id="plugin-container" class="plugin-container"></div>';
    const container = document.getElementById('plugin-container');
    
    // Mount plugin
    try {
      plugin.mount(container);
      this.store.set('activePlugin', pluginId);
    } catch (error) {
      console.error('Failed to mount plugin:', error);
      content.innerHTML = `
        <div class="plugin-page">
          <h1>Plugin Error</h1>
          <p>Failed to load plugin "${pluginId}": ${error.message}</p>
        </div>
      `;
    }

    // Activate plugin if not already active
    if (!plugin.activated) {
      try {
        await this.pluginLoader.activatePlugin(pluginId);
      } catch (error) {
        console.error(`Failed to activate plugin ${pluginId}:`, error);
        content.innerHTML = `
          <div class="plugin-page">
            <h1>Plugin Activation Failed</h1>
            <p>${error.message}</p>
            <a href="#/">← Back to Home</a>
          </div>
        `;
        return;
      }
    }

    // Load plugin CSS if available
    const manifest = this.pluginLoader.getManifest(pluginId);
    if (manifest.style) {
      const styleId = `plugin-style-${pluginId}`;
      if (!document.getElementById(styleId)) {
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        link.href = `/plugins/${pluginId}/${manifest.style}`;
        document.head.appendChild(link);
      }
    }

    // Render plugin UI
    content.innerHTML = '';
    const pluginContainer = document.createElement('div');
    pluginContainer.className = 'plugin-container';
    pluginContainer.dataset.pluginId = pluginId;
    
    const rendered = plugin.render();
    if (typeof rendered === 'string') {
      pluginContainer.innerHTML = rendered;
    } else {
      pluginContainer.appendChild(rendered);
    }
    
    content.appendChild(pluginContainer);

    // Bind events if plugin has bindEvents method
    if (typeof plugin.bindEvents === 'function') {
      plugin.bindEvents(pluginContainer);
    }
    
    // Update store
    this.store.set('activePlugin', pluginId);
  }

  /**
   * Show settings page
   */
  showSettings() {
    const content = document.getElementById('content');
    
    // Get loaded plugins
    const plugins = this.pluginLoader ? this.pluginLoader.getAllManifests() : [];
    
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
        
        <div class="settings-section">
          <h2>Plugins</h2>
          ${plugins.length > 0 ? `
            <ul class="plugin-list">
              ${plugins.map(p => `
                <li>
                  <span class="plugin-name">${p.name.zh || p.name.en || p.id}</span>
                  <span class="plugin-version">v${p.version}</span>
                  <a href="#/plugin/${p.id}" class="plugin-link">Open</a>
                </li>
              `).join('')}
            </ul>
          ` : '<p>No plugins loaded</p>'}
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
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Show toast notification
   * @param {string} message - Message text
   * @param {string} type - Toast type (info, success, warning, error)
   */
  showToast(message, type = 'info') {
    // This will be implemented by the toast component
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message, type }
    }));
  }
  
  /**
   * Show modal dialog
   * @param {Object} options - Modal options
   * @returns {Promise<*>} Modal result
   */
  showModal(options) {
    // This will be implemented by the modal component
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('show-modal', {
        detail: { options, resolve }
      }));
    });
  }
  
  /**
   * Show confirm dialog
   * @param {string} message - Confirm message
   * @returns {Promise<boolean>} True if confirmed
   */
  showConfirm(message) {
    return this.showModal({
      type: 'confirm',
      message
    });
  }
  
  /**
   * Show prompt dialog
   * @param {string} message - Prompt message
   * @param {string} defaultValue - Default input value
   * @returns {Promise<string|null>} User input or null
   */
  showPrompt(message, defaultValue = '') {
    return this.showModal({
      type: 'prompt',
      message,
      defaultValue
    });
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
