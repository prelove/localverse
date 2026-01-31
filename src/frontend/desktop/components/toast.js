/**
 * Toast Component
 * Notification toast messages
 */

import LVComponent from './base.js';

class LVToastContainer extends LVComponent {
  constructor() {
    super();
    this._state = {
      toasts: []
    };
    this._nextId = 1;
  }

  styles() {
    return `
      :host {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: var(--z-tooltip, 1200);
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      
      .toast {
        min-width: 280px;
        max-width: 400px;
        padding: 12px 16px;
        background: var(--surface-color, #fff);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
        animation: slideIn 0.2s ease-out;
        border-left: 4px solid var(--toast-color);
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .toast.removing {
        animation: slideOut 0.2s ease-in;
      }
      
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      
      .toast-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .toast-content {
        flex: 1;
        font-size: 14px;
        color: var(--text-color);
        line-height: 1.4;
      }
      
      .toast-close {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        font-size: 18px;
        line-height: 1;
        padding: 0;
        flex-shrink: 0;
        transition: background var(--transition-fast);
      }
      
      .toast-close:hover {
        background: var(--hover-bg);
      }
      
      /* Toast types */
      .toast.info {
        --toast-color: var(--info-color, #2196f3);
      }
      
      .toast.success {
        --toast-color: var(--success-color, #4caf50);
      }
      
      .toast.warning {
        --toast-color: var(--warning-color, #ff9800);
      }
      
      .toast.error {
        --toast-color: var(--error-color, #f44336);
      }
      
      @media (max-width: 768px) {
        :host {
          left: 16px;
          right: 16px;
        }
        
        .toast {
          min-width: auto;
          max-width: none;
        }
      }
    `;
  }

  template() {
    const toasts = this.state.toasts;
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    return toasts.map(toast => `
      <div class="toast ${toast.type}" data-id="${toast.id}">
        <span class="toast-icon">${icons[toast.type]}</span>
        <div class="toast-content">${toast.message}</div>
        <button class="toast-close" data-id="${toast.id}">×</button>
      </div>
    `).join('');
  }

  bindEvents() {
    this.$$('.toast-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        this.remove(id);
      });
    });
  }

  /**
   * Show a toast message
   * @param {string} message - Message text
   * @param {string} type - Toast type ('info', 'success', 'warning', 'error')
   * @param {number} duration - Auto-close duration in ms (0 = no auto-close)
   */
  show(message, type = 'info', duration = 3000) {
    const id = this._nextId++;
    const toast = { id, message, type };
    
    const toasts = [...this.state.toasts, toast];
    this.setState({ toasts });
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
    
    return id;
  }

  /**
   * Remove a toast by ID
   * @param {number} id - Toast ID
   */
  remove(id) {
    // Add removing class for animation
    const toastElement = this.shadowRoot.querySelector(`[data-id="${id}"]`);
    if (toastElement) {
      toastElement.classList.add('removing');
      
      // Remove from state after animation
      setTimeout(() => {
        const toasts = this.state.toasts.filter(t => t.id !== id);
        this.setState({ toasts });
      }, 200);
    }
  }

  /**
   * Clear all toasts
   */
  clear() {
    this.setState({ toasts: [] });
  }

  /**
   * Convenience methods for different types
   */
  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }

  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  warning(message, duration = 3000) {
    return this.show(message, 'warning', duration);
  }

  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }
}

// Register custom element
customElements.define('lv-toast-container', LVToastContainer);

export default LVToastContainer;
