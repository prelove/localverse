/**
 * PluginLoader - Loads and manages plugins
 * Handles discovery, validation, loading, and lifecycle
 * Plugin Loader
 * Discovers, loads, and manages plugins
 * 插件加载器 - 管理插件的完整生命周期
 * 插件加载器
 * 
 * 功能：
 * 1. 加载插件模块
 * 2. 解析和验证 manifest
 * 3. 依赖检查
 * 4. 动态导入
 */

export class PluginLoader {
  constructor() {
    this._loadedPlugins = new Map(); // pluginId -> { module, manifest, instance }
    this._basePath = './plugins/';
  }

  /**
   * 设置插件基础路径
   * @param {string} path - 路径
   */
  setBasePath(path) {
    this._basePath = path.endsWith('/') ? path : `${path}/`;
  }

  /**
   * 加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>} - { module, manifest, instance }
   */
  async load(pluginId) {
    // 检查是否已加载
    if (this._loadedPlugins.has(pluginId)) {
      return this._loadedPlugins.get(pluginId);
    }

    try {
      // 1. 加载 manifest
      const manifest = await this.loadManifest(pluginId);

      // 2. 验证 manifest
      this.validateManifest(manifest);

      // 3. 检查应用版本兼容性
      this.checkAppVersion(manifest);

      // 4. 检查依赖
      await this.checkDependencies(manifest);

      // 5. 加载插件模块
      const module = await this.loadModule(pluginId, manifest.entry);

      // 6. 验证插件类
      this.validateModule(module);

      const pluginData = {
        module,
        manifest,
        instance: null // 稍后由 PluginManager 创建实例
      };

      this._loadedPlugins.set(pluginId, pluginData);
      return pluginData;

    } catch (error) {
      console.error(`Failed to load plugin "${pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 加载 manifest.json
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>}
   */
  async loadManifest(pluginId) {
    const manifestUrl = `${this._basePath}${pluginId}/manifest.json`;
    
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load manifest for plugin "${pluginId}": ${error.message}`);
    }
  }

  /**
   * 验证 manifest 结构
   * @param {Object} manifest
   * @throws {Error}
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'entry'];
    
 * Plugin Loader
 * 
 * Manages plugin discovery, loading, lifecycle, and dependency resolution.
 * Manages plugin discovery, loading, and lifecycle
 */

import { PluginStorage } from './plugin-storage.js';
import { PluginSettings } from './plugin-settings.js';
import { PluginI18n } from './plugin-i18n.js';
import { I18n } from '../i18n.js';

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || '/plugins';
    this.services = options.services || {};
    this.eventBus = options.eventBus;
    this.permissionManager = options.permissionManager;
    this.router = options.router;
    this.databaseService = options.databaseService;
    
