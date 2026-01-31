/**
 * PluginStorage - IndexedDB storage for plugins
 * Each plugin gets isolated storage
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
   * @returns {Promise<void>}
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
   * @returns {Promise<void>}
   */
  async ensureDb() {
    if (!this.db) {
      await this.init();
    }
  }

  /**
   * Get a value
   * @param {string} key - Storage key
   * @returns {Promise<*>} Stored value or null
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
   * Set a value
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
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
   * Remove a value
   * @param {string} key - Storage key
   * @returns {Promise<void>}
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
   * Clear all values
   * @returns {Promise<void>}
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
   * @returns {Promise<Object>} Object with all data
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
