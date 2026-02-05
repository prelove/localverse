/**
 * 插件管理器
 * 
 * 功能：
 * 1. 插件发现和注册
 * 2. 生命周期管理
 * 3. 协调各组件（loader, permissions, storage, eventBus）
 */

import { PluginLoader } from './plugin-loader.js';
import { PluginStorage } from './plugin-storage.js';
import { permissionManager } from './permission-manager.js';
import { eventBus } from './event-bus.js';

export class PluginManager {
  constructor(services = {}) {
    this.loader = new PluginLoader();
    this.services = services;
    this._plugins = new Map(); // pluginId -> pluginInstance
    this._registry = new Map(); // pluginId -> metadata
    this._i18n = null;
    this._authService = null;
  }

  /**
   * 初始化
   * @param {Object} options
   */
  async init(options = {}) {
    const { i18n, authService, pluginBasePath } = options;

    this._i18n = i18n;
    this._authService = authService;

    if (authService) {
      permissionManager.setAuthService(authService);
    }

    if (pluginBasePath) {
      this.loader.setBasePath(pluginBasePath);
    }

    // 发布初始化事件
    await eventBus.emit('plugin-manager:init', { manager: this });
  }

  /**
   * 注册插件（仅注册元数据，不加载代码）
   * @param {Object} metadata - 插件元数据
   */
  register(metadata) {
    const { id } = metadata;
    if (!id) {
      throw new Error('Plugin metadata must have an id');
    }

    this._registry.set(id, {
      ...metadata,
      state: 'registered', // registered | loaded | active | error
      installedAt: metadata.installedAt || Date.now(),
      enabled: metadata.enabled !== false
    });

    eventBus.emitSync('plugin:registered', { pluginId: id, metadata });
  }

  /**
   * 加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>} - 插件实例
   */
  async load(pluginId) {
    try {
      const metadata = this._registry.get(pluginId);
      if (!metadata) {
        throw new Error(`Plugin "${pluginId}" not registered`);
      }

      if (!metadata.enabled) {
        throw new Error(`Plugin "${pluginId}" is disabled`);
      }

      // 检查是否已加载
      if (this._plugins.has(pluginId)) {
        return this._plugins.get(pluginId);
      }

      // 更新状态
      metadata.state = 'loading';

      // 1. 加载插件代码
      const { module, manifest } = await this.loader.load(pluginId);

      // 2. 注册权限
      permissionManager.register(pluginId, manifest.permissions || []);

      // 3. 创建插件上下文
      const context = this._createContext(pluginId, manifest);

      // 4. 实例化插件
      const PluginClass = module.default || module.Plugin;
      const instance = new PluginClass(context);

      // 5. 保存实例
      this._plugins.set(pluginId, instance);

      // 6. 检查是否首次安装
      const isFirstInstall = !metadata.installedAt;
      if (isFirstInstall) {
        await instance.onInstall();
        metadata.installedAt = Date.now();
      }

      // 更新状态
      metadata.state = 'loaded';
      metadata.manifest = manifest;

      await eventBus.emit('plugin:loaded', { pluginId, instance, manifest });

      return instance;

    } catch (error) {
      const metadata = this._registry.get(pluginId);
      if (metadata) {
        metadata.state = 'error';
        metadata.error = error.message;
      }
      throw error;
    }
  }

  /**
   * 激活插件
   * @param {string} pluginId
   */
  async activate(pluginId) {
    try {
      const instance = this._plugins.get(pluginId);
      if (!instance) {
        await this.load(pluginId);
        return this.activate(pluginId);
      }

      if (instance.isActive()) {
        console.warn(`Plugin "${pluginId}" is already active`);
        return;
      }

      const metadata = this._registry.get(pluginId);
      metadata.state = 'activating';

      await instance.onActivate();
      instance.setState('active');

      metadata.state = 'active';
      metadata.activatedAt = Date.now();

      await eventBus.emit('plugin:activated', { pluginId, instance });

    } catch (error) {
      const metadata = this._registry.get(pluginId);
      if (metadata) {
        metadata.state = 'error';
        metadata.error = error.message;
      }
      throw error;
    }
  }

