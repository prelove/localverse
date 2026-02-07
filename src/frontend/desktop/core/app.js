/**
 * Localverse Application Main Class
 * Handles application lifecycle and initialization
 */

import { Router } from './router.js';
import store from './state.js';
import { I18n } from './i18n.js';
import { ThemeManager } from './theme.js';
import { PluginLoader, EventBus, PermissionManager } from './plugin/index.js';

class LocalverseApp {
  constructor() {
    this.mode = null;
    this.user = null;
    this.services = {};
    this.pluginLoader = null;
    this.eventBus = null;
    this.permissionManager = null;
    this.ready = false;
    
    this.router = new Router();
    this.store = store;
    this.i18n = new I18n();
    this.theme = new ThemeManager();
    this.eventBus = new EventBus();
    this.permissionManager = new PermissionManager();
    
    // Bind methods
    this.handlePluginSelect = this.handlePluginSelect.bind(this);
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      this.showSplash();

      // 1. Initialize i18n early to avoid missing translation warnings
      await this.i18n.init();
      
      // 2. Detect mode
      this.mode = await this.detectMode();
      this.store.set('mode', this.mode);
      this.updateSplash(this.i18n.t('splash.detecting') || '检测环境...');
      
      // 3. Load configuration
      await this.loadConfig();
      this.updateSplash(this.i18n.t('splash.loading_config') || '加载配置...');

      // 4. Initialize theme
      this.theme.init();
      
      // 5. Initialize services
      await this.initServices();
      this.updateSplash(this.i18n.t('splash.init_services') || '初始化服务...');

      // 6. Authenticate user
      this.updateSplash(this.i18n.t('splash.authenticating') || '认证中...');
      const authResult = await this.authenticateUser();
      if (authResult === 'setup-required') {
        await this.showSetup();
        return;
      }

      // 7. Continue initialization
      await this.finalizeInitialization();
      
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
      if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
        return false;
      }
      if (typeof window !== 'undefined') {
        const host = window.location?.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          return false;
        }
      }
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
   * Initialize services
   */
  async initServices() {
    this.services = {};

    if (this.mode === 'full') {
      try {
        const { CommunicationLayer } = await import('../services/comm/index.js');
        this.services.CommunicationLayer = new CommunicationLayer({
          serverUrl: 'http://127.0.0.1:8765'
        });
      } catch {
        // Communication layer unavailable in this environment.
      }
    }

    try {
      const { default: DatabaseServiceFactory, MockDatabaseService } = await import('../services/database/index.js');
      this.services.DatabaseService = await DatabaseServiceFactory.create(this.mode);
      if (!this.services.DatabaseService) {
        const mockDb = new MockDatabaseService();
        await mockDb.init();
        this.services.DatabaseService = mockDb;
      }
    } catch {
      const { MockDatabaseService } = await import('../services/database/index.js');
      const mockDb = new MockDatabaseService();
      await mockDb.init();
      this.services.DatabaseService = mockDb;
    }

    try {
      const { SearchService } = await import('../services/search/index.js');
      this.services.SearchService = new SearchService();
    } catch {
      this.services.SearchService = {
        searchFiles: async () => []
      };
    }

    try {
      const { AuthService } = await import('../services/auth/index.js');
      this.services.AuthService = new AuthService();
    } catch {
      this.services.AuthService = null;
    }

    if (!this.services.FileSystemService) {
      this.services.FileSystemService = {
        list: async () => [],
        readFile: async () => null,
        writeFile: async () => null,
        openFile: async () => null,
        watch: async () => ({ close() {} })
      };
    }

    if (this.mode === 'full' && this.services.CommunicationLayer) {
      try {
        await this.services.CommunicationLayer.connect();
      } catch (error) {
        console.warn('[App] Communication layer connection failed:', error);
      }
    }

    console.log('[App] Services initialized:', Object.keys(this.services));
  }

  /**
   * Authenticate current user
   * @returns {Promise<string>} auth result
   */
  async authenticateUser() {
    if (!this.services.AuthService) {
      console.log('[App] Auth service not available, skipping authentication');
      return 'skipped';
    }

    try {
      const user = await this.services.AuthService.authenticate();
      if (!user) {
        return 'setup-required';
      }

      this.user = user;
      this.store.set('user', user);
      return 'authenticated';
    } catch (error) {
      console.error('[App] Authentication failed:', error);
      this.showError(error);
      return 'failed';
    }
  }

  /**
   * Show setup UI for first-time configuration
   */
  async showSetup() {
    if (!this.services.AuthService) {
      this.showError(new Error('Auth service is unavailable'));
      return;
    }

    this.hideSplash();

    const { SetupUI } = await import('../services/auth/setup-ui.js');
    const root = document.getElementById('app');
    const setupUI = new SetupUI(root);

    return new Promise((resolve) => {
      setupUI.setOnComplete(async (userData) => {
        try {
          this.updateSplash(this.i18n.t('splash.loading_config') || '加载配置...');
          this.showSplash();

          const user = await this.services.AuthService.setup(userData);
          this.user = user;
          this.store.set('user', user);

          await this.finalizeInitialization();
          resolve(user);
        } catch (error) {
          this.showError(error);
          resolve(null);
        }
      });

      setupUI.render();
    });
  }

  /**
   * Finish initialization after authentication
   */
  async finalizeInitialization() {
    // Initialize plugin system
    await this.initPluginSystem();
    this.updateSplash(this.i18n.t('splash.loading_plugins') || '加载插件...');

    // Load plugins
    await this.loadPlugins();

    // Setup routes
    this.setupRoutes();

    // Render UI
    this.render();

    // Hide splash
    setTimeout(() => this.hideSplash(), 500);

    this.startBackgroundTasks();

    this.ready = true;
    this.dispatchEvent('app:ready');
    console.log('[App] Initialization complete');
  }

  /**
   * Initialize plugin system
   */
  async initPluginSystem() {
    try {
      const baseUrl = typeof document !== 'undefined' ? document.baseURI : window.location?.href;
      const pluginsDir = new URL('plugins/', baseUrl);

      this.pluginLoader = new PluginLoader({
        pluginsDir,
        services: this.services,
        eventBus: this.eventBus,
        router: this.router,
        permissionManager: this.permissionManager,
        app: this
      });
      
      // Listen to plugin events
      this.eventBus.on('plugin:loaded', (data) => {
        console.log('[App] Plugin loaded:', data.id);
      });
      
      this.eventBus.on('plugin:error', (data) => {
        console.error('[App] Plugin error:', data.id, data.error);
      });
      
    } catch (error) {
      console.error('[App] Failed to initialize plugin system:', error);
    }
  }

  /**
   * Load plugins
   */
  async loadPlugins() {
    if (!this.pluginLoader) return;
    
    try {
      const result = await this.pluginLoader.loadAll();
      console.log(`[App] Plugins loaded: ${result.loaded}/${result.total}`);
      this.store.set('plugins', this.pluginLoader.getAllManifests());
    } catch (error) {
      console.error('[App] Failed to load plugins:', error);
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
    try {
      // Import components dynamically
      await import('../components/header.js');
      await import('../components/sidebar.js');
      await import('../components/toast.js');
      await import('../components/modal.js');
      await import('../components/dropdown.js');
      await import('../components/tooltip.js');
      
      // Initialize sidebar with plugins
      const sidebar = document.querySelector('lv-sidebar');
      if (sidebar && this.pluginLoader) {
        const manifests = this.pluginLoader.getAllManifests();
        const pluginList = manifests.map(m => ({
          id: m.id,
          name: m.name[this.i18n.currentLang] || m.name.en || m.id,
          icon: m.icon || '📦'
        }));
        
        sidebar.setPlugins(pluginList);
        sidebar.addEventListener('plugin-select', this.handlePluginSelect);
      }
    } catch (error) {
      console.error('[App] Failed to initialize components:', error);
    }
  }

  /**
   * Handle plugin selection from sidebar
   * @param {CustomEvent} event
   */
  handlePluginSelect(event) {
    const { pluginId } = event.detail;
    if (pluginId) {
      this.router.navigate(`/plugin/${pluginId}`);
    }
  }

  /**
   * Show home page
   */
  showHome() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="home-page">
        <h1>${this.i18n.t('home.welcome') || '欢迎使用 Localverse'}</h1>
        <p>${this.i18n.t('home.subtitle') || '请从左侧选择一个模块开始'}</p>
        <div class="mode-info">
          <p>运行模式: <strong>${this.getModeDisplayName()}</strong></p>
        </div>
      </div>
    `;
  }

  /**
   * Get display name for current mode
   * @returns {string}
   */
  getModeDisplayName() {
    const names = {
      'full': '完整模式 (Full)',
      'light': '轻量模式 (Light)',
      'pure': '纯净模式 (Pure)'
    };
    return names[this.mode] || this.mode;
  }

  /**
   * Show plugin page
   * @param {string} pluginId - Plugin ID
   */
  async showPlugin(pluginId) {
    const content = document.getElementById('content');
    
    if (!this.pluginLoader) {
      content.innerHTML = `
        <div class="plugin-page">
          <h1>插件系统未初始化</h1>
          <p>插件系统尚未准备好，请稍后再试。</p>
          <a href="#/">← 返回首页</a>
        </div>
      `;
      return;
    }
    
    // Get plugin manifest
    const manifest = this.pluginLoader.getManifest(pluginId);
    if (!manifest) {
      const available = this.pluginLoader.getAllManifests().map(m => m.id).join(', ');
      content.innerHTML = `
        <div class="plugin-page">
          <h1>插件未找到</h1>
          <p>插件 "${this.escapeHtml(pluginId)}" 不存在或未加载。</p>
          <p>可用插件: ${available || '无'}</p>
          <a href="#/">← 返回首页</a>
        </div>
      `;
      return;
    }
    
    // Activate plugin
    try {
      await this.pluginLoader.activatePlugin(pluginId);
      
      // Get plugin instance
      const plugin = this.pluginLoader.getPlugin(pluginId);
      if (!plugin) {
        throw new Error('Plugin instance not available');
      }
      
      // Load plugin CSS if available
      if (manifest.style) {
        this.loadPluginStyle(pluginId, manifest.style);
      }
      
      // Render plugin container
      content.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'plugin-container';
      container.dataset.pluginId = pluginId;
      content.appendChild(container);
      
      // Mount plugin
      if (typeof plugin.mount === 'function') {
        plugin.mount(container);
      } else if (typeof plugin.render === 'function') {
        const rendered = plugin.render();
        if (typeof rendered === 'string') {
          container.innerHTML = rendered;
        } else if (rendered instanceof Node) {
          container.appendChild(rendered);
        }
      }
      
      // Bind events
      if (typeof plugin.bindEvents === 'function') {
        plugin.bindEvents(container);
      }
      
      // Update store and sidebar
      this.store.set('activePlugin', pluginId);
      const sidebar = document.querySelector('lv-sidebar');
      if (sidebar && typeof sidebar.setActive === 'function') {
        sidebar.setActive(pluginId);
      }
      
    } catch (error) {
      console.error(`[App] Failed to show plugin ${pluginId}:`, error);
      content.innerHTML = `
        <div class="plugin-page">
          <h1>插件加载失败</h1>
          <p>插件 "${this.escapeHtml(pluginId)}" 加载失败: ${this.escapeHtml(error.message)}</p>
          <a href="#/">← 返回首页</a>
        </div>
      `;
    }
  }

  /**
   * Load plugin stylesheet
   * @param {string} pluginId
   * @param {string} stylePath
   */
  loadPluginStyle(pluginId, stylePath) {
    const styleId = `plugin-style-${pluginId}`;
    if (document.getElementById(styleId)) return;
    
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = `/plugins/${pluginId}/${stylePath}`;
    document.head.appendChild(link);
  }

  /**
   * Show settings page
   */
  showSettings() {
    const content = document.getElementById('content');
    const plugins = this.pluginLoader ? this.pluginLoader.getAllManifests() : [];
    
    content.innerHTML = `
      <div class="settings-page">
        <h1>设置</h1>
        
        <div class="settings-section">
          <h2>主题</h2>
          <select id="themeSelect">
            <option value="light" ${this.theme.getTheme() === 'light' ? 'selected' : ''}>浅色</option>
            <option value="dark" ${this.theme.getTheme() === 'dark' ? 'selected' : ''}>深色</option>
          </select>
        </div>
        
        <div class="settings-section">
          <h2>语言</h2>
          <select id="languageSelect">
            <option value="zh" ${this.i18n.getLocale?.() === 'zh' ? 'selected' : ''}>中文</option>
            <option value="en" ${this.i18n.getLocale?.() === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
        
        <div class="settings-section">
          <h2>已安装插件</h2>
          ${plugins.length > 0 ? `
            <ul class="plugin-list">
              ${plugins.map(p => `
                <li>
                  <span class="plugin-name">${p.name?.zh || p.name?.en || p.id}</span>
                  <span class="plugin-version">v${p.version}</span>
                  <a href="#/plugin/${p.id}" class="plugin-link">打开</a>
                </li>
              `).join('')}
            </ul>
          ` : '<p>没有已加载的插件</p>'}
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
      await this.i18n.setLocale?.(e.target.value);
      this.showSettings();
    });
  }

  /**
   * Start background tasks
   */
  startBackgroundTasks() {
    if (this.services.CommunicationLayer) {
      this.services.CommunicationLayer.startHeartbeat?.();
    }
  }

  /**
   * Show 404 page
   */
  show404() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="not-found">
        <h1>404</h1>
        <p>${this.i18n.t('error.not_found') || '页面未找到'}</p>
        <a href="#/">← 返回首页</a>
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
        <h1>${this.i18n.t('error.startup_failed') || '启动失败'}</h1>
        <p>${this.escapeHtml(error.message)}</p>
        <button onclick="location.reload()">${this.i18n.t('error.retry') || '重试'}</button>
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
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message, type }
    }));
  }
  
  /**
   * Show confirm dialog
   * @param {string} message - Confirm message
   * @returns {Promise<boolean>} True if confirmed
   */
  async showConfirm(message) {
    return confirm(message);
  }
  
  /**
   * Show prompt dialog
   * @param {string} message - Prompt message
   * @param {string} defaultValue - Default input value
   * @returns {Promise<string|null>} User input or null
   */
  async showPrompt(message, defaultValue = '') {
    return prompt(message, defaultValue);
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
