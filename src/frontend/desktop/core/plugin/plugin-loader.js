/**
 * Plugin Loader
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
    const builtInPlugins = [
      { id: 'demo', path: './plugins/demo' },
      { id: 'finder', path: './plugins/finder' },
      { id: 'wiki', path: './plugins/wiki' },
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

    // Validate ID format (lowercase, alphanumeric, hyphens)
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      throw new Error(`Invalid plugin ID format: ${manifest.id}`);
    }

    // Validate version format (semver)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
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
