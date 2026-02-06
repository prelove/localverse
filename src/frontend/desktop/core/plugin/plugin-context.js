/**
 * Plugin Context
 * Provides isolated context and APIs for each plugin
 */

import { PluginStorage } from './plugin-storage.js';
import { PluginSettings } from './plugin-settings.js';

export class PluginContext {
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
