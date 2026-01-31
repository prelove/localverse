/**
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
