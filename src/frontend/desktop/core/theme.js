/**
 * Theme Manager
 * Handles theme switching and persistence
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.themes = ['light', 'dark', 'high-contrast'];
  }

  /**
   * Initialize theme system
   */
  init() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('localverse_theme');
    if (savedTheme && this.themes.includes(savedTheme)) {
      this.setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }

    // Listen to system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('localverse_theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Set theme
   * @param {string} theme - Theme name ('light', 'dark', 'high-contrast')
   */
  setTheme(theme) {
    if (!this.themes.includes(theme)) {
      console.warn(`Unknown theme: ${theme}`);
      return;
    }

    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('localverse_theme', theme);

    // Dispatch theme change event
    window.dispatchEvent(new CustomEvent('theme-change', {
      detail: { theme }
    }));
  }

  /**
   * Get current theme
   * @returns {string} Current theme name
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Toggle between light and dark theme
   */
  toggle() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Get available themes
   * @returns {string[]} Array of theme names
   */
  getAvailableThemes() {
    return [...this.themes];
  }

  /**
   * Check if theme is dark
   * @returns {boolean} True if current theme is dark
   */
  isDark() {
    return this.currentTheme === 'dark' || this.currentTheme === 'high-contrast';
  }

  /**
   * Apply custom theme variables
   * @param {Object} variables - CSS variable overrides
   */
  applyCustomVariables(variables) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(`--${key}`, value);
    }
  }

  /**
   * Reset to default theme variables
   */
  resetCustomVariables() {
    const root = document.documentElement;
    root.removeAttribute('style');
  }
}

export { ThemeManager };
export default ThemeManager;
