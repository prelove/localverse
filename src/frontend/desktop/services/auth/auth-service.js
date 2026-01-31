/**
 * Authentication Service
 * 
 * Main authentication service that handles:
 * - User authentication flow
 * - First-time setup
 * - Token management
 * - Current user state
 */

import { TokenManager } from './token-manager.js';
import { generateDeviceId } from './device-fingerprint.js';

/**
 * Authentication Service Class
 */
export class AuthService {
  constructor() {
    this.tokenManager = new TokenManager();
    this.currentUser = null;
    this.deviceId = null;
  }
  
  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async init() {
    // Generate/get device ID
    this.deviceId = await this.getOrCreateDeviceId();
  }
  
  /**
   * Get or create device ID
   * @returns {Promise<string>} Device ID
   */
  async getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('localverse_device_id');
    
    if (!deviceId) {
      deviceId = await generateDeviceId();
      localStorage.setItem('localverse_device_id', deviceId);
    }
    
    return deviceId;
  }
  
  /**
   * Authenticate user with stored token
   * @returns {Promise<Object|null>} User object or null if not authenticated
   */
  async authenticate() {
    await this.init();
    
    // Load token
    const token = await this.tokenManager.loadToken();
    
    if (!token) {
      return null; // Need setup
    }
    
    // Verify signature
    const isValid = await this.tokenManager.verifySignature(token);
    if (!isValid) {
      console.warn('Token signature invalid');
      await this.tokenManager.clearToken();
      return null;
    }
    
    // Check expiration
    if (this.tokenManager.isTokenExpired(token)) {
      console.warn('Token expired');
      await this.tokenManager.clearToken();
      return null;
    }
    
    // Verify device ID
    if (token.deviceId !== this.deviceId) {
      console.warn('Device ID mismatch');
      // Optional: force re-setup or allow (lenient mode)
      // For now, we allow it (lenient mode)
    }
    
    // Refresh token if needed (within 7 days of expiry)
    let finalToken = token;
    if (this.tokenManager.shouldRefreshToken(token)) {
      finalToken = await this.tokenManager.refreshToken(token);
    }
    
    this.currentUser = {
      id: finalToken.userId,
      name: finalToken.userName,
      department: finalToken.department,
      role: finalToken.role,
      deviceId: finalToken.deviceId
    };
    
    return this.currentUser;
  }
  
  /**
   * Setup new user (first time configuration)
   * @param {Object} userData - User data (userId, userName, department, role)
   * @returns {Promise<Object>} User object
   */
  async setup(userData) {
    await this.init();
    
    // Generate token
    const token = await this.tokenManager.generateToken(userData, this.deviceId);
    
    // Save
    await this.tokenManager.saveToken(token);
    
    // Set current user
    this.currentUser = {
      id: token.userId,
      name: token.userName,
      department: token.department,
      role: token.role,
      deviceId: token.deviceId
    };
    
    return this.currentUser;
  }
  
  /**
   * Logout current user
   * @returns {Promise<void>}
   */
  async logout() {
    await this.tokenManager.clearToken();
    this.currentUser = null;
  }
  
  /**
   * Get current authenticated user
   * @returns {Object|null} User object or null
   */
  getCurrentUser() {
    return this.currentUser;
  }
  
  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }
  
  /**
   * Get current token
   * @returns {Promise<Object|null>} Token or null
   */
  async getToken() {
    return await this.tokenManager.loadToken();
  }
  
  /**
   * Get authentication headers for HTTP requests
   * @returns {Promise<Object>} Headers object
   */
  async getAuthHeader() {
    const token = await this.getToken();
    if (!token) return {};
    
    return {
      'Authorization': `Bearer ${btoa(JSON.stringify(token))}`,
      'X-Device-Id': token.deviceId
    };
  }
}

// Singleton instance
export const authService = new AuthService();
