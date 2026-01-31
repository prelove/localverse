/**
 * Example Plugin
 * Demonstrates basic plugin functionality
 */

import { Plugin } from '../../core/plugin/plugin-base.js';

export default class ExamplePlugin extends Plugin {
  static id = 'example';
  
  constructor(context) {
    super(context);
    this._counter = 0;
  }
  
  async onInstall() {
    console.log('Example plugin installed');
  }
  
  async onActivate() {
    console.log('Example plugin activated');
    this.setState({ message: this.getSetting('message') });
  }
  
  async onDeactivate() {
    console.log('Example plugin deactivated');
  }
  
  async onSettingsChange(key, value, oldValue) {
    console.log(`Setting changed: ${key} = ${value} (was ${oldValue})`);
    if (key === 'message') {
      this.setState({ message: value });
    }
  }
  
  render() {
    return `
      <div class="example-plugin">
        <h2>${this.escapeHtml(this.state.message || 'Example Plugin')}</h2>
        <p>Counter: <span class="counter">${this._counter}</span></p>
        <button class="btn-increment">Increment</button>
        <button class="btn-reset">Reset</button>
        <button class="btn-greet">Greet</button>
        
        <div class="info">
          <h3>Plugin Info</h3>
          <ul>
            <li><strong>ID:</strong> ${this.id}</li>
            <li><strong>Version:</strong> ${this.manifest.version}</li>
            <li><strong>User:</strong> ${this.escapeHtml(this.getCurrentUserName())}</li>
          </ul>
        </div>
      </div>
    `;
  }
  
  styles() {
    return `
      .example-plugin {
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .example-plugin h2 {
        color: #2c3e50;
        margin-bottom: 20px;
      }
      
      .example-plugin p {
        font-size: 18px;
        margin: 15px 0;
      }
      
      .example-plugin .counter {
        font-weight: bold;
        color: #3498db;
      }
      
      .example-plugin button {
        padding: 10px 20px;
        margin: 5px;
        border: none;
        border-radius: 4px;
        background: #3498db;
        color: white;
        cursor: pointer;
        font-size: 14px;
      }
      
      .example-plugin button:hover {
        background: #2980b9;
      }
      
      .example-plugin .info {
        margin-top: 30px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 4px;
      }
      
      .example-plugin .info h3 {
        margin-top: 0;
        color: #2c3e50;
      }
      
      .example-plugin .info ul {
        list-style: none;
        padding: 0;
      }
      
      .example-plugin .info li {
        margin: 8px 0;
      }
    `;
  }
  
  bindEvents() {
    const btnIncrement = this.$('.btn-increment');
    const btnReset = this.$('.btn-reset');
    const btnGreet = this.$('.btn-greet');
    
    btnIncrement?.addEventListener('click', () => {
      this._counter++;
      this._render();
      this.bindEvents();
    });
    
    btnReset?.addEventListener('click', () => {
      this._counter = 0;
      this._render();
      this.bindEvents();
    });
    
    btnGreet?.addEventListener('click', () => {
      this.greet();
    });
  }
  
  // Exported method
  greet() {
    const message = this.getSetting('message');
    // Use context UI helper instead of alert()
    if (this.context.ui.showToast) {
      this.context.ui.showToast(message, 'info');
    } else {
      // Fallback to console if UI helper not available
      console.log('Greet:', message);
    }
    this.emit('greeted', { message, timestamp: Date.now() });
  }
}
