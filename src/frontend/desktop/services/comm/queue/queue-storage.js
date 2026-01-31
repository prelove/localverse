/**
 * IndexedDB storage for offline message queue
 * Provides persistent storage for messages when network is unavailable
 */

const DB_NAME = 'localverse_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_messages';

export class QueueStorage {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database
   * @returns {Promise<void>}
   */
  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('nextAttempt', 'nextAttempt', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
        }
      };
    });
  }

  /**
   * Save a queue item
   * @param {Object} item - Queue item to save
   * @returns {Promise<void>}
   */
  async save(item) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save item'));
    });
  }

  /**
   * Update an existing queue item
   * @param {Object} item - Updated queue item
   * @returns {Promise<void>}
   */
  async update(item) {
    return this.save(item);
  }

  /**
   * Remove a queue item
   * @param {string} id - Item ID to remove
   * @returns {Promise<void>}
   */
  async remove(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove item'));
    });
  }

  /**
   * Get a queue item by ID
   * @param {string} id - Item ID
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get item'));
    });
  }

  /**
   * Get all pending items ready for retry
   * @param {number} limit - Maximum number of items to return
   * @returns {Promise<Array>}
   */
  async getPending(limit = 10) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('nextAttempt');
      
      const items = [];
      const now = Date.now();
      
      // Get items where nextAttempt <= now, ordered by nextAttempt
      const request = index.openCursor(IDBKeyRange.upperBound(now));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor && items.length < limit) {
          const item = cursor.value;
          
          // Only include pending items
          if (item.status === 'pending') {
            items.push(item);
          }
          
          cursor.continue();
        } else {
          // Sort by priority (urgent > high > normal) then by createdAt
          items.sort((a, b) => {
            const priorityOrder = { urgent: 3, high: 2, normal: 1 };
            const aPriority = priorityOrder[a.message.priority] || 1;
            const bPriority = priorityOrder[b.message.priority] || 1;
            
            if (aPriority !== bPriority) {
              return bPriority - aPriority;
            }
            
            return a.createdAt - b.createdAt;
          });
          
          resolve(items);
        }
      };

      request.onerror = () => reject(new Error('Failed to get pending items'));
    });
  }

  /**
   * Get all items with a specific status
   * @param {string} status - Status to filter by
   * @returns {Promise<Array>}
   */
  async getByStatus(status) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      
      const items = [];
      const request = index.openCursor(IDBKeyRange.only(status));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(new Error('Failed to get items by status'));
    });
  }

  /**
   * Get count of items with specific status
   * @param {string} status - Status to count
   * @returns {Promise<number>}
   */
  async getCount(status) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      
      const request = index.count(IDBKeyRange.only(status));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count items'));
    });
  }

  /**
   * Remove expired messages
   * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
   * @returns {Promise<number>} Number of items removed
   */
  async cleanExpired(maxAge = 7 * 24 * 60 * 60 * 1000) { // Default: 7 days in milliseconds
    await this.init();

    const cutoff = Date.now() - maxAge;
    let removed = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else {
          resolve(removed);
        }
      };

      request.onerror = () => reject(new Error('Failed to clean expired items'));
    });
  }

  /**
   * Clear all items from storage
   * @returns {Promise<void>}
   */
  async clear() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear storage'));
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
