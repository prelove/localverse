(function(){
const __modules = {};
const __cache = {};
function __define(id, factory){ __modules[id] = factory; }
function __require(id){ if(__cache[id]) return __cache[id].exports; if(!__modules[id]) throw new Error('Module not found: ' + id); const module = { exports: {} }; __cache[id] = module; __modules[id](module, module.exports); return module.exports; }
__define('./app.js', function(module, exports){
/**
 * Localverse Desktop Application Entry Point
 */

__require('./core/app.js');

// Export for testing
const __reexport_1 = __require('./core/app.js'); exports.app = __reexport_1['default'];
const __reexport_2 = __require('./core/state.js'); exports.store = __reexport_2['default'];
const __reexport_3 = __require('./core/router.js'); exports.Router = __reexport_3['Router'];
const __reexport_4 = __require('./core/i18n.js'); exports.I18n = __reexport_4['I18n'];
const __reexport_5 = __require('./core/theme.js'); exports.ThemeManager = __reexport_5['ThemeManager'];

});
__define('./core/app.js', function(module, exports){
/**
 * Localverse Application Main Class
 * Handles application lifecycle and initialization
 */

const { Router } = __require('./core/router.js');
const store = __require('./core/state.js').default ?? __require('./core/state.js');
const { I18n } = __require('./core/i18n.js');
const { ThemeManager } = __require('./core/theme.js');
const { PluginLoader, EventBus, PermissionManager } = __require('./core/plugin/index.js');

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
        const { CommunicationLayer } = await Promise.resolve(__require('./services/comm/index.js'));
        this.services.CommunicationLayer = new CommunicationLayer({
          serverUrl: 'http://127.0.0.1:8765'
        });
      } catch {
        // Communication layer unavailable in this environment.
      }
    }

    try {
      const { default: DatabaseServiceFactory, MockDatabaseService } = await Promise.resolve(__require('./services/database/index.js'));
      this.services.DatabaseService = await DatabaseServiceFactory.create(this.mode);
      if (!this.services.DatabaseService) {
        const mockDb = new MockDatabaseService();
        await mockDb.init();
        this.services.DatabaseService = mockDb;
      }
    } catch {
      const { MockDatabaseService } = await Promise.resolve(__require('./services/database/index.js'));
      const mockDb = new MockDatabaseService();
      await mockDb.init();
      this.services.DatabaseService = mockDb;
    }

    try {
      const { SearchService } = await Promise.resolve(__require('./services/search/index.js'));
      this.services.SearchService = new SearchService();
    } catch {
      this.services.SearchService = {
        searchFiles: async () => []
      };
    }

    try {
      const { AuthService } = await Promise.resolve(__require('./services/auth/index.js'));
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

    const { SetupUI } = await Promise.resolve(__require('./services/auth/setup-ui.js'));
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
      await Promise.resolve(__require('./components/header.js'));
      await Promise.resolve(__require('./components/sidebar.js'));
      await Promise.resolve(__require('./components/toast.js'));
      await Promise.resolve(__require('./components/modal.js'));
      await Promise.resolve(__require('./components/dropdown.js'));
      await Promise.resolve(__require('./components/tooltip.js'));
      
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
exports.default = app;

});
__define('./core/router.js', function(module, exports){
/**
 * Hash-based Router System
 * Provides client-side routing without server requests
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};
    
    // Listen to hash changes
    window.addEventListener('popstate', () => this.handleRoute());
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  /**
   * Register a route handler
   * @param {string} path - Route pattern (e.g., '/plugin/:id')
   * @param {Function} handler - Handler function
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to a path
   * @param {string} path - Path to navigate to
   * @param {Object} params - Additional parameters
   */
  navigate(path, params = {}) {
    this.params = params;
    window.history.pushState(params, '', `#${path}`);
    this.handleRoute();
  }

  /**
   * Replace current route
   * @param {string} path - Path to replace with
   * @param {Object} params - Additional parameters
   */
  replace(path, params = {}) {
    this.params = params;
    window.history.replaceState(params, '', `#${path}`);
    this.handleRoute();
  }

  /**
   * Handle route change
   */
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    
    // Parse query parameters
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((value, key) => {
        this.params[key] = value;
      });
    }
    
    // Match route
    for (const [pattern, handler] of this.routes) {
      const match = this.matchRoute(pattern, path);
      if (match) {
        this.currentRoute = pattern;
        this.params = { ...this.params, ...match.params };
        handler(this.params);
        return;
      }
    }
    
    // 404 - Not Found
    const notFoundHandler = this.routes.get('*');
    if (notFoundHandler) {
      notFoundHandler(this.params);
    }
  }

  /**
   * Match route pattern against path
   * @param {string} pattern - Route pattern
   * @param {string} path - Current path
   * @returns {Object|null} Match result with params
   */
  matchRoute(pattern, path) {
    if (pattern === '*') {
      return { params: {} };
    }
    
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        // Dynamic parameter
        params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return { params };
  }

  /**
   * Get current route parameters
   * @returns {Object} Current parameters
   */
  getParams() {
    return this.params;
  }

  /**
   * Get current route pattern
   * @returns {string} Current route pattern
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Navigate back
   */
  back() {
    window.history.back();
  }

  /**
   * Navigate forward
   */
  forward() {
    window.history.forward();
  }

  /**
   * Build URL with parameters
   * @param {string} path - Base path
   * @param {Object} params - URL parameters
   * @returns {string} Complete URL
   */
  buildUrl(path, params = {}) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    return queryString ? `${path}?${queryString}` : path;
  }
}

exports.Router = Router;
exports.default = Router;

});
__define('./core/state.js', function(module, exports){
/**
 * State Management System
 * Provides reactive state management with subscription support
 */

class Store {
  constructor(initialState = {}) {
    this._state = initialState;
    this._listeners = new Map();
    this._middlewares = [];
  }

  /**
   * Get state value by path
   * @param {string} path - Dot-separated path (e.g., 'user.name')
   * @returns {*} State value
   */
  get(path) {
    if (!path) return this._state;
    
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key];
    }, this._state);
  }

  /**
   * Set state value by path
   * @param {string} path - Dot-separated path
   * @param {*} value - New value
   */
  set(path, value) {
    const oldValue = this.get(path);
    
    // Run middlewares
    for (const middleware of this._middlewares) {
      const result = middleware({ path, value, oldValue });
      if (result === false) return;
      if (result !== undefined) value = result;
    }
    
    // Update state
    if (!path) {
      this._state = value;
    } else {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {};
        return obj[key];
      }, this._state);
      target[lastKey] = value;
    }
    
    // Notify listeners
    this._notify(path, value, oldValue);
  }

  /**
   * Subscribe to state changes
   * @param {string} path - Path to watch
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, listener) {
    if (!this._listeners.has(path)) {
      this._listeners.set(path, new Set());
    }
    this._listeners.get(path).add(listener);
    
    return () => {
      this._listeners.get(path)?.delete(listener);
    };
  }

  /**
   * Notify listeners of state change
   * @private
   */
  _notify(path, value, oldValue) {
    // Exact match
    const listeners = this._listeners.get(path);
    if (listeners) {
      listeners.forEach(listener => listener(value, oldValue));
    }
    
    // Wildcard match
    const wildcardListeners = this._listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => listener({ path, value, oldValue }));
    }
    
    // Parent path match
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      const parentListeners = this._listeners.get(parentPath + '.*');
      if (parentListeners) {
        parentListeners.forEach(listener => listener({ path, value, oldValue }));
      }
    }
  }

  /**
   * Add middleware for state changes
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this._middlewares.push(middleware);
  }

  /**
   * Batch update multiple state values
   * @param {Object} updates - Object with path-value pairs
   */
  batch(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
  }

  /**
   * Reset state to initial values
   * @param {Object} initialState - New initial state
   */
  reset(initialState = {}) {
    this._state = initialState;
    this._notify('*', this._state, {});
  }

  /**
   * Get all state as plain object
   * @returns {Object} Current state
   */
  getAll() {
    return JSON.parse(JSON.stringify(this._state));
  }
}

// Create and export global store instance
const store = new Store({
  user: null,
  mode: 'full',
  theme: 'light',
  language: 'zh',
  connection: {
    status: 'disconnected',
    transport: null,
    latency: 0
  },
  sync: {
    pending: 0,
    conflicts: 0,
    lastSync: null
  },
  plugins: [],
  activePlugin: null,
  config: {}
});

exports.Store = Store;
exports.default = store;

});
__define('./core/i18n.js', function(module, exports){
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
    // Load default messages first
    this.messages['zh'] = this.getEmbeddedMessages('zh');
    this.messages['en'] = this.getEmbeddedMessages('en');
    
    // Try to load user's preferred locale from localStorage
    const savedLocale = localStorage.getItem('localverse_locale');
    if (savedLocale && this.messages[savedLocale]) {
      this.locale = savedLocale;
    } else {
      // Use browser's language if supported
      const browserLang = navigator.language.split('-')[0];
      if (this.messages[browserLang]) {
        this.locale = browserLang;
      }
    }
    
    document.documentElement.lang = this.locale;
  }

  /**
   * Load language messages
   * @param {string} locale - Locale code (e.g., 'zh', 'en')
   */
  async load(locale) {
    if (this.messages[locale]) return;
    
    try {
      if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
        this.messages[locale] = this.getEmbeddedMessages(locale);
        return;
      }
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

exports.I18n = I18n;
exports.default = I18n;

});
__define('./core/theme.js', function(module, exports){
/**
 * Theme Manager
 * Handles theme switching and persistence
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.themes = ['light', 'dark', 'high-contrast'];
  }

  /**
   * Initialize theme system
   */
  init() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('localverse_theme');
    if (savedTheme && this.themes.includes(savedTheme)) {
      this.setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }

    // Listen to system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('localverse_theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Set theme
   * @param {string} theme - Theme name ('light', 'dark', 'high-contrast')
   */
  setTheme(theme) {
    if (!this.themes.includes(theme)) {
      console.warn(`Unknown theme: ${theme}`);
      return;
    }

    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('localverse_theme', theme);

    // Dispatch theme change event
    window.dispatchEvent(new CustomEvent('theme-change', {
      detail: { theme }
    }));
  }

  /**
   * Get current theme
   * @returns {string} Current theme name
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Toggle between light and dark theme
   */
  toggle() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Get available themes
   * @returns {string[]} Array of theme names
   */
  getAvailableThemes() {
    return [...this.themes];
  }

  /**
   * Check if theme is dark
   * @returns {boolean} True if current theme is dark
   */
  isDark() {
    return this.currentTheme === 'dark' || this.currentTheme === 'high-contrast';
  }

  /**
   * Apply custom theme variables
   * @param {Object} variables - CSS variable overrides
   */
  applyCustomVariables(variables) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(`--${key}`, value);
    }
  }

  /**
   * Reset to default theme variables
   */
  resetCustomVariables() {
    const root = document.documentElement;
    root.removeAttribute('style');
  }
}

