import { Plugin } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

/**
 * Hello World Plugin
 * Simple sample plugin demonstrating plugin system features
 */
class HelloWorldPlugin extends Plugin {
  static id = 'hello-world';
  
  constructor(context) {
    super(context);
    
    // Initialize state
    this.setState({
      greetCount: 0
    });
  }
  
  /**
   * Called when plugin is installed (first time only)
   */
  async onInstall() {
    console.log('[HelloWorld] Plugin installed');
    
    // Show notification
    this.showToast(this.t('installed'), 'success');
  }
  
  /**
   * Called when plugin is activated
   */
  async onActivate() {
    console.log('[HelloWorld] Plugin activated');
    
    // Listen to global events
    this.on('*', (event) => {
      console.log('[HelloWorld] Received event:', event);
    });
  }
  
  /**
   * Called when plugin is deactivated
   */
  async onDeactivate() {
    console.log('[HelloWorld] Plugin deactivated');
  }
  
  /**
   * Called when settings change
   */
  async onSettingsChange(key, value, oldValue) {
    console.log('[HelloWorld] Setting changed:', key, oldValue, '->', value);
    
    // Re-render when settings change
    this.forceUpdate();
  }
  
  /**
   * Render plugin UI
   */
  render() {
    const showIcon = this.getSetting('showIcon');
    const userName = this.getSetting('userName');
    const greetCount = this.state.greetCount;
    
    return `
      <div class="hello-world">
        <div class="greeting">
          ${showIcon ? '<span class="icon">👋</span>' : ''}
          <h1>${this.t('hello', { name: userName })}</h1>
        </div>
        
        <div class="info">
          <p>${this.t('description')}</p>
          <p class="count">${this.t('greetCount', { count: greetCount })}</p>
        </div>
        
        <div class="actions">
          <button id="greetBtn" class="btn-primary">
            ${this.t('greetButton')}
          </button>
          <button id="changeNameBtn" class="btn-secondary">
            ${this.t('changeNameButton')}
          </button>
        </div>
        
        <div class="plugin-info">
          <h3>${this.t('pluginInfo')}</h3>
          <ul>
            <li><strong>${this.t('id')}:</strong> ${this.manifest.id}</li>
            <li><strong>${this.t('version')}:</strong> ${this.manifest.version}</li>
            <li><strong>${this.t('author')}:</strong> ${this.manifest.author}</li>
          </ul>
        </div>
      </div>
    `;
  }
  
  /**
   * Plugin styles
   */
  styles() {
    return `
      .hello-world {
        padding: 24px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .greeting {
        text-align: center;
        margin-bottom: 32px;
      }
      
      .greeting .icon {
        font-size: 48px;
        display: block;
        margin-bottom: 16px;
      }
      
      .greeting h1 {
        font-size: 32px;
        margin: 0;
        color: #1976d2;
      }
      
      .info {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 24px;
      }
      
      .info p {
        margin: 0 0 8px 0;
      }
      
      .info .count {
        font-weight: bold;
        color: #1976d2;
      }
      
      .actions {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }
      
      button {
        padding: 10px 20px;
        font-size: 14px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: #1976d2;
        color: white;
      }
      
      .btn-primary:hover {
        background: #1565c0;
      }
      
      .btn-secondary {
        background: #e0e0e0;
        color: #212121;
      }
      
      .btn-secondary:hover {
        background: #bdbdbd;
      }
      
      .plugin-info {
        border-top: 1px solid #e0e0e0;
        padding-top: 24px;
      }
      
      .plugin-info h3 {
        font-size: 18px;
        margin: 0 0 12px 0;
      }
      
      .plugin-info ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .plugin-info li {
        padding: 4px 0;
      }
    `;
  }
  
  /**
   * Bind DOM events
   */
  bindEvents() {
    const greetBtn = this.$('#greetBtn');
    const changeNameBtn = this.$('#changeNameBtn');
    
    if (greetBtn) {
      greetBtn.addEventListener('click', () => this.handleGreet());
    }
    
    if (changeNameBtn) {
      changeNameBtn.addEventListener('click', () => this.handleChangeName());
    }
  }
  
  /**
   * Handle greet button click
   */
  handleGreet() {
    const userName = this.getSetting('userName');
    
    // Increment count
    this.setState({
      greetCount: this.state.greetCount + 1
    });
    
    // Show notification
    this.showToast(this.t('greetMessage', { name: userName }), 'success');
    
    // Emit custom event
    this.emit('greeted', { 
      name: userName, 
      count: this.state.greetCount 
    });
  }
  
  /**
   * Handle change name button click
   */
  async handleChangeName() {
    const newName = prompt(this.t('enterName'), this.getSetting('userName'));
    
    if (newName && newName.trim()) {
      await this.setSetting('userName', newName.trim());
      this.showToast(this.t('nameChanged'), 'success');
    }
  }
  
  /**
   * Public method - Can be called from other plugins
   * @param {string} name - Name to greet
   * @returns {string} Greeting message
   */
  greet(name = 'World') {
    return `Hello, ${name}!`;
  }
}

export default HelloWorldPlugin;
