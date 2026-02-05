/**
 * 事件总线 - 插件间通信
 * 
 * 功能：
 * 1. 发布-订阅模式
 * 2. 事件命名空间
 * 3. 一次性监听
 * 4. 通配符支持
 * Event Bus
 * 
 * Central event system for plugin communication.
 * Supports standard events, once events, wildcards, and async handling.
 * Event Bus for Plugin Communication
 * Provides publish-subscribe pattern for plugins
 * Provides publish-subscribe messaging between plugins and core system
 */

export class EventBus {
  constructor() {
    this._listeners = new Map(); // eventName -> Set<{handler, once, namespace}>
    this._wildcards = new Map(); // pattern -> Set<{handler, once, namespace}>
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名，支持通配符 (e.g., "plugin:*", "file:*.change")
   * @param {Function} handler - 处理函数
   * @param {Object} options - 选项
   * @param {boolean} options.once - 是否只触发一次
   * @param {string} options.namespace - 命名空间，用于批量取消订阅
   */
  on(eventName, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    const { once = false, namespace = null } = options;
    const listener = { handler, once, namespace };

    // 处理通配符
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

    // 返回取消订阅函数
    return () => this.off(eventName, handler);
  }

  /**
   * 订阅一次性事件
   */
  once(eventName, handler, options = {}) {
    return this.on(eventName, handler, { ...options, once: true });
  }

  /**
   * 取消订阅
   * @param {string} eventName - 事件名
   * @param {Function} handler - 处理函数（可选，不传则取消该事件的所有订阅）
   */
  off(eventName, handler = null) {
    const listeners = this._listeners.get(eventName);
    if (!listeners) return;

    if (handler === null) {
      // 取消所有订阅
      this._listeners.delete(eventName);
    } else {
      // 取消特定处理函数
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

  /**
   * 取消指定命名空间的所有订阅
   */
  offNamespace(namespace) {
    // 精确匹配
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

    // 通配符
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
   * 发布事件
   * @param {string} eventName - 事件名
   * @param {any} data - 事件数据
   * @returns {Promise<any[]>} - 所有处理器的返回值
   */
  async emit(eventName, data = null) {
    const results = [];
    const toRemove = [];

    // 精确匹配
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

    // 通配符匹配
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

    // 移除一次性监听器
    toRemove.forEach(({ set, listener }) => set.delete(listener));

    return results;
  }

  /**
   * 同步发布事件（不等待异步处理器）
   */
  emitSync(eventName, data = null) {
    this.emit(eventName, data).catch(err => {
      console.error(`Error emitting event "${eventName}":`, err);
    });
  }

  /**
   * 清除所有监听器
   */
  clear() {
    this._listeners.clear();
    this._wildcards.clear();
  }

  /**
   * 获取事件的监听器数量
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
   * 获取所有事件名
   */
  eventNames() {
    return Array.from(this._listeners.keys());
  }

  /**
   * 通配符匹配
   * @private
   */
  _matchWildcard(eventName, pattern) {
    // Escape special regex characters except *
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape all special chars including backslash
      .replace(/\*/g, '.*');  // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventName);
  }
}

// 创建全局实例
export const eventBus = new EventBus();
    this.handlers = new Map();
    this.onceHandlers = new Map();
  }
  
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
  
   * @param {Function} callback - Event handler
   * @param {Object} context - Execution context (plugin instance)
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, context = null) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listener = { callback, context };
    this.listeners.get(event).push(listener);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  once(event, handler) {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event).add(handler);
  }
  
   * @param {Function} callback - Event handler
   * @param {Object} context - Execution context
   * @returns {Function} Unsubscribe function
   */
  once(event, callback, context = null) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      callback.apply(context, args);
    };
    return this.on(event, onceWrapper, context);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
    }
  }
  
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const eventListeners = this.listeners.get(event);
    const index = eventListeners.findIndex(l => l.callback === callback);
    
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }

    // Clean up empty event arrays
    if (eventListeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    // Regular handlers
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error [${event}]:`, error);
        }
      }
    }
    
    // Once handlers
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Once handler error [${event}]:`, error);
        }
      }
      this.onceHandlers.delete(event);
    }
    
    // Wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler({ event, data });
        } catch (error) {
          console.error('Wildcard handler error:', error);
        }
      }
    }
  }
  

  /**
   * Emit an event asynchronously
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  async emitAsync(event, data) {
    const handlers = this.handlers.get(event) || new Set();
    const onceHandlers = this.onceHandlers.get(event) || new Set();
    
    const allHandlers = [...handlers, ...onceHandlers];
    
    await Promise.all(
      allHandlers.map(async handler => {
        try {
          await handler(data);
        } catch (error) {
          console.error(`Async handler error [${event}]:`, error);
        }
      })
    );
    
    this.onceHandlers.delete(event);
  }
  

  /**
   * Wait for an event to be emitted
   * @param {string} event - Event name
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<*>} Event data
   */
  wait(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event timeout: ${event}`));
      }, timeout);
      
      this.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
  

  /**
   * Clear all event handlers
   */
  clear() {
    this.handlers.clear();
    this.onceHandlers.clear();
  }
}

export default EventBus;
   * @param {...any} args - Arguments to pass to handlers
   */
  emit(event, ...args) {
    if (!this.listeners.has(event)) return;

    const eventListeners = this.listeners.get(event);
    
    // Call each listener in order
    for (const { callback, context } of eventListeners) {
      try {
        callback.apply(context, args);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    }
  }

  /**
   * Remove all listeners for an event or all events
   * @param {string} [event] - Event name (optional, removes all if not provided)
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0;
  }

  /**
   * Get all event names
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return Array.from(this.listeners.keys());
  }
}

// Export singleton instance
export default new EventBus();
