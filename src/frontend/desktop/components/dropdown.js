/**
 * Dropdown Component
 * Provides a simple dropdown menu with trigger and menu slots.
 */

import LVComponent from './base.js';

class LVDropdown extends LVComponent {
  static get observedAttributes() {
    return ['open', 'align'];
  }

  constructor() {
    super();
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  styles() {
    return `
      :host {
        position: relative;
        display: inline-block;
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }

      .menu {
        position: absolute;
        top: calc(100% + 6px);
        min-width: 160px;
        padding: 8px 0;
        background: var(--dropdown-bg, #fff);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-md, 8px);
        box-shadow: var(--shadow-md, 0 8px 20px rgba(0,0,0,0.08));
        display: none;
        z-index: var(--z-dropdown, 1100);
      }

      :host([open]) .menu {
        display: block;
      }

      :host([align="right"]) .menu {
        right: 0;
        left: auto;
      }

      :host(:not([align="right"])) .menu {
        left: 0;
        right: auto;
      }
    `;
  }

  template() {
    return `
      <div class="trigger" id="trigger">
        <slot name="trigger"></slot>
      </div>
      <div class="menu" role="menu">
        <slot name="menu"></slot>
      </div>
    `;
  }

  bindEvents() {
    this.on('#trigger', 'click', (event) => {
      event.stopPropagation();
      this.toggle();
    });
  }

  onMount() {
    document.addEventListener('click', this.handleDocumentClick);
  }

  onUnmount() {
    document.removeEventListener('click', this.handleDocumentClick);
  }

  handleDocumentClick(event) {
    if (!this.hasAttribute('open')) return;
    if (!this.contains(event.target)) {
      this.close();
    }
  }

  open() {
    this.setAttribute('open', '');
    this.emit('open');
  }

  close() {
    this.removeAttribute('open');
    this.emit('close');
  }

  toggle() {
    if (this.hasAttribute('open')) {
      this.close();
    } else {
      this.open();
    }
  }
}

customElements.define('lv-dropdown', LVDropdown);

export default LVDropdown;
