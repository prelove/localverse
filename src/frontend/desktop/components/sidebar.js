/**
 * Sidebar Component
 * Navigation sidebar with plugin list
 */

import LVComponent from './base.js';

class LVSidebar extends LVComponent {
  static get observedAttributes() {
    return ['expanded'];
  }

  constructor() {
    super();
    this._state = {
      plugins: [],
      activePlugin: null
    };
  }

  styles() {
    return `
      :host {
        display: block;
        width: var(--sidebar-width, 60px);
        height: 100%;
        background: var(--sidebar-bg, #f5f5f5);
        border-right: 1px solid var(--border-color, #e0e0e0);
        transition: width var(--transition-normal);
      }
      
      :host([expanded]) {
        width: var(--sidebar-expanded-width, 240px);
      }
      
      .sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }
      
      .nav-list {
        flex: 1;
        padding: 8px;
        overflow-y: auto;
      }
      
      .nav-item {
        display: flex;
        align-items: center;
        padding: 12px;
        border-radius: var(--radius-md, 8px);
        cursor: pointer;
        transition: background var(--transition-fast);
        color: var(--text-color, #212121);
        text-decoration: none;
        margin-bottom: 4px;
      }
      
      .nav-item:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      .nav-item.active {
        background: var(--active-bg, rgba(25, 118, 210, 0.1));
        color: var(--primary-color, #1976d2);
      }
      
      .nav-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .nav-label {
        margin-left: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 14px;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }
      
      :host([expanded]) .nav-label {
        opacity: 1;
      }
      
      .sidebar-footer {
        padding: 8px;
        border-top: 1px solid var(--border-color, #e0e0e0);
      }
      
      .toggle-btn {
        width: 100%;
        padding: 12px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm, 4px);
        color: var(--text-secondary, #757575);
        font-size: 18px;
        transition: background var(--transition-fast);
      }
      
      .toggle-btn:hover {
        background: var(--hover-bg, rgba(0,0,0,0.05));
      }
      
      /* Scrollbar */
      .nav-list::-webkit-scrollbar {
        width: 4px;
      }
      
      .nav-list::-webkit-scrollbar-thumb {
        background: var(--gray-400, #bdbdbd);
        border-radius: 2px;
      }
      
      @media (max-width: 768px) {
        :host {
          position: fixed;
          left: 0;
          top: var(--header-height, 48px);
          bottom: 0;
          z-index: var(--z-sticky, 200);
          transform: translateX(-100%);
          transition: transform var(--transition-normal);
        }
        
        :host([expanded]) {
          transform: translateX(0);
          width: 280px;
        }
      }
    `;
  }

  template() {
    const plugins = this.state.plugins;
    const activeId = this.state.activePlugin;
    const expanded = this.hasAttribute('expanded');
    
    return `
      <nav class="sidebar">
        <div class="nav-list">
          ${plugins.map(plugin => `
            <div class="nav-item ${plugin.id === activeId ? 'active' : ''}"
                 data-plugin="${plugin.id}"
                 title="${plugin.name}">
              <span class="nav-icon">${plugin.icon || '📦'}</span>
              <span class="nav-label">${plugin.name}</span>
            </div>
          `).join('')}
          ${plugins.length === 0 ? '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">No plugins</div>' : ''}
        </div>
        
        <div class="sidebar-footer">
          <button class="toggle-btn" id="toggleBtn" title="${expanded ? 'Collapse' : 'Expand'} sidebar">
            ${expanded ? '◀' : '▶'}
          </button>
        </div>
      </nav>
    `;
  }

  bindEvents() {
    // Plugin item click
    this.$$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const pluginId = item.dataset.plugin;
        this.setState({ activePlugin: pluginId });
        this.emit('plugin-select', { pluginId });
      });
    });
    
    // Toggle button
    this.on('#toggleBtn', 'click', () => {
      this.toggleAttribute('expanded');
    });
  }

  /**
   * Set plugins list
   * @param {Array} plugins - Array of plugin objects
   */
  setPlugins(plugins) {
    this.setState({ plugins });
  }

  /**
   * Set active plugin
   * @param {string} pluginId - Plugin ID
   */
  setActive(pluginId) {
    this.setState({ activePlugin: pluginId });
  }

  /**
   * Add plugin to list
   * @param {Object} plugin - Plugin object
   */
  addPlugin(plugin) {
    const plugins = [...this.state.plugins, plugin];
    this.setState({ plugins });
  }

  /**
   * Remove plugin from list
   * @param {string} pluginId - Plugin ID
   */
  removePlugin(pluginId) {
    const plugins = this.state.plugins.filter(p => p.id !== pluginId);
    this.setState({ plugins });
  }
}

// Register custom element
customElements.define('lv-sidebar', LVSidebar);

export default LVSidebar;
