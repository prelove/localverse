/**
 * Localverse Desktop Application Entry Point
 */

import './core/app.js';

// Export for testing
export { default as app } from './core/app.js';
export { default as store } from './core/state.js';
export { Router } from './core/router.js';
export { I18n } from './core/i18n.js';
export { ThemeManager } from './core/theme.js';