exports.ThemeManager = ThemeManager;
exports.default = ThemeManager;

});
__define('./core/plugin/index.js', function(module, exports){
/**
 * Plugin System - Main exports
 * Localverse Plugin Framework
 */

const { PluginBase } = __require('./core/plugin/plugin-base.js');
const { PluginLoader } = __require('./core/plugin/plugin-loader.js');
const { PluginStorage } = __require('./core/plugin/plugin-storage.js');
const { EventBus, eventBus } = __require('./core/plugin/event-bus.js');
const { PermissionManager, permissionManager, PERMISSIONS } = __require('./core/plugin/permission-manager.js');
const { PluginContext } = __require('./core/plugin/plugin-context.js');
const { PluginRegistry } = __require('./core/plugin/plugin-registry.js');
const { PluginSettings } = __require('./core/plugin/plugin-settings.js');
const { PluginI18n } = __require('./core/plugin/plugin-i18n.js');

exports.PluginBase = PluginBase; exports.PluginLoader = PluginLoader; exports.PluginStorage = PluginStorage; exports.EventBus = EventBus; exports.eventBus = eventBus; exports.PermissionManager = PermissionManager; exports.permissionManager = permissionManager; exports.PERMISSIONS = PERMISSIONS; exports.PluginContext = PluginContext; exports.PluginRegistry = PluginRegistry; exports.PluginSettings = PluginSettings; exports.PluginI18n = PluginI18n;

// Default export
exports.default = PluginLoader;

});
__define('./core/plugin/plugin-base.js', function(module, exports){
/**
 * Plugin Base Class
 * All plugins must extend this class
 */

class PluginBase {
  /**
   * Plugin ID (must be overridden by subclasses)
   * @type {string}
   */
  static id = 'base-plugin';

  /**
   * @param {Object} context - Plugin context
   */
  constructor(context) {
    this.context = context;
    this.id = this.constructor.id;
    this.manifest = context?.manifest || {};
    this.services = context?.services || {};
    this.eventBus = context?.eventBus;
    this.storage = context?.storage;
    this.settings = context?.settings;
    this.i18n = context?.i18n;
    this.ui = context?.ui;
    
    this._state = {};
    this._mounted = false;
    this._activated = false;
    this._shadowRoot = null;
  }

  /**
   * Called when plugin is installed (first time only)
   */
  async onInstall() {
    // Override in subclass
  }

  /**
   * Called when plugin is activated
   */
  async onActivate() {
    // Override in subclass
    this._activated = true;
  }

  /**
   * Called when plugin is deactivated
   */
  async onDeactivate() {
    // Override in subclass
    this._activated = false;
  }

  /**
   * Mount the plugin to a DOM element
   * @param {HTMLElement} container - Container element
   */
  mount(container) {
    if (this._mounted) {
      console.warn(`Plugin ${this.id} is already mounted`);
      return;
    }

    this._container = container;
    this._shadowRoot = container.attachShadow({ mode: 'open' });
    this._mounted = true;

    this._render();
    this.bindEvents?.(this._shadowRoot);
  }

  /**
   * Unmount the plugin
   */
  unmount() {
    if (!this._mounted) return;
    
    this._mounted = false;
    
    if (this._shadowRoot) {
      this._shadowRoot.innerHTML = '';
    }
  }

  /**
   * Render the plugin UI
   * @returns {string|HTMLElement} HTML string or DOM element
   */
  render() {
    // Override in subclass
    return `<div class="plugin-${this.id}">Plugin ${this.id}</div>`;
  }

  /**
   * Render plugin styles
   */
  styles() {
    return '';
  }

  /**
   * Set state
   * @param {string} key - State key
   * @param {any} value - State value
   */
  setState(key, value) {
    if (key && typeof key === 'object') {
      this._state = { ...this._state, ...key };
    } else {
      this._state[key] = value;
    }

    if (this._mounted) {
      this._render();
      this.bindEvents?.(this._shadowRoot);
    }
  }

  /**
   * Get state
   * @param {string} key - State key
   * @returns {any} State value
   */
  getState(key) {
    return this._state[key];
  }

  /**
   * Get all state
   * @returns {Object} All state
   */
  getAllState() {
    return { ...this._state };
  }

  /**
   * Get state
   */
  get state() {
    return this._state;
  }

  /**
   * Check if plugin is mounted
   * @returns {boolean}
   */
  isMounted() {
    return this._mounted;
  }

  /**
   * Check if plugin is activated
   * @returns {boolean}
   */
  isActivated() {
    return this._activated;
  }

  /**
   * Find element in shadow root
   */
  $(selector) {
    return this._shadowRoot?.querySelector(selector);
  }

  /**
   * Find elements in shadow root
   */
  $$(selector) {
    return this._shadowRoot?.querySelectorAll(selector) || [];
  }

  /**
   * Render and attach styles
   * @private
   */
  _render() {
    if (!this._shadowRoot) return;
    const content = this.render();
    const styles = this.styles?.() || '';

    if (typeof content === 'string') {
      this._shadowRoot.innerHTML = `
        <style>${styles}</style>
        ${content}
      `;
    } else {
      this._shadowRoot.innerHTML = `<style>${styles}</style>`;
      if (content instanceof Node) {
        this._shadowRoot.appendChild(content);
      }
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message
   * @param {string} type - Type (info, success, warning, error)
   */
  toast(message, type = 'info') {
    if (this.context?.app?.showToast) {
      this.context.app.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Navigate to a route
   * @param {string} path - Route path
   */
  navigate(path) {
    if (this.context?.router) {
      this.context.router.navigate(path);
    }
  }

  /**
   * Emit an event
   */
  emit(event, data) {
    return this.eventBus?.emit(`${this.id}:${event}`, data);
  }

  /**
   * Subscribe to an event
   */
  on(event, handler) {
    return this.eventBus?.on(event, handler);
  }

  /**
   * Call a service method
   */
  async callService(serviceName, method, ...args) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    if (typeof service[method] !== 'function') {
      throw new Error(`Method not found: ${serviceName}.${method}`);
    }
    return service[method](...args);
  }

  /**
   * Get a setting value
   */
  getSetting(key, defaultValue = null) {
    return this.settings?.get?.(key, defaultValue);
  }

  /**
   * Set a setting value
   */
  async setSetting(key, value) {
    return this.settings?.set?.(key, value);
  }

  /**
   * Translate a key
   */
  t(key, params) {
    return this.i18n?.t?.(key, params) ?? key;
  }

  /**
   * Log helper
   */
  log(level, message, data) {
    const prefix = `[Plugin:${this.id}]`;
    if (level === 'error') {
      console.error(prefix, message, data);
    } else if (level === 'warn') {
      console.warn(prefix, message, data);
    } else {
      console.log(prefix, message, data);
    }
  }
}

// Alias for backward compatibility
class Plugin extends PluginBase {}
exports.default = PluginBase;

exports.PluginBase = PluginBase;
exports.Plugin = Plugin;
});
__define('./core/plugin/plugin-loader.js', function(module, exports){
/**
 * PluginLoader - Loads and manages plugins
 * Handles discovery, validation, loading, and lifecycle
 */

const { PluginContext } = __require('./core/plugin/plugin-context.js');
const { PluginI18n } = __require('./core/plugin/plugin-i18n.js');
const { embeddedManifests, embeddedPluginIds } = __require('./core/plugin/embedded-plugin-data.js');
const { embeddedPluginModules } = __require('./core/plugin/embedded-plugin-modules.js');

class PluginLoader {
  constructor(context = {}) {
    this.pluginsBaseUrl = this.normalizePluginsBaseUrl(context.pluginsDir);
    this.services = context.services || {};
    this.eventBus = context.eventBus;
    this.permissionManager = context.permissionManager;
    this.router = context.router;
    this.app = context.app || window.app;

    this._manifests = new Map();
    this._instances = new Map();
    this._loaded = new Set();
  }

  /**
   * Load all available plugins
   */
  async loadAll() {
    const result = { total: 0, loaded: 0, failed: [] };
    
    try {
      // Discover plugins
      const pluginIds = await this.discoverPlugins();
      result.total = pluginIds.length;
      
      // Load each plugin
      for (const pluginId of pluginIds) {
        try {
          await this.load(pluginId);
          result.loaded++;
        } catch (error) {
          result.failed.push({ id: pluginId, error: error.message });
          console.error(`Failed to load plugin ${pluginId}:`, error);
        }
      }
    } catch (error) {
      console.error('Plugin discovery failed:', error);
    }
    
    return result;
  }

  /**
   * Discover available plugins
   */
  async discoverPlugins() {
    if (this.isFileProtocol()) {
      return embeddedPluginIds;
    }

    try {
      const response = await fetch(this.resolvePluginUrl('manifest.json'));
      if (response.ok) {
        const manifest = await response.json();
        return manifest.plugins || [];
      }
    } catch {
      // Try to discover from directory listing
    }
    
    // Default plugins
    return ['wiki', 'finder'];
  }

  /**
   * Load a specific plugin
   */
  async load(pluginId) {
    if (this._loaded.has(pluginId)) {
      return this._instances.get(pluginId);
    }

    // Load manifest
    const manifest = await this.loadManifest(pluginId);
    this.validateManifest(manifest);
    await this.ensureDependencies(manifest);
    this._manifests.set(pluginId, manifest);

    // Load module
    let module;
    if (this.isFileProtocol()) {
      module = embeddedPluginModules[pluginId];
      if (!module) {
        throw new Error(`Embedded module not found for plugin ${pluginId}`);
      }
    } else {
      const entry = this.resolveEntry(manifest);
      const moduleUrl = this.resolvePluginUrl(`${pluginId}/${entry}`);
      module = await import(moduleUrl);
    }
    
    // Create instance
    const PluginClass = module.default || module[Object.keys(module)[0]];
    this.permissionManager?.grantMultiple?.(pluginId, manifest.permissions || []);
    const context = await this.createContext(manifest);
    const instance = new PluginClass(context);
    
    this._instances.set(pluginId, instance);
    this._loaded.add(pluginId);
    
    // Install plugin
    if (typeof instance.onInstall === 'function') {
      await instance.onInstall();
    }
    
    this.eventBus?.emit('plugin:loaded', { id: pluginId, manifest });
    
    return instance;
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId) {
    const instance = this._instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not loaded`);
    }
    
    if (typeof instance.onActivate === 'function') {
      await instance.onActivate();
    }
    
    instance._activated = true;
    this.eventBus?.emit('plugin:activated', { id: pluginId });
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId) {
    const instance = this._instances.get(pluginId);
    if (!instance) return;
    
    if (typeof instance.onDeactivate === 'function') {
      await instance.onDeactivate();
    }
    
    instance._activated = false;
    this.eventBus?.emit('plugin:deactivated', { id: pluginId });
  }

  /**
   * Load plugin manifest
   */
  async loadManifest(pluginId) {
    if (this.isFileProtocol()) {
      const embedded = embeddedManifests[pluginId];
      if (embedded) {
        return JSON.parse(JSON.stringify(embedded));
      }
    }

    const response = await fetch(this.resolvePluginUrl(`${pluginId}/manifest.json`));
    if (!response.ok) {
      throw new Error(`Manifest not found for plugin ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Validate manifest
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Ensure plugin dependencies are available
   */
  async ensureDependencies(manifest) {
    const dependencies = manifest.dependencies || {};
    const requiredServices = dependencies.services || [];
    const requiredPlugins = dependencies.plugins || [];

    const missingServices = requiredServices.filter((serviceName) => !this.services[serviceName]);
    if (missingServices.length > 0) {
      console.warn(`[PluginLoader] Missing services for ${manifest.id}:`, missingServices);
    }

    for (const pluginId of requiredPlugins) {
      if (!this._loaded.has(pluginId)) {
        await this.load(pluginId);
      }
    }
  }

  /**
   * Resolve plugin entry file
   */
  resolveEntry(manifest) {
    const entry = manifest.entry || 'index.js';
    return entry.replace(/^\.\//, '');
  }

  /**
   * Create plugin context
   */
  async createContext(manifest) {
    const pluginI18n = new PluginI18n(manifest);
    await pluginI18n.loadLocales(this.pluginsBaseUrl);

    return new PluginContext(manifest, {
      app: this.app,
      services: this.services,
      eventBus: this.eventBus,
      router: this.router,
      permissionManager: this.permissionManager,
      i18n: pluginI18n,
      ui: this.createUiHelper()
    });
  }

  createUiHelper() {
    return {
      toast: (message, type = 'info') => {
        if (this.app?.showToast) {
          this.app.showToast(message, type);
        } else {
          console.log(`[${type.toUpperCase()}] ${message}`);
        }
      }
    };
  }

  normalizePluginsBaseUrl(base) {
    if (base instanceof URL) {
      return base;
    }
    if (typeof base === 'string') {
      return new URL(base, window.location.href);
    }
    return new URL('/plugins/', window.location.href);
  }

  resolvePluginUrl(path) {
    return new URL(path, this.pluginsBaseUrl).href;
  }

  isFileProtocol() {
    return typeof window !== 'undefined' && window.location?.protocol === 'file:';
  }

  /**
   * Get plugin instance
   */
  getPlugin(pluginId) {
    return this._instances.get(pluginId);
  }

  /**
   * Get plugin manifest
   */
  getManifest(pluginId) {
    return this._manifests.get(pluginId);
  }

  /**
   * Get all loaded plugin manifests
   */
  getAllManifests() {
    return Array.from(this._manifests.values());
  }

  /**
   * Get all loaded plugin IDs
   */
  getAllPlugins() {
    return Array.from(this._loaded);
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(pluginId) {
    return this._loaded.has(pluginId);
  }

  /**
   * Unload a plugin
   */
  async unload(pluginId) {
    const instance = this._instances.get(pluginId);
    if (instance) {
      if (typeof instance.onDeactivate === 'function') {
        await instance.onDeactivate();
      }
      instance.unmount?.();
    }
    
    this._instances.delete(pluginId);
    this._manifests.delete(pluginId);
    this._loaded.delete(pluginId);
    
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }

  /**
   * Unload all plugins
   */
  async unloadAll() {
    for (const pluginId of this._loaded) {
      await this.unload(pluginId);
    }
  }
}

exports.default = PluginLoader;

exports.PluginLoader = PluginLoader;
});
__define('./core/plugin/plugin-context.js', function(module, exports){
/**
 * Plugin Context
 * Provides isolated context and APIs for each plugin
 */

const { PluginStorage } = __require('./core/plugin/plugin-storage.js');
const { PluginSettings } = __require('./core/plugin/plugin-settings.js');

class PluginContext {
  constructor(manifest, options = {}) {
    this.manifest = manifest;
    this.app = options.app;
    this.permissionManager = options.permissionManager;
    this._eventBus = options.eventBus || this.app?.eventBus;
    this._router = options.router || this.app?.router;
    this._i18n = options.i18n || this.app?.i18n;
    this._store = options.store || this.app?.store;
    this._theme = options.theme || this.app?.theme;
    this._services = options.services || this.app?.services || {};
    this._ui = options.ui || this.app?.ui;

    // Create isolated storage for this plugin
    this._storage = new PluginStorage(this.manifest.id);
    this._settings = new PluginSettings(this.manifest);
    this._permissions = new Set(manifest.permissions || []);
  }

  /**
   * Get plugin manifest
   */
  get id() {
    return this.manifest.id;
  }

  /**
   * Get event bus
   */
  get eventBus() {
    return this._eventBus;
  }

  /**
   * Get i18n service
   */
  get i18n() {
    return this._i18n;
  }

  /**
   * Get router
   */
  get router() {
    return this._router;
  }

  /**
   * Get state store
   */
  get store() {
    return this._store;
  }

  /**
   * Get theme manager
   */
  get theme() {
    return this._theme;
  }

  /**
   * Get available services (based on permissions)
   */
  get services() {
    const services = {};

    const requiredServices = this.manifest.dependencies?.services || [];

    const wantsService = (name) => requiredServices.includes(name);

    // Only expose services that plugin has permission to use
    if (
      this._services.DatabaseService &&
      (wantsService('DatabaseService') || this.hasPermission('database:read') || this.hasPermission('database:write'))
    ) {
      services.DatabaseService = this._services.DatabaseService;
    }
    
    if (
      this._services.FileSystemService &&
      (wantsService('FileSystemService') ||
        this.hasPermission('filesystem:read') ||
        this.hasPermission('filesystem:write') ||
        this.hasPermission('filesystem:watch'))
    ) {
      services.FileSystemService = this._services.FileSystemService;
    }
    
    if (
      this._services.SearchService &&
      (wantsService('SearchService') || this.hasPermission('search'))
    ) {
      services.SearchService = this._services.SearchService;
    }
    
    return services;
  }

  /**
   * Get plugin storage API
   */
  get storage() {
    return this._storage;
  }

  /**
   * Get plugin settings API
   */
  get settings() {
    return this._settings;
  }

  /**
   * Get UI helper
   */
  get ui() {
    return this._ui;
  }

  /**
   * Get plugin permissions
   */
  get permissions() {
    return this._permissions;
  }

  /**
   * Check if plugin has permission
   * @param {string} permission - Permission string
   * @returns {boolean} True if has permission
   */
  hasPermission(permission) {
    if (this.permissionManager?.hasPermission) {
      return this.permissionManager.hasPermission(this.manifest.id, permission);
    }

    return this._permissions.has(permission) || this._permissions.has('*');
  }
}

exports.PluginContext = PluginContext;
});
__define('./core/plugin/plugin-storage.js', function(module, exports){
/**
 * PluginStorage - Provides isolated storage for plugins using IndexedDB
 */

class PluginStorage {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.dbName = `localverse_plugin_${pluginId}`;
    this.storeName = 'data';
    this.db = null;
    this._initPromise = null;
  }
  
  /**
   * Initialize the database
   */
  async _init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;
    
    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
    
    return this._initPromise;
  }
  
  /**
   * Get a value
   */
  async get(key, defaultValue = null) {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result !== undefined ? request.result : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Set a value
   */
  async set(key, value) {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Remove a value
   */
  async remove(key) {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get all keys
   */
  async keys() {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get all values
   */
  async getAll() {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Clear all values
   */
  async clear() {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Check if key exists
   */
  async has(key) {
    const db = await this._init();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getKey(key);
      
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get total number of stored entries
   */
  async size() {
    const db = await this._init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this._initPromise = null;
    }
  }
}

exports.default = PluginStorage;

exports.PluginStorage = PluginStorage;
});
__define('./core/plugin/plugin-settings.js', function(module, exports){
/**
 * PluginSettings - Manages plugin configuration with validation
 */

class PluginSettings {
  constructor(manifest) {
    this.pluginId = manifest?.id || 'unknown';
    this.schema = manifest?.settings || {};
    this.values = {};
    this.listeners = [];
    
    this.loadDefaults();
    this.loadFromStorage();
  }

  /**
   * Load default values from schema
   */
  loadDefaults() {
    for (const [key, config] of Object.entries(this.schema)) {
      this.values[key] = config?.default;
    }
  }

  /**
   * Load saved settings from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(`plugin_settings_${this.pluginId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate each loaded value against schema
        for (const [key, value] of Object.entries(parsed)) {
          const config = this.schema[key];
          if (config && this.validate(key, value, config)) {
            this.values[key] = value;
          }
        }
      }
    } catch {
      // Ignore invalid data
    }
  }

  /**
   * Save settings to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(
        `plugin_settings_${this.pluginId}`,
        JSON.stringify(this.values)
      );
    } catch (e) {
      console.error(`Failed to save settings for plugin ${this.pluginId}:`, e);
    }
  }

  /**
   * Get a setting value
   */
  get(key, defaultValue = null) {
    return this.values.hasOwnProperty(key) ? this.values[key] : defaultValue;
  }

  /**
   * Set a setting value
   */
  set(key, value) {
    const config = this.schema[key];
    if (config && !this.validate(key, value, config)) {
      throw new Error(`Invalid value for setting ${key}: ${value}`);
    }
    
    this.values[key] = value;
    this.saveToStorage();
    this.notify(key, value);
  }

  /**
   * Get all settings
   */
  getAll() {
    return { ...this.values };
  }

  /**
   * Set multiple settings
   */
  setMultiple(values) {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.values = {};
    this.loadDefaults();
    this.saveToStorage();
    this.notifyAll();
  }

  /**
   * Validate a value against schema
   */
  validate(key, value, config) {
    if (!config) return true;
    
    // Type validation
    if (config.type && typeof value !== config.type) {
      return false;
    }
    
    // Enum validation
    if (config.enum && !config.enum.includes(value)) {
      return false;
    }
    
    // Number range
    if (config.type === 'number') {
      if (config.min !== undefined && value < config.min) return false;
      if (config.max !== undefined && value > config.max) return false;
    }
    
    // String pattern
    if (config.type === 'string' && config.pattern) {
      const regex = new RegExp(config.pattern);
      if (!regex.test(value)) return false;
    }
    
    return true;
  }

  /**
   * Subscribe to setting changes
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners of a change
   */
  notify(key, value) {
    for (const listener of this.listeners) {
      try {
        listener(key, value, this.values);
      } catch (e) {
        console.error('Settings change listener error:', e);
      }
    }
  }

  /**
   * Notify listeners of all changes
   */
  notifyAll() {
    for (const listener of this.listeners) {
      try {
        listener(null, null, this.values);
      } catch (e) {
        console.error('Settings change listener error:', e);
      }
    }
  }

  /**
   * Get setting schema
   */
  getSchema() {
    return { ...this.schema };
  }

  /**
   * Check if setting exists
   */
  has(key) {
    return this.schema.hasOwnProperty(key);
  }

  /**
   * Remove a setting
   */
  remove(key) {
    delete this.values[key];
    this.saveToStorage();
    this.notify(key, undefined);
  }
}

exports.default = PluginSettings;

exports.PluginSettings = PluginSettings;
});
__define('./core/plugin/plugin-i18n.js', function(module, exports){
/**
 * PluginI18n - Internationalization for plugins
 */

class PluginI18n {
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
      const { embeddedLocales } = await Promise.resolve(__require('./core/plugin/embedded-plugin-data.js'));
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

exports.default = PluginI18n;

exports.PluginI18n = PluginI18n;
});
__define('./core/plugin/embedded-plugin-data.js', function(module, exports){
const embeddedManifests = {
  finder: {
    id: 'finder',
    name: {
      zh: '文件搜索',
      ja: 'ファイル検索',
      en: 'Finder'
    },
    version: '1.0.0',
    description: {
      zh: '快速搜索本地文件，支持全文检索和实时预览',
      ja: 'ローカルファイルを高速検索、全文検索とプレビュー対応',
      en: 'Fast local file search with full-text and preview support'
    },
    icon: '🔍',
    category: 'productivity',
    entry: './index.js',
    style: './style.css',
    location: {
      sidebar: {
        enabled: true,
        order: 1
      },
      shortcut: {
        global: 'Ctrl+Shift+F'
      }
    },
    permissions: [
      'filesystem:read',
      'filesystem:watch',
      'database:read',
      'database:write',
      'clipboard:write'
    ],
    dependencies: {
      services: ['FileSystemService', 'SearchService', 'DatabaseService']
    },
    settings: {
      watchPaths: {
        type: 'array',
        default: [],
        label: {
          zh: '监视路径',
          en: 'Watch paths'
        }
      },
      maxResults: {
        type: 'number',
        default: 100,
        min: 10,
        max: 1000,
        label: {
          zh: '最大结果数',
          en: 'Max results'
        }
      },
      includeHidden: {
        type: 'boolean',
        default: false,
        label: {
          zh: '包含隐藏文件',
          en: 'Include hidden files'
        }
      },
      enableContentSearch: {
        type: 'boolean',
        default: true,
        label: {
          zh: '启用内容搜索',
          en: 'Enable content search'
        }
      },
      indexExtensions: {
        type: 'array',
        default: ['txt', 'md', 'json', 'js', 'java', 'py', 'html', 'css'],
        label: {
          zh: '索引的扩展名',
          en: 'Extensions to index'
        }
      }
    }
  },
  wiki: {
    id: 'wiki',
    name: {
      zh: '知识库',
      ja: 'ナレッジベース',
      en: 'Wiki'
    },
    version: '1.0.0',
    description: {
      zh: '模块化知识管理,支持 Markdown 和双向链接',
      ja: 'モジュール式ナレッジ管理、Markdownと双方向リンク対応',
      en: 'Modular knowledge management with Markdown and bidirectional links'
    },
    icon: '📚',
    category: 'productivity',
    entry: './index.js',
    style: './style.css',
    location: {
      sidebar: {
        enabled: true,
        order: 2
      },
      shortcut: {
        global: 'Ctrl+Shift+W'
      }
    },
    permissions: [
      'database:read',
      'database:write',
      'filesystem:read',
      'filesystem:write',
      'clipboard:read',
      'clipboard:write'
    ],
    dependencies: {
      services: ['DatabaseService', 'SearchService', 'FileSystemService']
    },
    settings: {
      defaultView: {
        type: 'select',
        options: ['board', 'list', 'grid'],
        default: 'board',
        label: { zh: '默认视图', en: 'Default view' }
      },
      autoSaveInterval: {
        type: 'number',
        default: 5000,
        min: 1000,
        max: 60000,
        label: { zh: '自动保存间隔(ms)', en: 'Auto-save interval(ms)' }
      },
      enableBidirectionalLinks: {
        type: 'boolean',
        default: true,
        label: { zh: '启用双向链接', en: 'Enable bidirectional links' }
      },
      enableVersionHistory: {
        type: 'boolean',
        default: true,
        label: { zh: '启用版本历史', en: 'Enable version history' }
      }
    }
  }
};

const embeddedLocales = {
  wiki: {
    en: {
      moduleName: 'Module Name',
      moduleDescription: 'Module Description',
      createModule: 'Create Module',
      editModule: 'Edit Module',
      deleteModule: 'Delete Module',
      columnName: 'Column Name',
      createColumn: 'Create Column',
      editColumn: 'Edit Column',
      deleteColumn: 'Delete Column',
      cardTitle: 'Card Title',
      cardContent: 'Card Content',
      preview: 'Preview',
      tags: 'Tags',
      tagsHint: 'Comma-separated tags',
      tagsEmpty: 'No tags yet',
      noSnippet: 'No snippet available',
      createCard: 'Create Card',
      editCard: 'Edit Card',
      deleteCard: 'Delete Card',
      moveCard: 'Move Card',
      pinCard: 'Pin Card',
      unpinCard: 'Unpin Card',
      addTag: 'Add Tag',
      removeTag: 'Remove Tag',
      search: 'Search',
      searchPlaceholder: 'Search cards...',
      searchResults: 'Search Results',
      searchResultsFor: 'Keyword',
      filterByTag: 'Filter by Tag',
      filterByModule: 'Filter by Module',
      noResults: 'No results found',
      unknownColumn: 'Unknown Column',
      unknownModule: 'Unknown Module',
      backlinks: 'Backlinks',
      linkedFrom: 'Linked from',
      noBacklinks: 'No backlinks',
      missingLinkHint: 'Card not created yet, click to create',
      missingLinkAction: 'Create',
      cardNotFound: 'Card not found or removed',
      versionHistory: 'Version History',
      restoreVersion: 'Restore this version',
      unsavedChanges: 'Unsaved changes',
      allChangesSaved: 'All changes saved',
      previewStatus: 'Preview',
      previewOn: 'On',
      previewOff: 'Off',
      saveSuccess: 'Saved successfully',
      saveError: 'Save failed',
      discardChangesConfirm: 'You have unsaved changes. Discard them?',
      deleteConfirm: 'Are you sure you want to delete?',
      yes: 'Yes',
      no: 'No',
      cancel: 'Cancel',
      save: 'Save',
      showPreview: 'Show Preview',
      hidePreview: 'Hide Preview',
      editorTips: 'Tip: Use [[Card Title]] to link, and #tags to mark keywords.',
      createModuleFirst: 'Please create a module first',
      createColumnFirst: 'Please create a column first',
      edit: 'Edit',
      delete: 'Delete',
      close: 'Close',
      viewBoard: 'Board View',
      viewList: 'List View',
      viewGrid: 'Grid View',
      sortByName: 'Sort by Name',
      sortByDate: 'Sort by Date',
      sortByUpdate: 'Sort by Update Time',
      exportMarkdown: 'Export as Markdown',
      exportJson: 'Export as JSON',
      importMarkdown: 'Import Markdown',
      importJson: 'Import JSON',
      settings: 'Settings',
      welcome: 'Welcome to Wiki',
      welcomeMessage: 'Start by creating your first module',
      emptyModule: 'This module has no columns yet',
      emptyColumn: 'This column has no cards yet'
    },
    zh: {
      moduleName: '模块名称',
      moduleDescription: '模块描述',
      createModule: '创建模块',
      editModule: '编辑模块',
      deleteModule: '删除模块',
      columnName: '列名',
      createColumn: '创建列',
      editColumn: '编辑列',
      deleteColumn: '删除列',
      cardTitle: '卡片标题',
      cardContent: '卡片内容',
      preview: '预览',
      tags: '标签',
      tagsHint: '使用逗号分隔标签',
      tagsEmpty: '暂无标签',
      noSnippet: '暂无内容摘要',
      createCard: '创建卡片',
      editCard: '编辑卡片',
      deleteCard: '删除卡片',
      moveCard: '移动卡片',
      pinCard: '置顶卡片',
      unpinCard: '取消置顶',
      addTag: '添加标签',
      removeTag: '删除标签',
      search: '搜索',
      searchPlaceholder: '搜索卡片...',
      searchResults: '搜索结果',
      searchResultsFor: '关键词',
      filterByTag: '按标签筛选',
      filterByModule: '按模块筛选',
      noResults: '没有找到结果',
      unknownColumn: '未知列',
      unknownModule: '未知模块',
      backlinks: '反向链接',
      linkedFrom: '被以下卡片引用',
      noBacklinks: '没有反向链接',
      missingLinkHint: '未创建卡片，点击即可创建',
      missingLinkAction: '可创建',
      cardNotFound: '卡片不存在或已删除',
      versionHistory: '版本历史',
      restoreVersion: '恢复此版本',
      unsavedChanges: '有未保存的更改',
      allChangesSaved: '所有更改已保存',
      previewStatus: '预览',
      previewOn: '开启',
      previewOff: '关闭',
      saveSuccess: '保存成功',
      saveError: '保存失败',
      discardChangesConfirm: '有未保存的更改，确定要放弃吗？',
      deleteConfirm: '确定要删除吗？',
      yes: '是',
      no: '否',
      cancel: '取消',
      save: '保存',
      showPreview: '显示预览',
      hidePreview: '隐藏预览',
      editorTips: '提示：使用 [[卡片名]] 创建链接，使用 #标签 记录关键字。',
      createModuleFirst: '请先创建一个模块',
      createColumnFirst: '请先创建一个列',
      edit: '编辑',
      delete: '删除',
      close: '关闭',
      viewBoard: '看板视图',
      viewList: '列表视图',
      viewGrid: '网格视图',
      sortByName: '按名称排序',
      sortByDate: '按日期排序',
      sortByUpdate: '按更新时间排序',
      exportMarkdown: '导出为 Markdown',
      exportJson: '导出为 JSON',
      importMarkdown: '导入 Markdown',
      importJson: '导入 JSON',
      settings: '设置',
      welcome: '欢迎使用 Wiki 知识库',
      welcomeMessage: '开始创建您的第一个模块',
      emptyModule: '此模块还没有列',
      emptyColumn: '此列还没有卡片'
    },
    ja: {
      moduleName: 'モジュール名',
      moduleDescription: 'モジュールの説明',
      createModule: 'モジュールを作成',
      editModule: 'モジュールを編集',
      deleteModule: 'モジュールを削除',
      columnName: 'カラム名',
      createColumn: 'カラムを作成',
      editColumn: 'カラムを編集',
      deleteColumn: 'カラムを削除',
      cardTitle: 'カードタイトル',
      cardContent: 'カード内容',
      preview: 'プレビュー',
      tags: 'タグ',
      tagsHint: 'カンマで区切って入力',
      tagsEmpty: 'タグはまだありません',
      noSnippet: '概要はありません',
      createCard: 'カードを作成',
      editCard: 'カードを編集',
      deleteCard: 'カードを削除',
      moveCard: 'カードを移動',
      pinCard: 'カードをピン留め',
      unpinCard: 'ピン留めを解除',
      addTag: 'タグを追加',
      removeTag: 'タグを削除',
      search: '検索',
      searchPlaceholder: 'カードを検索...',
      searchResults: '検索結果',
      searchResultsFor: 'キーワード',
      filterByTag: 'タグでフィルター',
      filterByModule: 'モジュールでフィルター',
      noResults: '結果が見つかりません',
      unknownColumn: '不明なカラム',
      unknownModule: '不明なモジュール',
      backlinks: 'バックリンク',
      linkedFrom: '以下のカードからリンクされています',
      noBacklinks: 'バックリンクはありません',
      missingLinkHint: 'カードは未作成です。クリックして作成',
      missingLinkAction: '作成',
      cardNotFound: 'カードが見つからないか削除されました',
      versionHistory: 'バージョン履歴',
      restoreVersion: 'このバージョンを復元',
      unsavedChanges: '未保存の変更があります',
      allChangesSaved: 'すべての変更が保存されました',
      previewStatus: 'プレビュー',
      previewOn: 'オン',
      previewOff: 'オフ',
      saveSuccess: '保存しました',
      saveError: '保存に失敗しました',
      discardChangesConfirm: '未保存の変更があります。破棄しますか？',
      deleteConfirm: '削除してもよろしいですか？',
      yes: 'はい',
      no: 'いいえ',
      cancel: 'キャンセル',
      save: '保存',
      showPreview: 'プレビューを表示',
      hidePreview: 'プレビューを非表示',
      editorTips: 'ヒント: [[カード名]] でリンク、#タグ でキーワードを記録します。',
      createModuleFirst: '先にモジュールを作成してください',
      createColumnFirst: '先にカラムを作成してください',
      edit: '編集',
      delete: '削除',
      close: '閉じる',
      viewBoard: 'ボードビュー',
      viewList: 'リストビュー',
      viewGrid: 'グリッドビュー',
      sortByName: '名前で並べ替え',
      sortByDate: '日付で並べ替え',
      sortByUpdate: '更新日時で並べ替え',
      exportMarkdown: 'Markdownとしてエクスポート',
      exportJson: 'JSONとしてエクスポート',
      importMarkdown: 'Markdownをインポート',
      importJson: 'JSONをインポート',
      settings: '設定',
      welcome: 'Wikiへようこそ',
      welcomeMessage: '最初のモジュールを作成してください',
      emptyModule: 'このモジュールにはまだカラムがありません',
      emptyColumn: 'このカラムにはまだカードがありません'
    }
  }
};

const embeddedPluginIds = Object.keys(embeddedManifests);

exports.embeddedManifests = embeddedManifests;
exports.embeddedLocales = embeddedLocales;
exports.embeddedPluginIds = embeddedPluginIds;
});
__define('./core/plugin/embedded-plugin-modules.js', function(module, exports){
const FinderPlugin = __require('./plugins/finder/index.js').default ?? __require('./plugins/finder/index.js');
const WikiPlugin = __require('./plugins/wiki/index.js').default ?? __require('./plugins/wiki/index.js');

const embeddedPluginModules = {
  finder: { default: FinderPlugin },
  wiki: { default: WikiPlugin }
};


exports.embeddedPluginModules = embeddedPluginModules;
});
__define('./plugins/finder/index.js', function(module, exports){
/**
 * Finder Plugin
 * Fast file search plugin with full-text search and preview support
 */

const { getFileCategory } = __require('./plugins/finder/utils/file-icons.js');
const { formatSize, formatDate } = __require('./plugins/finder/utils/formatters.js');
const { t } = __require('./plugins/finder/i18n.js');
const { FinderIndexer } = __require('./plugins/finder/services/indexer.js');
const { PreviewService } = __require('./plugins/finder/services/preview.js');
const { renderSearchBox } = __require('./plugins/finder/components/search-box.js');
const { renderFilterBar } = __require('./plugins/finder/components/filter-bar.js');
const { renderResultList } = __require('./plugins/finder/components/result-list.js');
const { renderPreview } = __require('./plugins/finder/components/preview.js');

class FinderPlugin {
  static id = 'finder';
  
  constructor(context) {
    this.context = context;
    this.services = context.services;
    this.settings = context.settings || {};
    
    // Detect locale from context or default to 'en'
    this.locale = context.locale || (context.i18n && context.i18n.locale) || 'en';
    
    // Plugin state
    this.state = {
      query: '',
      results: [],
      loading: false,
      selectedIndex: 0,
      filters: {
        type: 'all',
        dateRange: 'any',
        sizeRange: 'any',
        extension: ''
      },
      preview: null
    };
    
    this.searchDebounceTimer = null;
    this.container = null;
    this.indexer = null;
    this.previewService = null;
    this.previewData = null;
    
    // Bind methods
    this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }
  
  // ============ Lifecycle Hooks ============
  
  async onInstall() {
    console.log('Finder plugin: Installing...');
    
    try {
      this.indexer = new FinderIndexer({
        db: this.services.DatabaseService,
        fs: this.services.FileSystemService,
        settings: this.settings
      });
      this.previewService = new PreviewService({
        fs: this.services.FileSystemService,
        t: this.t.bind(this)
      });

      // Create file index tables
      await this.indexer.ensureSchema();
      console.log('Finder plugin: Database initialized');
    } catch (error) {
      console.error('Finder plugin: Installation failed:', error);
      throw error;
    }
  }
  
  async onActivate() {
    console.log('Finder plugin: Activating...');
    
    try {
      // Bind global shortcut
      document.addEventListener('keydown', this.handleGlobalKeydown);
      
      // Start file watch in full mode
      if (this.context.mode === 'full') {
        await this.startFileWatch();
      }
      
      // Build initial index if watch paths configured
      const watchPaths = this.getSetting('watchPaths');
      if (watchPaths && watchPaths.length > 0) {
        // Index in background
        this.buildIndex().catch(error => {
          console.error('Finder plugin: Index build failed:', error);
        });
      }
      
      console.log('Finder plugin: Activated successfully');
    } catch (error) {
      console.error('Finder plugin: Activation failed:', error);
      throw error;
    }
  }
  
  async onDeactivate() {
    console.log('Finder plugin: Deactivating...');
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    
    // Stop file watch
    this.stopFileWatch();
    
    console.log('Finder plugin: Deactivated');
  }
  
  async onUninstall() {
    console.log('Finder plugin: Uninstalling...');
    
    try {
      // Clean up database
      await this.indexer?.clearSchema();
      console.log('Finder plugin: Uninstalled successfully');
    } catch (error) {
      console.error('Finder plugin: Uninstall failed:', error);
    }
  }
  
  // ============ Mount/Unmount ============
  
  mount(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }
  
  unmount() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
  
  // ============ Rendering ============
  
  render() {
    if (!this.container) return;
    
    const { query, results, loading, selectedIndex, preview, filters } = this.state;
    
    this.container.innerHTML = `
      <div class="finder">
        <div class="finder-header">
          ${this.renderSearchBox()}
          ${this.renderFilterBar()}
        </div>
        <div class="finder-body">
          <div class="results-panel ${preview ? 'with-preview' : ''}" tabindex="0">
            ${loading ? this.renderLoading() : this.renderResults()}
          </div>
          ${preview ? this.renderPreview() : ''}
        </div>
        <div class="finder-footer">
          ${this.renderFooter()}
        </div>
      </div>
    `;
    
    // Re-bind events after render
    this.bindEvents();
  }
  
  renderSearchBox() {
    const { query } = this.state;

    return renderSearchBox({
      query,
      placeholder: this.t('searchPlaceholder') || 'Search files...',
      shortcut: 'Ctrl+Shift+F'
    });
  }
  
  renderFilterBar() {
    const { filters } = this.state;

    return renderFilterBar({
      filters,
      labels: {
        allTypes: this.t('allTypes') || 'All Types',
        documents: this.t('documents') || 'Documents',
        images: this.t('images') || 'Images',
        code: this.t('code') || 'Code',
        other: this.t('other') || 'Other',
        allSizes: this.t('allSizes') || 'Any Size',
        sizeSmall: this.t('sizeSmall') || 'Small (<1MB)',
        sizeMedium: this.t('sizeMedium') || 'Medium (1-10MB)',
        sizeLarge: this.t('sizeLarge') || 'Large (>10MB)',
        allDates: this.t('allDates') || 'Any Time',
        dateDay: this.t('dateDay') || 'Last 24h',
        dateWeek: this.t('dateWeek') || 'Last 7 days',
        dateMonth: this.t('dateMonth') || 'Last 30 days',
        dateYear: this.t('dateYear') || 'Last year',
        extensionPlaceholder: this.t('extensionPlaceholder') || 'Extension'
      }
    });
  }
  
  renderResults() {
    const { results, selectedIndex, query } = this.state;

    return renderResultList({
      results,
      selectedIndex,
      query,
      locale: this.locale,
      emptyLabel: this.t('noResults') || 'No files found'
    });
  }
  
  renderPreview() {
    const { preview } = this.state;

    const fallbackPreview = {
      type: 'info',
      content: this.t('previewNotAvailable') || 'Preview not available'
    };

    return renderPreview({
      file: preview,
      preview: this.previewData || fallbackPreview,
      labels: {
        filePath: this.t('filePath') || 'File Path:'
      }
    });
  }
  
  renderLoading() {
    return `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${this.t('searching') || 'Searching...'}</p>
      </div>
    `;
  }
  
  renderFooter() {
    const { results } = this.state;
    
    return `
      <span class="result-count">
        ${results.length} ${this.t('results') || 'results'}
      </span>
      <span class="shortcuts-hint">
        ↑↓ ${this.t('navigate') || 'navigate'} · 
        Enter ${this.t('open') || 'open'} · 
        ${this.t('previewShortcut') || 'Space preview'} ·
        Ctrl+C ${this.t('copyPath') || 'copy path'} ·
        Esc ${this.t('closeOrClear') || 'close/clear'}
      </span>
    `;
  }
  
  // ============ Event Handling ============
  
  bindEvents() {
    if (!this.container) return;
    
    // Search input
    const searchInput = this.container.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearchInput(e.target.value);
      });
      searchInput.addEventListener('keydown', this.handleKeydown);
    }
    
    // Filter change
    const filterType = this.container.querySelector('.filter-type');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.setState({
          filters: { ...this.state.filters, type: e.target.value }
        });
        this.performSearch();
      });
    }

    const filterSize = this.container.querySelector('.filter-size');
    if (filterSize) {
      filterSize.addEventListener('change', (e) => {
        this.setState({
          filters: { ...this.state.filters, sizeRange: e.target.value }
        });
        this.performSearch();
      });
    }

    const filterDate = this.container.querySelector('.filter-date');
    if (filterDate) {
      filterDate.addEventListener('change', (e) => {
        this.setState({
          filters: { ...this.state.filters, dateRange: e.target.value }
        });
        this.performSearch();
      });
    }

    const filterExtension = this.container.querySelector('.filter-extension');
    if (filterExtension) {
      filterExtension.addEventListener('input', (e) => {
        this.setState({
          filters: { ...this.state.filters, extension: e.target.value }
        });
        this.performSearch();
      });
    }
    
    // Result list click
    const resultList = this.container.querySelector('.result-list');
    if (resultList) {
      resultList.addEventListener('click', (e) => {
        const item = e.target.closest('.result-item');
        if (item) {
          const index = parseInt(item.dataset.index);
          this.selectResult(index);
          this.container?.querySelector('.results-panel')?.focus();
          
          if (e.detail === 2) {  // Double click
            this.openSelectedFile();
          }
        }
      });
    }

    const resultsPanel = this.container.querySelector('.results-panel');
    if (resultsPanel) {
      resultsPanel.addEventListener('keydown', this.handleKeydown);
    }
    
    // Close preview
    const closeBtn = this.container.querySelector('[data-action="close-preview"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.previewData = null;
        this.setState({ preview: null });
      });
    }
  }
  
  handleSearchInput(query) {
    this.previewData = null;
    this.setState({ query, loading: true, preview: null });
    
    // Debounce search
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.performSearch();
    }, 150);
  }
  
  handleKeydown(e) {
    const { results, selectedIndex } = this.state;
    const isInputTarget = e.target?.classList?.contains('search-input');
    
    switch (e.key) {
      case 'ArrowUp':
        if (results.length === 0) return;
        e.preventDefault();
        this.selectResult(Math.max(0, selectedIndex - 1));
        break;
        
      case 'ArrowDown':
        if (results.length === 0) return;
        e.preventDefault();
        this.selectResult(Math.min(results.length - 1, selectedIndex + 1));
        break;
        
      case 'Enter':
        e.preventDefault();
        this.openSelectedFile();
        break;
        
      case 'Escape':
        if (this.state.preview) {
          this.previewData = null;
          this.setState({ preview: null });
        } else {
          this.previewData = null;
          this.setState({ query: '', results: [] });
        }
        break;
        
      case ' ':  // Space
        if (!isInputTarget) {
          e.preventDefault();
          this.previewSelectedFile();
        }
        break;
    }
    
    // Ctrl+C - Copy path
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && results[selectedIndex]) {
      e.preventDefault();
      this.copyPath(results[selectedIndex].path);
    }
  }
  
  handleGlobalKeydown(e) {
    // Ctrl+Shift+F - Open Finder
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      this.focus();
    }
  }
  
  // ============ Search Operations ============
  
  async performSearch() {
    const { query, filters } = this.state;
    
    if (!query.trim()) {
      this.setState({ results: [], loading: false });
      return;
    }
    
    try {
      let results;
      
      if (this.context.mode === 'full' && this.services.SearchService) {
        // Full mode: search through local service when available
        try {
          results = await this.searchFilesystem(query);
          if (this.getSetting('enableContentSearch') !== false) {
            const localResults = await this.searchLocalIndex(query);
            results = this.mergeResults(results, localResults);
          }
        } catch (error) {
          console.error('Finder plugin: Full-mode search failed, falling back', error);
          results = await this.searchLocalIndex(query);
          this.showError(this.t('searchFallback') || 'File search service unavailable, using local index');
        }
      } else {
        // Light/Pure mode: search local index
        results = await this.searchLocalIndex(query);
      }
      
      const normalizedResults = this.normalizeResults(results);
      // Apply filters
      results = this.applyFilters(normalizedResults, filters);
      
      this.setState({
        results,
        loading: false,
        selectedIndex: 0
      });
      
    } catch (error) {
      console.error('Finder plugin: Search failed:', error);
      this.setState({ results: [], loading: false });
      this.showError(this.t('searchError') || 'Search failed');
    }
  }
  
  async searchFilesystem(query) {
    // Search through FileSystemService
    // This is a simplified implementation - actual implementation would depend on the service API
    const results = await this.services.SearchService.searchFiles(query, {
      maxResults: this.getSetting('maxResults') || 100,
      includeHidden: this.getSetting('includeHidden') || false,
      includeContent: this.getSetting('enableContentSearch') || false
    });
    return results || [];
  }
  
  async searchLocalIndex(query) {
    const maxResults = this.getSetting('maxResults') || 100;

    if (!this.indexer) return [];

    return this.indexer.searchIndex(query, maxResults);
  }

  normalizeResults(results = []) {
    return results
      .map(result => this.normalizeResult(result))
      .filter(Boolean);
  }

  normalizeResult(result) {
    if (!result) return null;

    if (result.path && result.name) {
      return {
        ...result,
        extension: result.extension || this.getExtension(result.name || result.path || ''),
        modifiedAt: result.modifiedAt || result.updatedAt || result.modified_at
      };
    }

    const metadata = result.metadata || {};
    const path = metadata.path || result.path || result.snippet || '';
    const name = result.title || result.name || this.getBasename(path) || path;
    const extension = this.getExtension(name || path);

    return {
      id: result.id,
      path,
      name,
      extension,
      size: metadata.size ?? result.size,
      mimeType: metadata.mimeType ?? result.mimeType ?? result.mime_type,
      modifiedAt: result.updatedAt || result.modifiedAt || result.updated_at,
      snippet: result.snippet,
      score: result.score
    };
  }

  getExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  getBasename(path) {
    if (!path) return '';
    return path.split(/[/\\]/).pop();
  }

  mergeResults(primary = [], secondary = []) {
    const merged = new Map();
    for (const result of primary) {
      const normalized = this.normalizeResult(result);
      if (normalized?.path) {
        merged.set(normalized.path, normalized);
      }
    }
    for (const result of secondary) {
      const normalized = this.normalizeResult(result);
      if (!normalized?.path) continue;
      if (!merged.has(normalized.path)) {
        merged.set(normalized.path, normalized);
      }
    }
    return Array.from(merged.values());
  }
  
  applyFilters(results, filters) {
    const sizeRanges = {
      small: { max: 1024 * 1024 },
      medium: { min: 1024 * 1024, max: 10 * 1024 * 1024 },
      large: { min: 10 * 1024 * 1024 }
    };
    const now = Date.now();
    const dateRanges = {
      day: now - 24 * 60 * 60 * 1000,
      week: now - 7 * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
      year: now - 365 * 24 * 60 * 60 * 1000
    };

    return results.filter(result => {
      // Type filter
      if (filters.type !== 'all') {
        const category = getFileCategory(result.extension);
        if (category !== filters.type) return false;
      }
      
      // Size filter
      if (filters.sizeRange && filters.sizeRange !== 'any') {
        const range = sizeRanges[filters.sizeRange];
        if (result.size == null) return false;
        if (range?.min && result.size < range.min) return false;
        if (range?.max && result.size > range.max) return false;
      }
      
      // Date filter
      if (filters.dateRange && filters.dateRange !== 'any') {
        const start = dateRanges[filters.dateRange];
        if (start && result.modifiedAt < start) return false;
      }

      if (filters.extension) {
        const fallbackExtension = result.name?.includes('.') ? result.name.split('.').pop() : '';
        const extension = (result.extension || fallbackExtension || '').toLowerCase();
        const target = filters.extension.trim().replace(/^\./, '').toLowerCase();
        if (target && extension !== target) return false;
      }
      
      return true;
    });
  }
  
  // ============ File Operations ============
  
  selectResult(index) {
    this.setState({ selectedIndex: index });
    
    // Scroll selected item into view
    const item = this.container?.querySelector(`.result-item[data-index="${index}"]`);
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  
  async openSelectedFile() {
    const { results, selectedIndex } = this.state;
    const file = results[selectedIndex];
    
    if (!file) return;
    
    try {
      // Attempt to open file through FileSystemService
      if (this.services.FileSystemService && this.services.FileSystemService.openFile) {
        await this.services.FileSystemService.openFile(file.path);
      } else {
        // Fallback: try to download/open via browser
        window.open(file.path, '_blank');
      }
    } catch (error) {
      console.error('Finder plugin: Failed to open file:', error);
      this.showError(this.t('openError') || 'Failed to open file');
    }
  }
  
  async previewSelectedFile() {
    const { results, selectedIndex } = this.state;
    const file = results[selectedIndex];
    
    if (!file) return;

    this.previewData = await this.previewService?.getPreview(file);
    this.setState({ preview: file });
  }
  
  async copyPath(path) {
    try {
      await navigator.clipboard.writeText(path);
      this.showSuccess(this.t('pathCopied') || 'Path copied to clipboard');
    } catch (error) {
      console.error('Finder plugin: Failed to copy path:', error);
      this.showError(this.t('copyError') || 'Failed to copy path');
    }
  }
  
  // ============ File Indexing ============
  
  async buildIndex() {
    const watchPaths = this.getSetting('watchPaths') || [];
    
    if (watchPaths.length === 0) {
      console.log('Finder plugin: No watch paths configured');
      return;
    }
    
    console.log('Finder plugin: Building index for paths:', watchPaths);
    
    this.emit('index_start');
    
    try {
      await this.indexer?.buildIndex(watchPaths);
      
      this.emit('index_complete');
      console.log('Finder plugin: Index build complete');
    } catch (error) {
      console.error('Finder plugin: Index build failed:', error);
      this.emit('index_error', error);
    }
  }
  
  async startFileWatch() {
    // File watching would be implemented here
    // Would require FileSystemService support
    console.log('Finder plugin: File watch started');
  }
  
  stopFileWatch() {
    // Stop file watching
    console.log('Finder plugin: File watch stopped');
  }
  
  // ============ Utility Methods ============
  
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.render();
  }
  
  getSetting(key) {
    return this.settings[key];
  }
  
  t(key) {
    // Translation helper using the i18n module
    return t(key, this.locale);
  }
  
  emit(event, data) {
    // Event emitter - simplified
    console.log('Finder plugin event:', event, data);
  }
  
  focus() {
    const searchInput = this.container?.querySelector('.search-input');
    searchInput?.focus();
  }
  
  showError(message) {
    // Show error toast
    console.error('Finder plugin:', message);
    if (this.context.ui && this.context.ui.showToast) {
      this.context.ui.showToast(message, 'error');
    }
  }
  
  showSuccess(message) {
    // Show success toast
    console.log('Finder plugin:', message);
    if (this.context.ui && this.context.ui.showToast) {
      this.context.ui.showToast(message, 'success');
    }
  }
}

exports.default = FinderPlugin;
});
__define('./plugins/finder/utils/file-icons.js', function(module, exports){
/**
 * File icon utilities
 * Maps file extensions to appropriate icons
 */

const FILE_ICONS = {
  // Documents
  'pdf': '📄',
  'doc': '📝',
  'docx': '📝',
  'txt': '📝',
  'md': '📝',
  'markdown': '📝',
  
  // Spreadsheets
  'xls': '📊',
  'xlsx': '📊',
  'csv': '📊',
  
  // Presentations
  'ppt': '📊',
  'pptx': '📊',
  
  // Images
  'jpg': '🖼️',
  'jpeg': '🖼️',
  'png': '🖼️',
  'gif': '🖼️',
  'svg': '🖼️',
  'webp': '🖼️',
  'bmp': '🖼️',
  'ico': '🖼️',
  
  // Code
  'js': '📜',
  'ts': '📜',
  'jsx': '📜',
  'tsx': '📜',
  'java': '☕',
  'py': '🐍',
  'rb': '💎',
  'php': '🐘',
  'go': '🐹',
  'rs': '🦀',
  'c': '📜',
  'cpp': '📜',
  'h': '📜',
  'hpp': '📜',
  'cs': '📜',
  'sh': '📜',
  'bash': '📜',
  
  // Web
  'html': '🌐',
  'htm': '🌐',
  'css': '🎨',
  'scss': '🎨',
  'sass': '🎨',
  'less': '🎨',
  
  // Data
  'json': '📋',
  'xml': '📋',
  'yaml': '📋',
  'yml': '📋',
  'toml': '📋',
  'ini': '⚙️',
  'conf': '⚙️',
  'config': '⚙️',
  
  // Archives
  'zip': '🗜️',
  'rar': '🗜️',
  '7z': '🗜️',
  'tar': '🗜️',
  'gz': '🗜️',
  'bz2': '🗜️',
  
  // Media
  'mp3': '🎵',
  'wav': '🎵',
  'flac': '🎵',
  'mp4': '🎬',
  'avi': '🎬',
  'mkv': '🎬',
  'mov': '🎬',
  
  // Database
  'db': '🗄️',
  'sqlite': '🗄️',
  'sql': '🗄️',
  
  // Other
  'log': '📋',
  'exe': '⚙️',
  'dll': '⚙️',
  'so': '⚙️',
  'jar': '☕'
};

const CATEGORY_ICONS = {
  document: '📄',
  image: '🖼️',
  code: '📜',
  archive: '🗜️',
  media: '🎵',
  folder: '📁',
  unknown: '📄'
};

/**
 * Get icon for a file based on its extension
 * @param {Object} file - File object with extension property
 * @returns {string} - Icon emoji
 */
function getFileIcon(file) {
  if (file.isDirectory) {
    return CATEGORY_ICONS.folder;
  }
  
  const ext = file.extension?.toLowerCase();
  return FILE_ICONS[ext] || CATEGORY_ICONS.unknown;
}

/**
 * Get file category from extension
 * @param {string} extension - File extension
 * @returns {string} - Category name
 */
function getFileCategory(extension) {
  if (!extension) return 'unknown';
  
  const ext = extension.toLowerCase();
  
  // Documents
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'markdown', 'rtf', 'odt'].includes(ext)) {
    return 'document';
  }
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  
  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'java', 'py', 'rb', 'php', 'go', 'rs', 
       'c', 'cpp', 'h', 'hpp', 'cs', 'sh', 'bash', 'html', 'css', 'scss'].includes(ext)) {
    return 'code';
  }
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return 'archive';
  }
  
  // Media
  if (['mp3', 'wav', 'flac', 'mp4', 'avi', 'mkv', 'mov'].includes(ext)) {
    return 'media';
  }
  
  return 'other';
}

