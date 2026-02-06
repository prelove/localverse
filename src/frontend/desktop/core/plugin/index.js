/**
 * Plugin System - Main exports
 * Localverse Plugin Framework
 */

import { PluginBase } from './plugin-base.js';
import { PluginLoader } from './plugin-loader.js';
import { PluginStorage } from './plugin-storage.js';
import { EventBus, eventBus } from './event-bus.js';
import { PermissionManager, permissionManager, PERMISSIONS } from './permission-manager.js';
import { PluginContext } from './plugin-context.js';
import { PluginRegistry } from './plugin-registry.js';
import { PluginSettings } from './plugin-settings.js';
import { PluginI18n } from './plugin-i18n.js';

export {
  PluginBase,
  PluginLoader,
  PluginStorage,
  EventBus,
  eventBus,
  PermissionManager,
  permissionManager,
  PERMISSIONS,
  PluginContext,
  PluginRegistry,
  PluginSettings,
  PluginI18n
};

// Default export
export default PluginLoader;
