/**
 * Plugin Registry
 * Manages registered plugins and their lifecycle
 */

export class PluginRegistry {
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
