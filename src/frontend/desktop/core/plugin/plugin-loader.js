/**
 * PluginLoader - Loads and manages plugins
 * Handles discovery, validation, loading, and lifecycle
 */

import { PluginContext } from './plugin-context.js';
import { PluginI18n } from './plugin-i18n.js';
import { embeddedManifests, embeddedPluginIds } from './embedded-plugin-data.js';
import { embeddedPluginModules } from './embedded-plugin-modules.js';

export class PluginLoader {
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

export default PluginLoader;