  /**
   * 停用插件
   * @param {string} pluginId
   */
  async deactivate(pluginId) {
    try {
      const instance = this._plugins.get(pluginId);
      if (!instance) {
        throw new Error(`Plugin "${pluginId}" not loaded`);
      }

      if (!instance.isActive()) {
        console.warn(`Plugin "${pluginId}" is not active`);
        return;
      }

      const metadata = this._registry.get(pluginId);
      metadata.state = 'deactivating';

      await instance.onDeactivate();
      await instance.cleanup();
      instance.setState('inactive');

      metadata.state = 'loaded';

      await eventBus.emit('plugin:deactivated', { pluginId, instance });

    } catch (error) {
      console.error(`Failed to deactivate plugin "${pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 卸载插件
   * @param {string} pluginId
   */
  async unload(pluginId) {
    try {
      const instance = this._plugins.get(pluginId);
      if (!instance) return;

      // 先停用
      if (instance.isActive()) {
        await this.deactivate(pluginId);
      }

      // 卸载
      await instance.onUninstall();
      await instance.cleanup();

      // 清理
      instance.storage.close();
      permissionManager.unregister(pluginId);
      this.loader.unload(pluginId);
      this._plugins.delete(pluginId);

      const metadata = this._registry.get(pluginId);
      if (metadata) {
        metadata.state = 'registered';
      }

      await eventBus.emit('plugin:unloaded', { pluginId });

    } catch (error) {
      console.error(`Failed to unload plugin "${pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 卸载插件（完全删除）
   * @param {string} pluginId
   */
  async uninstall(pluginId) {
    await this.unload(pluginId);
    this._registry.delete(pluginId);
    await eventBus.emit('plugin:uninstalled', { pluginId });
  }

  /**
   * 启用插件
   * @param {string} pluginId
   */
  async enable(pluginId) {
    const metadata = this._registry.get(pluginId);
    if (!metadata) {
      throw new Error(`Plugin "${pluginId}" not registered`);
    }

    metadata.enabled = true;
    await eventBus.emit('plugin:enabled', { pluginId });
  }

  /**
   * 禁用插件
   * @param {string} pluginId
   */
  async disable(pluginId) {
    // 先停用
    if (this._plugins.has(pluginId)) {
      const instance = this._plugins.get(pluginId);
      if (instance.isActive()) {
        await this.deactivate(pluginId);
      }
    }

    const metadata = this._registry.get(pluginId);
    if (metadata) {
      metadata.enabled = false;
    }

    await eventBus.emit('plugin:disabled', { pluginId });
  }

  /**
   * 获取插件实例
   * @param {string} pluginId
   * @returns {Object|null}
   */
  get(pluginId) {
    return this._plugins.get(pluginId) || null;
  }

  /**
   * 获取插件元数据
   * @param {string} pluginId
   * @returns {Object|null}
   */
  getMetadata(pluginId) {
    return this._registry.get(pluginId) || null;
  }

  /**
   * 获取所有已注册插件
   * @returns {Array}
   */
  getAll() {
    return Array.from(this._registry.entries()).map(([id, metadata]) => ({
      id,
      ...metadata,
      instance: this._plugins.get(id) || null
    }));
  }

  /**
   * 获取所有已激活插件
   * @returns {Array}
   */
  getActive() {
    return this.getAll().filter(p => p.state === 'active');
  }

  /**
   * 检查插件是否存在
   * @param {string} pluginId
   * @returns {boolean}
   */
  has(pluginId) {
    return this._registry.has(pluginId);
  }

  /**
   * 检查插件是否已加载
   * @param {string} pluginId
   * @returns {boolean}
   */
  isLoaded(pluginId) {
    return this._plugins.has(pluginId);
  }

  /**
   * 检查插件是否已激活
   * @param {string} pluginId
   * @returns {boolean}
   */
  isActive(pluginId) {
    const instance = this._plugins.get(pluginId);
    return instance ? instance.isActive() : false;
  }

  /**
   * 创建插件上下文
   * @private
   */
  _createContext(pluginId, manifest) {
    return {
      pluginId,
      manifest,
      services: this.services,
      eventBus,
      storage: new PluginStorage(pluginId),
      settings: this._createSettings(pluginId, manifest.settings || {}),
      i18n: this._i18n || { t: (key) => key },
      permissionManager
    };
  }

  /**
   * 创建设置管理器
   * @private
   */
  _createSettings(pluginId, defaultSettings) {
    const storage = new PluginStorage(pluginId);
    const SETTINGS_KEY = '_settings';

    return {
      get: async (key, defaultValue = null) => {
        const settings = await storage.get(SETTINGS_KEY, {});
        if (key in settings) {
          return settings[key];
        }
        if (key in defaultSettings) {
          return defaultSettings[key].default;
        }
        return defaultValue;
      },

      set: async (key, value) => {
        const settings = await storage.get(SETTINGS_KEY, {});
        const oldValue = settings[key];
        settings[key] = value;
        await storage.set(SETTINGS_KEY, settings);

        // 通知插件设置变更
        const instance = this._plugins.get(pluginId);
        if (instance) {
          await instance.onSettingsChange(key, value, oldValue);
        }
      },

      getAll: async () => {
        return await storage.get(SETTINGS_KEY, {});
      },

      reset: async () => {
        await storage.set(SETTINGS_KEY, {});
      }
    };
  }

  /**
   * 批量加载插件
   * @param {string[]} pluginIds
   */
  async loadAll(pluginIds) {
    const results = [];
    for (const id of pluginIds) {
      try {
        await this.load(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 批量激活插件
   * @param {string[]} pluginIds
   */
  async activateAll(pluginIds) {
    const results = [];
    for (const id of pluginIds) {
      try {
        await this.activate(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 清理所有插件
   */
  async cleanup() {
    const activePlugins = this.getActive();
    for (const plugin of activePlugins) {
      try {
        await this.deactivate(plugin.id);
      } catch (error) {
        console.error(`Failed to deactivate plugin "${plugin.id}":`, error);
      }
    }
  }
}
