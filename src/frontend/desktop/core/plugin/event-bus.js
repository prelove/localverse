/**
 * Event Bus for Plugin Communication
 * Provides publish-subscribe pattern for plugins
 * Provides publish-subscribe messaging between plugins and core system
 */

export class EventBus {
  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Map();
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
