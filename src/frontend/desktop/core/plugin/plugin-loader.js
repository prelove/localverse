/**
 * PluginLoader - Loads and manages plugins
 * Handles discovery, validation, loading, and lifecycle
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
   * Load all available plugins
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
   */
  async discoverPlugins() {
    // Try to load plugins.json
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      const data = await response.json();
      return data.plugins || [];
    } catch {
      // Return empty array if no plugins.json found
      return [];
    }
  }
  
  /**
   * Load a specific plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<Object>} Plugin instance
   */
  async load(pluginId) {
    const pluginDir = `${this.pluginsDir}/${pluginId}`;
    
    // 1. Read manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. Validate
    this.validateManifest(manifest);
    
    // 3. Check dependencies
    await this.checkDependencies(manifest);
    
    // 4. Load style
    if (manifest.style) {
      await this.loadStyle(`${pluginDir}/${manifest.style}`, manifest.id);
    }
    
    // 5. Load entry module
    const module = await import(`${pluginDir}/${manifest.entry}`);
    const PluginClass = module.default;
    
    // 6. Create context
    const context = await this.createContext(manifest, pluginDir);
    
    // 7. Instantiate
    const instance = new PluginClass(context);
    
    // 8. Register
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. Grant permissions
    if (this.permissionManager && manifest.permissions) {
      this.permissionManager.grant(manifest.id, manifest.permissions);
    }
    
    // 10. Install/activate
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
    
    // 11. Emit event
    this.eventBus?.emit('plugin:loaded', { id: manifest.id, manifest });
    
    return instance;
  }
  
  /**
   * Unload a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<void>}
   */
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    await instance.onDeactivate();
    
    // Remove style
    this.unloadStyle(pluginId);
    
    // Revoke permissions
    if (this.permissionManager) {
      this.permissionManager.revokeAll(pluginId);
    }
    
    // Remove registration
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }
  
  /**
   * Load plugin manifest
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Manifest object
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
   * @param {string} pluginDir - Plugin directory
   * @returns {Promise<Object>} Plugin context
   */
  async createContext(manifest, pluginDir) {
    // Filter services by permissions
    const allowedServices = this.filterServicesByPermissions(
      manifest.permissions || []
    );
    
    // Create i18n and load locales
    const i18n = new PluginI18n(manifest);
    await i18n.loadLocales(pluginDir);
    
    return {
      manifest,
      services: allowedServices,
      eventBus: this.eventBus,
      storage: new PluginStorage(manifest.id),
      settings: new PluginSettings(manifest),
      i18n,
      ui: this.createUIHelper()
    };
  }
  
  /**
   * Filter services by permissions
   * @param {string[]} permissions - Requested permissions
   * @returns {Object} Allowed services
   */
  filterServicesByPermissions(permissions) {
    const allowed = {};
    
    // Permission to service mapping
    const permissionServiceMap = {
      'database:read': 'DatabaseService',
      'database:write': 'DatabaseService',
      'filesystem:read': 'FileSystemService',
      'filesystem:write': 'FileSystemService',
      'network:sync': 'CommunicationLayer',
      'search': 'SearchService',
      'notification': 'NotificationService'
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
   */
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  /**
   * Get all plugin instances
   * @returns {Object[]} Array of plugin instances
   */
  getAll() {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get a plugin manifest
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
   * Call an exported plugin method
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
}

export default PluginLoader;
