import { Plugin } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

/**
 * Demo Plugin
 * A simple demonstration plugin to test the plugin system
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
    await super.onActivate();
    console.log('[Demo Plugin] Activating...');
    console.log(`[Demo Plugin] Settings:`, this.settings.getAll());
    
    // Load saved counter from storage
    const savedCounter = await this.storage.get('counter');
    if (savedCounter !== null) {
      this.setState({ counter: savedCounter });
    }
    
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
    const { counter, messages } = this.state;
    const showWelcome = this.settings.get('showWelcome');
    const lang = this.context.i18n.currentLang;
    
    return `
      <div class="demo-plugin">
        <div class="demo-header">
          <h1>${this.manifest.icon || '🎯'} ${this.getName(lang)}</h1>
          <p>${this.getDescription(lang)}</p>
        </div>
        
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
        
        <div class="demo-section counter">
          <h3>Interactive Counter</h3>
          <span>Counter: <strong id="counterValue">${counter}</strong></span>
          <button id="increment-btn" class="demo-btn">+</button>
          <button id="decrement-btn" class="demo-btn">-</button>
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
        
        <div class="messages">
          ${messages.map(msg => `<div>${this.escapeHtml(msg)}</div>`).join('')}
        </div>
      </div>
    `;
  }
  
  styles() {
    return `
      .demo-plugin { 
        padding: 20px; 
      }
      .demo-header {
        margin-bottom: 20px;
      }
      .demo-welcome {
        padding: 15px;
        background: #e8f4f8;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .demo-section {
        margin: 20px 0;
        padding: 15px;
        background: #f9f9f9;
        border-radius: 8px;
      }
      .counter { 
        margin: 20px 0; 
      }
      button, .demo-btn { 
        padding: 10px 20px; 
        margin: 0 5px;
        background: var(--accent-color, #007bff);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover, .demo-btn:hover {
        opacity: 0.9;
      }
      input[type="text"] {
        padding: 8px;
        margin-right: 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      input[type="checkbox"] {
        margin-right: 8px;
      }
    `;
  }
  
  /**
   * Called after render to bind event handlers
   */
  bindEvents(container) {
    // Increment button
    const incrementBtn = this.$('#increment-btn');
    incrementBtn?.addEventListener('click', () => {
      this.setState({ counter: this.state.counter + 1 });
      this.storage.set('counter', this.state.counter);
    });

    // Decrement button
    const decrementBtn = this.$('#decrement-btn');
    decrementBtn?.addEventListener('click', () => {
      this.setState({ counter: this.state.counter - 1 });
      this.storage.set('counter', this.state.counter);
    });

    // Reset button
    const resetBtn = this.$('#resetBtn');
    resetBtn?.addEventListener('click', () => {
      this.setState({ counter: 0 });
      this.storage.set('counter', 0);
      const counterValue = this.$('#counterValue');
      if (counterValue) counterValue.textContent = '0';
    });

    // Show welcome checkbox
    const showWelcomeCheck = this.$('#showWelcomeCheck');
    showWelcomeCheck?.addEventListener('change', (e) => {
      this.settings.set('showWelcome', e.target.checked);
      console.log('[Demo Plugin] Setting updated:', e.target.checked);
    });

    // Storage save
    const saveBtn = this.$('#saveBtn');
    saveBtn?.addEventListener('click', () => {
      const input = this.$('#storageInput');
      const text = input?.value || '';
      this.storage.set('testData', text);
      console.log('[Demo Plugin] Saved to storage:', text);
      const output = this.$('#storageOutput');
      if (output) output.textContent = 'Saved: ' + text;
    });

    // Storage load
    const loadBtn = this.$('#loadBtn');
    loadBtn?.addEventListener('click', () => {
      const text = this.storage.get('testData', '(no data)');
      console.log('[Demo Plugin] Loaded from storage:', text);
      const output = this.$('#storageOutput');
      if (output) output.textContent = 'Loaded: ' + text;
    });
  }
  
  getPluginInfo() {
    return { id: this.id, counter: this.state.counter };
  }
}
