/**
 * State Management System
 * Provides reactive state management with subscription support
 */

class Store {
  constructor(initialState = {}) {
    this._state = initialState;
    this._listeners = new Map();
    this._middlewares = [];
  }

  /**
   * Get state value by path
   * @param {string} path - Dot-separated path (e.g., 'user.name')
   * @returns {*} State value
   */
  get(path) {
    if (!path) return this._state;
    
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key];
    }, this._state);
  }

  /**
   * Set state value by path
   * @param {string} path - Dot-separated path
   * @param {*} value - New value
   */
  set(path, value) {
    const oldValue = this.get(path);
    
    // Run middlewares
    for (const middleware of this._middlewares) {
      const result = middleware({ path, value, oldValue });
      if (result === false) return;
      if (result !== undefined) value = result;
    }
    
    // Update state
    if (!path) {
      this._state = value;
    } else {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {};
        return obj[key];
      }, this._state);
      target[lastKey] = value;
    }
    
    // Notify listeners
    this._notify(path, value, oldValue);
  }

  /**
   * Subscribe to state changes
   * @param {string} path - Path to watch
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, listener) {
    if (!this._listeners.has(path)) {
      this._listeners.set(path, new Set());
    }
    this._listeners.get(path).add(listener);
    
    return () => {
      this._listeners.get(path)?.delete(listener);
    };
  }

  /**
   * Notify listeners of state change
   * @private
   */
  _notify(path, value, oldValue) {
    // Exact match
    const listeners = this._listeners.get(path);
    if (listeners) {
      listeners.forEach(listener => listener(value, oldValue));
    }
    
    // Wildcard match
    const wildcardListeners = this._listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => listener({ path, value, oldValue }));
    }
    
    // Parent path match
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      const parentListeners = this._listeners.get(parentPath + '.*');
      if (parentListeners) {
        parentListeners.forEach(listener => listener({ path, value, oldValue }));
      }
    }
  }

  /**
   * Add middleware for state changes
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this._middlewares.push(middleware);
  }

  /**
   * Batch update multiple state values
   * @param {Object} updates - Object with path-value pairs
   */
  batch(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
  }

  /**
   * Reset state to initial values
   * @param {Object} initialState - New initial state
   */
  reset(initialState = {}) {
    this._state = initialState;
    this._notify('*', this._state, {});
  }

  /**
   * Get all state as plain object
   * @returns {Object} Current state
   */
  getAll() {
    return JSON.parse(JSON.stringify(this._state));
  }
}

// Create and export global store instance
const store = new Store({
  user: null,
  mode: 'full',
  theme: 'light',
  language: 'zh',
  connection: {
    status: 'disconnected',
    transport: null,
    latency: 0
  },
  sync: {
    pending: 0,
    conflicts: 0,
    lastSync: null
  },
  plugins: [],
  activePlugin: null,
  config: {}
});

export { Store };
export default store;
