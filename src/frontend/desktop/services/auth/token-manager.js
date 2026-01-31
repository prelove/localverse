/**
 * Token Manager Module
 * 
 * Manages user authentication tokens including:
 * - Token generation with signatures
 * - Token validation and verification
 * - Token persistence (localStorage + IndexedDB)
 * - Token refresh logic
 */

import { detectPlatform } from './device-fingerprint.js';

const SECRET_KEY = 'localverse-secret-key-2024';
const TOKEN_STORAGE_KEY = 'localverse_token';
const TOKEN_EXPIRY_DAYS = 30;

/**
 * Token Manager Class
 */
export class TokenManager {
  /**
   * Generate a new token for a user
   * @param {Object} userData - User data (userId, userName, department, role)
   * @param {string} deviceId - Device fingerprint
   * @returns {Promise<Object>} Generated token
   */
  async generateToken(userData, deviceId) {
    const now = Date.now();
    
    const token = {
      userId: userData.userId,
      userName: userData.userName,
      department: userData.department,
      role: userData.role || 'user',
      deviceId,
      deviceName: `${userData.userName}的设备`,
      platform: detectPlatform(),
      createdAt: now,
      expiresAt: now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    };
    
    token.signature = await this.generateSignature(token);
    
    return token;
  }
  
  /**
   * Generate HMAC-SHA256 signature for token
   * @param {Object} token - Token object
   * @returns {Promise<string>} Signature string
   */
  async generateSignature(token) {
    const payload = [
      token.userId,
      token.deviceId,
      token.createdAt,
      token.expiresAt
    ].join(':');
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const data = encoder.encode(payload);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    
    return 'sha256:' + Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Verify token signature
   * @param {Object} token - Token to verify
   * @returns {Promise<boolean>} True if signature is valid
   */
  async verifySignature(token) {
    const expectedSignature = await this.generateSignature(token);
    return token.signature === expectedSignature;
  }
  
  /**
   * Save token to localStorage and IndexedDB
   * @param {Object} token - Token to save
   * @returns {Promise<void>}
   */
  async saveToken(token) {
    const tokenString = JSON.stringify(token);
    
    // Save to localStorage
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenString);
    
    // Backup to IndexedDB
    await this.saveToIndexedDB(token);
  }
  
  /**
   * Load token from storage
   * @returns {Promise<Object|null>} Token or null if not found
   */
  async loadToken() {
    // Try localStorage first
    let tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
    
    if (!tokenString) {
      // Try IndexedDB
      const token = await this.loadFromIndexedDB();
      if (token) {
        // Sync back to localStorage
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
        return token;
      }
      return null;
    }
    
    try {
      return JSON.parse(tokenString);
    } catch {
      return null;
    }
  }
  
  /**
   * Clear token from all storage
   * @returns {Promise<void>}
   */
  async clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    await this.clearFromIndexedDB();
  }
  
  /**
   * Check if token is expired
   * @param {Object} token - Token to check
   * @returns {boolean} True if expired
   */
  isTokenExpired(token) {
    return token.expiresAt < Date.now();
  }
  
  /**
   * Check if token should be refreshed (within 7 days of expiry)
   * @param {Object} token - Token to check
   * @returns {boolean} True if should refresh
   */
  shouldRefreshToken(token) {
    const refreshThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    return token.expiresAt - Date.now() < refreshThreshold;
  }
  
  /**
   * Refresh token with new expiry date
   * @param {Object} token - Token to refresh
   * @returns {Promise<Object>} New token
   */
  async refreshToken(token) {
    const newToken = {
      ...token,
      expiresAt: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    };
    newToken.signature = await this.generateSignature(newToken);
    await this.saveToken(newToken);
    return newToken;
  }
  
  // IndexedDB operations
  
  /**
   * Save token to IndexedDB
   * @param {Object} token - Token to save
   * @returns {Promise<void>}
   */
  async saveToIndexedDB(token) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_auth', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth');
        }
      };
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('auth', 'readwrite');
        tx.objectStore('auth').put(token, 'token');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Load token from IndexedDB
   * @returns {Promise<Object|null>} Token or null
   */
  async loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_auth', 1);
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          db.close();
          resolve(null);
          return;
        }
        
        const tx = db.transaction('auth', 'readonly');
        const getRequest = tx.objectStore('auth').get('token');
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result || null);
        };
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Clear token from IndexedDB
   * @returns {Promise<void>}
   */
  async clearFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_auth', 1);
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          db.close();
          resolve();
          return;
        }
        
        const tx = db.transaction('auth', 'readwrite');
        tx.objectStore('auth').delete('token');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}
