/**
 * Plugin Loader
 * Manages plugin discovery, loading, and lifecycle
 */

import { PluginStorage } from './plugin-storage.js';
import { PluginSettings } from './plugin-settings.js';
import { PluginI18n } from './plugin-i18n.js';

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || '/plugins';
    this.services = options.services || {};
    this.eventBus = options.eventBus;
    this.permissionManager = options.permissionManager;
    
    this.manifests = new Map();
    this.instances = new Map();
    this.installedVersions = new Map();
  }
  
  /**
   * Load all plugins
   * @returns {Promise<void>}
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
  }
  
  /**
   * Load single plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<Plugin>} Plugin instance
   */
  async load(pluginId) {
    const pluginDir = `${this.pluginsDir}/${pluginId}`;
    
    // 1. Load manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. Validate manifest
    this.validateManifest(manifest);
    
    // 3. Check dependencies
    await this.checkDependencies(manifest);
    
    // 4. Load styles (if any)
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
    
    // 8. Register plugin
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. Grant permissions
    if (this.permissionManager) {
      this.permissionManager.grant(manifest.id, manifest.permissions || []);
    }
    
    // 10. Install/Activate
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
    this.eventBus?.emit('plugin:loaded', { id: manifest.id, manifest });
    
    return instance;
  }
  
  /**
   * Unload plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   */
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
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
    
    // 5. Remove registration
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    // 6. Emit event
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }
  
  /**
   * Load manifest file
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Manifest object
   * @private
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
   * @param {Object} manifest - Manifest object
   * @throws {Error} If manifest is invalid
   * @private
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
        await this.load(pluginId);
      }
    }
  }
  
  /**
   * Create plugin context
   * @param {Object} manifest - Manifest object
   * @returns {Object} Plugin context
   * @private
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
      ui: this.createUIHelper()
    };
  }
  
  /**
   * Filter services by permissions
   * @param {string[]} permissions - Requested permissions
   * @returns {Object} Allowed services
   * @private
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
   * Load plugin stylesheet
   * @param {string} stylePath - Path to stylesheet
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   * @private
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
    }
  }
  
  /**
   * Unload plugin stylesheet
   * @param {string} pluginId - Plugin ID
   * @private
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
   * @returns {Promise<boolean>} True if installed
   * @private
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
   * @private
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
   * Create UI helper for plugins
   * @returns {Object} UI helper object
   * @private
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
   * @param {string} pluginId - Plugin ID
   * @returns {Plugin|undefined} Plugin instance
   */
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  /**
   * Get all plugin instances
   * @returns {Plugin[]} Array of plugin instances
   */
  getAll() {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get plugin manifest
   * @param {string} pluginId - Plugin ID
   * @returns {Object|undefined} Plugin manifest
   */
  getManifest(pluginId) {
    return this.manifests.get(pluginId);
  }
  
  /**
   * Get all plugin manifests
   * @returns {Object[]} Array of plugin manifests
   */
  getAllManifests() {
    return Array.from(this.manifests.values());
  }
  
  /**
   * Call exported plugin method
   * @param {string} pluginId - Plugin ID
   * @param {string} method - Method name
   * @param {...*} args - Method arguments
   * @returns {Promise<*>} Method result
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