/**
 * Get category icon
 * @param {string} category - Category name
 * @returns {string} - Icon emoji
 */
function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.unknown;
}

exports.getFileIcon = getFileIcon;
exports.getFileCategory = getFileCategory;
exports.getCategoryIcon = getCategoryIcon;
});
__define('./plugins/finder/utils/formatters.js', function(module, exports){
/**
 * Formatting utilities for file information
 */

/**
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes == null) return '-';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

/**
 * Format timestamp to relative time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {string} locale - Locale for formatting (default: 'en')
 * @returns {string} - Relative time string (e.g., "2 days ago", "1 hour ago")
 */
function formatDate(timestamp, locale = 'en') {
  if (!timestamp) return '-';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  
  // Localized time units
  const timeUnits = {
    en: {
      year: (n) => `${n} year${n > 1 ? 's' : ''} ago`,
      month: (n) => `${n} month${n > 1 ? 's' : ''} ago`,
      day: (n) => `${n} day${n > 1 ? 's' : ''} ago`,
      hour: (n) => `${n} hour${n > 1 ? 's' : ''} ago`,
      minute: (n) => `${n} minute${n > 1 ? 's' : ''} ago`,
      justNow: 'just now'
    },
    zh: {
      year: (n) => `${n}年前`,
      month: (n) => `${n}月前`,
      day: (n) => `${n}天前`,
      hour: (n) => `${n}小时前`,
      minute: (n) => `${n}分钟前`,
      justNow: '刚刚'
    },
    ja: {
      year: (n) => `${n}年前`,
      month: (n) => `${n}ヶ月前`,
      day: (n) => `${n}日前`,
      hour: (n) => `${n}時間前`,
      minute: (n) => `${n}分前`,
      justNow: 'たった今'
    }
  };
  
  const units = timeUnits[locale] || timeUnits.en;
  
  if (years > 0) {
    return units.year(years);
  } else if (months > 0) {
    return units.month(months);
  } else if (days > 0) {
    return units.day(days);
  } else if (hours > 0) {
    return units.hour(hours);
  } else if (minutes > 0) {
    return units.minute(minutes);
  } else {
    return units.justNow;
  }
}

/**
 * Format absolute date
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Formatted date string
 */
function formatAbsoluteDate(timestamp) {
  if (!timestamp) return '-';
  
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (text == null) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching text in search results
 * @param {string} text - Original text
 * @param {string} query - Search query
 * @returns {string} - HTML with highlighted text
 */
function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Format snippet text with safe highlights.
 * @param {string} snippet - Snippet containing highlight markers.
 * @param {string} query - Search query.
 * @returns {string} - HTML snippet with highlights.
 */
function formatSnippet(snippet, query) {
  if (!snippet) return '';
  const markerStart = '\u0001';
  const markerEnd = '\u0002';
  const hasMarkers = snippet.includes(markerStart) && snippet.includes(markerEnd);
  if (hasMarkers) {
    const escaped = escapeHtml(snippet);
    return escaped
      .replaceAll(markerStart, '<mark>')
      .replaceAll(markerEnd, '</mark>');
  }
  return highlightMatch(snippet, query);
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Build FTS5 query from user input
 * @param {string} query - User search query
 * @returns {string} - FTS5 query
 */
function buildFtsQuery(query) {
  if (!query) return '';
  
  // Escape FTS5 special characters
  query = query.replace(/[:"*]/g, ' ');
  
  // Split into terms
  const terms = query.trim().split(/\s+/).filter(t => t.length > 0);
  
  if (terms.length === 0) return '';
  
  // Build query with prefix matching
  return terms.map(term => `${term}*`).join(' ');
}

exports.formatSize = formatSize;
exports.formatDate = formatDate;
exports.formatAbsoluteDate = formatAbsoluteDate;
exports.escapeHtml = escapeHtml;
exports.highlightMatch = highlightMatch;
exports.formatSnippet = formatSnippet;
exports.truncate = truncate;
exports.buildFtsQuery = buildFtsQuery;
});
__define('./plugins/finder/i18n.js', function(module, exports){
/**
 * Finder Plugin Internationalization
 * Translations for all supported languages
 */

const translations = {
  en: {
    searchPlaceholder: 'Search files...',
    allTypes: 'All Types',
    documents: 'Documents',
    images: 'Images',
    code: 'Code',
    other: 'Other',
    allSizes: 'Any Size',
    sizeSmall: 'Small (<1MB)',
    sizeMedium: 'Medium (1-10MB)',
    sizeLarge: 'Large (>10MB)',
    allDates: 'Any Time',
    dateDay: 'Last 24h',
    dateWeek: 'Last 7 days',
    dateMonth: 'Last 30 days',
    dateYear: 'Last year',
    extensionPlaceholder: 'Extension',
    noResults: 'No files found',
    searching: 'Searching...',
    results: 'results',
    navigate: 'navigate',
    open: 'open',
    previewShortcut: 'Space preview',
    copyPath: 'copy path',
    closeOrClear: 'close/clear',
    searchError: 'Search failed',
    searchFallback: 'File search service unavailable, using local index',
    openError: 'Failed to open file',
    copyError: 'Failed to copy path',
    pathCopied: 'Path copied to clipboard',
    preview: 'Preview',
    fileName: 'Name',
    filePath: 'Path',
    fileSize: 'Size',
    modified: 'Modified',
    previewNotAvailable: 'Preview not available for this file type',
    previewTextTooLarge: 'Text preview skipped ({size} > {limit})',
    previewImageTooLarge: 'Image preview skipped ({size} > {limit})'
  },
  zh: {
    searchPlaceholder: '搜索文件...',
    allTypes: '所有类型',
    documents: '文档',
    images: '图片',
    code: '代码',
    other: '其他',
    allSizes: '所有大小',
    sizeSmall: '小于 1MB',
    sizeMedium: '1-10MB',
    sizeLarge: '大于 10MB',
    allDates: '全部时间',
    dateDay: '24 小时内',
    dateWeek: '7 天内',
    dateMonth: '30 天内',
    dateYear: '一年内',
    extensionPlaceholder: '扩展名',
    noResults: '未找到文件',
    searching: '搜索中...',
    results: '个结果',
    navigate: '导航',
    open: '打开',
    previewShortcut: '空格预览',
    copyPath: '复制路径',
    closeOrClear: '关闭/清空',
    searchError: '搜索失败',
    searchFallback: '文件搜索服务不可用，已切换本地索引',
    openError: '打开文件失败',
    copyError: '复制路径失败',
    pathCopied: '路径已复制到剪贴板',
    preview: '预览',
    fileName: '名称',
    filePath: '路径',
    fileSize: '大小',
    modified: '修改时间',
    previewNotAvailable: '此文件类型暂不支持预览',
    previewTextTooLarge: '文本预览已跳过（{size} > {limit}）',
    previewImageTooLarge: '图片预览已跳过（{size} > {limit}）'
  },
  ja: {
    searchPlaceholder: 'ファイルを検索...',
    allTypes: 'すべてのタイプ',
    documents: 'ドキュメント',
    images: '画像',
    code: 'コード',
    other: 'その他',
    allSizes: 'すべてのサイズ',
    sizeSmall: '1MB未満',
    sizeMedium: '1-10MB',
    sizeLarge: '10MB以上',
    allDates: 'すべての期間',
    dateDay: '24時間以内',
    dateWeek: '7日以内',
    dateMonth: '30日以内',
    dateYear: '1年以内',
    extensionPlaceholder: '拡張子',
    noResults: 'ファイルが見つかりません',
    searching: '検索中...',
    results: '件の結果',
    navigate: 'ナビゲート',
    open: '開く',
    previewShortcut: 'スペースでプレビュー',
    copyPath: 'パスをコピー',
    closeOrClear: '閉じる/クリア',
    searchError: '検索に失敗しました',
    searchFallback: 'ファイル検索サービスが利用できないためローカル検索に切り替えました',
    openError: 'ファイルを開けませんでした',
    copyError: 'パスのコピーに失敗しました',
    pathCopied: 'パスをクリップボードにコピーしました',
    preview: 'プレビュー',
    fileName: '名前',
    filePath: 'パス',
    fileSize: 'サイズ',
    modified: '更新日時',
    previewNotAvailable: 'このファイルタイプのプレビューは利用できません',
    previewTextTooLarge: 'テキストプレビューを省略しました（{size} > {limit}）',
    previewImageTooLarge: '画像プレビューを省略しました（{size} > {limit}）'
  }
};

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @param {string} locale - Locale code (default: 'en')
 * @returns {string} - Translated string
 */
function t(key, locale = 'en') {
  const localeTranslations = translations[locale] || translations.en;
  return localeTranslations[key] || translations.en[key] || key;
}

/**
 * Get all translations for a locale
 * @param {string} locale - Locale code
 * @returns {Object} - Translations object
 */
function getTranslations(locale = 'en') {
  return translations[locale] || translations.en;
}

exports.translations = translations;
exports.t = t;
exports.getTranslations = getTranslations;
});
__define('./plugins/finder/services/indexer.js', function(module, exports){
/**
 * Finder Indexer Service
 * Handles file indexing and local search.
 */

const { buildFtsQuery } = __require('./plugins/finder/utils/formatters.js');

class FinderIndexer {
  constructor({ db, fs, settings }) {
    this.db = db;
    this.fs = fs;
    this.settings = settings || {};
  }

  async ensureSchema() {
    if (!this.db) return;

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS finder_index (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        extension TEXT,
        size INTEGER,
        mime_type TEXT,
        content_hash TEXT,
        content_indexed INTEGER DEFAULT 0,
        created_at INTEGER,
        modified_at INTEGER,
        indexed_at INTEGER NOT NULL
      )
    `);

    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_name ON finder_index(name)`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_ext ON finder_index(extension)`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_path ON finder_index(path)`);

    await this.db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS finder_fts USING fts5(
        name,
        path,
        content,
        content='finder_index',
        content_rowid='rowid',
        tokenize='unicode61'
      )
    `);
  }

  async clearSchema() {
    if (!this.db) return;
    await this.db.execute('DROP TABLE IF EXISTS finder_fts');
    await this.db.execute('DROP TABLE IF EXISTS finder_index');
  }

  async buildIndex(paths = []) {
    if (!this.fs || !this.fs.listDir) return;

    for (const path of paths) {
      await this.indexDirectory(path);
    }
  }

  async indexDirectory(dirPath) {
    if (!this.fs || !this.fs.listDir) return;

    const files = await this.fs.listDir(dirPath, {
      recursive: true,
      includeHidden: this.settings.includeHidden || false
    });

    for (const file of files) {
      await this.indexFile(file);
    }
  }

  async indexFile(file) {
    if (!this.db) return;

    const shouldIndexContent = Boolean(
      this.settings.enableContentSearch &&
      this.settings.indexExtensions?.includes?.(file.extension)
    );

    let content = null;
    if (shouldIndexContent && this.fs?.readFile) {
      try {
        content = await this.fs.readFile(file.path, 'text');
      } catch {
        content = null;
      }
    }

    await this.db.execute(`
      INSERT OR REPLACE INTO finder_index
      (id, path, name, extension, size, mime_type, content_hash, content_indexed, created_at, modified_at, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      file.id || file.path,
      file.path,
      file.name,
      file.extension,
      file.size,
      file.mimeType,
      file.contentHash || null,
      content ? 1 : 0,
      file.createdAt || Date.now(),
      file.modifiedAt || Date.now(),
      Date.now()
    ]);

    const row = await this.db.queryOne(
      'SELECT rowid FROM finder_index WHERE path = ?',
      [file.path]
    );

    if (row?.rowid) {
      await this.db.execute(`
        INSERT OR REPLACE INTO finder_fts(rowid, name, path, content)
        VALUES (?, ?, ?, ?)
      `, [row.rowid, file.name, file.path, content || '']);
    }
  }

  async searchIndex(query, maxResults = 100) {
    if (!this.db) return [];

    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    const results = await this.db.query(`
      SELECT
        f.id,
        f.path,
        f.name,
        f.extension,
        f.size,
        f.mime_type,
        f.modified_at,
        snippet(finder_fts, 2, '\u0001', '\u0002', '…', 12) as snippet,
        bm25(finder_fts) as score
      FROM finder_index f
      JOIN finder_fts ON f.rowid = finder_fts.rowid
      WHERE finder_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `, [ftsQuery, maxResults]);

    return results.map(r => ({
      id: r.id,
      path: r.path,
      name: r.name,
      extension: r.extension,
      size: r.size,
      mimeType: r.mime_type,
      modifiedAt: r.modified_at,
      snippet: r.snippet,
      score: r.score
    }));
  }
}

exports.FinderIndexer = FinderIndexer;
});
__define('./plugins/finder/services/preview.js', function(module, exports){
/**
 * Finder Preview Service
 * Provides basic preview data for files.
 */

const { escapeHtml, formatSize, truncate } = __require('./plugins/finder/utils/formatters.js');
const { getFileCategory } = __require('./plugins/finder/utils/file-icons.js');

class PreviewService {
  constructor({ fs, t }) {
    this.fs = fs;
    this.t = t;
    this.maxTextBytes = 200 * 1024;
    this.maxImageBytes = 5 * 1024 * 1024;
    this.maxTextChars = 12000;
  }

  async getPreview(file) {
    if (!file) return null;

    const category = getFileCategory(file.extension);
    const fileSize = file.size ?? null;

    if (!this.fs || !this.fs.readFile) {
      return {
        type: 'info',
        content: escapeHtml(file.path || '')
      };
    }

    if (category === 'image') {
      if (fileSize && fileSize > this.maxImageBytes) {
        return {
          type: 'info',
          content: this.formatMessage(
            'previewImageTooLarge',
            `Image preview skipped (${formatSize(fileSize)} > ${formatSize(this.maxImageBytes)})`,
            { size: formatSize(fileSize), limit: formatSize(this.maxImageBytes) }
          )
        };
      }
      try {
        const src = await this.fs.readFile(file.path, 'dataurl');
        return { type: 'image', src };
      } catch {
        return { type: 'info', content: escapeHtml(file.path || '') };
      }
    }

    if (category === 'text' || category === 'code' || category === 'document') {
      if (fileSize && fileSize > this.maxTextBytes) {
        return {
          type: 'info',
          content: this.formatMessage(
            'previewTextTooLarge',
            `Text preview skipped (${formatSize(fileSize)} > ${formatSize(this.maxTextBytes)})`,
            { size: formatSize(fileSize), limit: formatSize(this.maxTextBytes) }
          )
        };
      }
      try {
        const raw = await this.fs.readFile(file.path, 'text');
        const safe = escapeHtml(truncate(raw, this.maxTextChars));
        if (category === 'code') {
          return {
            type: 'code',
            content: safe,
            language: (file.extension || '').toLowerCase()
          };
        }
        return { type: 'text', content: safe };
      } catch {
        return { type: 'info', content: escapeHtml(file.path || '') };
      }
    }

    return {
      type: 'info',
      content: escapeHtml(file.path || '')
    };
  }

  formatMessage(key, fallback, data = {}) {
    const localized = this.t ? this.t(key) : null;
    const template = localized && localized !== key ? localized : fallback;
    return template.replace(/\{(\w+)\}/g, (_, token) => data[token] ?? '');
  }
}

exports.PreviewService = PreviewService;
});
__define('./plugins/finder/components/search-box.js', function(module, exports){
const { escapeHtml } = __require('./plugins/finder/utils/formatters.js');

function renderSearchBox({ query, placeholder, shortcut }) {
  return `
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        class="search-input"
        placeholder="${escapeHtml(placeholder)}"
        value="${escapeHtml(query)}"
        autofocus
      >
      <span class="search-shortcut">${escapeHtml(shortcut)}</span>
    </div>
  `;
}

exports.renderSearchBox = renderSearchBox;
});
__define('./plugins/finder/components/filter-bar.js', function(module, exports){
function isSelected(current, value) {
  return current === value ? 'selected' : '';
}

function renderFilterBar({ filters, labels }) {
  return `
    <div class="filter-bar">
      <select class="filter-type" value="${filters.type}">
        <option value="all" ${isSelected(filters.type, 'all')}>${labels.allTypes}</option>
        <option value="document" ${isSelected(filters.type, 'document')}>${labels.documents}</option>
        <option value="image" ${isSelected(filters.type, 'image')}>${labels.images}</option>
        <option value="code" ${isSelected(filters.type, 'code')}>${labels.code}</option>
        <option value="other" ${isSelected(filters.type, 'other')}>${labels.other}</option>
      </select>
      <select class="filter-size" value="${filters.sizeRange}">
        <option value="any" ${isSelected(filters.sizeRange, 'any')}>${labels.allSizes}</option>
        <option value="small" ${isSelected(filters.sizeRange, 'small')}>${labels.sizeSmall}</option>
        <option value="medium" ${isSelected(filters.sizeRange, 'medium')}>${labels.sizeMedium}</option>
        <option value="large" ${isSelected(filters.sizeRange, 'large')}>${labels.sizeLarge}</option>
      </select>
      <select class="filter-date" value="${filters.dateRange}">
        <option value="any" ${isSelected(filters.dateRange, 'any')}>${labels.allDates}</option>
        <option value="day" ${isSelected(filters.dateRange, 'day')}>${labels.dateDay}</option>
        <option value="week" ${isSelected(filters.dateRange, 'week')}>${labels.dateWeek}</option>
        <option value="month" ${isSelected(filters.dateRange, 'month')}>${labels.dateMonth}</option>
        <option value="year" ${isSelected(filters.dateRange, 'year')}>${labels.dateYear}</option>
      </select>
      <input class="filter-extension" type="text" value="${filters.extension || ''}" placeholder="${labels.extensionPlaceholder}" />
    </div>
  `;
}

exports.renderFilterBar = renderFilterBar;
});
__define('./plugins/finder/components/result-list.js', function(module, exports){
const { getFileIcon } = __require('./plugins/finder/utils/file-icons.js');
const { escapeHtml, formatDate, formatSize, formatSnippet, highlightMatch } = __require('./plugins/finder/utils/formatters.js');

function renderResultList({ results, selectedIndex, query, locale, emptyLabel }) {
  if (results.length === 0) {
    return `
      <div class="empty-state">
        <span class="empty-icon">📂</span>
        <p>${escapeHtml(emptyLabel)}</p>
      </div>
    `;
  }

  return `
    <ul class="result-list">
      ${results.map((result, index) => `
        <li class="result-item ${index === selectedIndex ? 'selected' : ''}"
            data-index="${index}"
            data-path="${escapeHtml(result.path)}">
          <span class="file-icon">${getFileIcon(result)}</span>
          <div class="file-info">
            <div class="file-name">${highlightMatch(result.name, query)}</div>
            <div class="file-path">${highlightMatch(result.path, query)}</div>
            ${result.snippet ? `<div class="file-snippet">${formatSnippet(result.snippet, query)}</div>` : ''}
          </div>
          <div class="file-meta">
            <span class="file-size">${formatSize(result.size)}</span>
            <span class="file-date">${formatDate(result.modifiedAt, locale)}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

exports.renderResultList = renderResultList;
});
__define('./plugins/finder/components/preview.js', function(module, exports){
const { escapeHtml } = __require('./plugins/finder/utils/formatters.js');

function renderPreview({ file, preview, labels }) {
  if (!file || !preview) return '';

  let content = '';
  if (preview.type === 'image') {
    content = `<img src="${preview.src}" alt="${escapeHtml(file.name)}" />`;
  } else if (preview.type === 'code') {
    content = `<pre class="preview-code"><code data-language="${escapeHtml(preview.language || '')}">${preview.content}</code></pre>`;
  } else if (preview.type === 'text') {
    content = `<pre class="preview-text">${preview.content}</pre>`;
  } else {
    content = `<div class="preview-info">${escapeHtml(preview.content || '')}</div>`;
  }

  return `
    <div class="preview-panel">
      <div class="preview-header">
        <span class="preview-title">${escapeHtml(file.name)}</span>
        <button class="preview-close" data-action="close-preview">×</button>
      </div>
      <div class="preview-content">
        <div class="preview-meta">
          <p><strong>${labels.filePath}</strong> ${escapeHtml(file.path)}</p>
        </div>
        ${content}
      </div>
    </div>
  `;
}

exports.renderPreview = renderPreview;
});
__define('./plugins/wiki/index.js', function(module, exports){
/**
 * Wiki Plugin - Knowledge base with modules, columns, and cards
 * Supports Markdown, bidirectional links, and tags
 */
const WikiService = __require('./plugins/wiki/services/wiki-service.js').default ?? __require('./plugins/wiki/services/wiki-service.js');
const LinkParser = __require('./plugins/wiki/services/link-parser.js').default ?? __require('./plugins/wiki/services/link-parser.js');
const VersionManager = __require('./plugins/wiki/services/version-manager.js').default ?? __require('./plugins/wiki/services/version-manager.js');

class WikiPlugin {
  static id = 'wiki';

  constructor(context) {
    this.context = context;
    this.container = null;
    
    // State
    this.state = {
      modules: [],
      allColumns: [],
      currentModule: null,
      columns: [],
      cards: [],
      allCards: [],
      selectedCard: null,
      editingCard: null,
      view: 'board',
      searchQuery: '',
      searchResults: [],
      highlightQuery: '',
      focusedCardId: null,
      filters: {
        tags: [],
        dateRange: null
      },
      showBacklinks: false,
      editorPreviewEnabled: true
    };

    // Services
    this.wikiService = null;
    this.linkParser = new LinkParser();
    this.versionManager = null;

    // Auto-save
    this.autoSaveTimer = null;
    this.pendingChanges = new Map();
    this.editingOriginal = null;

    // Localization
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('Wiki plugin installing...');
    
    // Initialize database schema
    this.wikiService = new WikiService(this.context.services.DatabaseService);
    await this.wikiService.initSchema();
    
    console.log('Wiki plugin installed');
  }

  async onActivate() {
    console.log('Wiki plugin activating...');
    
    // Initialize services
    this.wikiService = new WikiService(this.context.services.DatabaseService);
    this.versionManager = new VersionManager(this.wikiService);
    
    // Load initial data
    await this.loadModules();
    
    // Bind global shortcuts
    this.bindGlobalShortcuts();
    
    console.log('Wiki plugin activated');
  }

  async onDeactivate() {
    console.log('Wiki plugin deactivating...');
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Unbind shortcuts
    this.unbindGlobalShortcuts();
    
    console.log('Wiki plugin deactivated');
  }

  async mount(container) {
    this.container = container;
    
    // Load default view setting
    const settings = await this.context.getSettings();
    this.state.view = settings.defaultView || 'board';
    
    await this.render();
    this.bindEvents();
  }

  async unmount() {
    this.stopAutoSave();
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  // ==================== Rendering ====================

  async render() {
    if (!this.container) return;

    const { modules, currentModule, columns, cards, selectedCard, view, searchQuery } = this.state;

    this.container.innerHTML = `
      <div class="wiki-plugin">
        <div class="wiki-sidebar">
          ${this.renderSidebar(modules)}
        </div>
        <div class="wiki-main">
          ${searchQuery ? this.renderSearchResults() : ''}
          ${currentModule ? this.renderModule(currentModule, columns, cards, view) : this.renderWelcome()}
        </div>
        ${selectedCard ? this.renderCardDetail(selectedCard) : ''}
      </div>
    `;
  }

  renderSidebar(modules) {
    return `
      <div class="sidebar-header">
        <h2>📚 ${this.t('welcome')}</h2>
        <button class="btn-icon" data-action="create-module" title="${this.t('createModule')}">
          ➕
        </button>
      </div>
      <div class="sidebar-search">
        <input 
          type="text" 
          class="search-input" 
          placeholder="${this.t('searchPlaceholder')}"
          data-action="search"
          value="${this.escapeHtml(this.state.searchQuery)}">
      </div>
      <div class="module-list">
        ${modules.length === 0 
          ? `<div class="empty-state">${this.t('welcomeMessage')}</div>`
          : modules.map(m => this.renderModuleItem(m)).join('')
        }
      </div>
    `;
  }

  renderModuleItem(module) {
    const isActive = this.state.currentModule?.id === module.id;
    return `
      <div class="module-item ${isActive ? 'active' : ''}" 
           data-module-id="${module.id}"
           data-action="select-module">
        <span class="module-icon">${module.icon || '📚'}</span>
        <span class="module-name">${this.escapeHtml(module.name)}</span>
        <div class="module-actions">
          <button class="btn-icon-small" data-action="edit-module" data-module-id="${module.id}" title="${this.t('edit')}">✏️</button>
          <button class="btn-icon-small" data-action="delete-module" data-module-id="${module.id}" title="${this.t('delete')}">🗑️</button>
        </div>
      </div>
    `;
  }

  renderWelcome() {
    return `
      <div class="welcome-screen">
        <div class="welcome-icon">📚</div>
        <h1>${this.t('welcome')}</h1>
        <p>${this.t('welcomeMessage')}</p>
        <button class="btn-primary" data-action="create-module">
          ${this.t('createModule')}
        </button>
      </div>
    `;
  }

  renderModule(module, columns, cards, view) {
    return `
      <div class="module-view">
        <div class="module-header">
          <div class="module-title">
            <span class="module-icon">${module.icon || '📚'}</span>
            <h1>${this.escapeHtml(module.name)}</h1>
          </div>
          <div class="module-toolbar">
            <button class="btn-icon" data-action="create-column" title="${this.t('createColumn')}">
              ➕ ${this.t('createColumn')}
            </button>
            <div class="view-switcher">
              <button class="btn-icon ${view === 'board' ? 'active' : ''}" 
                      data-action="switch-view" 
                      data-view="board"
                      title="${this.t('viewBoard')}">📋</button>
              <button class="btn-icon ${view === 'list' ? 'active' : ''}" 
                      data-action="switch-view" 
                      data-view="list"
                      title="${this.t('viewList')}">📄</button>
            </div>
          </div>
        </div>
        <div class="module-body">
          ${view === 'board' 
            ? this.renderBoardView(columns, cards)
            : this.renderListView(columns, cards)
          }
        </div>
      </div>
    `;
  }

  renderBoardView(columns, cards) {
    if (columns.length === 0) {
      return `<div class="empty-state">${this.t('emptyModule')}</div>`;
    }

    return `
      <div class="board-view">
        ${columns.map(col => this.renderColumn(col, cards)).join('')}
      </div>
    `;
  }

  renderColumn(column, allCards) {
    const cards = allCards.filter(c => c.column_id === column.id);

    return `
      <div class="column" data-column-id="${column.id}">
        <div class="column-header">
          <h3 class="column-title">${this.escapeHtml(column.name)}</h3>
          <span class="column-count">${cards.length}</span>
          <div class="column-actions">
            <button class="btn-icon-small" data-action="edit-column" data-column-id="${column.id}">✏️</button>
            <button class="btn-icon-small" data-action="delete-column" data-column-id="${column.id}">🗑️</button>
          </div>
        </div>
        <div class="column-body">
          ${cards.length === 0 
            ? `<div class="empty-column">${this.t('emptyColumn')}</div>`
            : cards.map(card => this.renderCard(card)).join('')
          }
          <button class="btn-add-card" data-action="create-card" data-column-id="${column.id}">
            ➕ ${this.t('createCard')}
          </button>
        </div>
      </div>
    `;
  }

  renderCard(card) {
    const tags = card.tags || [];
    const contentPreview = this.getContentPreview(card.content);
    const isFocused = this.state.focusedCardId === card.id;

    return `
      <div class="card ${card.isPinned ? 'pinned' : ''} ${isFocused ? 'focused' : ''}" 
           data-card-id="${card.id}"
           data-action="select-card">
        ${card.isPinned ? '<div class="pin-indicator">📌</div>' : ''}
        <h4 class="card-title">${this.escapeHtml(card.title)}</h4>
        ${contentPreview ? `<p class="card-preview">${contentPreview}</p>` : ''}
        ${tags.length > 0 ? `
          <div class="card-tags">
            ${tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-meta">
          <span class="card-date">${this.formatDate(card.updated_at)}</span>
        </div>
      </div>
    `;
  }

  renderListView(columns, cards) {
    return `
      <div class="list-view">
        <table class="card-table">
          <thead>
            <tr>
              <th>${this.t('cardTitle')}</th>
              <th>Column</th>
              <th>Tags</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${cards.map(card => {
              const column = columns.find(c => c.id === card.column_id);
              const isFocused = this.state.focusedCardId === card.id;
              return `
                <tr data-card-id="${card.id}" data-action="select-card" class="${isFocused ? 'focused' : ''}">
                  <td>${this.escapeHtml(card.title)}</td>
                  <td>${column ? this.escapeHtml(column.name) : '-'}</td>
                  <td>${(card.tags || []).map(t => `#${t}`).join(' ')}</td>
                  <td>${this.formatDate(card.updated_at)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderCardDetail(card) {
    if (this.state.editingCard) {
      return this.renderCardEditor(this.state.editingCard);
    }

    const backlinksCount = this.linkParser.findBacklinks(card.id, card.title, this.state.allCards).length;
    const columnContext = this.getColumnContext(card.column_id);

    return `
      <div class="card-detail-panel">
        <div class="card-detail-header">
          <div class="card-detail-heading">
            <h2>${this.escapeHtml(card.title)}</h2>
            <div class="card-detail-subtitle">
              <span>${columnContext}</span>
              <span>•</span>
              <span>${this.formatDate(card.updated_at)}</span>
            </div>
          </div>
          <button class="btn-icon" data-action="close-detail">✕</button>
        </div>
        <div class="card-detail-body">
          <div class="card-content">
            ${this.renderMarkdown(card.content, {
              highlightQuery: this.state.highlightQuery,
              sourceModuleId: this.getModuleIdByColumn(card.column_id)
            })}
          </div>
          ${this.state.showBacklinks ? this.renderBacklinks(card) : ''}
        </div>
        <div class="card-detail-footer">
          <button class="btn-secondary" data-action="edit-card-detail">
            ${this.t('edit')}
          </button>
          <button class="btn-secondary" data-action="delete-card-detail">
            ${this.t('delete')}
          </button>
          <button class="btn-secondary" data-action="toggle-backlinks">
            ${this.t('backlinks')} (${backlinksCount})
          </button>
        </div>
      </div>
    `;
  }

  renderBacklinks(card) {
    const backlinks = this.linkParser.findBacklinks(card.id, card.title, this.state.allCards);
    
    return `
      <div class="backlinks-section">
        <div class="backlinks-header">
          <h3>${this.t('backlinks')}</h3>
          <span class="backlinks-count">${backlinks.length}</span>
        </div>
        ${backlinks.length === 0 
          ? `<p class="empty-state">${this.t('noBacklinks')}</p>`
          : `<ul class="backlinks-list">
              ${backlinks.map(bl => `
                <li data-card-id="${bl.cardId}" data-action="open-backlink">
                  <div class="backlink-title">${this.escapeHtml(bl.cardTitle)}</div>
                  <div class="backlink-meta">${this.getColumnContext(bl.columnId)}</div>
                </li>
              `).join('')}
            </ul>`
        }
      </div>
    `;
  }

  renderSearchResults() {
    const results = this.state.searchResults || [];
    const query = this.state.searchQuery;

    return `
      <div class="search-results">
        <div class="search-results-header">
          <div>
            <h3>${this.t('searchResults')}</h3>
            <p class="search-results-subtitle">${this.t('searchResultsFor')} "${this.escapeHtml(query)}"</p>
          </div>
          <span class="search-results-count">${results.length}</span>
        </div>
        ${results.length === 0
          ? `<div class="empty-state">${this.t('noResults')}</div>`
          : `
            <ul class="search-results-list">
              ${results.map(card => `
                <li data-card-id="${card.id}" data-action="open-search-result">
                  <div class="result-title">${this.highlightText(card.title, query)}</div>
                  <div class="result-snippet">${this.getSearchSnippet(card, query)}</div>
                  <div class="result-meta">
                    <span>${this.getColumnContext(card.column_id)}</span>
                    <span>${this.formatDate(card.updated_at)}</span>
                  </div>
                </li>
              `).join('')}
            </ul>
          `
        }
      </div>
    `;
  }

  // ==================== Event Handling ====================

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', async (e) => {
      const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      e.preventDefault();
      await this.handleAction(action, e.target.closest('[data-action]'));
    });

    this.container.addEventListener('input', (e) => {
      const target = e.target;
      if (target.matches('.sidebar-search .search-input')) {
        this.handleSearch(target.value);
        return;
      }

      if (!this.state.editingCard) return;
      if (target.matches('.editor-input[data-field="title"]')) {
        this.state.editingCard.title = target.value;
      }
      if (target.matches('.editor-input[data-field="tags"]')) {
        this.state.editingCard.tagsInput = target.value;
        this.updateTagsPreview();
      }
      if (target.matches('.editor-textarea[data-field="content"]')) {
        this.state.editingCard.content = target.value;
      }

      this.updateEditorPreview();
    });
  }

  async handleAction(action, element) {
    const handlers = {
      'create-module': () => this.createModule(),
      'select-module': () => this.selectModule(element.dataset.moduleId),
      'edit-module': () => this.editModule(element.dataset.moduleId),
      'delete-module': () => this.deleteModule(element.dataset.moduleId),
      'create-column': () => this.createColumn(),
      'edit-column': () => this.editColumn(element.dataset.columnId),
      'delete-column': () => this.deleteColumn(element.dataset.columnId),
      'create-card': () => this.createCard(element.dataset.columnId),
      'select-card': () => this.openCardById(element.dataset.cardId),
      'open-backlink': () => this.openCardById(element.dataset.cardId),
      'edit-card-detail': () => this.editCard(this.state.selectedCard?.id),
      'delete-card-detail': () => this.deleteCard(this.state.selectedCard?.id),
      'close-detail': () => this.closeDetail(),
      'save-card': () => this.saveCardEdits(),
      'cancel-edit': () => this.cancelEdit(),
      'toggle-backlinks': () => this.toggleBacklinks(),
      'toggle-preview': () => this.togglePreview(),
      'switch-view': () => this.switchView(element.dataset.view),
      'search': () => this.handleSearch(element.value),
      'open-card-link': () => this.openCardFromLink(element.dataset.cardId),
      'create-missing-card': () => this.createMissingCardFromLink(element.dataset.linkTitle),
      'open-search-result': () => this.openSearchResult(element.dataset.cardId)
    };

    const handler = handlers[action];
    if (handler) {
      await handler();
    }
  }

  bindGlobalShortcuts() {
    this.globalKeyHandler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        this.context.router.navigate('/plugin/wiki');
      }
    };
    document.addEventListener('keydown', this.globalKeyHandler);
  }

  unbindGlobalShortcuts() {
    if (this.globalKeyHandler) {
      document.removeEventListener('keydown', this.globalKeyHandler);
    }
  }

  // ==================== Data Operations ====================

  async loadModules() {
    await this.refreshGlobalData();
    
    // Select first module by default
    if (this.state.modules.length > 0 && !this.state.currentModule) {
      await this.selectModule(this.state.modules[0].id);
    }
  }

  async selectModule(moduleId, options = {}) {
    if (!options.skipConfirm && !(await this.confirmDiscardChanges())) return;
    this.state.currentModule = await this.wikiService.getModule(moduleId);
    this.state.columns = await this.wikiService.getColumns(moduleId);
    this.state.cards = await this.wikiService.getAllCards(moduleId);
    await this.refreshGlobalData();
    this.state.selectedCard = null;
    this.state.highlightQuery = '';
    this.state.focusedCardId = null;
    
    await this.render();
  }

  async createModule() {
    const name = prompt(this.t('moduleName'));
    if (!name) return;

    const module = await this.wikiService.createModule({ name });
    this.state.modules.push(module);
    await this.refreshGlobalData();
    await this.selectModule(module.id);
  }

  async editModule(moduleId) {
    const module = await this.wikiService.getModule(moduleId);
    const newName = prompt(this.t('moduleName'), module.name);
    if (!newName) return;

    await this.wikiService.updateModule(moduleId, { name: newName });
    await this.refreshGlobalData();
    await this.render();
  }

  async deleteModule(moduleId) {
    if (!confirm(this.t('deleteConfirm'))) return;

    await this.wikiService.deleteModule(moduleId);
    await this.refreshGlobalData();
    
    if (this.state.currentModule?.id === moduleId) {
      this.state.currentModule = null;
      this.state.columns = [];
      this.state.cards = [];
    }
    
    await this.render();
  }

  async createColumn() {
    if (!this.state.currentModule) return;

    const name = prompt(this.t('columnName'));
    if (!name) return;

    const column = await this.wikiService.createColumn({
      moduleId: this.state.currentModule.id,
      name
    });
    
    this.state.columns.push(column);
    await this.refreshGlobalData();
    await this.render();
  }

  async editColumn(columnId) {
    const column = await this.wikiService.getColumn(columnId);
    const newName = prompt(this.t('columnName'), column.name);
    if (!newName) return;

    await this.wikiService.updateColumn(columnId, { name: newName });
    await this.refreshGlobalData();
    await this.selectModule(this.state.currentModule.id);
  }

  async deleteColumn(columnId) {
    if (!confirm(this.t('deleteConfirm'))) return;

    await this.wikiService.deleteColumn(columnId);
    await this.refreshGlobalData();
    await this.selectModule(this.state.currentModule.id);
  }

  async createCard(columnId) {
    const title = prompt(this.t('cardTitle'));
    if (!title) return;

    const card = await this.wikiService.createCard({
      columnId,
      title,
      content: ''
    });
    
    this.state.cards.push(card);
    await this.refreshGlobalData();
    await this.render();
  }

  async selectCard(cardId, options = {}) {
    if (
      !options.skipConfirm &&
      this.state.editingCard &&
      this.state.editingCard.id !== cardId &&
      !(await this.confirmDiscardChanges(cardId))
    ) {
      return;
    }
    const card = await this.wikiService.getCard(cardId);
    if (!card) {
      this.showToast(this.t('cardNotFound'), 'error');
      return;
    }

    this.state.selectedCard = card;
    this.state.showBacklinks = false;
    this.state.editingCard = null;
    this.editingOriginal = null;
    this.state.highlightQuery = options.highlightQuery || '';
    this.state.focusedCardId = options.focusedCardId || null;

    await this.render();
    this.scrollToFocusedCard();
    this.scrollToSearchHighlight();
  }

  async editCard(cardId) {
    const card = await this.wikiService.getCard(cardId);
    if (!card) return;

    this.state.editingCard = {
      ...card,
      tagsInput: (card.tags || []).join(', ')
    };
    this.editingOriginal = {
      title: card.title || '',
      content: card.content || '',
      tagsInput: (card.tags || []).join(', ')
    };
    this.state.showBacklinks = false;
    await this.render();
  }

  async deleteCard(cardId) {
    if (!cardId) return;
    if (!confirm(this.t('deleteConfirm'))) return;

    await this.wikiService.deleteCard(cardId);
    await this.refreshGlobalData();
    await this.selectModule(this.state.currentModule.id);
  }

  async openCardById(cardId, options = {}) {
    if (!(await this.confirmDiscardChanges(cardId))) return;
    const card = await this.wikiService.getCard(cardId);
    if (!card) {
      this.showToast(this.t('cardNotFound'), 'error');
      return;
    }

    const column = await this.wikiService.getColumn(card.column_id);
    if (column?.module_id && this.state.currentModule?.id !== column.module_id) {
      await this.selectModule(column.module_id, { skipConfirm: true });
    }

    await this.selectCard(cardId, { ...options, skipConfirm: true });
  }

  async openCardFromLink(cardId) {
    if (!cardId) return;
    await this.openCardById(cardId);
  }

  async openSearchResult(cardId) {
    if (!cardId) return;
    const highlightQuery = this.state.searchQuery;
    await this.openCardById(cardId, {
      highlightQuery,
      focusedCardId: cardId
    });
  }

  async createMissingCardFromLink(rawTitle) {
    const title = (rawTitle || '').trim();
    if (!title) return;

    if (!this.state.currentModule) {
      this.showToast(this.t('createModuleFirst'), 'warning');
      return;
    }

    const defaultColumn = this.state.columns[0];
    if (!defaultColumn) {
      this.showToast(this.t('createColumnFirst'), 'warning');
      return;
    }

    const card = await this.wikiService.createCard({
      columnId: defaultColumn.id,
      title,
      content: ''
    });

    await this.refreshGlobalData();
    await this.selectCard(card.id, { focusedCardId: card.id });
    await this.editCard(card.id);
  }

  async closeDetail() {
    if (!(await this.confirmDiscardChanges())) return;
    this.state.selectedCard = null;
    this.state.showBacklinks = false;
    this.state.editingCard = null;
    this.editingOriginal = null;
    this.state.highlightQuery = '';
    this.state.focusedCardId = null;
    this.render();
  }

  toggleBacklinks() {
    this.state.showBacklinks = !this.state.showBacklinks;
    this.render();
  }

  switchView(view) {
    this.state.view = view;
    this.render();
  }

  togglePreview() {
    this.state.editorPreviewEnabled = !this.state.editorPreviewEnabled;
    this.render();
  }

  async handleSearch(query) {
    this.state.searchQuery = query;
    this.state.highlightQuery = '';
    this.state.focusedCardId = null;
    
    if (!query.trim()) {
      this.state.searchResults = [];
      await this.render();
      return;
    }

    // Debounce search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(async () => {
      const results = await this.wikiService.search(query);
      this.state.searchResults = results;
      await this.render();
    }, 300);
  }

  // ==================== Helper Methods ====================

  t(key) {
    return this.i18n?.t?.(key) || key;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  getContentPreview(content, maxLength = 100) {
    if (!content) return '';
    
    const text = content
      .replace(/[#*`\[\]]/g, '')
      .replace(/\n/g, ' ')
      .trim();
    
    if (text.length <= maxLength) return this.escapeHtml(text);
    return this.escapeHtml(text.slice(0, maxLength) + '...');
  }

  renderMarkdown(content, options = {}) {
    if (!content) return '';
    
    // Simple markdown rendering (in real implementation, use a proper markdown library)
    let html = content;
    
    // Render links
    const cardsForLinks = this.state.allCards.length > 0 ? this.state.allCards : this.state.cards;
    html = this.linkParser.renderLinks(html, cardsForLinks, {
      missingLinkTitle: this.t('missingLinkHint'),
      missingLinkAction: 'create-missing-card',
      missingLinkLabel: this.t('missingLinkAction'),
      preferModuleId: options.sourceModuleId,
      getModuleId: (card) => this.getModuleIdByColumn(card.column_id),
      getUpdatedAt: (card) => card.updated_at,
      getLinkContextLabel: (card) => this.getColumnContext(card.column_id)
    });
    
    // Basic markdown (simplified)
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    
    const highlightQuery = options.highlightQuery;
    return this.applyHighlight(html, highlightQuery);
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(this.locale);
  }

  escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  highlightText(text, query) {
    const escaped = this.escapeHtml(text || '');
    if (!query) return escaped;
    const regex = new RegExp(this.escapeRegex(query), 'gi');
    return escaped.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`);
  }

  applyHighlight(html, query) {
    if (!query || !html) return html;
    const container = document.createElement('div');
    container.innerHTML = html;
    const regex = new RegExp(this.escapeRegex(query), 'gi');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach((node) => {
      const value = node.nodeValue;
      if (!value || !regex.test(value)) return;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      value.replace(regex, (match, offset) => {
        const before = value.slice(lastIndex, offset);
        if (before) {
          frag.appendChild(document.createTextNode(before));
        }
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = match;
        frag.appendChild(mark);
        lastIndex = offset + match.length;
        return match;
      });
      const after = value.slice(lastIndex);
      if (after) {
        frag.appendChild(document.createTextNode(after));
      }
      node.parentNode.replaceChild(frag, node);
    });
    return container.innerHTML;
  }

  getSearchSnippet(card, query, maxLength = 120) {
    const raw = (card.content || '')
      .replace(/[#*`\[\]]/g, '')
      .replace(/\n/g, ' ')
      .trim();
    if (!raw) return `<span class="result-snippet-empty">${this.t('noSnippet')}</span>`;
    if (!query) {
      return this.escapeHtml(raw.slice(0, maxLength)) + (raw.length > maxLength ? '...' : '');
    }
    const lower = raw.toLowerCase();
    const queryLower = query.toLowerCase();
    const index = lower.indexOf(queryLower);
    if (index === -1) {
      return this.escapeHtml(raw.slice(0, maxLength)) + (raw.length > maxLength ? '...' : '');
    }
    const start = Math.max(0, index - 40);
    const end = Math.min(raw.length, index + query.length + 40);
    const snippet = raw.slice(start, end);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < raw.length ? '...' : '';
    return `${prefix}${this.highlightText(snippet, query)}${suffix}`;
  }

  renderCardEditor(card) {
    const isDirty = this.isEditingDirty(card);
    const tagsPreview = this.parseTags(card.tagsInput || '').slice(0, 8);
    const hasTags = tagsPreview.length > 0;
    return `
      <div class="card-detail-panel">
        <div class="card-detail-header">
          <div class="card-detail-heading">
            <h2>${this.escapeHtml(card.title)}</h2>
            <div class="editor-status ${isDirty ? 'dirty' : ''}">
              ${isDirty ? this.t('unsavedChanges') : this.t('allChangesSaved')}
            </div>
            <div class="editor-preview-status">
              ${this.t('previewStatus')}: ${this.state.editorPreviewEnabled ? this.t('previewOn') : this.t('previewOff')}
            </div>
          </div>
          <button class="btn-icon" data-action="cancel-edit">✕</button>
        </div>
        <div class="card-detail-body">
          <label class="editor-label">${this.t('cardTitle')}</label>
          <input class="editor-input" data-field="title" type="text" value="${this.escapeHtml(card.title)}" />

          <label class="editor-label">${this.t('tags')}</label>
          <input class="editor-input" data-field="tags" type="text" value="${this.escapeHtml(card.tagsInput || '')}" placeholder="${this.t('tagsHint')}" />
          <div class="tags-preview ${hasTags ? '' : 'is-empty'}" data-role="tags-preview">
            ${hasTags
              ? tagsPreview.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')
              : `<span class="tags-empty">${this.t('tagsEmpty')}</span>`
            }
          </div>

          <label class="editor-label">${this.t('cardContent')}</label>
          <textarea class="editor-textarea" data-field="content" rows="12">${this.escapeHtml(card.content || '')}</textarea>

          <div class="editor-hint">
            ${this.t('editorTips')}
          </div>

          ${this.state.editorPreviewEnabled ? `
            <div class="editor-preview">
              <div class="editor-preview-header">
                <h4>${this.t('preview')}</h4>
                <button class="btn-icon-small" data-action="toggle-preview" aria-pressed="true">${this.t('hidePreview')}</button>
              </div>
              <div class="card-content">${this.renderMarkdown(card.content || '', {
                sourceModuleId: this.getModuleIdByColumn(card.column_id)
              })}</div>
            </div>
          ` : `
            <button class="btn-secondary btn-preview-toggle" data-action="toggle-preview" aria-pressed="false">${this.t('showPreview')}</button>
          `}
        </div>
        <div class="card-detail-footer">
          <button class="btn-secondary" data-action="cancel-edit">${this.t('cancel')}</button>
          <button class="btn-primary" data-action="save-card" ${isDirty ? '' : 'disabled'}>${this.t('save')}</button>
        </div>
      </div>
    `;
  }

  async saveCardEdits() {
    if (!this.container || !this.state.editingCard) return;

    const titleInput = this.container.querySelector('.editor-input[data-field="title"]');
    const tagsInput = this.container.querySelector('.editor-input[data-field="tags"]');
    const contentInput = this.container.querySelector('.editor-textarea[data-field="content"]');

    const title = titleInput?.value?.trim() || this.state.editingCard.title;
    const content = contentInput?.value || '';
    const tags = this.parseTags(tagsInput?.value || '');

    try {
      await this.wikiService.updateCard(this.state.editingCard.id, {
        title,
        content,
        tags
      });

      this.state.editingCard = null;
      this.editingOriginal = null;
      await this.selectModule(this.state.currentModule.id);
      this.showToast(this.t('saveSuccess'));
    } catch (error) {
      console.error('Failed to save card', error);
      this.showToast(this.t('saveError'), 'error');
    }
  }

  cancelEdit() {
    if (this.isEditingDirty(this.state.editingCard)) {
      if (!confirm(this.t('discardChangesConfirm'))) return;
    }
    this.state.editingCard = null;
    this.editingOriginal = null;
    this.render();
  }

  parseTags(raw) {
    if (!raw) return [];
    const tags = [];
    const seen = new Set();
    raw
      .split(/[,#]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .forEach(tag => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        tags.push(tag);
      });
    return tags;
  }

  isEditingDirty(card) {
    if (!card || !this.editingOriginal) return false;
    return (
      (card.title || '') !== (this.editingOriginal.title || '') ||
      (card.content || '') !== (this.editingOriginal.content || '') ||
      (card.tagsInput || '') !== (this.editingOriginal.tagsInput || '')
    );
  }

  updateEditorPreview() {
    if (!this.container || !this.state.editingCard) return;
    const isDirty = this.isEditingDirty(this.state.editingCard);
    const status = this.container.querySelector('.editor-status');
    if (status) {
      status.textContent = isDirty ? this.t('unsavedChanges') : this.t('allChangesSaved');
      status.classList.toggle('dirty', isDirty);
    }
    const headerTitle = this.container.querySelector('.card-detail-header h2');
    if (headerTitle) {
      headerTitle.textContent = this.state.editingCard.title || this.t('cardTitle');
    }
    const saveButton = this.container.querySelector('.card-detail-footer .btn-primary');
    if (saveButton) {
      saveButton.disabled = !isDirty;
    }
    if (!this.state.editorPreviewEnabled) return;
    const preview = this.container.querySelector('.editor-preview .card-content');
    if (preview) {
      preview.innerHTML = this.renderMarkdown(this.state.editingCard.content || '', {
        sourceModuleId: this.getModuleIdByColumn(this.state.editingCard.column_id)
      });
    }
  }

  updateTagsPreview() {
    if (!this.container || !this.state.editingCard) return;
    const preview = this.container.querySelector('[data-role="tags-preview"]');
    if (!preview) return;
    const tags = this.parseTags(this.state.editingCard.tagsInput || '').slice(0, 8);
    preview.innerHTML = tags.length > 0
      ? tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')
      : `<span class="tags-empty">${this.t('tagsEmpty')}</span>`;
    preview.classList.toggle('is-empty', tags.length === 0);
  }

  scrollToFocusedCard() {
    if (!this.container || !this.state.focusedCardId) return;
    requestAnimationFrame(() => {
      const selector = `[data-card-id="${this.state.focusedCardId}"]`;
      const cardEl = this.container.querySelector(`.card${selector}, .card-table tr${selector}`);
      if (cardEl?.scrollIntoView) {
        cardEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  scrollToSearchHighlight() {
    if (!this.container || !this.state.highlightQuery) return;
    requestAnimationFrame(() => {
      const highlight = this.container.querySelector('.card-detail-panel .search-highlight');
      if (highlight?.scrollIntoView) {
        highlight.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  getColumnName(columnId) {
    const column = this.state.allColumns.find(col => col.id === columnId);
    return column ? this.escapeHtml(column.name) : this.t('unknownColumn');
  }

  getModuleName(moduleId) {
    const module = this.state.modules.find(item => item.id === moduleId);
    return module ? this.escapeHtml(module.name) : this.t('unknownModule');
  }

  getModuleIdByColumn(columnId) {
    const column = this.state.allColumns.find(col => col.id === columnId);
    return column ? column.module_id : null;
  }

  getColumnContext(columnId) {
    const column = this.state.allColumns.find(col => col.id === columnId);
    if (!column) return this.t('unknownColumn');
    const moduleName = this.getModuleName(column.module_id);
    const columnName = this.escapeHtml(column.name);
    return `${moduleName} / ${columnName}`;
  }

  async refreshGlobalData() {
    this.state.modules = await this.wikiService.getModules();
    this.state.allColumns = await this.wikiService.getAllColumns();
    this.state.allCards = await this.wikiService.getAllCardsGlobal();
  }

  async confirmDiscardChanges(nextCardId = null) {
    if (!this.isEditingDirty(this.state.editingCard)) return true;
    if (nextCardId && this.state.editingCard?.id === nextCardId) return true;
    return confirm(this.t('discardChangesConfirm'));
  }

  showToast(message, type = 'success') {
    this.context.ui?.toast?.(message, type);
  }

  startAutoSave() {
    const interval = this.context.settings?.autoSaveInterval || 5000;
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingChanges.size > 0) {
        await this.savePendingChanges();
      }
    }, interval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  async savePendingChanges() {
    for (const [cardId, changes] of this.pendingChanges) {
      try {
        await this.wikiService.updateCard(cardId, changes);
      } catch (error) {
        console.error('Failed to save card:', cardId, error);
      }
    }
    this.pendingChanges.clear();
  }
}

exports.default = WikiPlugin;

});
__define('./plugins/wiki/services/wiki-service.js', function(module, exports){
/**
 * WikiService - Database service for Wiki plugin
 * Handles all data operations for modules, columns, cards, and links
 */
class WikiService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Initialize database schema
   */
  async initSchema() {
    await this.db.exec(`
      -- Modules table
      CREATE TABLE IF NOT EXISTS wiki_modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );
      
      -- Columns table
      CREATE TABLE IF NOT EXISTS wiki_columns (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (module_id) REFERENCES wiki_modules(id) ON DELETE CASCADE
      );
      
      -- Cards table
      CREATE TABLE IF NOT EXISTS wiki_cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'markdown',
        tags TEXT,
        attachments TEXT,
        metadata TEXT,
        sort_order INTEGER NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (column_id) REFERENCES wiki_columns(id) ON DELETE CASCADE
      );
      
      -- Card links table (bidirectional links)
      CREATE TABLE IF NOT EXISTS wiki_card_links (
        id TEXT PRIMARY KEY,
        source_card_id TEXT NOT NULL,
        target_card_id TEXT NOT NULL,
        link_type TEXT DEFAULT 'reference',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (target_card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE
      );
      
      -- Card history table
      CREATE TABLE IF NOT EXISTS wiki_card_history (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT,
        FOREIGN KEY (card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE
      );
      
      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_wiki_modules_order ON wiki_modules(sort_order);
      CREATE INDEX IF NOT EXISTS idx_wiki_columns_module ON wiki_columns(module_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_wiki_cards_column ON wiki_cards(column_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_wiki_cards_tags ON wiki_cards(tags);
      CREATE INDEX IF NOT EXISTS idx_wiki_card_links_source ON wiki_card_links(source_card_id);
      CREATE INDEX IF NOT EXISTS idx_wiki_card_links_target ON wiki_card_links(target_card_id);
      
      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
        title,
        content,
        tags,
        content='wiki_cards',
        content_rowid='rowid',
        tokenize='unicode61'
      );
    `);
  }

  // ==================== Module Operations ====================

  async getModules() {
    const rows = await this.db.query(
      'SELECT * FROM wiki_modules WHERE deleted = 0 ORDER BY sort_order'
    );
    return rows;
  }

  async getModule(id) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_modules WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] || null;
  }

  async createModule(data) {
    const id = this.generateId('mod');
    const now = Date.now();
    const maxOrder = await this.getMaxSortOrder('wiki_modules');
    
    await this.db.exec(
      `INSERT INTO wiki_modules (id, name, description, icon, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || '',
        data.icon || '📚',
        data.color || '#3b82f6',
        maxOrder + 1,
        now,
        now
      ]
    );
    
    return await this.getModule(id);
  }

  async updateModule(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      params.push(data.icon);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);
    
    await this.db.exec(
      `UPDATE wiki_modules SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return await this.getModule(id);
  }

  async deleteModule(id) {
    await this.db.exec(
      'UPDATE wiki_modules SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Column Operations ====================

  async getColumns(moduleId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_columns WHERE module_id = ? AND deleted = 0 ORDER BY sort_order',
      [moduleId]
    );
    return rows;
  }

  async getAllColumns() {
    const rows = await this.db.query(
      'SELECT * FROM wiki_columns WHERE deleted = 0 ORDER BY sort_order'
    );
    return rows;
  }

  async getColumn(id) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_columns WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] || null;
  }

  async createColumn(data) {
    const id = this.generateId('col');
    const now = Date.now();
    const maxOrder = await this.getMaxSortOrder('wiki_columns', 'module_id', data.moduleId);
    
    await this.db.exec(
      `INSERT INTO wiki_columns (id, module_id, name, description, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.moduleId,
        data.name,
        data.description || '',
        data.color || '#6b7280',
        maxOrder + 1,
        now,
        now
      ]
    );
    
    return await this.getColumn(id);
  }

  async updateColumn(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);
    
    await this.db.exec(
      `UPDATE wiki_columns SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return await this.getColumn(id);
  }

  async deleteColumn(id) {
    await this.db.exec(
      'UPDATE wiki_columns SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Card Operations ====================

  async getCards(columnId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_cards WHERE column_id = ? AND deleted = 0 ORDER BY is_pinned DESC, sort_order',
      [columnId]
    );
    return rows.map(row => this.deserializeCard(row));
  }

  async getAllCards(moduleId) {
    const rows = await this.db.query(
      `SELECT c.* FROM wiki_cards c
       INNER JOIN wiki_columns col ON c.column_id = col.id
       WHERE col.module_id = ? AND c.deleted = 0
       ORDER BY c.is_pinned DESC, c.sort_order`,
      [moduleId]
    );
    return rows.map(row => this.deserializeCard(row));
  }

  async getAllCardsGlobal() {
    const rows = await this.db.query(
      'SELECT * FROM wiki_cards WHERE deleted = 0 ORDER BY is_pinned DESC, sort_order'
    );
    return rows.map(row => this.deserializeCard(row));
  }

  async getCard(id) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_cards WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeCard(rows[0]) : null;
  }

  async createCard(data) {
    const id = this.generateId('card');
    const now = Date.now();
    const maxOrder = await this.getMaxSortOrder('wiki_cards', 'column_id', data.columnId);
    
    await this.db.exec(
      `INSERT INTO wiki_cards (id, column_id, title, content, content_type, tags, attachments, metadata, sort_order, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.columnId,
        data.title,
        data.content || '',
        data.contentType || 'markdown',
        JSON.stringify(data.tags || []),
        JSON.stringify(data.attachments || []),
        JSON.stringify(data.metadata || {}),
        maxOrder + 1,
        data.isPinned ? 1 : 0,
        now,
        now
      ]
    );
    
    // Save to version history
    await this.saveVersion(id, data.title, data.content || '', 1, data.createdBy);
    
    return await this.getCard(id);
  }

  async updateCard(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];
    
    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.attachments !== undefined) {
      updates.push('attachments = ?');
      params.push(JSON.stringify(data.attachments));
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }
    if (data.columnId !== undefined) {
      updates.push('column_id = ?');
      params.push(data.columnId);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    if (data.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(data.isPinned ? 1 : 0);
    }
    
    updates.push('updated_at = ?', 'version = version + 1');
    params.push(now);
    params.push(id);
    
    await this.db.exec(
      `UPDATE wiki_cards SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Save version if content changed
    if (data.title !== undefined || data.content !== undefined) {
      const card = await this.getCard(id);
      await this.saveVersion(id, card.title, card.content, card.version, data.updatedBy);
    }
    
    return await this.getCard(id);
  }

  async deleteCard(id) {
    await this.db.exec(
      'UPDATE wiki_cards SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  async moveCard(cardId, toColumnId, newOrder) {
    await this.updateCard(cardId, {
      columnId: toColumnId,
      sortOrder: newOrder !== undefined ? newOrder : 0
    });
  }

  // ==================== Search ====================

  async search(query, filters = {}) {
    if (!query || query.trim() === '') {
      return [];
    }

    let sql = `
      SELECT c.* FROM wiki_cards c
      INNER JOIN wiki_fts f ON c.rowid = f.rowid
      WHERE f MATCH ? AND c.deleted = 0
    `;
    
    const params = [query];
    
    if (filters.columnId) {
      sql += ' AND c.column_id = ?';
      params.push(filters.columnId);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      sql += ' AND c.tags LIKE ?';
      params.push(`%${filters.tags[0]}%`);
    }
    
    sql += ' ORDER BY rank LIMIT ?';
    params.push(filters.limit || 50);
    
    const rows = await this.db.query(sql, params);
    return rows.map(row => this.deserializeCard(row));
  }

  // ==================== Links ====================

  async createLink(sourceCardId, targetCardId, linkType = 'reference') {
    const id = this.generateId('link');
    await this.db.exec(
      'INSERT INTO wiki_card_links (id, source_card_id, target_card_id, link_type, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, sourceCardId, targetCardId, linkType, Date.now()]
    );
  }

  async deleteLink(sourceCardId, targetCardId) {
    await this.db.exec(
      'DELETE FROM wiki_card_links WHERE source_card_id = ? AND target_card_id = ?',
      [sourceCardId, targetCardId]
    );
  }

  async getLinks(cardId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_card_links WHERE source_card_id = ? OR target_card_id = ?',
      [cardId, cardId]
    );
    return rows;
  }

  async getBacklinks(cardId) {
    const rows = await this.db.query(
      `SELECT c.* FROM wiki_cards c
       INNER JOIN wiki_card_links l ON c.id = l.source_card_id
       WHERE l.target_card_id = ? AND c.deleted = 0`,
      [cardId]
    );
    return rows.map(row => this.deserializeCard(row));
  }

  // ==================== Version History ====================

  async saveVersion(cardId, title, content, version, createdBy) {
    const id = this.generateId('ver');
    await this.db.exec(
      'INSERT INTO wiki_card_history (id, card_id, title, content, version, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, cardId, title, content, version, Date.now(), createdBy || null]
    );
  }

  async getVersions(cardId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_card_history WHERE card_id = ? ORDER BY version DESC',
      [cardId]
    );
    return rows;
  }

  async getVersion(versionId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_card_history WHERE id = ?',
      [versionId]
    );
    return rows[0] || null;
  }

  // ==================== Helper Methods ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  async getMaxSortOrder(table, filterColumn, filterValue) {
    let sql = `SELECT COALESCE(MAX(sort_order), 0) as max_order FROM ${table} WHERE deleted = 0`;
    const params = [];
    
    if (filterColumn && filterValue !== undefined) {
      sql += ` AND ${filterColumn} = ?`;
      params.push(filterValue);
    }
    
    const rows = await this.db.query(sql, params);
    return rows[0]?.max_order || 0;
  }

  deserializeCard(row) {
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      isPinned: row.is_pinned === 1
    };
  }
}

exports.default = WikiService;

});
__define('./plugins/wiki/services/link-parser.js', function(module, exports){
/**
 * LinkParser - Parses and handles bidirectional links in Wiki cards
 * Supports [[Card Title]] syntax
 */
class LinkParser {
  constructor() {
    this.linkRegex = /\[\[([^\]]+)\]\]/g;
    this.tagRegex = /#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
  }

  /**
   * Parse links from content
   * @param {string} content - Markdown content
   * @returns {Array} Array of link objects
   */
  parseLinks(content) {
    if (!content) return [];
    
    const links = [];
    let match;
    
    // Reset regex state
    this.linkRegex.lastIndex = 0;
    
    while ((match = this.linkRegex.exec(content)) !== null) {
      links.push({
        text: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0]
      });
    }
    
    return links;
  }

  /**
   * Parse tags from content
   * @param {string} content - Markdown content
   * @returns {Array} Array of tag strings
   */
  parseTags(content) {
    if (!content) return [];
    
    const tags = new Set();
    let match;
    
    // Reset regex state
    this.tagRegex.lastIndex = 0;
    
    while ((match = this.tagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }
    
    return Array.from(tags);
  }

  /**
   * Render links as HTML
   * @param {string} content - Markdown content
   * @param {Array} cards - All available cards
   * @param {Object} options - Render options
   * @param {Function} options.onLinkClick - Callback for link clicks
   * @param {string} options.missingLinkTitle - Tooltip for missing links
   * @param {string} options.missingLinkAction - data-action for missing links
   * @param {string} options.missingLinkLabel - Label for missing link action
   * @param {string} options.preferModuleId - Preferred module id for link resolution
   * @param {Function} options.getModuleId - Get module id from card
   * @param {Function} options.getUpdatedAt - Get updated timestamp from card
   * @param {Function} options.getLinkContextLabel - Get tooltip label for a card
   * @returns {string} Content with rendered links
   */
  renderLinks(content, cards = [], options = {}) {
    if (!content) return '';
    
    // Create a map of card titles to IDs for quick lookup
    const cardMap = new Map();
    cards.forEach(card => {
      const key = card.title.toLowerCase();
      if (!cardMap.has(key)) {
        cardMap.set(key, []);
      }
      cardMap.get(key).push(card);
    });
    const {
      onLinkClick,
      missingLinkTitle,
      missingLinkAction,
      missingLinkLabel,
      preferModuleId,
      getModuleId,
      getUpdatedAt,
      getLinkContextLabel
    } = options;
    
    return content.replace(this.linkRegex, (match, cardTitle) => {
      const trimmedTitle = cardTitle.trim();
      const candidates = cardMap.get(trimmedTitle.toLowerCase()) || [];
      const byUpdated = (a, b) => {
        const aTime = getUpdatedAt ? getUpdatedAt(a) : a.updated_at;
        const bTime = getUpdatedAt ? getUpdatedAt(b) : b.updated_at;
        return (bTime || 0) - (aTime || 0);
      };

      let pool = candidates;
      if (preferModuleId && getModuleId) {
        const inModule = candidates.filter(card => getModuleId(card) === preferModuleId);
        pool = inModule.length > 0 ? inModule : candidates;
      }

      const selectedCard = [...pool].sort(byUpdated)[0];
      
      if (selectedCard) {
        const cardId = selectedCard.id;
        const contextLabel = getLinkContextLabel ? getLinkContextLabel(selectedCard) : '';
        const linkTitle = contextLabel ? ` title="${this.escapeHtml(contextLabel)}"` : '';
        // Existing card - create clickable link
        const onClick = onLinkClick 
          ? `onclick="event.preventDefault(); (${onLinkClick.toString()})('${cardId}')"`
          : '';
        return `<a href="#/wiki/card/${cardId}" class="wiki-link" data-card-id="${cardId}" data-action="open-card-link"${linkTitle} ${onClick}>${this.escapeHtml(trimmedTitle)}</a>`;
      } else {
        // Non-existing card - show as missing
        const title = this.escapeHtml(trimmedTitle);
        const tooltip = missingLinkTitle ? ` title="${this.escapeHtml(missingLinkTitle)}"` : '';
        const action = missingLinkAction ? ` data-action="${missingLinkAction}"` : '';
        const label = missingLinkLabel ? `<span class="wiki-link-missing-action">${this.escapeHtml(missingLinkLabel)}</span>` : '';
        return `<span class="wiki-link-missing" data-link-title="${title}"${action}${tooltip}><span class="wiki-link-missing-text">${title}</span>${label}</span>`;
      }
    });
  }

  /**
   * Find backlinks for a card
   * @param {string} cardId - Target card ID
   * @param {string} cardTitle - Target card title
   * @param {Array} allCards - All cards to search
   * @returns {Array} Array of cards that link to the target
   */
  findBacklinks(cardId, cardTitle, allCards) {
    if (!cardTitle || !allCards) return [];
    
    const backlinks = [];
    const targetTitleLower = cardTitle.toLowerCase();
    
    for (const card of allCards) {
      if (card.id === cardId) continue;
      
      const links = this.parseLinks(card.content);
      const hasLink = links.some(link => 
        link.text.toLowerCase() === targetTitleLower
      );
      
      if (hasLink) {
        backlinks.push({
          cardId: card.id,
          cardTitle: card.title,
          columnId: card.column_id
        });
      }
    }
    
    return backlinks;
  }

  /**
   * Get all linked card titles from content
   * @param {string} content - Markdown content
   * @returns {Array} Array of unique card titles
   */
  getLinkedTitles(content) {
    const links = this.parseLinks(content);
    return [...new Set(links.map(link => link.text))];
  }

  /**
   * Update links when a card title changes
   * @param {string} oldTitle - Old card title
   * @param {string} newTitle - New card title
   * @param {string} content - Content to update
   * @returns {string} Updated content
   */
  updateLinksForRename(oldTitle, newTitle, content) {
    if (!content || !oldTitle || !newTitle) return content;
    
    const oldLinkPattern = `\\[\\[${this.escapeRegex(oldTitle)}\\]\\]`;
    const regex = new RegExp(oldLinkPattern, 'gi');
    
    return content.replace(regex, `[[${newTitle}]]`);
  }

  /**
   * Check if content has any links
   * @param {string} content - Markdown content
   * @returns {boolean} True if content has links
   */
  hasLinks(content) {
    if (!content) return false;
    this.linkRegex.lastIndex = 0;
    return this.linkRegex.test(content);
  }

  /**
   * Check if content has any tags
   * @param {string} content - Markdown content
   * @returns {boolean} True if content has tags
   */
  hasTags(content) {
    if (!content) return false;
    this.tagRegex.lastIndex = 0;
    return this.tagRegex.test(content);
  }

  /**
   * Insert a link at cursor position
   * @param {string} content - Current content
   * @param {number} cursorPos - Cursor position
   * @param {string} cardTitle - Card title to link
   * @returns {Object} Updated content and new cursor position
   */
  insertLink(content, cursorPos, cardTitle) {
    const linkText = `[[${cardTitle}]]`;
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    
    return {
      content: before + linkText + after,
      cursorPos: cursorPos + linkText.length
    };
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract link context (surrounding text)
   * @param {string} content - Full content
   * @param {Object} link - Link object with start/end positions
   * @param {number} contextLength - Characters before and after
   * @returns {string} Context string
   */
  getLinkContext(content, link, contextLength = 50) {
    const start = Math.max(0, link.start - contextLength);
    const end = Math.min(content.length, link.end + contextLength);
    
    let context = content.slice(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';
    
    return context.trim();
  }

  /**
   * Validate link syntax
   * @param {string} linkText - Link text to validate
   * @returns {boolean} True if valid
   */
  isValidLink(linkText) {
    return /^\[\[.+\]\]$/.test(linkText);
  }

  /**
   * Convert plain text references to links
   * @param {string} content - Content to process
   * @param {Array} cardTitles - Available card titles
   * @returns {string} Content with auto-linked references
   */
  autoLinkReferences(content, cardTitles) {
    if (!content || !cardTitles || cardTitles.length === 0) return content;
    
    let result = content;
    
    // Sort by length (longest first) to avoid partial matches
    const sortedTitles = [...cardTitles].sort((a, b) => b.length - a.length);
    
    for (const title of sortedTitles) {
      // Only auto-link if not already linked
      const pattern = new RegExp(`(?<!\\[\\[)${this.escapeRegex(title)}(?!\\]\\])`, 'gi');
      result = result.replace(pattern, `[[${title}]]`);
    }
    
    return result;
  }
}

exports.default = LinkParser;

});
__define('./plugins/wiki/services/version-manager.js', function(module, exports){
/**
 * VersionManager - Manages card version history
 */
class VersionManager {
  constructor(wikiService) {
    this.wikiService = wikiService;
  }

  /**
   * Save a new version of a card
   * @param {string} cardId - Card ID
   * @param {string} title - Card title
   * @param {string} content - Card content
   * @param {number} version - Version number
   * @param {string} createdBy - User ID
   */
  async saveVersion(cardId, title, content, version, createdBy) {
    await this.wikiService.saveVersion(cardId, title, content, version, createdBy);
  }

  /**
   * Get all versions for a card
   * @param {string} cardId - Card ID
   * @returns {Array} Array of versions
   */
  async getVersions(cardId) {
    return await this.wikiService.getVersions(cardId);
  }

  /**
   * Get a specific version
   * @param {string} versionId - Version ID
   * @returns {Object} Version object
   */
  async getVersion(versionId) {
    return await this.wikiService.getVersion(versionId);
  }

  /**
   * Restore a card to a specific version
   * @param {string} cardId - Card ID
   * @param {string} versionId - Version ID to restore
   * @param {string} updatedBy - User ID
   * @returns {Object} Updated card
   */
  async restoreVersion(cardId, versionId, updatedBy) {
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const card = await this.wikiService.updateCard(cardId, {
      title: version.title,
      content: version.content,
      updatedBy
    });

    return card;
  }

  /**
   * Compare two versions
   * @param {string} versionId1 - First version ID
   * @param {string} versionId2 - Second version ID
   * @returns {Object} Comparison result
   */
  async compareVersions(versionId1, versionId2) {
    const [v1, v2] = await Promise.all([
      this.getVersion(versionId1),
      this.getVersion(versionId2)
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    return {
      version1: v1,
      version2: v2,
      titleChanged: v1.title !== v2.title,
      contentChanged: v1.content !== v2.content,
      timeDiff: v2.created_at - v1.created_at
    };
  }

  /**
   * Get version diff statistics
   * @param {string} content1 - First content
   * @param {string} content2 - Second content
   * @returns {Object} Diff statistics
   */
  getDiffStats(content1, content2) {
    const lines1 = (content1 || '').split('\n');
    const lines2 = (content2 || '').split('\n');

    return {
      linesAdded: Math.max(0, lines2.length - lines1.length),
      linesRemoved: Math.max(0, lines1.length - lines2.length),
      charsAdded: Math.max(0, content2.length - content1.length),
      charsRemoved: Math.max(0, content1.length - content2.length)
    };
  }

  /**
   * Format version for display
   * @param {Object} version - Version object
   * @returns {Object} Formatted version
   */
  formatVersion(version) {
    return {
      id: version.id,
      version: version.version,
      title: version.title,
      contentPreview: this.getContentPreview(version.content),
      createdAt: new Date(version.created_at).toLocaleString(),
      createdBy: version.created_by || 'Unknown'
    };
  }

  /**
   * Get content preview
   * @param {string} content - Full content
   * @param {number} maxLength - Maximum length
   * @returns {string} Preview text
   */
  getContentPreview(content, maxLength = 100) {
    if (!content) return '';
    
    const text = content.replace(/[#*`\[\]]/g, '').trim();
    
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.slice(0, maxLength) + '...';
  }

  /**
   * Clean up old versions (keep only recent N versions)
   * @param {string} cardId - Card ID
   * @param {number} keepCount - Number of versions to keep
   */
  async cleanupOldVersions(cardId, keepCount = 10) {
    const versions = await this.getVersions(cardId);
    
    if (versions.length <= keepCount) {
      return;
    }

    // Sort by version number (descending)
    versions.sort((a, b) => b.version - a.version);
    
    // Delete versions beyond keepCount
    const toDelete = versions.slice(keepCount);
    
    for (const version of toDelete) {
      await this.wikiService.db.exec(
        'DELETE FROM wiki_card_history WHERE id = ?',
        [version.id]
      );
    }
  }
}

exports.default = VersionManager;

});
__define('./core/plugin/event-bus.js', function(module, exports){
/**
 * EventBus - Plugin Event Communication
 * Provides publish-subscribe pattern for plugins
 */

class EventBus {
  constructor() {
    this._listeners = new Map();
    this._wildcards = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Event name (supports wildcards like "plugin:*")
   * @param {Function} handler - Event handler
   * @param {Object} options - Options { once: false, namespace: null }
   * @returns {Function} Unsubscribe function
   */
  on(eventName, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    const { once = false, namespace = null } = options;
    const listener = { handler, once, namespace };

    if (eventName.includes('*')) {
      if (!this._wildcards.has(eventName)) {
        this._wildcards.set(eventName, new Set());
      }
      this._wildcards.get(eventName).add(listener);
    } else {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      this._listeners.get(eventName).add(listener);
    }

    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to an event once
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Options
   * @returns {Function} Unsubscribe function
   */
  once(eventName, handler, options = {}) {
    return this.on(eventName, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name
   * @param {Function} handler - Handler to remove (optional)
   */
  off(eventName, handler = null) {
    if (eventName.includes('*')) {
      const listeners = this._wildcards.get(eventName);
      if (!listeners) return;

      if (handler === null) {
        this._wildcards.delete(eventName);
      } else {
        for (const listener of listeners) {
          if (listener.handler === handler) {
            listeners.delete(listener);
          }
        }
        if (listeners.size === 0) {
          this._wildcards.delete(eventName);
        }
      }
    } else {
      const listeners = this._listeners.get(eventName);
      if (!listeners) return;

      if (handler === null) {
        this._listeners.delete(eventName);
      } else {
        for (const listener of listeners) {
          if (listener.handler === handler) {
            listeners.delete(listener);
          }
        }
        if (listeners.size === 0) {
          this._listeners.delete(eventName);
        }
      }
    }
  }

  /**
   * Unsubscribe all listeners for a namespace
   * @param {string} namespace - Namespace to remove
   */
  offNamespace(namespace) {
    for (const [eventName, listeners] of this._listeners.entries()) {
      const toRemove = [];
      for (const listener of listeners) {
        if (listener.namespace === namespace) {
          toRemove.push(listener);
        }
      }
      toRemove.forEach(listener => listeners.delete(listener));
      if (listeners.size === 0) {
        this._listeners.delete(eventName);
      }
    }

    for (const [pattern, listeners] of this._wildcards.entries()) {
      const toRemove = [];
      for (const listener of listeners) {
        if (listener.namespace === namespace) {
          toRemove.push(listener);
        }
      }
      toRemove.forEach(listener => listeners.delete(listener));
      if (listeners.size === 0) {
        this._wildcards.delete(pattern);
      }
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   * @returns {Promise<any[]>} Results from all handlers
   */
  async emit(eventName, data = null) {
    const results = [];
    const toRemove = [];

    // Exact match
    const listeners = this._listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        try {
          const result = await listener.handler(data, eventName);
          results.push(result);
          if (listener.once) {
            toRemove.push({ set: listeners, listener });
          }
        } catch (error) {
          console.error(`Error in event handler for "${eventName}":`, error);
        }
      }
    }

    // Wildcard match
    for (const [pattern, listeners] of this._wildcards.entries()) {
      if (this._matchWildcard(eventName, pattern)) {
        for (const listener of listeners) {
          try {
            const result = await listener.handler(data, eventName);
            results.push(result);
            if (listener.once) {
              toRemove.push({ set: listeners, listener });
            }
          } catch (error) {
            console.error(`Error in wildcard handler for "${pattern}":`, error);
          }
        }
      }
    }

    // Remove once listeners
    toRemove.forEach(({ set, listener }) => set.delete(listener));

    return results;
  }

  /**
   * Emit an event synchronously
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  emitSync(eventName, data = null) {
    this.emit(eventName, data).catch(err => {
      console.error(`Error emitting event "${eventName}":`, err);
    });
  }

  /**
   * Clear all listeners
   */
  clear() {
    this._listeners.clear();
    this._wildcards.clear();
  }

  /**
   * Get listener count for an event
   * @param {string} eventName - Event name
   * @returns {number} Listener count
   */
  listenerCount(eventName) {
    let count = 0;
    
    const listeners = this._listeners.get(eventName);
    if (listeners) {
      count += listeners.size;
    }

    for (const [pattern] of this._wildcards.entries()) {
      if (this._matchWildcard(eventName, pattern)) {
        count += this._wildcards.get(pattern).size;
      }
    }

    return count;
  }

  /**
   * Get all event names
   * @returns {string[]} Event names
   */
  eventNames() {
    return Array.from(this._listeners.keys());
  }

  /**
   * Match event name against wildcard pattern
   * @private
   */
  _matchWildcard(eventName, pattern) {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventName);
  }
}

// Create singleton instance
const eventBus = new EventBus();
exports.default = eventBus;

exports.EventBus = EventBus;
exports.eventBus = eventBus;
});
__define('./core/plugin/permission-manager.js', function(module, exports){
/**
 * PermissionManager - Manages plugin permissions
 */

// Permission definitions
const PERMISSIONS = {
  // Database
  'database:read': { level: 1, description: 'Read database' },
  'database:write': { level: 2, description: 'Write database' },
  'database:delete': { level: 3, description: 'Delete database data' },
  'database:*': { level: 4, description: 'Full database access' },
  
  // Filesystem
  'filesystem:read': { level: 1, description: 'Read files' },
  'filesystem:write': { level: 2, description: 'Write files' },
  'filesystem:delete': { level: 3, description: 'Delete files' },
  'filesystem:*': { level: 4, description: 'Full filesystem access' },
  
  // Network
  'network:local': { level: 1, description: 'Access local network' },
  'network:external': { level: 2, description: 'Access external network' },
  'network:*': { level: 3, description: 'Full network access' },
  
  // UI
  'ui:notification': { level: 1, description: 'Show notifications' },
  'ui:modal': { level: 1, description: 'Show modals' },
  'ui:theme': { level: 2, description: 'Change theme' },
  
  // System
  'system:process': { level: 3, description: 'Execute processes' },
  'system:config': { level: 3, description: 'Modify system config' },
  '*': { level: 5, description: 'All permissions' }
};

class PermissionManager {
  constructor() {
    this.grants = new Map(); // pluginId -> Set<permission>
  }
  
  /**
   * Grant permission to a plugin
   */
  grant(pluginId, permission) {
    if (!this.grants.has(pluginId)) {
      this.grants.set(pluginId, new Set());
    }
    this.grants.get(pluginId).add(permission);
  }
  
  /**
   * Grant multiple permissions
   */
  grantMultiple(pluginId, permissions) {
    for (const perm of permissions) {
      this.grant(pluginId, perm);
    }
  }

  /**
   * Register permissions (alias for grantMultiple)
   */
  register(pluginId, permissions) {
    this.grantMultiple(pluginId, permissions);
  }
  
  /**
   * Revoke a permission
   */
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }
  
  /**
   * Revoke all permissions for a plugin
   */
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }
  
  /**
   * Check if plugin has a permission
   */
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // Check wildcard (all permissions)
    if (grants.has('*')) return true;
    
    // Check exact permission
    if (grants.has(permission)) return true;
    
    // Check parent permission (e.g., database:* includes database:read)
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }

  /**
   * Check permission (alias for hasPermission)
   */
  check(pluginId, permission) {
    return this.hasPermission(pluginId, permission);
  }
  
  /**
   * Check permission - throws if not granted
   */
  require(pluginId, permission) {
    if (!this.hasPermission(pluginId, permission)) {
      throw new Error(`Plugin "${pluginId}" does not have permission: ${permission}`);
    }
  }
  
  /**
   * Check if plugin has all specified permissions
   */
  hasAll(pluginId, permissions) {
    return permissions.every(perm => this.hasPermission(pluginId, perm));
  }

  /**
   * Check all permissions (alias for hasAll)
   */
  checkAll(pluginId, permissions) {
    return this.hasAll(pluginId, permissions);
  }
  
  /**
   * Check if plugin has any of the specified permissions
   */
  hasAny(pluginId, permissions) {
    return permissions.some(perm => this.hasPermission(pluginId, perm));
  }

  /**
   * Check any permission (alias for hasAny)
   */
  checkAny(pluginId, permissions) {
    return this.hasAny(pluginId, permissions);
  }
  
  /**
   * Get all granted permissions for a plugin
   */
  getPermissions(pluginId) {
    const grants = this.grants.get(pluginId);
    return grants ? Array.from(grants) : [];
  }
  
  /**
   * Get permission description
   */
  getDescription(permission) {
    const def = PERMISSIONS[permission];
    return def ? def.description : permission;
  }
  
  /**
   * Get permission level
   */
  getLevel(permission) {
    const def = PERMISSIONS[permission];
    return def ? def.level : 0;
  }
  
  /**
   * Validate permission string
   */
  validate(permission) {
    return PERMISSIONS.hasOwnProperty(permission);
  }
  
  /**
   * Get all available permissions
   */
  getAllPermissions() {
    return Object.keys(PERMISSIONS);
  }
  
  /**
   * Clear all grants
   */
  clear() {
    this.grants.clear();
  }
}

// Create singleton instance
const permissionManager = new PermissionManager();
exports.default = PermissionManager;

exports.PERMISSIONS = PERMISSIONS;
exports.PermissionManager = PermissionManager;
exports.permissionManager = permissionManager;
});
__define('./core/plugin/plugin-registry.js', function(module, exports){
/**
 * Plugin Registry
 * Manages registered plugins and their lifecycle
 */

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.manifests = new Map();
    this.instances = new Map();
    this.loadOrder = [];
  }

  /**
   * Register a plugin
   * @param {string} id - Plugin ID
   * @param {Object} manifest - Plugin manifest
   * @param {Function} PluginClass - Plugin class constructor
   * @returns {boolean} Success
   */
  register(id, manifest, PluginClass) {
    if (this.plugins.has(id)) {
      console.warn(`Plugin ${id} is already registered`);
      return false;
    }

    this.plugins.set(id, PluginClass);
    this.manifests.set(id, manifest);
    this.loadOrder.push(id);

    console.log(`[Registry] Registered plugin: ${id}`);
    return true;
  }

  /**
   * Unregister a plugin
   * @param {string} id - Plugin ID
   * @returns {boolean} Success
   */
  unregister(id) {
    if (!this.plugins.has(id)) {
      return false;
    }

    // Warn if instance is still active
    const instance = this.instances.get(id);
    if (instance && instance.activated) {
      console.warn(`[Registry] Plugin ${id} is still activated. Deactivate before unregistering.`);
    }

    // Remove instance if exists
    if (this.instances.has(id)) {
      this.instances.delete(id);
    }

    this.plugins.delete(id);
    this.manifests.delete(id);
    
    const index = this.loadOrder.indexOf(id);
    if (index !== -1) {
      this.loadOrder.splice(index, 1);
    }

    console.log(`[Registry] Unregistered plugin: ${id}`);
    return true;
  }

  /**
   * Get plugin class
   * @param {string} id - Plugin ID
   * @returns {Function|null} Plugin class
   */
  getPluginClass(id) {
    return this.plugins.get(id) || null;
  }

  /**
   * Get plugin manifest
   * @param {string} id - Plugin ID
   * @returns {Object|null} Plugin manifest
   */
  getManifest(id) {
    return this.manifests.get(id) || null;
  }

  /**
   * Set plugin instance
   * @param {string} id - Plugin ID
   * @param {Object} instance - Plugin instance
   */
  setInstance(id, instance) {
    this.instances.set(id, instance);
  }

  /**
   * Get plugin instance
   * @param {string} id - Plugin ID
   * @returns {Object|null} Plugin instance
   */
  getInstance(id) {
    return this.instances.get(id) || null;
  }

  /**
   * Check if plugin is registered
   * @param {string} id - Plugin ID
   * @returns {boolean} True if registered
   */
  has(id) {
    return this.plugins.has(id);
  }

  /**
   * Get all registered plugin IDs
   * @returns {string[]} Array of plugin IDs
   */
  getAll() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get all plugin manifests
   * @returns {Object[]} Array of manifests
   */
  getAllManifests() {
    return Array.from(this.manifests.values());
  }

  /**
   * Get plugins in load order
   * @returns {string[]} Array of plugin IDs in load order
   */
  getLoadOrder() {
    return [...this.loadOrder];
  }

  /**
   * Get plugin count
   * @returns {number} Number of registered plugins
   */
  count() {
    return this.plugins.size;
  }

  /**
   * Clear all plugins
   */
  clear() {
    this.plugins.clear();
    this.manifests.clear();
    this.instances.clear();
    this.loadOrder = [];
  }

  /**
   * Get plugins by category
   * @param {string} category - Category name
   * @returns {string[]} Array of plugin IDs
   */
  getByCategory(category) {
    const result = [];
    for (const [id, manifest] of this.manifests.entries()) {
      if (manifest.category === category) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Search plugins
   * @param {string} query - Search query
   * @returns {Object[]} Array of matching manifests
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const manifest of this.manifests.values()) {
      const searchText = [
        manifest.id,
        manifest.name?.zh || '',
        manifest.name?.en || '',
        manifest.description?.zh || '',
        manifest.description?.en || '',
        ...(manifest.tags || [])
      ].join(' ').toLowerCase();

      if (searchText.includes(lowerQuery)) {
        results.push(manifest);
      }
    }

    return results;
  }
}

exports.PluginRegistry = PluginRegistry;
});
__define('./services/comm/index.js', function(module, exports){
/**
 * Communication Layer Module
 * Entry point for the communication service
 */

const __reexport_6 = __require('./services/comm/communication-layer.js'); exports.CommunicationLayer = __reexport_6['CommunicationLayer']; exports.ConnectionState = __reexport_6['ConnectionState'];
const __reexport_7 = __require('./services/comm/transports/websocket.js'); exports.WebSocketTransport = __reexport_7['WebSocketTransport'];
const __reexport_8 = __require('./services/comm/transports/sse.js'); exports.SSETransport = __reexport_8['SSETransport'];
const __reexport_9 = __require('./services/comm/transports/long-polling.js'); exports.LongPollingTransport = __reexport_9['LongPollingTransport'];
const __reexport_10 = __require('./services/comm/transports/short-polling.js'); exports.ShortPollingTransport = __reexport_10['ShortPollingTransport'];
const __reexport_11 = __require('./services/comm/queue/message-queue.js'); exports.MessageQueue = __reexport_11['MessageQueue'];
const __reexport_12 = __require('./services/comm/queue/queue-storage.js'); exports.QueueStorage = __reexport_12['QueueStorage'];
const __reexport_13 = __require('./services/comm/utils/message.js'); exports.generateMessageId = __reexport_13['generateMessageId']; exports.createMessage = __reexport_13['createMessage']; exports.validateMessage = __reexport_13['validateMessage']; exports.isMessageExpired = __reexport_13['isMessageExpired']; exports.serializeMessage = __reexport_13['serializeMessage']; exports.deserializeMessage = __reexport_13['deserializeMessage'];
const __reexport_14 = __require('./services/comm/utils/retry.js'); exports.calculateBackoff = __reexport_14['calculateBackoff']; exports.calculateNextAttempt = __reexport_14['calculateNextAttempt']; exports.shouldRetry = __reexport_14['shouldRetry']; exports.createRetryConfig = __reexport_14['createRetryConfig']; exports.RetryStrategy = __reexport_14['RetryStrategy'];

});
__define('./services/database/index.js', function(module, exports){
/**
 * 数据库服务工厂
 * 根据运行模式自动选择合适的数据库实现
 * 支持环境检测和自动降级
 */

const { WasmDatabaseService } = __require('./services/database/wasm-database.js');
const { JarDatabaseService } = __require('./services/database/jar-database.js');
const { MockDatabaseService } = __require('./services/database/mock-database.js');

/**
 * 数据库服务工厂类
 */
class DatabaseServiceFactory {
  /**
   * 创建数据库服务实例
   * @param {string} mode - 运行模式：'auto', 'wasm', 'jar', 'mock'
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 数据库服务实例
   */
  static async create(mode = 'auto', options = {}) {
    let service;
    const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
    
    // Mock 模式（用于测试）
    if (mode === 'mock') {
      service = new MockDatabaseService();
      await service.init();
      return service;
    }

    if (isFileProtocol) {
      service = new MockDatabaseService();
      await service.init();
      console.warn('File protocol detected, using MockDatabaseService');
      return service;
    }
    
    // WASM 模式（纯浏览器）
    if (mode === 'wasm' || mode === 'light' || mode === 'pure') {
      service = new WasmDatabaseService();
      await service.init();
      return service;
    }
    
    // JAR 模式（桌面客户端）
    if (mode === 'jar') {
      service = new JarDatabaseService(options.baseUrl);
      await service.init();
      return service;
    }

    // Full 模式（JAR + WASM 都可用，优先使用 JAR）
    if (mode === 'full') {
      try {
        service = new JarDatabaseService(options.baseUrl);
        await service.init();
        console.log('✓ Database mode: JAR (full mode)');
        return service;
      } catch (error) {
        console.warn('JAR database unavailable in full mode, falling back to WASM:', error.message);
        service = new WasmDatabaseService();
        await service.init();
        console.log('✓ Database mode: WASM (full mode fallback)');
        return service;
      }
    }

    // 自动模式：先尝试 JAR，失败则降级到 WASM
    if (mode === 'auto') {
      try {
        service = new JarDatabaseService(options.baseUrl);
        await service.init();
        console.log('✓ Database mode: JAR');
        return service;
      } catch (error) {
        console.warn('JAR database unavailable, falling back to WASM:', error.message);
        
        try {
          service = new WasmDatabaseService();
          await service.init();
          console.log('✓ Database mode: WASM');
          return service;
        } catch (wasmError) {
          console.error('Both JAR and WASM databases failed:', wasmError.message);
          throw new Error('No database backend available');
        }
      }
    }
    
    throw new Error(`Unknown database mode: ${mode}`);
  }
  
  /**
   * 检测可用的数据库模式
   * @returns {Promise<string>} 'jar', 'wasm', 或 'none'
   */
  static async detectMode() {
    // 尝试 JAR
    try {
      const jarService = new JarDatabaseService();
      await jarService.init();
      await jarService.close();
      return 'jar';
    } catch (jarError) {
      // JAR 不可用，检查 WASM
      try {
        const wasmService = new WasmDatabaseService();
        await wasmService.init();
        await wasmService.close();
        return 'wasm';
      } catch (wasmError) {
        return 'none';
      }
    }
  }
}

// 导出各个实现供直接使用
exports.WasmDatabaseService = WasmDatabaseService; exports.JarDatabaseService = JarDatabaseService; exports.MockDatabaseService = MockDatabaseService;

// 默认导出工厂
exports.default = DatabaseServiceFactory;

exports.DatabaseServiceFactory = DatabaseServiceFactory;
});
__define('./services/database/wasm-database.js', function(module, exports){
/**
 * WASM 数据库服务
 * 使用 sql.js (SQLite 编译为 WASM) 在浏览器中运行
 * 数据持久化到 IndexedDB
 */

class WasmDatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.ready = false;
    this.autoSaveInterval = null;
  }
  
  /**
   * 初始化数据库
   */
  async init() {
    // 动态加载 sql.js
    // 注意：sql.js 需要预先下载到 /lib/sql.js/ 目录
    const initSqlJs = await this._loadSqlJs();
    
    this.SQL = await initSqlJs({
      locateFile: file => `/wasm/${file.replace('.wasm', '.dat')}`
    });
    
    // 从 IndexedDB 加载已有数据
    const savedData = await this.loadFromStorage();
    
    if (savedData) {
      this.db = new this.SQL.Database(savedData);
    } else {
      this.db = new this.SQL.Database();
    }
    
    // 配置数据库
    this.db.run('PRAGMA foreign_keys = ON');
    
    // 运行迁移
    await this.runMigrations();
    
    // 启动自动保存
    this.startAutoSave();
    
    this.ready = true;
  }
  
  /**
   * 动态加载 sql.js
   * 此处仅为占位，实际需要真实的 sql.js 库
   */
  async _loadSqlJs() {
    // 在实际环境中，应该从 /lib/sql.js/sql-wasm.js 加载
    // 这里返回一个模拟的加载函数用于开发
    if (typeof window !== 'undefined' && window.initSqlJs) {
      return window.initSqlJs;
    }
    
    // 如果 sql.js 不可用，抛出错误
    throw new Error('sql.js not available. Please include sql-wasm.js in your project.');
  }
  
  /**
   * 关闭数据库
   */
  async close() {
    await this.saveToStorage();
    this.stopAutoSave();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.ready = false;
  }
  
  /**
   * 查询多行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Array} 查询结果数组
   */
  query(sql, params = []) {
    this.ensureReady();
    
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  }
  
  /**
   * 查询单行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Object|null} 查询结果对象或 null
   */
  queryOne(sql, params = []) {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 执行 SQL（带参数）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   * @returns {Object} 执行结果 { changes, lastInsertRowid }
   */
  run(sql, params = []) {
    this.ensureReady();
    this.db.run(sql, params);
    
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: this.queryOne('SELECT last_insert_rowid() as id')?.id || 0
    };
  }
  
  /**
   * 执行 SQL（无参数，可以是多条语句）
   * @param {string} sql - SQL 语句
   */
  exec(sql) {
    this.ensureReady();
    this.db.exec(sql);
  }

  /**
   * 执行 SQL（execute 别名）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   */
  execute(sql, params = []) {
    return this.run(sql, params);
  }
  
  /**
   * 事务执行
   * @param {Function} callback - 事务回调函数
   * @returns {*} 回调函数的返回值
   */
  async transaction(callback) {
    this.ensureReady();
    
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      this.db.run('COMMIT');
      return result;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }
  
  /**
   * 从 IndexedDB 加载数据
   * @returns {Uint8Array|null} 数据库数据或 null
   */
  async loadFromStorage() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_db', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('database')) {
          db.createObjectStore('database');
        }
      };
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('database', 'readonly');
        const store = tx.objectStore('database');
        const getRequest = store.get('main');
        
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 保存数据到 IndexedDB
   */
  async saveToStorage() {
    if (!this.db) return;
    
    const data = this.db.export();
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_db', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('database')) {
          db.createObjectStore('database');
        }
      };
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('database', 'readwrite');
        const store = tx.objectStore('database');
        store.put(data, 'main');
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 启动自动保存
   */
  startAutoSave() {
    // 每 30 秒自动保存一次
    this.autoSaveInterval = setInterval(() => {
      this.saveToStorage().catch(console.error);
    }, 30000);
    
    // 页面卸载前保存
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveToStorage();
      });
    }
  }
  
  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
  
  /**
   * 运行数据库迁移
   */
  async runMigrations() {
    // 创建迁移表
    this.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at INTEGER NOT NULL
      )
    `);
    
    const migrations = await this.getMigrations();
    const executed = this.query('SELECT version FROM schema_migrations');
    const executedVersions = new Set(executed.map(r => r.version));
    
    for (const migration of migrations) {
      if (!executedVersions.has(migration.version)) {
        console.log(`Running migration: ${migration.name}`);
        
        await this.transaction(async () => {
          this.exec(migration.sql);
          this.run(
            'INSERT INTO schema_migrations (version, name, executed_at) VALUES (?, ?, ?)',
            [migration.version, migration.name, Date.now()]
          );
        });
      }
    }
  }
  
  /**
   * 获取所有迁移
   * @returns {Array} 迁移列表
   */
  async getMigrations() {
    const { migrations } = await Promise.resolve(__require('./services/database/migrations/index.js'));
    return migrations;
  }
  
  /**
   * 确保数据库已就绪
   */
  ensureReady() {
    if (!this.ready || !this.db) {
      throw new Error('Database not initialized');
    }
  }
  
  /**
   * 检查数据库是否就绪
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }
  
  /**
   * 获取数据库模式
   * @returns {string} 'wasm'
   */
  getMode() {
    return 'wasm';
  }
}

exports.WasmDatabaseService = WasmDatabaseService;
});
__define('./services/database/migrations/index.js', function(module, exports){
/**
 * 数据库迁移管理器
 * 所有的迁移按版本号顺序执行
 */

const migrations = [
  {
    version: 1,
    name: 'initial',
    sql: `
      -- 系统配置表
      CREATE TABLE system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- 模块表
      CREATE TABLE modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        deleted_by TEXT
      );
      
      -- 列表表
      CREATE TABLE columns (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (module_id) REFERENCES modules(id)
      );
      
      -- 卡片表
      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'markdown',
        tags TEXT,
        attachments TEXT,
        metadata TEXT,
        sort_order INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (column_id) REFERENCES columns(id)
      );
      
      -- 卡片全文搜索
      CREATE VIRTUAL TABLE cards_fts USING fts5(
        title, content, tags,
        content='cards',
        content_rowid='rowid',
        tokenize='unicode61'
      );
      
      -- 卡片链接表
      CREATE TABLE card_links (
        id TEXT PRIMARY KEY,
        source_card_id TEXT NOT NULL,
        target_card_id TEXT NOT NULL,
        link_type TEXT DEFAULT 'reference',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_card_id) REFERENCES cards(id),
        FOREIGN KEY (target_card_id) REFERENCES cards(id)
      );
      
      -- 文件表
      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT,
        size INTEGER NOT NULL,
        mime_type TEXT,
        hash TEXT,
        parent_id TEXT,
        parent_type TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );
      
      -- 同步队列表
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        priority INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        last_attempt INTEGER,
        next_attempt INTEGER,
        error_message TEXT
      );
      
      -- 版本历史表
      CREATE TABLE version_history (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        change_type TEXT NOT NULL,
        changed_by TEXT,
        created_at INTEGER NOT NULL
      );
      
      -- 索引
      CREATE INDEX idx_modules_sort ON modules(sort_order);
      CREATE INDEX idx_columns_module ON columns(module_id);
      CREATE INDEX idx_cards_column ON cards(column_id);
      CREATE INDEX idx_cards_sync ON cards(sync_status);
      CREATE INDEX idx_files_parent ON files(parent_id, parent_type);
      CREATE INDEX idx_sync_queue_status ON sync_queue(status, next_attempt);
      CREATE INDEX idx_version_history_entity ON version_history(entity_type, entity_id);
    `
  },
  {
    version: 2,
    name: 'add_tasks',
    sql: `
      -- 任务项目表
      CREATE TABLE task_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        members TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      );
      
      -- 任务表
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'todo',
        priority INTEGER DEFAULT 3,
        tags TEXT,
        assignee TEXT,
        assignee_name TEXT,
        due_date INTEGER,
        reminder_at INTEGER,
        project_id TEXT,
        parent_id TEXT,
        estimated_hours REAL,
        actual_hours REAL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES task_projects(id),
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );
      
      -- 任务全文搜索
      CREATE VIRTUAL TABLE tasks_fts USING fts5(
        title, content, tags,
        content='tasks',
        content_rowid='rowid',
        tokenize='unicode61'
      );
      
      -- 索引
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_assignee ON tasks(assignee);
      CREATE INDEX idx_tasks_due ON tasks(due_date);
      CREATE INDEX idx_tasks_project ON tasks(project_id);
    `
  },
  {
    version: 3,
    name: 'add_chat',
    sql: `
      -- 聊天室表
      CREATE TABLE chat_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        room_type TEXT DEFAULT 'group',
        description TEXT,
        avatar TEXT,
        members TEXT,
        admins TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message_at INTEGER,
        last_message TEXT,
        last_read_at INTEGER DEFAULT 0,
        muted INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0
      );
      
      -- 聊天消息表
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        sender_avatar TEXT,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        attachments TEXT,
        reply_to TEXT,
        mentions TEXT,
        reactions TEXT,
        created_at INTEGER NOT NULL,
        edited_at INTEGER,
        status TEXT DEFAULT 'sent',
        deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
      );
      
      -- 索引
      CREATE INDEX idx_chat_rooms_type ON chat_rooms(room_type);
      CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
      CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
    `
  },
  {
    version: 4,
    name: 'add_search_history',
    sql: `
      -- 搜索历史表
      CREATE TABLE search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        search_type TEXT DEFAULT 'global',
        result_count INTEGER,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX idx_search_history_time ON search_history(created_at DESC);
    `
  },
  {
    version: 5,
    name: 'add_plugin_system',
    sql: `
      -- Plugin installation records table
      -- 插件安装记录表
      CREATE TABLE plugin_installs (
        plugin_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        installed_at INTEGER NOT NULL,
        updated_at INTEGER
      );
      
      -- 插件配置表（可选，供未来扩展）
      CREATE TABLE plugin_config (
        plugin_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (plugin_id, key)
      );
      
      CREATE INDEX idx_plugin_installs_time ON plugin_installs(installed_at);
    `
  }
];

exports.migrations = migrations;
});
__define('./services/database/jar-database.js', function(module, exports){
/**
 * JAR 数据库服务
 * 通过 HTTP API 访问本地 JAR 服务的 SQLite 数据库
 */

class JarDatabaseService {
  constructor(baseUrl = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl;
    this.ready = false;
  }
  
  /**
   * 初始化数据库连接
   */
  async init() {
    // 测试 JAR 服务是否可用
    try {
      const response = await fetch(`${this.baseUrl}/api/local/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 秒超时
      });
      
      if (!response.ok) {
        throw new Error('JAR service unavailable');
      }
      
      this.ready = true;
      
      // 触发迁移（JAR 端会自动执行）
      await this.runMigrations();
    } catch (error) {
      throw new Error(`Failed to connect to JAR service: ${error.message}`);
    }
  }
  
  /**
   * 关闭数据库连接
   */
  async close() {
    this.ready = false;
  }
  
  /**
   * 查询多行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Array} 查询结果数组
   */
  async query(sql, params = []) {
    this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/local/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Query failed' }));
      throw new Error(error.message || 'Query failed');
    }
    
    const result = await response.json();
    return result.rows || [];
  }
  
  /**
   * 查询单行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Object|null} 查询结果对象或 null
   */
  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 执行 SQL（带参数）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   * @returns {Object} 执行结果 { changes, lastInsertRowid }
   */
  async run(sql, params = []) {
    this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/local/db/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Exec failed' }));
      throw new Error(error.message || 'Exec failed');
    }
    
    const result = await response.json();
    return {
      changes: result.changes || 0,
      lastInsertRowid: result.lastInsertRowid || 0
    };
  }
  
  /**
   * 执行 SQL（无参数，可以是多条语句）
   * @param {string} sql - SQL 语句
   */
  async exec(sql) {
    await this.run(sql, []);
  }

  /**
   * 执行 SQL（execute 别名）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   */
  async execute(sql, params = []) {
    return this.run(sql, params);
  }
  
  /**
   * 事务执行
   * @param {Function} callback - 事务回调函数
   * @returns {*} 回调函数的返回值
   */
  async transaction(callback) {
    this.ensureReady();
    
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }
  
  /**
   * 运行数据库迁移
   * JAR 端会自动处理迁移
   */
  async runMigrations() {
    try {
      const response = await fetch(`${this.baseUrl}/api/local/db/migrate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Migration failed');
      }
    } catch (error) {
      // 如果迁移端点不存在，忽略错误（可能是旧版本 JAR）
      console.warn('Migration endpoint not available:', error.message);
    }
  }
  
  /**
   * 确保数据库已就绪
   */
  ensureReady() {
    if (!this.ready) {
      throw new Error('Database not initialized');
    }
  }
  
  /**
   * 检查数据库是否就绪
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }
  
  /**
   * 获取数据库模式
   * @returns {string} 'jar'
   */
  getMode() {
    return 'jar';
  }
}

exports.JarDatabaseService = JarDatabaseService;
});
__define('./services/database/mock-database.js', function(module, exports){
/**
 * Mock 数据库服务
 * 用于单元测试，使用内存存储
 */

class MockDatabaseService {
  constructor() {
    this.ready = false;
    this.tables = new Map(); // 表名 -> 行数组
    this.migrations = [];
  }
  
  /**
   * 初始化数据库
   */
  async init() {
    this.ready = true;
    await this.runMigrations();
  }
  
  /**
   * 关闭数据库
   */
  async close() {
    this.ready = false;
    this.tables.clear();
  }
  
  /**
   * 查询多行数据（简化实现）
   */
  query(sql, params = []) {
    this.ensureReady();
    
    // 简化的查询解析
    if (sql.includes('SELECT') && sql.includes('FROM')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        return this.tables.get(tableName) || [];
      }
    }
    
    // 特殊查询处理
    if (sql.includes('last_insert_rowid')) {
      return [{ id: this._lastInsertId || 0 }];
    }
    
    if (sql.includes('schema_migrations')) {
      return this.migrations;
    }
    
    return [];
  }
  
  /**
   * 查询单行数据
   */
  queryOne(sql, params = []) {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 执行 SQL（简化实现）
   */
  run(sql, params = []) {
    this.ensureReady();
    
    let changes = 0;
    
    // 简化的 INSERT 解析
    if (sql.includes('INSERT INTO')) {
      const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
        
        // 创建简单的行对象
        const row = {};
        params.forEach((param, i) => {
          row[`col${i}`] = param;
        });
        
        this.tables.get(tableName).push(row);
        this._lastInsertId = (this._lastInsertId || 0) + 1;
        changes = 1;
      }
    }
    
    // 简化的 UPDATE 解析
    if (sql.includes('UPDATE')) {
      changes = 1; // 假设更新了一行
    }
    
    // 简化的 DELETE 解析
    if (sql.includes('DELETE')) {
      changes = 1; // 假设删除了一行
    }
    
    return {
      changes,
      lastInsertRowid: this._lastInsertId || 0
    };
  }
  
  /**
   * 执行 SQL（无参数）
   */
  exec(sql) {
    this.ensureReady();
    
    // 简化的 CREATE TABLE 解析
    if (sql.includes('CREATE TABLE')) {
      const matches = sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/gi);
      for (const match of matches) {
        const tableName = match[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    }
    
    // 简化的 CREATE VIRTUAL TABLE 解析（FTS）
    if (sql.includes('CREATE VIRTUAL TABLE')) {
      const matches = sql.matchAll(/CREATE VIRTUAL TABLE\s+(\w+)/gi);
      for (const match of matches) {
        const tableName = match[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    }
  }

  /**
   * 执行 SQL（execute 别名）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   */
  execute(sql, params = []) {
    return this.run(sql, params);
  }
  
  /**
   * 事务执行
   */
  async transaction(callback) {
    this.ensureReady();
    
    // Mock 实现不做实际的事务处理
    try {
      return await callback();
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 运行数据库迁移
   */
  async runMigrations() {
    // 创建迁移表
    this.tables.set('schema_migrations', []);
    
    const { migrations: migrationList } = await Promise.resolve(__require('./services/database/migrations/index.js'));
    const executedVersions = new Set(this.migrations.map(r => r.version));
    
    for (const migration of migrationList) {
      if (!executedVersions.has(migration.version)) {
        this.exec(migration.sql);
        this.migrations.push({
          version: migration.version,
          name: migration.name,
          executed_at: Date.now()
        });
      }
    }
  }
  
  /**
   * 确保数据库已就绪
   */
  ensureReady() {
    if (!this.ready) {
      throw new Error('Database not initialized');
    }
  }
  
  /**
   * 检查数据库是否就绪
   */
  isReady() {
    return this.ready;
  }
  
  /**
   * 获取数据库模式
   */
  getMode() {
    return 'mock';
  }
}

exports.MockDatabaseService = MockDatabaseService;
});
__define('./services/search/index.js', function(module, exports){
/**
 * Search Service Module
 * Entry point for search service
 * 
 * Note: Using CommonJS for compatibility with search-service.js
 */

const SearchService = require('./search-service.js');

module.exports = SearchService;
module.exports.SearchService = SearchService;

});
__define('./services/auth/index.js', function(module, exports){
/**
 * Authentication Module - Main Entry Point
 * 
 * Exports all authentication-related functionality.
 */

const __reexport_15 = __require('./services/auth/device-fingerprint.js'); exports.generateDeviceId = __reexport_15['generateDeviceId']; exports.detectPlatform = __reexport_15['detectPlatform'];
const __reexport_16 = __require('./services/auth/token-manager.js'); exports.TokenManager = __reexport_16['TokenManager'];
const __reexport_17 = __require('./services/auth/auth-service.js'); exports.AuthService = __reexport_17['AuthService']; exports.authService = __reexport_17['authService'];
const __reexport_18 = __require('./services/auth/permission.js'); exports.hasPermission = __reexport_18['hasPermission']; exports.requirePermission = __reexport_18['requirePermission']; exports.canAccessData = __reexport_18['canAccessData']; exports.getRoleName = __reexport_18['getRoleName']; exports.getRolePermissions = __reexport_18['getRolePermissions'];
const __reexport_19 = __require('./services/auth/setup-ui.js'); exports.SetupUI = __reexport_19['SetupUI'];

});
__define('./services/auth/setup-ui.js', function(module, exports){
/**
 * Setup UI Module
 * 
 * Handles the first-time setup interface for user configuration.
 */

/**
 * Setup UI Class
 */
class SetupUI {
  /**
   * Create a new SetupUI instance
   * @param {HTMLElement} container - Container element for the UI
   */
  constructor(container) {
    this.container = container;
    this.onComplete = null;
  }
  
  /**
   * Render the setup form
   */
  render() {
    this.container.innerHTML = `
      <div class="setup-container">
        <div class="setup-card">
          <div class="setup-header">
            <h1>欢迎使用 Localverse</h1>
            <p>请填写以下信息完成初始化</p>
          </div>
          
          <form id="setupForm" class="setup-form">
            <div class="form-group">
              <label for="userId">工号 <span class="required">*</span></label>
              <input type="text" id="userId" name="userId" required
                     pattern="[a-zA-Z0-9_]+"
                     placeholder="例如: zhangsan"
                     autocomplete="off">
              <span class="form-hint">字母、数字、下划线</span>
            </div>
            
            <div class="form-group">
              <label for="userName">姓名 <span class="required">*</span></label>
              <input type="text" id="userName" name="userName" required
                     placeholder="例如: 张三">
            </div>
            
            <div class="form-group">
              <label for="department">部门 <span class="required">*</span></label>
              <select id="department" name="department" required>
                <option value="">请选择</option>
                <option value="dev">开发部</option>
                <option value="qa">测试部</option>
                <option value="ops">运维部</option>
                <option value="product">产品部</option>
                <option value="design">设计部</option>
                <option value="hr">人事部</option>
                <option value="finance">财务部</option>
                <option value="admin">行政部</option>
              </select>
            </div>
            
            <button type="submit" class="btn-primary btn-block">
              完成设置
            </button>
          </form>
          
          <div class="setup-footer">
            <p>数据将保存在本地设备上</p>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }
  
  /**
   * Bind form events
   */
  bindEvents() {
    const form = this.container.querySelector('#setupForm');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const userData = {
        userId: formData.get('userId'),
        userName: formData.get('userName'),
        department: formData.get('department'),
        role: 'user'
      };
      
      // Validate
      if (!this.validate(userData)) {
        return;
      }
      
      // Disable button
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '设置中...';
      
      try {
        if (this.onComplete) {
          await this.onComplete(userData);
        }
      } catch (error) {
        console.error('Setup failed:', error);
        alert('设置失败: ' + error.message + '，请重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '完成设置';
      }
    });
  }
  
  /**
   * Validate user data
   * @param {Object} userData - User data to validate
   * @returns {boolean} True if valid
   */
  validate(userData) {
    if (!/^[a-zA-Z0-9_]+$/.test(userData.userId)) {
      alert('工号只能包含字母、数字和下划线');
      return false;
    }
    
    if (userData.userName.length < 2) {
      alert('姓名至少2个字符');
      return false;
    }
    
    if (!userData.department) {
      alert('请选择部门');
      return false;
    }
    
    return true;
  }
  
  /**
   * Set completion callback
   * @param {Function} callback - Callback function
   */
  setOnComplete(callback) {
    this.onComplete = callback;
  }
}

