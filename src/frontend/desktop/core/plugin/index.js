/**
 * Plugin System - Main Entry Point
 * 插件系统主入口
 * 插件系统 - 主入口
 * 
 * 导出所有插件系统组件
 */

export { PluginManager } from './plugin-manager.js';
export { PluginBase } from './plugin-base.js';
export { PluginLoader } from './plugin-loader.js';
export { PluginStorage } from './plugin-storage.js';
export { EventBus, eventBus } from './event-bus.js';
export { PermissionManager, permissionManager, PERMISSIONS } from './permission-manager.js';

// 默认导出插件管理器
export { PluginManager as default } from './plugin-manager.js';
 * Plugin System
 * 
 * Main entry point for the Localverse plugin system.
 * Exports all public plugin APIs.
 * Plugin System Main Entry
 * Exports all plugin system components
 */

export { Plugin } from './plugin-base.js';
export { PluginLoader } from './plugin-loader.js';
export { EventBus } from './event-bus.js';
export { PluginStorage } from './plugin-storage.js';
export { PluginSettings } from './plugin-settings.js';
export { PluginI18n } from './plugin-i18n.js';
export { PermissionManager } from './permission-manager.js';
 * Plugin System Main Export
 */

export { EventBus } from './event-bus.js';
export { PluginBase } from './plugin-base.js';
export { PluginContext } from './plugin-context.js';
export { PluginLoader } from './plugin-loader.js';
export { PluginRegistry } from './plugin-registry.js';
export { PermissionManager } from './permission-manager.js';

// Export default event bus instance
export { default as eventBus } from './event-bus.js';
