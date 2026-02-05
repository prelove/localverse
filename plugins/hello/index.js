/**
 * Hello Plugin - Example Plugin
 * Demonstrates the plugin system capabilities
 */

import { Plugin } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

class HelloPlugin extends Plugin {
  static id = 'hello';
  
  constructor(context) {
    super(context);
    this.count = 0;
  }
  
  async onInstall() {
    console.log('Hello plugin installed!');
  }
  
  async onActivate() {
    console.log('Hello plugin activated!');
    
    if (this.getSetting('showWelcome')) {
      console.log('Welcome to Hello Plugin!');
    }
  }
  
  async onDeactivate() {
    console.log('Hello plugin deactivated!');
  }
  
  render() {
    const userName = this.getSetting('userName');
    
    return `
      <div class="hello-plugin">
        <h1>${this.t('title')}</h1>
        <p>${this.t('greeting', { name: this.escapeHtml(userName) })}</p>
        
        <div class="counter-section">
          <p>${this.t('counter')}: <strong>${this.state.count || 0}</strong></p>
          <button id="incrementBtn" class="btn-primary">${this.t('increment')}</button>
          <button id="resetBtn" class="btn-secondary">${this.t('reset')}</button>
        </div>
        
        <div class="settings-section">
          <h3>${this.t('settings_title')}</h3>
          <div class="form-group">
            <label for="userName">${this.t('user_name')}</label>
            <input type="text" id="userName" value="${this.escapeHtml(userName)}" />
          </div>
          <button id="saveBtn" class="btn-success">${this.t('save')}</button>
        </div>
        
        <div class="info-section">
          <p>Plugin ID: ${this.id}</p>
          <p>Version: ${this.manifest.version}</p>
          <p>Mode: ${window.app?.mode || 'unknown'}</p>
        </div>
      </div>
    `;
  }
  
  styles() {
    return `
      .hello-plugin {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
      }
      
      .hello-plugin h1 {
        color: var(--color-primary, #007bff);
        margin-bottom: 10px;
      }
      
      .counter-section,
      .settings-section,
      .info-section {
        margin: 20px 0;
        padding: 15px;
        background: var(--color-surface, #f8f9fa);
        border-radius: 8px;
      }
      
      .counter-section strong {
        color: var(--color-primary, #007bff);
        font-size: 1.5em;
      }
      
      button {
        padding: 8px 16px;
        margin: 5px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .btn-primary {
        background: var(--color-primary, #007bff);
        color: white;
      }
      
      .btn-secondary {
        background: var(--color-secondary, #6c757d);
        color: white;
      }
      
      .btn-success {
        background: var(--color-success, #28a745);
        color: white;
      }
      
      button:hover {
        opacity: 0.9;
      }
      
      .form-group {
        margin: 10px 0;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      
      .form-group input {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--color-border, #ddd);
        border-radius: 4px;
        box-sizing: border-box;
      }
      
      .info-section p {
        margin: 5px 0;
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
      }
    `;
  }
  
  bindEvents() {
    const incrementBtn = this.$('#incrementBtn');
    const resetBtn = this.$('#resetBtn');
    const saveBtn = this.$('#saveBtn');
    const userNameInput = this.$('#userName');
    
    incrementBtn?.addEventListener('click', () => {
      this.count++;
      this.setState({ count: this.count });
      this.emit('count_changed', { count: this.count });
    });
    
    resetBtn?.addEventListener('click', () => {
      this.count = 0;
      this.setState({ count: 0 });
      this.emit('count_reset');
    });
    
    saveBtn?.addEventListener('click', async () => {
      const newName = userNameInput?.value || 'User';
      await this.setSetting('userName', newName);
      this.setState({}); // Trigger re-render
    });
  }
  
  // Exported method
  greet(name) {
    return `Hello, ${name}! This is the Hello Plugin.`;
  }
}

export default HelloPlugin;
