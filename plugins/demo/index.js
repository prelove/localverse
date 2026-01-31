/**
 * Demo Plugin
 * A simple demonstration plugin to test the plugin system
 */

import { PluginBase } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

export default class DemoPlugin extends PluginBase {
  constructor(context) {
    super(context);
    this.counter = 0;
  }

  async onActivate() {
    await super.onActivate();
    console.log(`[Demo Plugin] Activated! Settings:`, this.settings.getAll());
    
    // Show welcome message if enabled
    if (this.settings.get('showWelcome')) {
      console.log('[Demo Plugin] Welcome to Demo Plugin!');
    }
  }

  async onDeactivate() {
    await super.onDeactivate();
    console.log('[Demo Plugin] Deactivated!');
  }

  render() {
    const showWelcome = this.settings.get('showWelcome');
    const lang = this.context.i18n.currentLang;
    
    return `
      <div class="demo-plugin">
        <div class="demo-header">
          <h1>${this.manifest.icon} ${this.getName(lang)}</h1>
          <p>${this.getDescription(lang)}</p>
        </div>
        
        <div class="demo-content">
          ${showWelcome ? `
            <div class="demo-welcome">
              <h2>Welcome to Demo Plugin!</h2>
              <p>This is a demonstration plugin showing the plugin system capabilities.</p>
            </div>
          ` : ''}
          
          <div class="demo-section">
            <h3>Plugin Information</h3>
            <ul>
              <li><strong>ID:</strong> ${this.id}</li>
              <li><strong>Version:</strong> ${this.version}</li>
              <li><strong>Status:</strong> ${this.activated ? 'Active' : 'Inactive'}</li>
              <li><strong>Language:</strong> ${lang}</li>
            </ul>
          </div>
          
          <div class="demo-section">
            <h3>Interactive Counter</h3>
            <p>Counter: <span id="counterValue">${this.counter}</span></p>
            <button id="incrementBtn" class="demo-btn">Increment</button>
            <button id="resetBtn" class="demo-btn">Reset</button>
          </div>
          
          <div class="demo-section">
            <h3>Settings</h3>
            <label>
              <input type="checkbox" id="showWelcomeCheck" ${showWelcome ? 'checked' : ''}>
              Show Welcome Message
            </label>
          </div>
          
          <div class="demo-section">
            <h3>Storage Test</h3>
            <input type="text" id="storageInput" placeholder="Enter text">
            <button id="saveBtn" class="demo-btn">Save to Storage</button>
            <button id="loadBtn" class="demo-btn">Load from Storage</button>
            <p id="storageOutput"></p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Called after render to bind event handlers
   */
  bindEvents(container) {
    // Increment button
    const incrementBtn = container.querySelector('#incrementBtn');
    incrementBtn?.addEventListener('click', () => {
      this.counter++;
      const counterValue = container.querySelector('#counterValue');
      if (counterValue) counterValue.textContent = this.counter;
    });

    // Reset button
    const resetBtn = container.querySelector('#resetBtn');
    resetBtn?.addEventListener('click', () => {
      this.counter = 0;
      const counterValue = container.querySelector('#counterValue');
      if (counterValue) counterValue.textContent = this.counter;
    });

    // Show welcome checkbox
    const showWelcomeCheck = container.querySelector('#showWelcomeCheck');
    showWelcomeCheck?.addEventListener('change', (e) => {
      this.settings.set('showWelcome', e.target.checked);
      console.log('[Demo Plugin] Setting updated:', e.target.checked);
    });

    // Storage save
    const saveBtn = container.querySelector('#saveBtn');
    saveBtn?.addEventListener('click', () => {
      const input = container.querySelector('#storageInput');
      const text = input?.value || '';
      this.storage.set('testData', text);
      console.log('[Demo Plugin] Saved to storage:', text);
      const output = container.querySelector('#storageOutput');
      if (output) output.textContent = 'Saved: ' + text;
    });

    // Storage load
    const loadBtn = container.querySelector('#loadBtn');
    loadBtn?.addEventListener('click', () => {
      const text = this.storage.get('testData', '(no data)');
      console.log('[Demo Plugin] Loaded from storage:', text);
      const output = container.querySelector('#storageOutput');
      if (output) output.textContent = 'Loaded: ' + text;
    });
  }
}
