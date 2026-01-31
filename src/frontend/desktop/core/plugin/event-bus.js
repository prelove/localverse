/**
 * 事件总线 - 插件间通信
 * 
 * 功能：
 * 1. 发布-订阅模式
 * 2. 事件命名空间
 * 3. 一次性监听
 * 4. 通配符支持
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
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventName);
  }
}

// 创建全局实例
export const eventBus = new EventBus();
