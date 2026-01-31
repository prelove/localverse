/**
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