exports.SetupUI = SetupUI;
});
__define('./components/header.js', function(module, exports){
/**
 * Header Component
 * Top navigation bar with logo, search, and user menu
 */

const LVComponent = __require('./components/base.js').default ?? __require('./components/base.js');

class LVHeader extends LVComponent {
  static get observedAttributes() {
    return ['mode'];
  }

  constructor() {
    super();
    this._state = {
      searchQuery: ''
    };
  }

  styles() {
    return `
      :host {
        display: block;
        height: var(--header-height, 48px);
        background: var(--header-bg, #fff);
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      
      .header {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 16px;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-color, #1976d2);
        text-decoration: none;
        cursor: pointer;
      }
      
      .logo-icon {
        font-size: 24px;
      }
      
      .search-box {
        flex: 1;
        max-width: 400px;
        margin: 0 24px;
      }
      
      .search-input {
        width: 100%;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        outline: none;
        background: var(--surface-color, #fff);
        color: var(--text-color, #212121);
        font-size: 14px;
        transition: border-color var(--transition-fast);
      }
      
      .search-input:focus {
        border-color: var(--primary-color, #1976d2);
      }
      
      .search-input::placeholder {
        color: var(--text-secondary, #757575);
      }
      
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-left: auto;
      }
      
      .mode-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        background: var(--surface-color, #f5f5f5);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        font-size: 12px;
        color: var(--text-secondary, #757575);
      }
      
      .mode-icon {
        font-size: 16px;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success-color, #4caf50);
      }
      
      .status-indicator.offline { background: var(--gray-500, #9e9e9e); }
      .status-indicator.connecting { background: var(--warning-color, #ff9800); }
      .status-indicator.error { background: var(--error-color, #f44336); }
      
      .user-button {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: var(--primary-color, #1976d2);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      
      .user-button:hover {
        background: var(--primary-dark, #1565c0);
      }
      
      @media (max-width: 768px) {
        .search-box {
          max-width: 200px;
          margin: 0 12px;
        }
        
        .mode-badge {
          display: none;
        }
      }
    `;
  }

  template() {
    const mode = this.getAttribute('mode') || 'full';
    const modeIcons = {
      full: '🟢',
      light: '🟡',
      pure: '🟠'
    };
    const modeLabels = {
      full: 'Full',
      light: 'Light',
      pure: 'Pure'
    };
    
    return `
      <header class="header">
        <a class="logo" id="logoLink">
          <span class="logo-icon">🌐</span>
          <span class="logo-text">Localverse</span>
        </a>
        
        <div class="search-box">
          <input type="text" 
                 class="search-input" 
                 id="searchInput"
                 placeholder="Search... (Ctrl+K)"
                 value="${this.state.searchQuery}">
        </div>
        
        <div class="actions">
          <div class="mode-badge">
            <span class="mode-icon">${modeIcons[mode]}</span>
            <span>${modeLabels[mode]}</span>
          </div>
          
          <div class="status-indicator" id="statusIndicator" title="Connection status"></div>
          
          <button class="user-button" id="userButton" title="User menu">
            ${this.getUserInitial()}
          </button>
        </div>
      </header>
    `;
  }

  bindEvents() {
    // Logo click - navigate home
    this.on('#logoLink', 'click', (e) => {
      e.preventDefault();
      window.app?.router.navigate('/');
    });
    
    // Search input
    const searchInput = this.$('#searchInput');
    searchInput?.addEventListener('input', (e) => {
      this.setState({ searchQuery: e.target.value });
      this.emit('search', { query: e.target.value });
    });
    
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.emit('search-submit', { query: e.target.value });
      }
    });
    
    // User button
    this.on('#userButton', 'click', () => {
      this.emit('user-menu');
    });
    
    // Global keyboard shortcut for search (Ctrl+K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput?.focus();
      }
    });
  }

  /**
   * Get user initial for avatar
   * @returns {string}
   */
  getUserInitial() {
    const userName = window.app?.user?.name || 'User';
    return userName.charAt(0).toUpperCase();
  }

  /**
   * Update connection status indicator
   * @param {string} status - Status ('online', 'offline', 'connecting', 'error')
   */
  updateConnectionStatus(status) {
    const indicator = this.$('#statusIndicator');
    if (indicator) {
      indicator.className = `status-indicator ${status}`;
    }
  }
}

