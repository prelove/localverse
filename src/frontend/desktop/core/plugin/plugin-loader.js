/**
 * 插件加载器
 * 
 * 功能：
 * 1. 加载插件模块
 * 2. 解析和验证 manifest
 * 3. 依赖检查
 * 4. 动态导入
 */

export class PluginLoader {
  constructor() {
    this._loadedPlugins = new Map(); // pluginId -> { module, manifest, instance }
    this._basePath = './plugins/';
  }

  /**
   * 设置插件基础路径
   * @param {string} path - 路径
   */
  setBasePath(path) {
    this._basePath = path.endsWith('/') ? path : `${path}/`;
  }

  /**
   * 加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>} - { module, manifest, instance }
   */
  async load(pluginId) {
    // 检查是否已加载
    if (this._loadedPlugins.has(pluginId)) {
      return this._loadedPlugins.get(pluginId);
    }

    try {
      // 1. 加载 manifest
      const manifest = await this.loadManifest(pluginId);

      // 2. 验证 manifest
      this.validateManifest(manifest);

      // 3. 检查应用版本兼容性
      this.checkAppVersion(manifest);

      // 4. 检查依赖
      await this.checkDependencies(manifest);

      // 5. 加载插件模块
      const module = await this.loadModule(pluginId, manifest.entry);

      // 6. 验证插件类
      this.validateModule(module);

      const pluginData = {
        module,
        manifest,
        instance: null // 稍后由 PluginManager 创建实例
      };

      this._loadedPlugins.set(pluginId, pluginData);
      return pluginData;

    } catch (error) {
      console.error(`Failed to load plugin "${pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 加载 manifest.json
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>}
   */
  async loadManifest(pluginId) {
    const manifestUrl = `${this._basePath}${pluginId}/manifest.json`;
    
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load manifest for plugin "${pluginId}": ${error.message}`);
    }
  }

  /**
   * 验证 manifest 结构
   * @param {Object} manifest
   * @throws {Error}
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'entry'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }

    // 验证 ID 格式
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      throw new Error('Plugin ID must contain only lowercase letters, numbers, and hyphens');
    }

    // 验证版本格式
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Plugin version must be in semver format (x.y.z)');
    }

    // 验证 name 是对象
    if (typeof manifest.name !== 'object') {
      throw new Error('Plugin name must be an object with language keys');
    }

    // 验证权限
    if (manifest.permissions && !Array.isArray(manifest.permissions)) {
      throw new Error('Permissions must be an array');
    }
  }

  /**
   * 检查应用版本兼容性
   * @param {Object} manifest
   */
  checkAppVersion(manifest) {
    // TODO: 实现版本检查
    // 需要从配置中获取当前应用版本
    if (manifest.minAppVersion || manifest.maxAppVersion) {
      console.debug(`Plugin "${manifest.id}" version constraints:`, {
        min: manifest.minAppVersion,
        max: manifest.maxAppVersion
      });
    }
  }

  /**
   * 检查依赖
   * @param {Object} manifest
   */
  async checkDependencies(manifest) {
    if (!manifest.dependencies) return;

    // 检查服务依赖
    if (manifest.dependencies.services) {
      for (const service of manifest.dependencies.services) {
        // TODO: 检查服务是否可用
        console.debug(`Plugin "${manifest.id}" requires service: ${service}`);
      }
    }

    // 检查插件依赖
    if (manifest.dependencies.plugins) {
      for (const pluginId of manifest.dependencies.plugins) {
        if (!this._loadedPlugins.has(pluginId)) {
          throw new Error(`Plugin "${manifest.id}" requires plugin "${pluginId}" to be loaded first`);
        }
      }
    }
  }

  /**
   * 加载插件模块
   * @param {string} pluginId - 插件ID
   * @param {string} entry - 入口文件路径
   * @returns {Promise<Object>}
   */
  async loadModule(pluginId, entry) {
    const moduleUrl = `${this._basePath}${pluginId}/${entry}`;
    
    try {
      // 使用动态导入
      const module = await import(moduleUrl);
      return module;
    } catch (error) {
      throw new Error(`Failed to load module for plugin "${pluginId}": ${error.message}`);
    }
  }

  /**
   * 验证插件模块
   * @param {Object} module
   */
  validateModule(module) {
    // 检查是否有默认导出或 Plugin 导出
    if (!module.default && !module.Plugin) {
      throw new Error('Plugin module must export a Plugin class as default or named export');
    }

    const PluginClass = module.default || module.Plugin;

    // 检查是否是类
    if (typeof PluginClass !== 'function') {
      throw new Error('Plugin export must be a class');
    }

    // 检查是否有 id 属性
    if (!PluginClass.id) {
      throw new Error('Plugin class must have a static id property');
    }
  }

  /**
   * 卸载插件
   * @param {string} pluginId
   */
  unload(pluginId) {
    this._loadedPlugins.delete(pluginId);
  }

  /**
   * 重新加载插件
   * @param {string} pluginId
   * @returns {Promise<Object>}
   */
  async reload(pluginId) {
    this.unload(pluginId);
    return this.load(pluginId);
  }

  /**
   * 获取已加载的插件
   * @param {string} pluginId
   * @returns {Object|null}
   */
  get(pluginId) {
    return this._loadedPlugins.get(pluginId) || null;
  }

  /**
   * 获取所有已加载插件ID
   * @returns {string[]}
   */
  getLoadedPluginIds() {
    return Array.from(this._loadedPlugins.keys());
  }

  /**
   * 检查插件是否已加载
   * @param {string} pluginId
   * @returns {boolean}
   */
  isLoaded(pluginId) {
    return this._loadedPlugins.has(pluginId);
  }

  /**
   * 清除所有已加载插件
   */
  clear() {
    this._loadedPlugins.clear();
  }

  /**
   * 比较版本
   * @param {string} version1
   * @param {string} version2
   * @returns {number} - -1: v1 < v2, 0: v1 == v2, 1: v1 > v2
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (v1Parts[i] > v2Parts[i]) return 1;
      if (v1Parts[i] < v2Parts[i]) return -1;
    }
    return 0;
  }

  /**
   * 检查版本是否满足要求
   * @param {string} version - 当前版本
   * @param {string} minVersion - 最小版本
   * @param {string} maxVersion - 最大版本
   * @returns {boolean}
   */
  checkVersionRange(version, minVersion = null, maxVersion = null) {
    if (minVersion && this.compareVersions(version, minVersion) < 0) {
      return false;
    }
    if (maxVersion && this.compareVersions(version, maxVersion) > 0) {
      return false;
    }
    return true;
  }
}