    this.manifests = new Map();
    this.instances = new Map();
    this.installedVersions = new Map();
  }
  
  /**
   * Load all available plugins
   * @returns {Promise<void>}
   * Load all plugins
   * @returns {Promise<void>}
   * Load all available plugins
    
    this.initDatabase();
  }
  
  /**
   * Initialize plugin database tables
   */
  async initDatabase() {
    if (!this.databaseService) return;
    
    try {
      await this.databaseService.run(`
        CREATE TABLE IF NOT EXISTS plugin_installs (
          plugin_id TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          installed_at INTEGER NOT NULL,
          updated_at INTEGER
        )
      `);
    } catch (error) {
      console.warn('Failed to init plugin database:', error);
    }
  }
  
  /**
   * Load all plugins
   */
  async loadAll() {
    const pluginIds = await this.discoverPlugins();
    
    for (const id of pluginIds) {
      try {
        await this.load(id);
      } catch (error) {
        console.error(`Failed to load plugin: ${id}`, error);
      }
    }
  }
  
  /**
   * Discover available plugins
   * @returns {Promise<string[]>} Array of plugin IDs
   */
  async discoverPlugins() {
    // Try to load plugins.json
   * @private
   */
  async discoverPlugins() {
    // Try to fetch plugins.json listing
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      if (response.ok) {
        const data = await response.json();
        return data.plugins || [];
      }
    } catch {
      // Ignore errors
    }
    
    // Default plugin list (empty for now, will be populated when plugins are added)
    return [];
   * @returns {Promise<string[]>}
   */
  async discoverPlugins() {
    // Try to load plugins list from config
  async discoverPlugins() {
    // 从配置或目录获取插件列表
    // 这里假设有一个 plugins.json 文件
    // Get plugin list from configuration or directory
    // Assumes a plugins.json file exists
  /**
   * Discover available plugins
   * @returns {Promise<string[]>} Plugin IDs
   */
  async discoverPlugins() {
    // Try to fetch plugins list from server
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      const data = await response.json();
      return data.plugins || [];
    } catch {
      // Return empty array if no plugins.json found
      // 默认插件列表（暂时为空，后续添加内置插件）
      return [];
    }
  }
  
  /**
   * Load a specific plugin
  async load(pluginId) {
    const pluginDir = `${this.pluginsDir}/${pluginId}`;
    
    // 1. 读取 manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. 验证
    this.validateManifest(manifest);
    
    // 3. 检查依赖
    await this.checkDependencies(manifest);
    
    // 4. 加载样式
      // Default plugin list
      return ['finder', 'wiki', 'chat', 'task'];
    }
  }
  
  /**
   * Load single plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<Plugin>} Plugin instance
   * @param {string} pluginId
      // Return default plugins when plugins.json is not available
      // This allows the system to work in demo/development mode
      return ['demo'];
    }
  }
  
  /**
   * Load a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<Object>} Plugin instance
   */
  async load(pluginId) {
    const pluginDir = `${this.pluginsDir}/${pluginId}`;
    
    // 1. Read manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. Validate
    // 1. Load manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. Validate
    // 2. Validate manifest
    this.validateManifest(manifest);
    
    // 3. Check dependencies
    await this.checkDependencies(manifest);
    
    // 4. Load style
    // 4. Load styles (if any)
    // 4. Load style
    // 4. Load styles
    if (manifest.style) {
      await this.loadStyle(`${pluginDir}/${manifest.style}`, manifest.id);
    }
    
    // 5. 加载入口模块
    const module = await import(`${pluginDir}/${manifest.entry}`);
    const PluginClass = module.default;
    
    // 6. 创建上下文
    const context = this.createContext(manifest);
    
    // 7. 实例化
    const instance = new PluginClass(context);
    
    // 8. 注册
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. 安装/激活
    // 5. Load entry module
    const module = await import(`${pluginDir}/${manifest.entry}`);
    const PluginClass = module.default;
    
    // 6. Create context
    const context = await this.createContext(manifest, pluginDir);
    
    // 7. Instantiate
    const instance = new PluginClass(context);
    
    // 8. Register
    const context = this.createContext(manifest);
    
    // 7. Instantiate plugin
    const instance = new PluginClass(context);
    
    // 8. Register plugin
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. Grant permissions
    if (this.permissionManager && manifest.permissions) {
      this.permissionManager.grant(manifest.id, manifest.permissions);
    }
    
    // 10. Install/activate
    if (this.permissionManager) {
      this.permissionManager.grant(manifest.id, manifest.permissions || []);
    }
    
    // 10. Install/Activate
    // 7. Instantiate
    const instance = new PluginClass(context);
    
    // 8. Register
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. Install/Activate
    const context = await this.createContext(manifest);
    
    // 7. Instantiate plugin
    const instance = new PluginClass(context);
    
    // 8. Register plugin
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. Handle installation
    const installed = await this.isInstalled(manifest.id);
    if (!installed) {
      await instance.onInstall();
      await this.markInstalled(manifest.id, manifest.version);
    } else {
      // Check version update
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        console.log(`Plugin ${manifest.id} updated: ${installedVersion} → ${manifest.version}`);
        await this.markInstalled(manifest.id, manifest.version);
      // 检查版本更新
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        // 可以触发迁移逻辑
      // Check version update
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        // Can trigger migration logic
        console.log(`Plugin ${manifest.id} updated: ${installedVersion} → ${manifest.version}`);
      }
    }
    
    await instance.onActivate();
    
    // 11. Setup settings listener
    if (instance.settings) {
      instance.settings.onChange((key, value, oldValue) => {
        instance.onSettingsChange(key, value, oldValue);
      });
    }
    
    // 12. Emit event
    // 10. Emit event
    // 10. 发送事件
    // 10. Emit event
      // Check for version update
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        console.log(`Plugin ${manifest.id} updated: ${installedVersion} → ${manifest.version}`);
        await this.markInstalled(manifest.id, manifest.version);
      }
    }
    
    // 10. Activate plugin
    await instance.onActivate();
    
    // 11. Emit event
    this.eventBus?.emit('plugin:loaded', { id: manifest.id, manifest });
    
    return instance;
  }
  
  /**
   * Unload a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   * Unload plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   * @param {string} pluginId
   * Unload a plugin
   * @param {string} pluginId - Plugin ID
   */
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    await instance.onDeactivate();
    
    // Remove style
    this.unloadStyle(pluginId);
    
    // Revoke permissions
    // 1. Deactivate
    await instance.onDeactivate();
    
    // 2. Unmount if mounted
    if (instance._mounted) {
      instance.unmount();
    }
    
    // 3. Remove styles
    this.unloadStyle(pluginId);
    
    // 4. Revoke permissions
    if (this.permissionManager) {
      this.permissionManager.revokeAll(pluginId);
    }
    
    // Remove registration
    // 5. Remove registration
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    // 6. Emit event
    await instance.onDeactivate();
    
    // Remove styles
    this.unloadStyle(pluginId);
    
    // Remove registration
    // 移除样式
    this.unloadStyle(pluginId);
    
    // 移除注册
    // Remove style
    this.unloadStyle(pluginId);
    
    // Remove registration
    // Remove styles
    this.unloadStyle(pluginId);
    
    // Unregister
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }
  
  /**
   * Load plugin manifest
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Manifest object
   * Load manifest file
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Manifest object
   * @private
   * Load manifest.json
   * @param {string} pluginDir
   * @returns {Promise<Object>}
   * Load plugin manifest
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Manifest
   */
  async loadManifest(pluginDir) {
    const response = await fetch(`${pluginDir}/manifest.json`);
    if (!response.ok) {
      throw new Error(`Failed to load manifest from ${pluginDir}`);
    }
    return await response.json();
  }
  
  /**
   * Validate plugin manifest
   * @param {Object} manifest - Manifest object
   * @throws {Error} If manifest is invalid
   * Validate manifest
   * @param {Object} manifest - Manifest object
   * @throws {Error} If manifest is invalid
   * @private
   * @param {Object} manifest
   * Validate plugin manifest
   * @param {Object} manifest - Manifest to validate
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'entry'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
      throw new Error(`Invalid plugin id: ${manifest.id}`);
    }
  }
  
  /**
   * Check plugin dependencies
   * @param {Object} manifest - Manifest object
   * @returns {Promise<void>}
   * @throws {Error} If dependencies not met
   * @private
   * @param {Object} manifest
  async checkDependencies(manifest) {
    const deps = manifest.dependencies || {};
    
    // 检查服务依赖
  /**
   * Check plugin dependencies
   * @param {Object} manifest - Plugin manifest
   */
  async checkDependencies(manifest) {
    const deps = manifest.dependencies || {};
    
    // Check service dependencies
    for (const serviceName of deps.services || []) {
      if (!this.services[serviceName]) {
        throw new Error(`Missing service dependency: ${serviceName}`);
      }
    }
    
    // Check plugin dependencies
    for (const pluginId of deps.plugins || []) {
      if (!this.instances.has(pluginId)) {
        // Try to load dependency plugin
    // 检查插件依赖
    for (const pluginId of deps.plugins || []) {
      if (!this.instances.has(pluginId)) {
        // 尝试加载依赖插件
    // Check plugin dependencies
    for (const pluginId of deps.plugins || []) {
      if (!this.instances.has(pluginId)) {
        // Try to load dependency plugin
        // Try to load dependency
        await this.load(pluginId);
      }
    }
  }
  
  /**
   * Create plugin context
   * @param {Object} manifest - Manifest object
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Plugin context
   */
  async createContext(manifest, pluginDir) {
   * @returns {Object} Plugin context
   * @private
   */
  createContext(manifest) {
   * @param {Object} manifest
   * @returns {Object}
   */
  createContext(manifest) {
  createContext(manifest) {
    // 根据权限过滤服务
  /**
   * Create plugin context
   * @param {Object} manifest - Plugin manifest
   * @returns {Promise<Object>} Context
   */
  async createContext(manifest) {
    // Filter services by permissions
    const allowedServices = this.filterServicesByPermissions(
      manifest.permissions || []
    );
    
    // Create i18n and load locales
    const i18n = new PluginI18n(manifest);
    await i18n.loadLocales(pluginDir);
    // Create storage
    const storage = new PluginStorage(manifest.id);
    await storage.init();
    
    // Create settings
    const settings = new PluginSettings(manifest);
    
    // Create i18n
    const i18n = new I18n();
    await i18n.init();
    
    return {
      manifest,
      services: allowedServices,
      eventBus: this.eventBus,
      storage: new PluginStorage(manifest.id),
      settings: new PluginSettings(manifest),
      i18n,
      i18n: new PluginI18n(manifest),
      ui: this.createUIHelper(),
      pluginLoader: this
      ui: this.createUIHelper()
    };
  }
  
  /**
   * Filter services by permissions
   * @param {string[]} permissions - Requested permissions
   * @returns {Object} Allowed services
   * @private
  filterServicesByPermissions(permissions) {
    const allowed = {};
    
    // 基础服务始终可用（不需要权限）
      storage,
      settings,
      i18n,
      router: this.router
    };
  }
  
  /**
   * Filter services by permissions
   * @param {string[]} permissions
   * @returns {Object}
   * @param {string[]} permissions - Required permissions
   * @returns {Object} Allowed services
   */
  filterServicesByPermissions(permissions) {
    const allowed = {};
    
    // Permission to service mapping
    // Base services always available
    const baseServices = ['NotificationService'];
    for (const name of baseServices) {
      if (this.services[name]) {
        allowed[name] = this.services[name];
      }
    }
    
    // Map permissions to services
    // 根据权限添加服务
    // Add services based on permissions
    // Permission-based services
    const permissionServiceMap = {
      'database:read': 'DatabaseService',
      'database:write': 'DatabaseService',
      'filesystem:read': 'FileSystemService',
      'filesystem:write': 'FileSystemService',
      'network:sync': 'CommunicationLayer',
      'search': 'SearchService',
      'notification': 'NotificationService'
      'search': 'SearchService'
    };
    
    for (const permission of permissions) {
      const serviceName = permissionServiceMap[permission];
      if (serviceName && this.services[serviceName]) {
        allowed[serviceName] = this.services[serviceName];
      }
    }
    
    return allowed;
  }
  
  /**
   * Load plugin style
   * @param {string} stylePath - Style file path
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   */
   * Load plugin stylesheet
   * @param {string} stylePath - Path to stylesheet
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   * @private
   * @param {string} stylePath
   * @param {string} pluginId
  async loadStyle(stylePath, pluginId) {
    const response = await fetch(stylePath);
    if (!response.ok) return;
    
    const css = await response.text();
    
    const style = document.createElement('style');
    style.id = `plugin-style-${pluginId}`;
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  /**
   * Unload plugin style
   * Load plugin styles
   * @param {string} stylePath - Path to CSS file
   * @param {string} pluginId - Plugin ID
   */
  async loadStyle(stylePath, pluginId) {
    try {
      const response = await fetch(stylePath);
      if (!response.ok) return;
      
      const css = await response.text();
      
      const style = document.createElement('style');
      style.id = `plugin-style-${pluginId}`;
      style.textContent = css;
      document.head.appendChild(style);
    } catch (error) {
      console.warn(`Failed to load plugin style: ${pluginId}`, error);
      console.warn(`Failed to load style for plugin ${pluginId}:`, error);
    }
  }
  
  /**
   * Unload plugin stylesheet
   * @param {string} pluginId - Plugin ID
   * @private
   * @param {string} pluginId
      console.warn(`Failed to load style for ${pluginId}:`, error);
    }
  }
  
  /**
   * Unload plugin styles
   * @param {string} pluginId - Plugin ID
   */
  unloadStyle(pluginId) {
    const style = document.getElementById(`plugin-style-${pluginId}`);
    if (style) {
      style.remove();
    }
  }
  
  /**
   * Check if plugin is installed
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Whether plugin is installed
   */
  async isInstalled(pluginId) {
    try {
      // Use localStorage for installation tracking
      const key = `plugin_install_${pluginId}`;
      const version = localStorage.getItem(key);
      
      if (version) {
        this.installedVersions.set(pluginId, version);
   * @returns {Promise<boolean>} True if installed
   * @private
   * @param {string} pluginId
   * @returns {Promise<boolean>}
   */
  async isInstalled(pluginId) {
    try {
      const db = this.services.DatabaseService;
      if (!db) {
        // Fallback to localStorage
        const installed = localStorage.getItem(`plugin_installed_${pluginId}`);
        if (installed) {
          this.installedVersions.set(pluginId, installed);
          return true;
        }
        return false;
      }
      
      const record = await db.queryOne(
      if (!db) return false;
      
      const record = await db.queryOne(
  /**
   * Check if plugin is installed
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Is installed
   */
  async isInstalled(pluginId) {
    if (!this.databaseService) return false;
    
    try {
      const record = await this.databaseService.queryOne(
        'SELECT version FROM plugin_installs WHERE plugin_id = ?',
        [pluginId]
      );
      
      if (record) {
        this.installedVersions.set(pluginId, record.version);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Mark plugin as installed
   * @param {string} pluginId - Plugin ID
   * @param {string} version - Plugin version
   * @returns {Promise<void>}
   */
  async markInstalled(pluginId, version) {
    try {
      const key = `plugin_install_${pluginId}`;
      localStorage.setItem(key, version);
   * @private
   * @param {string} pluginId
   * @param {string} version
   */
  async markInstalled(pluginId, version) {
    try {
      const db = this.services.DatabaseService;
      if (!db) {
        // Fallback to localStorage
        localStorage.setItem(`plugin_installed_${pluginId}`, version);
        this.installedVersions.set(pluginId, version);
        return;
      }
      if (!db) return;
      
      await db.run(
        `INSERT OR REPLACE INTO plugin_installs (plugin_id, version, installed_at)
         VALUES (?, ?, ?)`,
        [pluginId, version, Date.now()]
  /**
   * Mark plugin as installed
   * @param {string} pluginId - Plugin ID
   * @param {string} version - Plugin version
   */
  async markInstalled(pluginId, version) {
    if (!this.databaseService) return;
    
    try {
      await this.databaseService.run(
        `INSERT OR REPLACE INTO plugin_installs (plugin_id, version, installed_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [pluginId, version, Date.now(), Date.now()]
      );
      
      this.installedVersions.set(pluginId, version);
    } catch (error) {
      console.error('Failed to mark plugin installed:', error);
    }
  }
  
  /**
   * Create UI helper utilities
   * @returns {Object} UI helpers
   */
  createUIHelper() {
    return {
      showModal: (options) => window.app?.showModal?.(options),
      showToast: (message, type) => window.app?.showToast?.(message, type),
      showConfirm: (message) => window.app?.showConfirm?.(message),
      showPrompt: (message, defaultValue) => window.app?.showPrompt?.(message, defaultValue)
    };
  }
  
  // ========== Public API ==========
  
  /**
   * Get a plugin instance
   * @param {string} pluginId - Plugin ID
   * @returns {Object|undefined} Plugin instance
   * Create UI helper for plugins
   * @returns {Object} UI helper object
   * @private
   * Create UI helper
   * @returns {Object}
   */
  createUIHelper() {
    return {
      showModal: (options) => window.app?.showModal(options),
      showToast: (message, type) => window.app?.showToast(message, type),
      showConfirm: (message) => window.app?.showConfirm(message),
      showPrompt: (message, defaultValue) => window.app?.showPrompt(message, defaultValue)
    };
  }
  
  // ========== 公共 API ==========
  
  // ========== Public API ==========
  
  // ========== Public API ==========
  
  /**
   * Get plugin instance
   * @param {string} pluginId - Plugin ID
   * @returns {Plugin|undefined} Plugin instance
   * @param {string} pluginId
   * @returns {Plugin}
   * @param {string} pluginId - Plugin ID
   * @returns {Object} Plugin instance
   */
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  /**
   * Get all plugin instances
   * @returns {Object[]} Array of plugin instances
   * @returns {Plugin[]} Array of plugin instances
   * @returns {Plugin[]}
   * @returns {Object[]} Plugin instances
   */
  getAll() {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get a plugin manifest
   * @param {string} pluginId - Plugin ID
   * @returns {Object|undefined} Plugin manifest
   * Get plugin manifest
   * @param {string} pluginId - Plugin ID
   * @returns {Object|undefined} Plugin manifest
   * @param {string} pluginId
   * @returns {Object}
   * @param {string} pluginId - Plugin ID
   * @returns {Object} Plugin manifest
   */
  getManifest(pluginId) {
    return this.manifests.get(pluginId);
  }
  
  /**
   * Get all plugin manifests
   * @returns {Object[]} Array of plugin manifests
   * Get all manifests
   * @returns {Object[]}
   * Get all plugin manifests
   * @returns {Object[]} Plugin manifests
   */
  getAllManifests() {
    return Array.from(this.manifests.values());
  }
  
  /**
   * Call an exported plugin method
   * Call exported plugin method
   * @param {string} pluginId - Plugin ID
   * @param {string} method - Method name
   * @param {...*} args - Method arguments
   * @returns {Promise<*>} Method result
   * Call plugin exported method
   * @param {string} pluginId
   * @param {string} method
   * @param  {...any} args
   * Call plugin method
   * @param {string} pluginId - Plugin ID
   * @param {string} method - Method name
   * @param {...*} args - Method arguments
   * @returns {Promise<*>} Result
   */
  async call(pluginId, method, ...args) {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    const manifest = this.manifests.get(pluginId);
    const exports = manifest.exports || {};
    
    if (!exports[method]) {
      throw new Error(`Method not exported: ${pluginId}.${method}`);
    }
    
    const methodName = exports[method];
    if (typeof instance[methodName] !== 'function') {
      throw new Error(`Method not found: ${pluginId}.${methodName}`);
    }
    
    return instance[methodName](...args);
  }
}

export default PluginLoader;
  
  /**
   * Check if plugin is loaded
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} True if loaded
   */
  isLoaded(pluginId) {
    return this.instances.has(pluginId);
  }
  
  /**
   * Reload plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<Plugin>} Plugin instance
   */
  async reload(pluginId) {
    if (this.isLoaded(pluginId)) {
      await this.unload(pluginId);
    }
    return await this.load(pluginId);
  }
}

export default PluginLoader;
}

export default PluginLoader;
 * Discovers, loads, and initializes plugins
 */

import { PluginBase } from './plugin-base.js';
import { PluginContext } from './plugin-context.js';
import { PluginRegistry } from './plugin-registry.js';
import { PermissionManager } from './permission-manager.js';
import eventBus from './event-bus.js';

export class PluginLoader {
  constructor(app) {
    this.app = app;
    this.registry = new PluginRegistry();
    this.permissionManager = new PermissionManager();
    this.pluginPaths = ['./plugins']; // Base plugin directory
    this.loaded = false;
  }

  /**
   * Discover and load all plugins
   * @returns {Promise<Object>} Load result with success/error counts
   */
  async loadAll() {
    console.log('[PluginLoader] Starting plugin discovery...');

    const result = {
      total: 0,
      success: 0,
      failed: 0,
      plugins: []
    };

    try {
      // Get list of available plugins
      const pluginList = await this.discoverPlugins();
      result.total = pluginList.length;

      console.log(`[PluginLoader] Discovered ${pluginList.length} plugins`);

      // Load each plugin
      for (const pluginInfo of pluginList) {
        try {
          await this.loadPlugin(pluginInfo.id, pluginInfo.path);
          result.success++;
          result.plugins.push({ id: pluginInfo.id, status: 'success' });
        } catch (error) {
          console.error(`[PluginLoader] Failed to load plugin ${pluginInfo.id}:`, error);
          result.failed++;
          result.plugins.push({ id: pluginInfo.id, status: 'failed', error: error.message });
        }
      }

      this.loaded = true;
      console.log(`[PluginLoader] Load complete: ${result.success} success, ${result.failed} failed`);

      // Emit load complete event
      eventBus.emit('plugins:loaded', result);

    } catch (error) {
      console.error('[PluginLoader] Plugin discovery failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Discover available plugins
   * @returns {Promise<Array>} List of plugin info objects
   */
  async discoverPlugins() {
    // For browser environment, we need to have a registry of plugins
    // Since we can't scan directories in browser, we use a static list
    // Note: Use absolute paths from root
    const builtInPlugins = [
      { id: 'demo', path: '/plugins/demo' },
      { id: 'finder', path: '/plugins/finder' },
      { id: 'wiki', path: '/plugins/wiki' },
    ];

    // Filter to only plugins that exist
    const availablePlugins = [];
    for (const plugin of builtInPlugins) {
      try {
        // Try to fetch manifest to check if plugin exists
        const manifestPath = `${plugin.path}/manifest.json`;
        const response = await fetch(manifestPath);
        if (response.ok) {
          availablePlugins.push(plugin);
        }
      } catch (error) {
        // Plugin doesn't exist, skip
        console.debug(`[PluginLoader] Plugin ${plugin.id} not found at ${plugin.path}`);
      }
    }

    return availablePlugins;
  }

  /**
   * Load a single plugin
   * @param {string} id - Plugin ID
   * @param {string} path - Plugin path
   * @returns {Promise<Object>} Plugin instance
   */
  async loadPlugin(id, path) {
    console.log(`[PluginLoader] Loading plugin: ${id}`);

    // 1. Load manifest
    const manifest = await this.loadManifest(path);
    
    // Validate manifest
    this.validateManifest(manifest);

    // Check manifest ID matches
    if (manifest.id !== id) {
      throw new Error(`Manifest ID mismatch: expected ${id}, got ${manifest.id}`);
    }

    // 2. Register permissions
    this.permissionManager.register(id, manifest.permissions || []);

    // 3. Load plugin module
    const PluginClass = await this.loadModule(path, manifest.entry || './index.js');

    // 4. Register plugin
    this.registry.register(id, manifest, PluginClass);

    // 5. Create context and instance
    const context = new PluginContext(manifest, this.app, this.permissionManager);
    const instance = new PluginClass(context);

    // Store instance
    this.registry.setInstance(id, instance);

    // 6. Call install hook if first time
    const installKey = `plugin_${id}_installed`;
    if (!localStorage.getItem(installKey)) {
      await instance.onInstall();
      localStorage.setItem(installKey, 'true');
    }

    console.log(`[PluginLoader] Plugin ${id} loaded successfully`);
    
    return instance;
  }

  /**
   * Load plugin manifest.json
   * @param {string} path - Plugin path
   * @returns {Promise<Object>} Manifest object
   */
  async loadManifest(path) {
    const manifestPath = `${path}/manifest.json`;
    
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }
      
      const manifest = await response.json();
      return manifest;
    } catch (error) {
      throw new Error(`Failed to load manifest from ${manifestPath}: ${error.message}`);
    }
  }

  /**
   * Validate plugin manifest
   * @param {Object} manifest - Manifest object
   * @throws {Error} If manifest is invalid
   */
  validateManifest(manifest) {
    // Required fields
    const required = ['id', 'name', 'version', 'entry'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }

    // 验证 ID 格式
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      throw new Error('Plugin ID must contain only lowercase letters, numbers, and hyphens');
    }

    // 验证版本格式
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Plugin version must be in semver format (x.y.z)');
    }

    // 验证 name 是对象
    if (typeof manifest.name !== 'object') {
      throw new Error('Plugin name must be an object with language keys');
    }

    // 验证权限
    if (manifest.permissions && !Array.isArray(manifest.permissions)) {
      throw new Error('Permissions must be an array');
    }
  }

  /**
   * 检查应用版本兼容性
   * @param {Object} manifest
   */
  checkAppVersion(manifest) {
    // TODO: 实现版本检查
    // 需要从配置中获取当前应用版本
    if (manifest.minAppVersion || manifest.maxAppVersion) {
      console.debug(`Plugin "${manifest.id}" version constraints:`, {
        min: manifest.minAppVersion,
        max: manifest.maxAppVersion
      });
    }
  }

  /**
   * 检查依赖
   * @param {Object} manifest
   */
  async checkDependencies(manifest) {
    if (!manifest.dependencies) return;

    // 检查服务依赖
    if (manifest.dependencies.services) {
      for (const service of manifest.dependencies.services) {
        // TODO: 检查服务是否可用
        console.debug(`Plugin "${manifest.id}" requires service: ${service}`);
      }
    }

    // 检查插件依赖
    if (manifest.dependencies.plugins) {
      for (const pluginId of manifest.dependencies.plugins) {
        if (!this._loadedPlugins.has(pluginId)) {
          throw new Error(`Plugin "${manifest.id}" requires plugin "${pluginId}" to be loaded first`);
        }
      }
    }
  }

  /**
   * 加载插件模块
   * @param {string} pluginId - 插件ID
   * @param {string} entry - 入口文件路径
   * @returns {Promise<Object>}
   */
  async loadModule(pluginId, entry) {
    const moduleUrl = `${this._basePath}${pluginId}/${entry}`;
    
    try {
      // 使用动态导入
      const module = await import(moduleUrl);
      return module;
    } catch (error) {
      throw new Error(`Failed to load module for plugin "${pluginId}": ${error.message}`);
    }
  }

  /**
   * 验证插件模块
   * @param {Object} module
   */
  validateModule(module) {
    // 检查是否有默认导出或 Plugin 导出
    if (!module.default && !module.Plugin) {
      throw new Error('Plugin module must export a Plugin class as default or named export');
    }

    const PluginClass = module.default || module.Plugin;

    // 检查是否是类
    if (typeof PluginClass !== 'function') {
      throw new Error('Plugin export must be a class');
    }

    // 检查是否有 id 属性
    if (!PluginClass.id) {
      throw new Error('Plugin class must have a static id property');
    }
  }

  /**
   * 卸载插件
   * @param {string} pluginId
   */
  unload(pluginId) {
    this._loadedPlugins.delete(pluginId);
  }

  /**
   * 重新加载插件
   * @param {string} pluginId
   * @returns {Promise<Object>}
   */
  async reload(pluginId) {
    this.unload(pluginId);
    return this.load(pluginId);
  }

  /**
   * 获取已加载的插件
   * @param {string} pluginId
   * @returns {Object|null}
   */
  get(pluginId) {
    return this._loadedPlugins.get(pluginId) || null;
  }

  /**
   * 获取所有已加载插件ID
   * @returns {string[]}
   */
  getLoadedPluginIds() {
    return Array.from(this._loadedPlugins.keys());
  }

  /**
   * 检查插件是否已加载
   * @param {string} pluginId
   * @returns {boolean}
   */
  isLoaded(pluginId) {
    return this._loadedPlugins.has(pluginId);
  }

  /**
   * 清除所有已加载插件
   */
  clear() {
    this._loadedPlugins.clear();
  }

  /**
   * 比较版本
   * @param {string} version1
   * @param {string} version2
   * @returns {number} - -1: v1 < v2, 0: v1 == v2, 1: v1 > v2
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (v1Parts[i] > v2Parts[i]) return 1;
      if (v1Parts[i] < v2Parts[i]) return -1;
    }
    return 0;
  }

  /**
   * 检查版本是否满足要求
   * @param {string} version - 当前版本
   * @param {string} minVersion - 最小版本
   * @param {string} maxVersion - 最大版本
   * @returns {boolean}
   */
  checkVersionRange(version, minVersion = null, maxVersion = null) {
    if (minVersion && this.compareVersions(version, minVersion) < 0) {
      return false;
    }
    if (maxVersion && this.compareVersions(version, maxVersion) > 0) {
      return false;
    }
    return true;
    // Validate ID format (lowercase, alphanumeric, hyphens)
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      throw new Error(`Invalid plugin ID format: ${manifest.id}`);
    }

    // Validate version format (semver)
    if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(manifest.version)) {
      throw new Error(`Invalid version format: ${manifest.version}`);
    }

    // Validate permissions
    if (manifest.permissions) {
      for (const perm of manifest.permissions) {
        if (!this.permissionManager.validate(perm)) {
          throw new Error(`Invalid permission format: ${perm}`);
        }
      }
    }
  }

  /**
   * Load plugin module
   * @param {string} path - Plugin path
   * @param {string} entry - Entry file path
   * @returns {Promise<Function>} Plugin class
   */
  async loadModule(path, entry) {
    const modulePath = `${path}/${entry}`;
    
    try {
      const module = await import(modulePath);
      
      // Get default export or named Plugin export
      const PluginClass = module.default || module.Plugin;
      
      if (!PluginClass) {
        throw new Error('Plugin module must export a default class or named Plugin class');
      }

      // Validate plugin class extends PluginBase
      if (!(PluginClass.prototype instanceof PluginBase) && PluginClass !== PluginBase) {
        console.warn(`Plugin ${path} does not extend PluginBase, wrapping...`);
        // Allow it but warn
      }

      return PluginClass;
    } catch (error) {
      throw new Error(`Failed to load module ${modulePath}: ${error.message}`);
    }
  }

  /**
   * Activate a plugin
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} Success
   */
  async activatePlugin(id) {
    const instance = this.registry.getInstance(id);
    if (!instance) {
      throw new Error(`Plugin ${id} not loaded`);
    }

    if (instance.activated) {
      console.warn(`Plugin ${id} already activated`);
      return false;
    }

    try {
      await instance.onActivate();
      eventBus.emit('plugin:activated', id);
      return true;
    } catch (error) {
      console.error(`Failed to activate plugin ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate a plugin
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} Success
   */
  async deactivatePlugin(id) {
    const instance = this.registry.getInstance(id);
    if (!instance) {
      throw new Error(`Plugin ${id} not loaded`);
    }

    if (!instance.activated) {
      console.warn(`Plugin ${id} not activated`);
      return false;
    }

    try {
      await instance.onDeactivate();
      eventBus.emit('plugin:deactivated', id);
      return true;
    } catch (error) {
      console.error(`Failed to deactivate plugin ${id}:`, error);
      throw error;
    }
  }

  /**
   * Unload a plugin
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} Success
   */
  async unloadPlugin(id) {
    const instance = this.registry.getInstance(id);
    if (!instance) {
      return false;
    }

    try {
      // Deactivate if active
      if (instance.activated) {
        await this.deactivatePlugin(id);
      }

      // Call uninstall hook
      await instance.onUninstall();

      // Unregister
      this.registry.unregister(id);
      this.permissionManager.unregister(id);

      eventBus.emit('plugin:unloaded', id);
      return true;
    } catch (error) {
      console.error(`Failed to unload plugin ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin instance
   * @param {string} id - Plugin ID
   * @returns {Object|null} Plugin instance
   */
  getPlugin(id) {
    return this.registry.getInstance(id);
  }

  /**
   * Get all plugins
   * @returns {string[]} Array of plugin IDs
   */
  getAllPlugins() {
    return this.registry.getAll();
  }

  /**
   * Get plugin manifest
   * @param {string} id - Plugin ID
   * @returns {Object|null} Manifest
   */
  getManifest(id) {
    return this.registry.getManifest(id);
  }

  /**
   * Check if plugin is loaded
   * @param {string} id - Plugin ID
   * @returns {boolean} True if loaded
   */
  isLoaded(id) {
    return this.registry.has(id);
  }

  /**
   * Get load status
   * @returns {boolean} True if plugins have been loaded
   */
  isPluginsLoaded() {
    return this.loaded;
  }
}