// Register custom element
customElements.define('lv-header', LVHeader);

exports.default = LVHeader;

});
__define('./components/base.js', function(module, exports){
/**
 * Base Web Component Class
 * Provides foundation for all Localverse components
 */

class LVComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = {};
    this._mounted = false;
  }

  /**
   * Called when element is added to DOM
   */
  connectedCallback() {
    this._mounted = true;
    this.render();
    this.onMount();
  }

  /**
   * Called when element is removed from DOM
   */
  disconnectedCallback() {
    this._mounted = false;
    this.onUnmount();
  }

  /**
   * Called when observed attribute changes
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.onAttributeChange(name, newValue, oldValue);
      if (this._mounted) {
        this.render();
      }
    }
  }

  /**
   * Lifecycle hook - called after mount
   */
  onMount() {}

  /**
   * Lifecycle hook - called before unmount
   */
  onUnmount() {}

  /**
   * Lifecycle hook - called on attribute change
   */
  onAttributeChange(name, newValue, oldValue) {}

  /**
   * Get component state
   */
  get state() {
    return this._state;
  }

  /**
   * Update component state and re-render
   * @param {Object} newState - State updates
   */
  setState(newState) {
    this._state = { ...this._state, ...newState };
    if (this._mounted) {
      this.render();
    }
  }

  /**
   * Render component
   */
  render() {
    const styles = this.styles();
    const template = this.template();
    
    this.shadowRoot.innerHTML = `
      ${styles ? `<style>${styles}</style>` : ''}
      ${template}
    `;
    
    this.bindEvents();
  }

  /**
   * Component styles - override in subclass
   * @returns {string} CSS string
   */
  styles() {
    return '';
  }

  /**
   * Component template - override in subclass
   * @returns {string} HTML string
   */
  template() {
    return '';
  }

  /**
   * Bind event listeners - override in subclass
   */
  bindEvents() {}

  /**
   * Query selector in shadow DOM
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  /**
   * Query selector all in shadow DOM
   * @param {string} selector - CSS selector
   * @returns {NodeList}
   */
  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }

  /**
   * Emit custom event
   * @param {string} event - Event name
   * @param {*} detail - Event detail
   */
  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, {
      bubbles: true,
      composed: true,
      detail
    }));
  }

  /**
   * Add event listener to shadow DOM element
   * @param {string} selector - CSS selector
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(selector, event, handler) {
    const element = this.$(selector);
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  /**
   * Get attribute as boolean
   * @param {string} name - Attribute name
   * @returns {boolean}
   */
  getBooleanAttribute(name) {
    return this.hasAttribute(name);
  }

  /**
   * Set boolean attribute
   * @param {string} name - Attribute name
   * @param {boolean} value - Value
   */
  setBooleanAttribute(name, value) {
    if (value) {
      this.setAttribute(name, '');
    } else {
      this.removeAttribute(name);
    }
  }
}

