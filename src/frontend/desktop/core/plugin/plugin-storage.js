/**
 * Plugin Storage
 * Provides isolated IndexedDB storage for each plugin
 * 插件存储 - 基于 IndexedDB 的插件数据持久化
 * 插件存储 - 为每个插件提供独立的存储空间
 * 
 * 功能：
 * 1. 基于 IndexedDB 的持久化存储
 * 2. 插件数据隔离
 * 3. 简单的 key-value API
 * 4. 支持 JSON 序列化对象
 */

const PLUGIN_DB_NAME = 'localverse_plugin_storage';
const PLUGIN_DB_VERSION = 1;

export class PluginStorage {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.storeName = `plugin_${pluginId}`;
    this._db = null;
    this._initPromise = null;
  }

  /**
   * 初始化数据库
   */
  async _init() {
    if (this._db) return this._db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PLUGIN_DB_NAME, PLUGIN_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 为每个插件创建独立的 object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });

    return this._initPromise;
  }

  /**
   * 获取值
   * @param {string} key - 键
   * @param {any} defaultValue - 默认值
   * @returns {Promise<any>}
   */
  async get(key, defaultValue = null) {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : defaultValue);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.get error for plugin "${this.pluginId}":`, error);
      return defaultValue;
    }
  }

  /**
   * 设置值
   * @param {string} key - 键
   * @param {any} value - 值（可序列化为 JSON 的对象）
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put({ key, value });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.set error for plugin "${this.pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 删除值
   * @param {string} key - 键
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.remove error for plugin "${this.pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 清除所有数据
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.clear error for plugin "${this.pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 获取所有键
   * @returns {Promise<string[]>}
   */
  async keys() {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAllKeys();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.keys error for plugin "${this.pluginId}":`, error);
      return [];
    }
  }

  /**
   * 获取所有值
   * @returns {Promise<Object>} - { key: value, ... }
   */
  async getAll() {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result || [];
          const result = {};
          items.forEach(item => {
            result[item.key] = item.value;
          });
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.getAll error for plugin "${this.pluginId}":`, error);
      return {};
    }
  }

  /**
   * 检查键是否存在
   * @param {string} key - 键
   * @returns {Promise<boolean>}
   */
  async has(key) {
    try {
      const db = await this._init();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getKey(key);

        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`PluginStorage.has error for plugin "${this.pluginId}":`, error);
      return false;
    }
  }

  /**
   * 获取存储大小（近似值）
   * @returns {Promise<number>} - 字节数
   */
  async size() {
    try {
      const all = await this.getAll();
      const jsonStr = JSON.stringify(all);
      return new Blob([jsonStr]).size;
    } catch (error) {
      console.error(`PluginStorage.size error for plugin "${this.pluginId}":`, error);
      return 0;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
      this._initPromise = null;
    }
  }
}
 * Plugin Storage
 * 
 * Isolated storage for each plugin using IndexedDB.
 * Each plugin gets its own database namespace.
 * Plugin Storage using IndexedDB
 * Provides persistent storage for each plugin
 */

export class PluginStorage {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.dbName = `localverse_plugin_${pluginId}`;
    this.storeName = 'data';
    this.db = null;
  }

  /**
   * Initialize database
  

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  

  /**
   * Ensure database is initialized
   */
  async ensureDb() {
    if (!this.db) {
      await this.init();
    }
  }

  /**
   * Get value by key
   * @param {string} key
   * @returns {Promise<any>}
  

  /**
   * Get a value from storage
   * @param {string} key - Storage key
   * @returns {Promise<*>} Value or null
   */
  async get(key) {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).get(key);
      
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set value by key
   * @param {string} key
   * @param {any} value
  

  /**
   * Set a value in storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   */
  async set(key, value) {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(value, key);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Remove value by key
   * @param {string} key
  

  /**
   * Remove a value from storage
   * @param {string} key - Storage key
   */
  async remove(key) {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Clear all data
  

  /**
   * Clear all data from storage
   */
  async clear() {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get all keys
   * @returns {Promise<string[]>}
  

  /**
   * Get all keys from storage
   * @returns {Promise<string[]>} Array of keys
   */
  async keys() {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).getAllKeys();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all key-value pairs
   * @returns {Promise<Object>}
  

  /**
   * Get all data from storage
   * @returns {Promise<Object>} Object with all key-value pairs
   */
  async getAll() {
    await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      
      tx.oncomplete = () => {
        const result = {};
        keysRequest.result.forEach((key, i) => {
          result[key] = valuesRequest.result[i];
        });
        resolve(result);
      };
      
      tx.onerror = () => reject(tx.error);
    });
  }
}

export default PluginStorage;
