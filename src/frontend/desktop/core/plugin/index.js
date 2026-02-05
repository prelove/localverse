/**
 * Plugin System - Main exports
 * Localverse Plugin Framework
 */

export { PluginManager } from './plugin-manager.js';
export { PluginBase } from './plugin-base.js';
export { PluginLoader } from './plugin-loader.js';
export { PluginStorage } from './plugin-storage.js';
export { EventBus, eventBus } from './event-bus.js';
export { PermissionManager, permissionManager, PERMISSIONS } from './permission-manager.js';
export { PluginContext } from './plugin-context.js';
export { PluginRegistry } from './plugin-registry.js';
export { PluginSettings } from './plugin-settings.js';
export { PluginI18n } from './plugin-i18n.js';

// Default export
export { PluginManager as default } from './plugin-manager.js';