exports.default = LVComponent;

});
__define('./components/sidebar.js', function(module, exports){
/**
 * Sidebar Component
 * Navigation sidebar with plugin list
 */

const LVComponent = __require('./components/base.js').default ?? __require('./components/base.js');

class LVSidebar extends LVComponent {
  static get observedAttributes() {
    return ['expanded'];
  }

  constructor() {
    super();
    this._state = {
      plugins: [],
      activePlugin: null
    };
  }

  styles() {
    return `
      :host {
        display: block;
        width: var(--sidebar-width, 60px);
        height: 100%;
        background: var(--sidebar-bg, #f5f5f5);
        border-right: 1px solid var(--border-color, #e0e0e0);
        transition: width var(--transition-normal);
      }
      
      :host([expanded]) {
        width: var(--sidebar-expanded-width, 240px);
      }
      
      .sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }
      
      .nav-list {
        flex: 1;
        padding: 8px;
        overflow-y: auto;
      }
      
      .nav-item {
        display: flex;
        align-items: center;
        padding: 12px;
        border-radius: var(--radius-md, 8px);
        cursor: pointer;
        transition: background var(--transition-fast);
        color: var(--text-color, #212121);
        text-decoration: none;
        margin-bottom: 4px;
      }
      
      .nav-item:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      .nav-item.active {
        background: var(--active-bg, rgba(25, 118, 210, 0.1));
        color: var(--primary-color, #1976d2);
      }
      
      .nav-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .nav-label {
        margin-left: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 14px;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }
      
      :host([expanded]) .nav-label {
        opacity: 1;
      }
      
      .sidebar-footer {
        padding: 8px;
        border-top: 1px solid var(--border-color, #e0e0e0);
      }
      
      .toggle-btn {
        width: 100%;
        padding: 12px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm, 4px);
        color: var(--text-secondary, #757575);
        font-size: 18px;
        transition: background var(--transition-fast);
      }
      
      .toggle-btn:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      /* Scrollbar */
      .nav-list::-webkit-scrollbar {
        width: 4px;
      }
      
      .nav-list::-webkit-scrollbar-thumb {
        background: var(--gray-400, #bdbdbd);
        border-radius: 2px;
      }
      
      @media (max-width: 768px) {
        :host {
          position: fixed;
          left: 0;
          top: var(--header-height, 48px);
          bottom: 0;
          z-index: var(--z-sticky, 200);
          transform: translateX(-100%);
          transition: transform var(--transition-normal);
        }
        
        :host([expanded]) {
          transform: translateX(0);
          width: 280px;
        }
      }
    `;
  }

  template() {
    const plugins = this.state.plugins;
    const activeId = this.state.activePlugin;
    const expanded = this.hasAttribute('expanded');
    
    return `
      <nav class="sidebar">
        <div class="nav-list">
          ${plugins.map(plugin => `
            <div class="nav-item ${plugin.id === activeId ? 'active' : ''}"
                 data-plugin="${plugin.id}"
                 title="${plugin.name}">
              <span class="nav-icon">${plugin.icon || '📦'}</span>
              <span class="nav-label">${plugin.name}</span>
            </div>
          `).join('')}
          ${plugins.length === 0 ? '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">No plugins</div>' : ''}
        </div>
        
        <div class="sidebar-footer">
          <button class="toggle-btn" id="toggleBtn" title="${expanded ? 'Collapse' : 'Expand'} sidebar">
            ${expanded ? '◀' : '▶'}
          </button>
        </div>
      </nav>
    `;
  }

  bindEvents() {
    // Plugin item click
    this.$$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const pluginId = item.dataset.plugin;
        this.setState({ activePlugin: pluginId });
        this.emit('plugin-select', { pluginId });
      });
    });
    
    // Toggle button
    this.on('#toggleBtn', 'click', () => {
      this.toggleAttribute('expanded');
    });
  }

  /**
   * Set plugins list
   * @param {Array} plugins - Array of plugin objects
   */
  setPlugins(plugins) {
    this.setState({ plugins });
  }

  /**
   * Set active plugin
   * @param {string} pluginId - Plugin ID
   */
  setActive(pluginId) {
    this.setState({ activePlugin: pluginId });
  }

  /**
   * Add plugin to list
   * @param {Object} plugin - Plugin object
   */
  addPlugin(plugin) {
    const plugins = [...this.state.plugins, plugin];
    this.setState({ plugins });
  }

  /**
   * Remove plugin from list
   * @param {string} pluginId - Plugin ID
   */
  removePlugin(pluginId) {
    const plugins = this.state.plugins.filter(p => p.id !== pluginId);
    this.setState({ plugins });
  }
}

