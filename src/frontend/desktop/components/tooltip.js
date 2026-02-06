/**
 * Tooltip Component
 * Shows helper text on hover.
 */

import LVComponent from './base.js';

class LVTooltip extends LVComponent {
  static get observedAttributes() {
    return ['text', 'position'];
  }

  styles() {
    return `
      :host {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .tooltip-content {
        position: absolute;
        max-width: 240px;
        padding: 6px 10px;
        background: var(--tooltip-bg, rgba(0, 0, 0, 0.85));
        color: var(--tooltip-color, #fff);
        font-size: 12px;
        border-radius: var(--radius-sm, 4px);
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transform: translateY(4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        z-index: var(--z-tooltip, 1200);
      }

      :host(:hover) .tooltip-content {
        opacity: 1;
        transform: translateY(0);
      }

      :host([position="top"]) .tooltip-content {
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translate(-50%, -4px);
      }

      :host([position="bottom"]) .tooltip-content,
      :host(:not([position])) .tooltip-content {
        top: calc(100% + 6px);
        left: 50%;
        transform: translate(-50%, 4px);
      }

      :host([position="left"]) .tooltip-content {
        right: calc(100% + 6px);
        top: 50%;
        transform: translate(-4px, -50%);
      }

      :host([position="right"]) .tooltip-content {
        left: calc(100% + 6px);
        top: 50%;
        transform: translate(4px, -50%);
      }
    `;
  }

  template() {
    const text = this.getAttribute('text') || '';

    return `
      <slot></slot>
      <span class="tooltip-content" role="tooltip">${text}</span>
    `;
  }
}

customElements.define('lv-tooltip', LVTooltip);

export default LVTooltip;
