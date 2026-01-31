/**
 * Plugin Loader
 * Manages plugin discovery, loading, and lifecycle
 */

import { PluginStorage } from './plugin-storage.js';
import { PluginSettings } from './plugin-settings.js';
import { I18n } from '../i18n.js';

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || '/plugins';
    this.services = options.services || {};
    this.eventBus = options.eventBus;
    this.router = options.router;
    this.databaseService = options.databaseService;
    
    this.manifests = new Map();
    this.instances = new Map();
    this.installedVersions = new Map();
    
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
   * @returns {Promise<string[]>} Plugin IDs
   */
  async discoverPlugins() {
    // Try to fetch plugins list from server
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      const data = await response.json();
      return data.plugins || [];
    } catch {
      // Return default plugins
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
    
    // 1. Load manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. Validate manifest
    this.validateManifest(manifest);
    
    // 3. Check dependencies
    await this.checkDependencies(manifest);
    
    // 4. Load styles
    if (manifest.style) {
      await this.loadStyle(`${pluginDir}/${manifest.style}`, manifest.id);
    }
    
    // 5. Load entry module
    const module = await import(`${pluginDir}/${manifest.entry}`);
    const PluginClass = module.default;
    
    // 6. Create context
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
   */
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    await instance.onDeactivate();
    
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
        // Try to load dependency
        await this.load(pluginId);
      }
    }
  }
  
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
      storage,
      settings,
      i18n,
      router: this.router
    };
  }
  
  /**
   * Filter services by permissions
   * @param {string[]} permissions - Required permissions
   * @returns {Object} Allowed services
   */
  filterServicesByPermissions(permissions) {
    const allowed = {};
    
    // Base services always available
    const baseServices = ['NotificationService'];
    for (const name of baseServices) {
      if (this.services[name]) {
        allowed[name] = this.services[name];
      }
    }
    
    // Permission-based services
    const permissionServiceMap = {
      'database:read': 'DatabaseService',
      'database:write': 'DatabaseService',
      'filesystem:read': 'FileSystemService',
      'filesystem:write': 'FileSystemService',
      'network:sync': 'CommunicationLayer',
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
  
  // ========== Public API ==========
  
  /**
   * Get plugin instance
   * @param {string} pluginId - Plugin ID
   * @returns {Object} Plugin instance
   */
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  /**
   * Get all plugin instances
   * @returns {Object[]} Plugin instances
   */
  getAll() {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get plugin manifest
   * @param {string} pluginId - Plugin ID
   * @returns {Object} Plugin manifest
   */
  getManifest(pluginId) {
    return this.manifests.get(pluginId);
  }
  
  /**
   * Get all plugin manifests
   * @returns {Object[]} Plugin manifests
   */
  getAllManifests() {
    return Array.from(this.manifests.values());
  }
  
  /**
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
