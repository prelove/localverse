/**
 * Hash-based Router System
 * Provides client-side routing without server requests
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};
    
    // Listen to hash changes
    window.addEventListener('popstate', () => this.handleRoute());
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  /**
   * Register a route handler
   * @param {string} path - Route pattern (e.g., '/plugin/:id')
   * @param {Function} handler - Handler function
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to a path
   * @param {string} path - Path to navigate to
   * @param {Object} params - Additional parameters
   */
  navigate(path, params = {}) {
    this.params = params;
    window.history.pushState(params, '', `#${path}`);
    this.handleRoute();
  }

  /**
   * Replace current route
   * @param {string} path - Path to replace with
   * @param {Object} params - Additional parameters
   */
  replace(path, params = {}) {
    this.params = params;
    window.history.replaceState(params, '', `#${path}`);
    this.handleRoute();
  }

  /**
   * Handle route change
   */
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    
    // Parse query parameters
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((value, key) => {
        this.params[key] = value;
      });
    }
    
    // Match route
    for (const [pattern, handler] of this.routes) {
      const match = this.matchRoute(pattern, path);
      if (match) {
        this.currentRoute = pattern;
        this.params = { ...this.params, ...match.params };
        handler(this.params);
        return;
      }
    }
    
    // 404 - Not Found
    const notFoundHandler = this.routes.get('*');
    if (notFoundHandler) {
      notFoundHandler(this.params);
    }
  }

  /**
   * Match route pattern against path
   * @param {string} pattern - Route pattern
   * @param {string} path - Current path
   * @returns {Object|null} Match result with params
   */
  matchRoute(pattern, path) {
    if (pattern === '*') {
      return { params: {} };
    }
    
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        // Dynamic parameter
        params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return { params };
  }

  /**
   * Get current route parameters
   * @returns {Object} Current parameters
   */
  getParams() {
    return this.params;
  }

  /**
   * Get current route pattern
   * @returns {string} Current route pattern
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Navigate back
   */
  back() {
    window.history.back();
  }

  /**
   * Navigate forward
   */
  forward() {
    window.history.forward();
  }

  /**
   * Build URL with parameters
   * @param {string} path - Base path
   * @param {Object} params - URL parameters
   * @returns {string} Complete URL
   */
  buildUrl(path, params = {}) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    return queryString ? `${path}?${queryString}` : path;
  }
}

export { Router };
export default Router;
