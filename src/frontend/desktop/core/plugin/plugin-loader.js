/**
 * Plugin Loader
 * 插件加载器 - 管理插件的完整生命周期
 */

import { PluginStorage } from './plugin-storage.js';
import { PluginSettings } from './plugin-settings.js';
import { PluginI18n } from './plugin-i18n.js';

export class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || '/plugins';
    this.services = options.services || {};
    this.eventBus = options.eventBus;
    
    this.manifests = new Map();
    this.instances = new Map();
    this.installedVersions = new Map();
  }
  
  async loadAll() {
    const pluginIds = await this.discoverPlugins();
    
    for (const id of pluginIds) {
      try {
        await this.load(id);
      } catch (error) {
        console.error(`Failed to load plugin: ${id}`, error);
      }
    }
  }
  
  async discoverPlugins() {
    // 从配置或目录获取插件列表
    // 这里假设有一个 plugins.json 文件
    try {
      const response = await fetch(`${this.pluginsDir}/plugins.json`);
      const data = await response.json();
      return data.plugins || [];
    } catch {
      // 默认插件列表（暂时为空，后续添加内置插件）
      return [];
    }
  }
  
  async load(pluginId) {
    const pluginDir = `${this.pluginsDir}/${pluginId}`;
    
    // 1. 读取 manifest
    const manifest = await this.loadManifest(pluginDir);
    
    // 2. 验证
    this.validateManifest(manifest);
    
    // 3. 检查依赖
    await this.checkDependencies(manifest);
    
    // 4. 加载样式
    if (manifest.style) {
      await this.loadStyle(`${pluginDir}/${manifest.style}`, manifest.id);
    }
    
    // 5. 加载入口模块
    const module = await import(`${pluginDir}/${manifest.entry}`);
    const PluginClass = module.default;
    
    // 6. 创建上下文
    const context = this.createContext(manifest);
    
    // 7. 实例化
    const instance = new PluginClass(context);
    
    // 8. 注册
    this.manifests.set(manifest.id, manifest);
    this.instances.set(manifest.id, instance);
    
    // 9. 安装/激活
    const installed = await this.isInstalled(manifest.id);
    if (!installed) {
      await instance.onInstall();
      await this.markInstalled(manifest.id, manifest.version);
    } else {
      // 检查版本更新
      const installedVersion = this.installedVersions.get(manifest.id);
      if (installedVersion !== manifest.version) {
        // 可以触发迁移逻辑
        console.log(`Plugin ${manifest.id} updated: ${installedVersion} → ${manifest.version}`);
      }
    }
    
    await instance.onActivate();
    
    // 10. 发送事件
    this.eventBus?.emit('plugin:loaded', { id: manifest.id, manifest });
    
    return instance;
  }
  
  async unload(pluginId) {
    const instance = this.instances.get(pluginId);
    if (!instance) return;
    
    await instance.onDeactivate();
    
    // 移除样式
    this.unloadStyle(pluginId);
    
    // 移除注册
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    
    this.eventBus?.emit('plugin:unloaded', { id: pluginId });
  }
  
  async loadManifest(pluginDir) {
    const response = await fetch(`${pluginDir}/manifest.json`);
    if (!response.ok) {
      throw new Error(`Failed to load manifest from ${pluginDir}`);
    }
    return await response.json();
  }
  
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'entry'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
      throw new Error(`Invalid plugin id: ${manifest.id}`);
    }
  }
  
  async checkDependencies(manifest) {
    const deps = manifest.dependencies || {};
    
    // 检查服务依赖
    for (const serviceName of deps.services || []) {
      if (!this.services[serviceName]) {
        throw new Error(`Missing service dependency: ${serviceName}`);
      }
    }
    
    // 检查插件依赖
    for (const pluginId of deps.plugins || []) {
      if (!this.instances.has(pluginId)) {
        // 尝试加载依赖插件
        await this.load(pluginId);
      }
    }
  }
  
  createContext(manifest) {
    // 根据权限过滤服务
    const allowedServices = this.filterServicesByPermissions(
      manifest.permissions || []
    );
    
    return {
      manifest,
      services: allowedServices,
      eventBus: this.eventBus,
      storage: new PluginStorage(manifest.id),
      settings: new PluginSettings(manifest),
      i18n: new PluginI18n(manifest),
      ui: this.createUIHelper()
    };
  }
  
  filterServicesByPermissions(permissions) {
    const allowed = {};
    
    // 基础服务始终可用（不需要权限）
    const baseServices = ['NotificationService'];
    for (const name of baseServices) {
      if (this.services[name]) {
        allowed[name] = this.services[name];
      }
    }
    
    // 根据权限添加服务
    const permissionServiceMap = {
      'database:read': 'DatabaseService',
      'database:write': 'DatabaseService',
      'filesystem:read': 'FileSystemService',
      'filesystem:write': 'FileSystemService',
      'network:sync': 'CommunicationLayer',
      'search': 'SearchService'
    };
    
    for (const permission of permissions) {
      const serviceName = permissionServiceMap[permission];
      if (serviceName && this.services[serviceName]) {
        allowed[serviceName] = this.services[serviceName];
      }
    }
    
    return allowed;
  }
  
  async loadStyle(stylePath, pluginId) {
    const response = await fetch(stylePath);
    if (!response.ok) return;
    
    const css = await response.text();
    
    const style = document.createElement('style');
    style.id = `plugin-style-${pluginId}`;
    style.textContent = css;
    document.head.appendChild(style);
  }
  
  unloadStyle(pluginId) {
    const style = document.getElementById(`plugin-style-${pluginId}`);
    if (style) {
      style.remove();
    }
  }
  
  async isInstalled(pluginId) {
    try {
      const db = this.services.DatabaseService;
      if (!db) return false;
      
      const record = await db.queryOne(
        'SELECT version FROM plugin_installs WHERE plugin_id = ?',
        [pluginId]
      );
      
      if (record) {
        this.installedVersions.set(pluginId, record.version);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  
  async markInstalled(pluginId, version) {
    try {
      const db = this.services.DatabaseService;
      if (!db) return;
      
      await db.run(
        `INSERT OR REPLACE INTO plugin_installs (plugin_id, version, installed_at)
         VALUES (?, ?, ?)`,
        [pluginId, version, Date.now()]
      );
      
      this.installedVersions.set(pluginId, version);
    } catch (error) {
      console.error('Failed to mark plugin installed:', error);
    }
  }
  
  createUIHelper() {
    return {
      showModal: (options) => window.app?.showModal(options),
      showToast: (message, type) => window.app?.showToast(message, type),
      showConfirm: (message) => window.app?.showConfirm(message),
      showPrompt: (message, defaultValue) => window.app?.showPrompt(message, defaultValue)
    };
  }
  
  // ========== 公共 API ==========
  
  get(pluginId) {
    return this.instances.get(pluginId);
  }
  
  getAll() {
    return Array.from(this.instances.values());
  }
  
  getManifest(pluginId) {
    return this.manifests.get(pluginId);
  }
  
  getAllManifests() {
    return Array.from(this.manifests.values());
  }
  
  async call(pluginId, method, ...args) {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    const manifest = this.manifests.get(pluginId);
    const exports = manifest.exports || {};
    
    if (!exports[method]) {
      throw new Error(`Method not exported: ${pluginId}.${method}`);
    }
    
    const methodName = exports[method];
    if (typeof instance[methodName] !== 'function') {
      throw new Error(`Method not found: ${pluginId}.${methodName}`);
    }
    
    return instance[methodName](...args);
  }
}

export default PluginLoader;
