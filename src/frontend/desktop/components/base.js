/**
 * Base Web Component Class
 * Provides foundation for all Localverse components
 */

class LVComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = {};
    this._mounted = false;
  }

  /**
   * Called when element is added to DOM
   */
  connectedCallback() {
    this._mounted = true;
    this.render();
    this.onMount();
  }

  /**
   * Called when element is removed from DOM
   */
  disconnectedCallback() {
    this._mounted = false;
    this.onUnmount();
  }

  /**
   * Called when observed attribute changes
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.onAttributeChange(name, newValue, oldValue);
      if (this._mounted) {
        this.render();
      }
    }
  }

  /**
   * Lifecycle hook - called after mount
   */
  onMount() {}

  /**
   * Lifecycle hook - called before unmount
   */
  onUnmount() {}

  /**
   * Lifecycle hook - called on attribute change
   */
  onAttributeChange(name, newValue, oldValue) {}

  /**
   * Get component state
   */
  get state() {
    return this._state;
  }

  /**
   * Update component state and re-render
   * @param {Object} newState - State updates
   */
  setState(newState) {
    this._state = { ...this._state, ...newState };
    if (this._mounted) {
      this.render();
    }
  }

  /**
   * Render component
   */
  render() {
    const styles = this.styles();
    const template = this.template();
    
    this.shadowRoot.innerHTML = `
      ${styles ? `<style>${styles}</style>` : ''}
      ${template}
    `;
    
    this.bindEvents();
  }

  /**
   * Component styles - override in subclass
   * @returns {string} CSS string
   */
  styles() {
    return '';
  }

  /**
   * Component template - override in subclass
   * @returns {string} HTML string
   */
  template() {
    return '';
  }

  /**
   * Bind event listeners - override in subclass
   */
  bindEvents() {}

  /**
   * Query selector in shadow DOM
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  /**
   * Query selector all in shadow DOM
   * @param {string} selector - CSS selector
   * @returns {NodeList}
   */
  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }

  /**
   * Emit custom event
   * @param {string} event - Event name
   * @param {*} detail - Event detail
   */
  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, {
      bubbles: true,
      composed: true,
      detail
    }));
  }

  /**
   * Add event listener to shadow DOM element
   * @param {string} selector - CSS selector
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(selector, event, handler) {
    const element = this.$(selector);
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  /**
   * Get attribute as boolean
   * @param {string} name - Attribute name
   * @returns {boolean}
   */
  getBooleanAttribute(name) {
    return this.hasAttribute(name);
  }

  /**
   * Set boolean attribute
   * @param {string} name - Attribute name
   * @param {boolean} value - Value
   */
  setBooleanAttribute(name, value) {
    if (value) {
      this.setAttribute(name, '');
    } else {
      this.removeAttribute(name);
    }
  }
}

export default LVComponent;
