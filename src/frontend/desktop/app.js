/**
 * Localverse Desktop Application Entry Point
 */

import './core/app.js';

// ==================== Offline Banner ====================
// Show a banner when the network connection is lost

function setupOfflineBanner() {
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.textContent = '⚠️ 网络已断开，正在离线模式运行 / Offline mode';
  document.body.prepend(banner);

  function updateBanner() {
    banner.classList.toggle('visible', !navigator.onLine);
  }

  window.addEventListener('online', updateBanner);
  window.addEventListener('offline', updateBanner);
  updateBanner();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOfflineBanner);
  } else {
    setupOfflineBanner();
  }
}

// Export for testing
export { default as app } from './core/app.js';
export { default as store } from './core/state.js';
export { Router } from './core/router.js';
export { I18n } from './core/i18n.js';
export { ThemeManager } from './core/theme.js';
