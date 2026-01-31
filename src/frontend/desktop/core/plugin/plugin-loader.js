/**
 * Plugin Loader
 * Discovers, loads, and manages plugins
 */

import { PluginStorage } from './plugin-storage.js';
import { PluginSettings } from './plugin-settings.js';
import { PluginI18n } from './plugin-i18n.js';

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || '/plugins';
    this.services = options.services || {};
    this.eventBus = options.eventBus;
    
    this.manifests = new Map();
    this.instances = new Map();
    this.installedVersions = new Map();
  }
  
  /**
   * Load all available plugins
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
   * @returns {Promise<string[]>}
   */
  async discoverPlugins() {
    // Try to load plugins list from config
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      const data = await response.json();
      return data.plugins || [];
    } catch {
      // Default plugin list
      return ['finder', 'wiki', 'chat', 'task'];
    }
  }
  
  /**
   * Load single plugin
   * @param {string} pluginId
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
    const context = this.createContext(manifest);
    
    // 7. Instantiate plugin
    const instance = new PluginClass(context);
    
    // 8. Register
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. Install/Activate
    const installed = await this.isInstalled(manifest.id);
    if (!installed) {
      await instance.onInstall();
      await this.markInstalled(manifest.id, manifest.version);
    } else {
      // Check version update
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        console.log(`Plugin ${manifest.id} updated: ${installedVersion} → ${manifest.version}`);
      }
    }
    
    await instance.onActivate();
    
    // 10. Emit event
    this.eventBus?.emit('plugin:loaded', { id: manifest.id, manifest });
    
    return instance;
  }
  
  /**
   * Unload plugin
   * @param {string} pluginId
   */
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    await instance.onDeactivate();
    
    // Remove styles
    this.unloadStyle(pluginId);
    
    // Remove registration
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }
  
  /**
   * Load manifest.json
   * @param {string} pluginDir
   * @returns {Promise<Object>}
   */
  async loadManifest(pluginDir) {
    const response = await fetch(`${pluginDir}/manifest.json`);
    if (!response.ok) {
      throw new Error(`Failed to load manifest from ${pluginDir}`);
    }
    return await response.json();
  }
  
  /**
   * Validate manifest
   * @param {Object} manifest
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
   * @param {Object} manifest
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
   * @param {Object} manifest
   * @returns {Object}
   */
  createContext(manifest) {
    // Filter services by permissions
    const allowedServices = this.filterServicesByPermissions(
      manifest.permissions || []
    );
    
    return {
      manifest,
      services: allowedServices,
      eventBus: this.eventBus,
      storage: new PluginStorage(manifest.id),
      settings: new PluginSettings(manifest),
      i18n: new PluginI18n(manifest),
      ui: this.createUIHelper(),
      pluginLoader: this
    };
  }
  
  /**
   * Filter services by permissions
   * @param {string[]} permissions
   * @returns {Object}
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
    
    // Map permissions to services
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
   * Load plugin stylesheet
   * @param {string} stylePath
   * @param {string} pluginId
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
      console.warn(`Failed to load style for plugin ${pluginId}:`, error);
    }
  }
  
  /**
   * Unload plugin stylesheet
   * @param {string} pluginId
   */
  unloadStyle(pluginId) {
    const style = document.getElementById(`plugin-style-${pluginId}`);
    if (style) {
      style.remove();
    }
  }
  
  /**
   * Check if plugin is installed
   * @param {string} pluginId
   * @returns {Promise<boolean>}
   */
  async isInstalled(pluginId) {
    try {
      const db = this.services.DatabaseService;
      if (!db) return false;
      
      const record = await db.queryOne(
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
   * @param {string} pluginId
   * @param {string} version
   */
  async markInstalled(pluginId, version) {
    try {
      const db = this.services.DatabaseService;
      if (!db) return;
      
      await db.run(
        `INSERT OR REPLACE INTO plugin_installs (plugin_id, version, installed_at)
         VALUES (?, ?, ?)`,
        [pluginId, version, Date.now()]
      );
      
      this.installedVersions.set(pluginId, version);
    } catch (error) {
      console.error('Failed to mark plugin installed:', error);
    }
  }
  
  /**
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
  
  // ========== Public API ==========
  
  /**
   * Get plugin instance
   * @param {string} pluginId
   * @returns {Plugin}
   */
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  /**
   * Get all plugin instances
   * @returns {Plugin[]}
   */
  getAll() {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get plugin manifest
   * @param {string} pluginId
   * @returns {Object}
   */
  getManifest(pluginId) {
    return this.manifests.get(pluginId);
  }
  
  /**
   * Get all manifests
   * @returns {Object[]}
   */
  getAllManifests() {
    return Array.from(this.manifests.values());
  }
  
  /**
   * Call plugin exported method
   * @param {string} pluginId
   * @param {string} method
   * @param  {...any} args
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
