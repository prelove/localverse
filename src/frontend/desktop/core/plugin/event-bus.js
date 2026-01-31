/**
 * EventBus - Plugin Event Communication
 * Enables loose coupling between plugins and core system
 */

export class EventBus {
  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Map();
  }

  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
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

  /**
   * Register a one-time event handler
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
   */
  once(event, handler) {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event).add(handler);
  }

  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
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
   * @returns {Promise<void>}
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
   * @param {number} timeout - Timeout in milliseconds (default: 5000ms)
   * @returns {Promise<*>} Event data
   */
  wait(event, timeout = 5000) {
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
   * Clear all handlers
   */
  clear() {
    this.handlers.clear();
    this.onceHandlers.clear();
  }
}

export default EventBus;
