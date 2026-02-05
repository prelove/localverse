/**
 * Demo Plugin
 * Demonstrates plugin system capabilities
 */

import { Plugin } from '../../desktop/core/plugin/plugin-base.js';

export default class DemoPlugin extends Plugin {
  static id = 'demo';
  
  async onInstall() {
    console.log('Demo plugin installed');
    
    // Initialize database table
    try {
      await this.callService('DatabaseService', 'run', `
        CREATE TABLE IF NOT EXISTS demo_items (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          created_at INTEGER NOT NULL
        )
      `);
    } catch (error) {
      console.error('Failed to create demo table:', error);
    }
  }
  
  async onActivate() {
    console.log('Demo plugin activated');
    
    // Show welcome message if enabled
    if (this.getSetting('showWelcome')) {
      this.showWelcome();
    }
    
    // Load items from database
    await this.loadItems();
  }
  
  async onDeactivate() {
    console.log('Demo plugin deactivated');
  }
  
  async onUninstall() {
    console.log('Demo plugin uninstalled');
    
    // Clean up database
    try {
      await this.callService('DatabaseService', 'run', 'DROP TABLE IF EXISTS demo_items');
    } catch (error) {
      console.error('Failed to clean up demo table:', error);
    }
  }
  
  async onSettingsChange(key, value, oldValue) {
    console.log(`Setting changed: ${key} = ${value} (was ${oldValue})`);
    
    if (key === 'showWelcome' && value) {
      this.showWelcome();
    }
  }
  
  showWelcome() {
    const name = this.getCurrentUserName();
    console.log(`Welcome to Demo Plugin, ${name}!`);
  }
  
  async loadItems() {
    try {
      const items = await this.callService('DatabaseService', 'query', 
        'SELECT * FROM demo_items ORDER BY created_at DESC'
      );
      
      this.setState({ items: items || [] });
    } catch (error) {
      console.error('Failed to load items:', error);
      this.setState({ items: [] });
    }
  }
  
  async addItem(title, content) {
    const id = this.generateId('item');
    const created_at = Date.now();
    
    try {
      await this.callService('DatabaseService', 'run',
        'INSERT INTO demo_items (id, title, content, created_at) VALUES (?, ?, ?, ?)',
        [id, title, content, created_at]
      );
      
      await this.loadItems();
      this.emit('item:added', { id, title, content });
      
      return id;
    } catch (error) {
      console.error('Failed to add item:', error);
      throw error;
    }
  }
  
  async deleteItem(id) {
    try {
      await this.callService('DatabaseService', 'run',
        'DELETE FROM demo_items WHERE id = ?',
        [id]
      );
      
      await this.loadItems();
      this.emit('item:deleted', { id });
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw error;
    }
  }
  
  // Exported method
  sayHello(name = 'World') {
    return `Hello, ${name}! This is the Demo Plugin.`;
  }
  
  render() {
    const items = this.state.items || [];
    const showWelcome = this.getSetting('showWelcome');
    
    return `
      <div class="demo-plugin">
        <div class="demo-header">
          <h2>${this.escapeHtml(this.t('plugin.demo.title'))}</h2>
          <button id="demo-add-btn" class="btn btn-primary">
            ${this.escapeHtml(this.t('plugin.demo.add'))}
          </button>
        </div>
        
        ${showWelcome ? `
          <div class="demo-welcome">
            <p>${this.escapeHtml(this.t('plugin.demo.welcome'))}</p>
          </div>
        ` : ''}
        
        <div class="demo-items">
          ${items.length === 0 ? `
            <div class="demo-empty">
              <p>${this.escapeHtml(this.t('plugin.demo.empty'))}</p>
            </div>
          ` : items.map(item => `
            <div class="demo-item" data-id="${item.id}">
              <div class="demo-item-header">
                <h3>${this.escapeHtml(item.title)}</h3>
                <button class="demo-item-delete" data-id="${item.id}">
                  ${this.escapeHtml(this.t('plugin.demo.delete'))}
                </button>
              </div>
              <div class="demo-item-content">
                ${this.escapeHtml(item.content || '')}
              </div>
              <div class="demo-item-footer">
                <small>${new Date(item.created_at).toLocaleString()}</small>
              </div>
            </div>
          `).join('')}
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      
      .demo-header h2 {
        margin: 0;
      }
      
      .demo-welcome {
        background: var(--color-info-bg, #e3f2fd);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      
      .demo-welcome p {
        margin: 0;
      }
      
      .demo-empty {
        text-align: center;
        padding: 40px;
        color: var(--color-text-secondary, #666);
      }
      
      .demo-item {
        background: var(--color-bg-secondary, #f5f5f5);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
      }
      
      .demo-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .demo-item-header h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .demo-item-content {
        margin-bottom: 10px;
        white-space: pre-wrap;
      }
      
      .demo-item-footer {
        color: var(--color-text-secondary, #666);
        font-size: 12px;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .btn-primary {
        background: var(--color-primary, #2196F3);
        color: white;
      }
      
      .btn-primary:hover {
        background: var(--color-primary-dark, #1976D2);
      }
      
      .demo-item-delete {
        padding: 4px 12px;
        background: var(--color-danger, #f44336);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .demo-item-delete:hover {
        background: var(--color-danger-dark, #d32f2f);
      }
    `;
  }
  
  bindEvents() {
    // Add item button
    const addBtn = this.$('#demo-add-btn');
    if (addBtn) {
      addBtn.onclick = () => this.handleAddItem();
    }
    
    // Delete buttons
    const deleteButtons = this.$$('.demo-item-delete');
    deleteButtons.forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        this.handleDeleteItem(id);
      };
    });
  }
  
  async handleAddItem() {
    const title = prompt('Enter item title:');
    if (!title) return;
    
    const content = prompt('Enter item content (optional):');
    
    try {
      await this.addItem(title, content || '');
    } catch (error) {
      alert('Failed to add item: ' + error.message);
    }
  }
  
  async handleDeleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }
    
    try {
      await this.deleteItem(id);
    } catch (error) {
      alert('Failed to delete item: ' + error.message);
    }
  }
}
