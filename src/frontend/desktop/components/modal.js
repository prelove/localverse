/**
 * Modal Component
 * Dialog/modal window
 */

import LVComponent from './base.js';

class LVModal extends LVComponent {
  static get observedAttributes() {
    return ['open', 'title', 'size'];
  }

  styles() {
    return `
      :host {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: var(--z-modal, 1000);
      }
      
      :host([open]) {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--modal-overlay, rgba(0, 0, 0, 0.5));
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .modal {
        position: relative;
        background: var(--modal-bg, #fff);
        border-radius: var(--radius-lg, 12px);
        box-shadow: var(--shadow-xl);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        animation: modalIn 0.2s ease-out;
        overflow: hidden;
      }
      
      @keyframes modalIn {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      :host([size="small"]) .modal { width: 400px; }
      :host([size="medium"]) .modal { width: 600px; }
      :host([size="large"]) .modal { width: 800px; }
      :host([size="full"]) .modal { width: 90vw; height: 90vh; }
      :host(:not([size])) .modal { width: 600px; }
      
      .modal-header {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        flex-shrink: 0;
      }
      
      .modal-title {
        flex: 1;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        color: var(--text-color);
      }
      
      .modal-close {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm, 4px);
        font-size: 20px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast);
      }
      
      .modal-close:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      .modal-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        color: var(--text-color);
      }
      
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid var(--border-color, #e0e0e0);
        flex-shrink: 0;
      }
      
      /* Scrollbar */
      .modal-body::-webkit-scrollbar {
        width: 8px;
      }
      
      .modal-body::-webkit-scrollbar-thumb {
        background: var(--gray-400, #bdbdbd);
        border-radius: 4px;
      }
      
      @media (max-width: 768px) {
        .modal {
          width: 90vw !important;
          max-height: 85vh;
        }
      }
    `;
  }

  template() {
    const title = this.getAttribute('title') || '';
    
    return `
      <div class="overlay" id="overlay"></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" id="closeBtn" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Close on overlay click
    this.on('#overlay', 'click', () => this.close());
    
    // Close on close button
    this.on('#closeBtn', 'click', () => this.close());
    
    // Close on ESC key
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.hasAttribute('open')) {
        this.close();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }

  onUnmount() {
    // Clean up ESC handler
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
  }

  /**
   * Open modal
   */
  open() {
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    this.emit('open');
  }

  /**
   * Close modal
   */
  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
    this.emit('close');
  }

  /**
   * Toggle modal
   */
  toggle() {
    if (this.hasAttribute('open')) {
      this.close();
    } else {
      this.open();
    }
  }
}

// Register custom element
customElements.define('lv-modal', LVModal);

export default LVModal;