// Register custom element
customElements.define('lv-sidebar', LVSidebar);

exports.default = LVSidebar;

});
__define('./components/toast.js', function(module, exports){
/**
 * Toast Component
 * Notification toast messages
 */

const LVComponent = __require('./components/base.js').default ?? __require('./components/base.js');

class LVToastContainer extends LVComponent {
  constructor() {
    super();
    this._state = {
      toasts: []
    };
    this._nextId = 1;
  }

  styles() {
    return `
      :host {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: var(--z-tooltip, 1200);
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      
      .toast {
        min-width: 280px;
        max-width: 400px;
        padding: 12px 16px;
        background: var(--surface-color, #fff);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
        animation: slideIn 0.2s ease-out;
        border-left: 4px solid var(--toast-color);
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .toast.removing {
        animation: slideOut 0.2s ease-in;
      }
      
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      
      .toast-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .toast-content {
        flex: 1;
        font-size: 14px;
        color: var(--text-color);
        line-height: 1.4;
      }
      
      .toast-close {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        font-size: 18px;
        line-height: 1;
        padding: 0;
        flex-shrink: 0;
        transition: background var(--transition-fast);
      }
      
      .toast-close:hover {
        background: var(--hover-bg);
      }
      
      /* Toast types */
      .toast.info {
        --toast-color: var(--info-color, #2196f3);
      }
      
      .toast.success {
        --toast-color: var(--success-color, #4caf50);
      }
      
      .toast.warning {
        --toast-color: var(--warning-color, #ff9800);
      }
      
      .toast.error {
        --toast-color: var(--error-color, #f44336);
      }
      
      @media (max-width: 768px) {
        :host {
          left: 16px;
          right: 16px;
        }
        
        .toast {
          min-width: auto;
          max-width: none;
        }
      }
    `;
  }

  template() {
    const toasts = this.state.toasts;
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    return toasts.map(toast => `
      <div class="toast ${toast.type}" data-id="${toast.id}">
        <span class="toast-icon">${icons[toast.type]}</span>
        <div class="toast-content">${toast.message}</div>
        <button class="toast-close" data-id="${toast.id}">×</button>
      </div>
    `).join('');
  }

  bindEvents() {
    this.$$('.toast-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        this.remove(id);
      });
    });
  }

  /**
   * Show a toast message
   * @param {string} message - Message text
   * @param {string} type - Toast type ('info', 'success', 'warning', 'error')
   * @param {number} duration - Auto-close duration in ms (0 = no auto-close)
   */
  show(message, type = 'info', duration = 3000) {
    const id = this._nextId++;
    const toast = { id, message, type };
    
    const toasts = [...this.state.toasts, toast];
    this.setState({ toasts });
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
    
    return id;
  }

  /**
   * Remove a toast by ID
   * @param {number} id - Toast ID
   */
  remove(id) {
    // Add removing class for animation
    const toastElement = this.shadowRoot.querySelector(`[data-id="${id}"]`);
    if (toastElement) {
      toastElement.classList.add('removing');
      
      // Remove from state after animation
      setTimeout(() => {
        const toasts = this.state.toasts.filter(t => t.id !== id);
        this.setState({ toasts });
      }, 200);
    }
  }

  /**
   * Clear all toasts
   */
  clear() {
    this.setState({ toasts: [] });
  }

  /**
   * Convenience methods for different types
   */
  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }

  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  warning(message, duration = 3000) {
    return this.show(message, 'warning', duration);
  }

  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }
}

