/**
 * EventBus - Plugin Event Communication
 * Provides publish-subscribe pattern for plugins
 */

export class EventBus {
  constructor() {
    this._listeners = new Map();
    this._wildcards = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Event name (supports wildcards like "plugin:*")
   * @param {Function} handler - Event handler
   * @param {Object} options - Options { once: false, namespace: null }
   * @returns {Function} Unsubscribe function
   */
  on(eventName, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    const { once = false, namespace = null } = options;
    const listener = { handler, once, namespace };

    if (eventName.includes('*')) {
      if (!this._wildcards.has(eventName)) {
        this._wildcards.set(eventName, new Set());
      }
      this._wildcards.get(eventName).add(listener);
    } else {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      this._listeners.get(eventName).add(listener);
    }

    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to an event once
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Options
   * @returns {Function} Unsubscribe function
   */
  once(eventName, handler, options = {}) {
    return this.on(eventName, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name
   * @param {Function} handler - Handler to remove (optional)
   */
  off(eventName, handler = null) {
    if (eventName.includes('*')) {
      const listeners = this._wildcards.get(eventName);
      if (!listeners) return;

      if (handler === null) {
        this._wildcards.delete(eventName);
      } else {
        for (const listener of listeners) {
          if (listener.handler === handler) {
            listeners.delete(listener);
          }
        }
        if (listeners.size === 0) {
          this._wildcards.delete(eventName);
        }
      }
    } else {
      const listeners = this._listeners.get(eventName);
      if (!listeners) return;

      if (handler === null) {
        this._listeners.delete(eventName);
      } else {
        for (const listener of listeners) {
          if (listener.handler === handler) {
            listeners.delete(listener);
          }
        }
        if (listeners.size === 0) {
          this._listeners.delete(eventName);
        }
      }
    }
  }

  /**
   * Unsubscribe all listeners for a namespace
   * @param {string} namespace - Namespace to remove
   */
  offNamespace(namespace) {
    for (const [eventName, listeners] of this._listeners.entries()) {
      const toRemove = [];
      for (const listener of listeners) {
        if (listener.namespace === namespace) {
          toRemove.push(listener);
        }
      }
      toRemove.forEach(listener => listeners.delete(listener));
      if (listeners.size === 0) {
        this._listeners.delete(eventName);
      }
    }

    for (const [pattern, listeners] of this._wildcards.entries()) {
      const toRemove = [];
      for (const listener of listeners) {
        if (listener.namespace === namespace) {
          toRemove.push(listener);
        }
      }
      toRemove.forEach(listener => listeners.delete(listener));
      if (listeners.size === 0) {
        this._wildcards.delete(pattern);
      }
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   * @returns {Promise<any[]>} Results from all handlers
   */
  async emit(eventName, data = null) {
    const results = [];
    const toRemove = [];

    // Exact match
    const listeners = this._listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        try {
          const result = await listener.handler(data, eventName);
          results.push(result);
          if (listener.once) {
            toRemove.push({ set: listeners, listener });
          }
        } catch (error) {
          console.error(`Error in event handler for "${eventName}":`, error);
        }
      }
    }

    // Wildcard match
    for (const [pattern, listeners] of this._wildcards.entries()) {
      if (this._matchWildcard(eventName, pattern)) {
        for (const listener of listeners) {
          try {
            const result = await listener.handler(data, eventName);
            results.push(result);
            if (listener.once) {
              toRemove.push({ set: listeners, listener });
            }
          } catch (error) {
            console.error(`Error in wildcard handler for "${pattern}":`, error);
          }
        }
      }
    }

    // Remove once listeners
    toRemove.forEach(({ set, listener }) => set.delete(listener));

    return results;
  }

  /**
   * Emit an event synchronously
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  emitSync(eventName, data = null) {
    this.emit(eventName, data).catch(err => {
      console.error(`Error emitting event "${eventName}":`, err);
    });
  }

  /**
   * Clear all listeners
   */
  clear() {
    this._listeners.clear();
    this._wildcards.clear();
  }

  /**
   * Get listener count for an event
   * @param {string} eventName - Event name
   * @returns {number} Listener count
   */
  listenerCount(eventName) {
    let count = 0;
    
    const listeners = this._listeners.get(eventName);
    if (listeners) {
      count += listeners.size;
    }

    for (const [pattern] of this._wildcards.entries()) {
      if (this._matchWildcard(eventName, pattern)) {
        count += this._wildcards.get(pattern).size;
      }
    }

    return count;
  }

  /**
   * Get all event names
   * @returns {string[]} Event names
   */
  eventNames() {
    return Array.from(this._listeners.keys());
  }

  /**
   * Match event name against wildcard pattern
   * @private
   */
  _matchWildcard(eventName, pattern) {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventName);
  }
}

// Create singleton instance
export const eventBus = new EventBus();
export default eventBus;
