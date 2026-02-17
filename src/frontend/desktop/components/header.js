/**
 * Header Component
 * Top navigation bar with logo, search, and user menu
 */

import LVComponent from './base.js';

class LVHeader extends LVComponent {
  static get observedAttributes() {
    return ['mode'];
  }

  constructor() {
    super();
    this._state = {
      searchQuery: ''
    };
  }

  styles() {
    return `
      :host {
        display: block;
        height: var(--header-height, 48px);
        background: var(--header-bg, #fff);
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      
      .header {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 16px;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-color, #1976d2);
        text-decoration: none;
        cursor: pointer;
      }
      
      .logo-icon {
        font-size: 24px;
      }
      
      .search-box {
        flex: 1;
        max-width: 400px;
        margin: 0 24px;
      }
      
      .search-input {
        width: 100%;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        outline: none;
        background: var(--surface-color, #fff);
        color: var(--text-color, #212121);
        font-size: 14px;
        transition: border-color var(--transition-fast);
      }
      
      .search-input:focus {
        border-color: var(--primary-color, #1976d2);
      }
      
      .search-input::placeholder {
        color: var(--text-secondary, #757575);
      }
      
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-left: auto;
      }
      
      .mode-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        background: var(--surface-color, #f5f5f5);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        font-size: 12px;
        color: var(--text-secondary, #757575);
      }
      
      .mode-icon {
        font-size: 16px;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success-color, #4caf50);
      }
      
      .status-indicator.offline { background: var(--gray-500, #9e9e9e); }
      .status-indicator.connecting { background: var(--warning-color, #ff9800); }
      .status-indicator.error { background: var(--error-color, #f44336); }
      
      .user-button {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: var(--primary-color, #1976d2);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      
      .user-button:hover {
        background: var(--primary-dark, #1565c0);
      }
      

      .sync-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        background: var(--surface-color, #f5f5f5);
        color: var(--text-secondary, #757575);
        font-size: 12px;
        white-space: nowrap;
      }

      .sync-badge.syncing {
        color: var(--primary-color, #1976d2);
        border-color: var(--primary-color, #1976d2);
      }

      .sync-badge.error {
        color: var(--error-color, #f44336);
        border-color: var(--error-color, #f44336);
      }

      @media (max-width: 768px) {
        .search-box {
          max-width: 200px;
          margin: 0 12px;
        }
        
        .mode-badge {
          display: none;
        }
      }
    `;
  }

  template() {
    const mode = this.getAttribute('mode') || 'full';
    const modeIcons = {
      full: '🟢',
      light: '🟡',
      pure: '🟠'
    };
    const modeLabels = {
      full: 'Full',
      light: 'Light',
      pure: 'Pure'
    };
    
    return `
      <header class="header">
        <a class="logo" id="logoLink">
          <span class="logo-icon">🌐</span>
          <span class="logo-text">Localverse</span>
        </a>
        
        <div class="search-box">
          <input type="text" 
                 class="search-input" 
                 id="searchInput"
                 placeholder="Search... (Ctrl+K)"
                 value="${this.state.searchQuery}">
        </div>
        
        <div class="actions">
          <div class="mode-badge">
            <span class="mode-icon">${modeIcons[mode]}</span>
            <span>${modeLabels[mode]}</span>
          </div>
          
          <div class="sync-badge" id="syncBadge" title="Sync status">
            <span id="syncText">Sync: idle</span>
          </div>

          <div class="status-indicator" id="statusIndicator" title="Connection status"></div>
          
          <button class="user-button" id="userButton" title="User menu">
            ${this.getUserInitial()}
          </button>
        </div>
      </header>
    `;
  }

  bindEvents() {
    // Logo click - navigate home
    this.on('#logoLink', 'click', (e) => {
      e.preventDefault();
      window.app?.router.navigate('/');
    });
    
    // Search input
    const searchInput = this.$('#searchInput');
    searchInput?.addEventListener('input', (e) => {
      this.setState({ searchQuery: e.target.value });
      this.emit('search', { query: e.target.value });
    });
    
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.emit('search-submit', { query: e.target.value });
      }
    });
    
    // User button
    this.on('#userButton', 'click', () => {
      this.emit('user-menu');
    });
    
    // Global keyboard shortcut for search (Ctrl+K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput?.focus();
      }
    });
  }

  /**
   * Get user initial for avatar
   * @returns {string}
   */
  getUserInitial() {
    const userName = window.app?.user?.name || 'User';
    return userName.charAt(0).toUpperCase();
  }


  /**
   * 更新同步状态显示。
   * @param {{ syncing?: boolean, pending?: number, conflicts?: number, failed?: number }} state
   */
  updateSyncStatus(state = {}) {
    const badge = this.$('#syncBadge');
    const text = this.$('#syncText');
    if (!badge || !text) {
      return;
    }

    const syncing = Boolean(state.syncing);
    const pending = Number(state.pending || 0);
    const conflicts = Number(state.conflicts || 0);
    const failed = Number(state.failed || 0);

    badge.classList.remove('syncing', 'error');
    if (syncing) {
      badge.classList.add('syncing');
      text.textContent = `Syncing… P:${pending} C:${conflicts}`;
      return;
    }

    if (failed > 0) {
      badge.classList.add('error');
      text.textContent = `Sync error F:${failed} P:${pending}`;
      return;
    }

    text.textContent = `Sync P:${pending} C:${conflicts}`;
  }

  /**
   * Update connection status indicator
   * @param {string} status - Status ('online', 'offline', 'connecting', 'error')
   */
  updateConnectionStatus(status) {
    const indicator = this.$('#statusIndicator');
    if (indicator) {
      indicator.className = `status-indicator ${status}`;
    }
  }
}

// Register custom element
customElements.define('lv-header', LVHeader);

export default LVHeader;
