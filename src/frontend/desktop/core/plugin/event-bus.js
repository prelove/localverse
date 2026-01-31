/**
 * Event Bus for Plugin Communication
 * Provides pub/sub mechanism for plugins to communicate
 */

export class EventBus {
  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Map();
  }

  /**
   * Register event listener
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

  /**
   * Register one-time event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  once(event, handler) {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event).add(handler);
  }

  /**
   * Remove event listener
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

  /**
   * Emit event synchronously
   * @param {string} event - Event name
   * @param {any} data - Event data
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
    
    // One-time handlers
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
   * Emit event asynchronously
   * @param {string} event - Event name
   * @param {any} data - Event data
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
   * Wait for an event
   * @param {string} event - Event name
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves when event is emitted
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
   * Clear all event listeners
   */
  clear() {
    this.handlers.clear();
    this.onceHandlers.clear();
  }
}

export default EventBus;
