import { Plugin } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

/**
 * Demo Plugin
 * 
 * Demonstrates all plugin system features
 */
export default class DemoPlugin extends Plugin {
  static id = 'demo';
  
  constructor(context) {
    super(context);
    
    this._state = {
      counter: 0,
      messages: []
    };
  }
  
  async onActivate() {
    console.log('[Demo Plugin] Activating...');
    const savedCounter = await this.storage.get('counter');
    if (savedCounter !== null) {
      this.setState({ counter: savedCounter });
    }
  }
  
  render() {
    const { counter, messages } = this.state;
    
    return `
      <div class="demo-plugin">
        <h2>${this.t('title')}</h2>
        <div class="counter">
          <span>Counter: <strong>${counter}</strong></span>
          <button id="increment-btn">+</button>
          <button id="decrement-btn">-</button>
        </div>
        <div class="messages">
          ${messages.map(msg => `<div>${this.escapeHtml(msg)}</div>`).join('')}
        </div>
      </div>
    `;
  }
  
  styles() {
    return `
      .demo-plugin { padding: 20px; }
      .counter { margin: 20px 0; }
      button { padding: 10px 20px; margin: 0 5px; }
    `;
  }
  
  bindEvents() {
    this.$('#increment-btn')?.addEventListener('click', () => {
      this.setState({ counter: this.state.counter + 1 });
    });
    this.$('#decrement-btn')?.addEventListener('click', () => {
      this.setState({ counter: this.state.counter - 1 });
    });
  }
  
  getPluginInfo() {
    return { id: this.id, counter: this.state.counter };
  }
}
