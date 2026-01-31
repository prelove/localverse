/**
 * Event Bus for Plugin Communication
 * Provides publish-subscribe messaging between plugins and core system
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
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
