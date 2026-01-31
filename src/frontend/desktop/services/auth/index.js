/**
 * Authentication Module - Main Entry Point
 * 
 * Exports all authentication-related functionality.
 */

export { generateDeviceId, detectPlatform } from './device-fingerprint.js';
export { TokenManager } from './token-manager.js';
export { AuthService, authService } from './auth-service.js';
export { 
  hasPermission, 
  requirePermission, 
  canAccessData,
  getRoleName,
  getRolePermissions 
} from './permission.js';
export { SetupUI } from './setup-ui.js';