// Register custom element
customElements.define('lv-toast-container', LVToastContainer);

exports.default = LVToastContainer;

});
__define('./components/modal.js', function(module, exports){
/**
 * Modal Component
 * Dialog/modal window
 */

const LVComponent = __require('./components/base.js').default ?? __require('./components/base.js');

class LVModal extends LVComponent {
  static get observedAttributes() {
    return ['open', 'title', 'size'];
  }

  styles() {
    return `
      :host {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: var(--z-modal, 1000);
      }
      
      :host([open]) {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--modal-overlay, rgba(0, 0, 0, 0.5));
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .modal {
        position: relative;
        background: var(--modal-bg, #fff);
        border-radius: var(--radius-lg, 12px);
        box-shadow: var(--shadow-xl);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        animation: modalIn 0.2s ease-out;
        overflow: hidden;
      }
      
      @keyframes modalIn {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      :host([size="small"]) .modal { width: 400px; }
      :host([size="medium"]) .modal { width: 600px; }
      :host([size="large"]) .modal { width: 800px; }
      :host([size="full"]) .modal { width: 90vw; height: 90vh; }
      :host(:not([size])) .modal { width: 600px; }
      
      .modal-header {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        flex-shrink: 0;
      }
      
      .modal-title {
        flex: 1;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        color: var(--text-color);
      }
      
      .modal-close {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm, 4px);
        font-size: 20px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast);
      }
      
      .modal-close:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      .modal-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        color: var(--text-color);
      }
      
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid var(--border-color, #e0e0e0);
        flex-shrink: 0;
      }
      
      /* Scrollbar */
      .modal-body::-webkit-scrollbar {
        width: 8px;
      }
      
      .modal-body::-webkit-scrollbar-thumb {
        background: var(--gray-400, #bdbdbd);
        border-radius: 4px;
      }
      
      @media (max-width: 768px) {
        .modal {
          width: 90vw !important;
          max-height: 85vh;
        }
      }
    `;
  }

  template() {
    const title = this.getAttribute('title') || '';
    
    return `
      <div class="overlay" id="overlay"></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" id="closeBtn" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Close on overlay click
    this.on('#overlay', 'click', () => this.close());
    
    // Close on close button
    this.on('#closeBtn', 'click', () => this.close());
    
    // Close on ESC key
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.hasAttribute('open')) {
        this.close();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }

  onUnmount() {
    // Clean up ESC handler
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
  }

  /**
   * Open modal
   */
  open() {
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    this.emit('open');
  }

  /**
   * Close modal
   */
  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
    this.emit('close');
  }

  /**
   * Toggle modal
   */
  toggle() {
    if (this.hasAttribute('open')) {
      this.close();
    } else {
      this.open();
    }
  }
}

// Register custom element
customElements.define('lv-modal', LVModal);

exports.default = LVModal;

});
__define('./components/dropdown.js', function(module, exports){
/**
 * Dropdown Component
 * Provides a simple dropdown menu with trigger and menu slots.
 */

const LVComponent = __require('./components/base.js').default ?? __require('./components/base.js');

class LVDropdown extends LVComponent {
  static get observedAttributes() {
    return ['open', 'align'];
  }

  constructor() {
    super();
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  styles() {
    return `
      :host {
        position: relative;
        display: inline-block;
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }

      .menu {
        position: absolute;
        top: calc(100% + 6px);
        min-width: 160px;
        padding: 8px 0;
        background: var(--dropdown-bg, #fff);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-md, 0 8px 20px rgba(0,0,0,0.08));
        display: none;
        z-index: var(--z-dropdown, 1100);
      }

      :host([open]) .menu {
        display: block;
      }

      :host([align="right"]) .menu {
        right: 0;
        left: auto;
      }

      :host(:not([align="right"])) .menu {
        left: 0;
        right: auto;
      }
    `;
  }

  template() {
    return `
      <div class="trigger" id="trigger">
        <slot name="trigger"></slot>
      </div>
      <div class="menu" role="menu">
        <slot name="menu"></slot>
      </div>
    `;
  }

  bindEvents() {
    this.on('#trigger', 'click', (event) => {
      event.stopPropagation();
      this.toggle();
    });
  }

  onMount() {
    document.addEventListener('click', this.handleDocumentClick);
  }

  onUnmount() {
    document.removeEventListener('click', this.handleDocumentClick);
  }

  handleDocumentClick(event) {
    if (!this.hasAttribute('open')) return;
    if (!this.contains(event.target)) {
      this.close();
    }
  }

  open() {
    this.setAttribute('open', '');
    this.emit('open');
  }

  close() {
    this.removeAttribute('open');
    this.emit('close');
  }

  toggle() {
    if (this.hasAttribute('open')) {
      this.close();
    } else {
      this.open();
    }
  }
}

customElements.define('lv-dropdown', LVDropdown);

exports.default = LVDropdown;

});
__define('./components/tooltip.js', function(module, exports){
/**
 * Tooltip Component
 * Shows helper text on hover.
 */

const LVComponent = __require('./components/base.js').default ?? __require('./components/base.js');

class LVTooltip extends LVComponent {
  static get observedAttributes() {
    return ['text', 'position'];
  }

  styles() {
    return `
      :host {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .tooltip-content {
        position: absolute;
        max-width: 240px;
        padding: 6px 10px;
        background: var(--tooltip-bg, rgba(0, 0, 0, 0.85));
        color: var(--tooltip-color, #fff);
        font-size: 12px;
        border-radius: var(--radius-sm, 4px);
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transform: translateY(4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        z-index: var(--z-tooltip, 1200);
      }

      :host(:hover) .tooltip-content {
        opacity: 1;
        transform: translateY(0);
      }

      :host([position="top"]) .tooltip-content {
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translate(-50%, -4px);
      }

      :host([position="bottom"]) .tooltip-content,
      :host(:not([position])) .tooltip-content {
        top: calc(100% + 6px);
        left: 50%;
        transform: translate(-50%, 4px);
      }

      :host([position="left"]) .tooltip-content {
        right: calc(100% + 6px);
        top: 50%;
        transform: translate(-4px, -50%);
      }

      :host([position="right"]) .tooltip-content {
        left: calc(100% + 6px);
        top: 50%;
        transform: translate(4px, -50%);
      }
    `;
  }

  template() {
    const text = this.getAttribute('text') || '';

    return `
      <slot></slot>
      <span class="tooltip-content" role="tooltip">${text}</span>
    `;
  }
}

customElements.define('lv-tooltip', LVTooltip);

exports.default = LVTooltip;

});
__require('./app.js');
})();
