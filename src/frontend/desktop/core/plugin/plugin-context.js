/**
 * Plugin Context
 * Provides isolated context and APIs for each plugin
 */

export class PluginContext {
  constructor(manifest, app, permissionManager) {
    this.manifest = manifest;
    this.app = app;
    this.permissionManager = permissionManager;
    
    // Create isolated storage for this plugin
    this._storage = this._createStorage();
    this._settings = this._createSettings();
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
    return this.app.eventBus;
  }

  /**
   * Get i18n service
   */
  get i18n() {
    return this.app.i18n;
  }

  /**
   * Get router
   */
  get router() {
    return this.app.router;
  }

  /**
   * Get state store
   */
  get store() {
    return this.app.store;
  }

  /**
   * Get theme manager
   */
  get theme() {
    return this.app.theme;
  }

  /**
   * Get available services (based on permissions)
   */
  get services() {
    const services = {};
    
    // Only expose services that plugin has permission to use
    if (this.hasPermission('database:read') || this.hasPermission('database:write')) {
      services.database = this.app.services.database;
    }
    
    if (this.hasPermission('filesystem:read') || this.hasPermission('filesystem:write')) {
      services.filesystem = this.app.services.filesystem;
    }
    
    if (this.hasPermission('search')) {
      services.search = this.app.services.search;
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
    return this.permissionManager.check(this.manifest.id, permission, this._permissions);
  }

  /**
   * Create isolated storage for plugin
   * @private
   */
  _createStorage() {
    const prefix = `plugin_${this.manifest.id}_`;
    
    return {
      get: (key, defaultValue = null) => {
        try {
          const value = localStorage.getItem(prefix + key);
          return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
          console.error(`Storage get error for ${key}:`, error);
          return defaultValue;
        }
      },

      set: (key, value) => {
        try {
          localStorage.setItem(prefix + key, JSON.stringify(value));
          return true;
        } catch (error) {
          console.error(`Storage set error for ${key}:`, error);
          return false;
        }
      },

      remove: (key) => {
        try {
          localStorage.removeItem(prefix + key);
          return true;
        } catch (error) {
          console.error(`Storage remove error for ${key}:`, error);
          return false;
        }
      },

      clear: () => {
        try {
          // Remove all keys for this plugin
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (key.startsWith(prefix)) {
              localStorage.removeItem(key);
            }
          }
          return true;
        } catch (error) {
          console.error('Storage clear error:', error);
          return false;
        }
      },

      keys: () => {
        try {
          const keys = Object.keys(localStorage);
          return keys
            .filter(key => key.startsWith(prefix))
            .map(key => key.substring(prefix.length));
        } catch (error) {
          console.error('Storage keys error:', error);
          return [];
        }
      }
    };
  }

  /**
   * Create settings API for plugin
   * @private
   */
  _createSettings() {
    const settingsKey = 'settings';
    const defaultSettings = {};

    // Initialize default settings from manifest
    if (this.manifest.settings) {
      for (const [key, config] of Object.entries(this.manifest.settings)) {
        defaultSettings[key] = config.default;
      }
    }

    return {
      get: (key, defaultValue) => {
        const settings = this._storage.get(settingsKey, defaultSettings);
        return key ? (settings[key] ?? defaultValue ?? defaultSettings[key]) : settings;
      },

      set: (key, value) => {
        const settings = this._storage.get(settingsKey, defaultSettings);
        settings[key] = value;
        return this._storage.set(settingsKey, settings);
      },

      reset: (key) => {
        if (key) {
          return this.set(key, defaultSettings[key]);
        } else {
          return this._storage.set(settingsKey, defaultSettings);
        }
      },

      getAll: () => {
        return this._storage.get(settingsKey, defaultSettings);
      },

      setAll: (settings) => {
        return this._storage.set(settingsKey, { ...defaultSettings, ...settings });
      }
    };
  }
}
