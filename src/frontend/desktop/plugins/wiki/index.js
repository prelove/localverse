/**
 * Wiki Plugin - Knowledge base with modules, columns, and cards
 * Supports Markdown, bidirectional links, and tags
 */
import WikiService from './services/wiki-service.js';
import LinkParser from './services/link-parser.js';
import VersionManager from './services/version-manager.js';

class WikiPlugin {
  static id = 'wiki';

  constructor(context) {
    this.context = context;
    this.container = null;
    
    // State
    this.state = {
      modules: [],
      currentModule: null,
      columns: [],
      cards: [],
      selectedCard: null,
      editingCard: null,
      view: 'board',
      searchQuery: '',
      searchResults: [],
      filters: {
        tags: [],
        dateRange: null
      },
      showBacklinks: false
    };

    // Services
    this.wikiService = null;
    this.linkParser = new LinkParser();
    this.versionManager = null;

    // Auto-save
    this.autoSaveTimer = null;
    this.pendingChanges = new Map();

    // Localization
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('Wiki plugin installing...');
    
    // Initialize database schema
    this.wikiService = new WikiService(this.context.services.DatabaseService);
    await this.wikiService.initSchema();
    
    console.log('Wiki plugin installed');
  }

  async onActivate() {
    console.log('Wiki plugin activating...');
    
    // Initialize services
    this.wikiService = new WikiService(this.context.services.DatabaseService);
    this.versionManager = new VersionManager(this.wikiService);
    
    // Load initial data
    await this.loadModules();
    
    // Bind global shortcuts
    this.bindGlobalShortcuts();
    
    console.log('Wiki plugin activated');
  }

  async onDeactivate() {
    console.log('Wiki plugin deactivating...');
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Unbind shortcuts
    this.unbindGlobalShortcuts();
    
    console.log('Wiki plugin deactivated');
  }

  async mount(container) {
    this.container = container;
    
    // Load default view setting
    const settings = await this.context.getSettings();
    this.state.view = settings.defaultView || 'board';
    
    await this.render();
    this.bindEvents();
  }

  async unmount() {
    this.stopAutoSave();
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  // ==================== Rendering ====================

  async render() {
    if (!this.container) return;

    const { modules, currentModule, columns, cards, selectedCard, view, searchQuery } = this.state;

    this.container.innerHTML = `
      <div class="wiki-plugin">
        <div class="wiki-sidebar">
          ${this.renderSidebar(modules)}
        </div>
        <div class="wiki-main">
          ${searchQuery ? this.renderSearchResults() : ''}
          ${currentModule ? this.renderModule(currentModule, columns, cards, view) : this.renderWelcome()}
        </div>
        ${selectedCard ? this.renderCardDetail(selectedCard) : ''}
      </div>
    `;
  }

  renderSidebar(modules) {
    return `
      <div class="sidebar-header">
        <h2>📚 ${this.t('welcome')}</h2>
        <button class="btn-icon" data-action="create-module" title="${this.t('createModule')}">
          ➕
        </button>
      </div>
      <div class="sidebar-search">
        <input 
          type="text" 
          class="search-input" 
          placeholder="${this.t('searchPlaceholder')}"
          data-action="search"
          value="${this.escapeHtml(this.state.searchQuery)}">
      </div>
      <div class="module-list">
        ${modules.length === 0 
          ? `<div class="empty-state">${this.t('welcomeMessage')}</div>`
          : modules.map(m => this.renderModuleItem(m)).join('')
        }
      </div>
    `;
  }

  renderModuleItem(module) {
    const isActive = this.state.currentModule?.id === module.id;
    return `
      <div class="module-item ${isActive ? 'active' : ''}" 
           data-module-id="${module.id}"
           data-action="select-module">
        <span class="module-icon">${module.icon || '📚'}</span>
        <span class="module-name">${this.escapeHtml(module.name)}</span>
        <div class="module-actions">
          <button class="btn-icon-small" data-action="edit-module" data-module-id="${module.id}" title="${this.t('edit')}">✏️</button>
          <button class="btn-icon-small" data-action="delete-module" data-module-id="${module.id}" title="${this.t('delete')}">🗑️</button>
        </div>
      </div>
    `;
  }

  renderWelcome() {
    return `
      <div class="welcome-screen">
        <div class="welcome-icon">📚</div>
        <h1>${this.t('welcome')}</h1>
        <p>${this.t('welcomeMessage')}</p>
        <button class="btn-primary" data-action="create-module">
          ${this.t('createModule')}
        </button>
      </div>
    `;
  }

  renderModule(module, columns, cards, view) {
    return `
      <div class="module-view">
        <div class="module-header">
          <div class="module-title">
            <span class="module-icon">${module.icon || '📚'}</span>
            <h1>${this.escapeHtml(module.name)}</h1>
          </div>
          <div class="module-toolbar">
            <button class="btn-icon" data-action="create-column" title="${this.t('createColumn')}">
              ➕ ${this.t('createColumn')}
            </button>
            <div class="view-switcher">
              <button class="btn-icon ${view === 'board' ? 'active' : ''}" 
                      data-action="switch-view" 
                      data-view="board"
                      title="${this.t('viewBoard')}">📋</button>
              <button class="btn-icon ${view === 'list' ? 'active' : ''}" 
                      data-action="switch-view" 
                      data-view="list"
                      title="${this.t('viewList')}">📄</button>
            </div>
          </div>
        </div>
        <div class="module-body">
          ${view === 'board' 
            ? this.renderBoardView(columns, cards)
            : this.renderListView(columns, cards)
          }
        </div>
      </div>
    `;
  }

  renderBoardView(columns, cards) {
    if (columns.length === 0) {
      return `<div class="empty-state">${this.t('emptyModule')}</div>`;
    }

    return `
      <div class="board-view">
        ${columns.map(col => this.renderColumn(col, cards)).join('')}
      </div>
    `;
  }

  renderColumn(column, allCards) {
    const cards = allCards.filter(c => c.column_id === column.id);

    return `
      <div class="column" data-column-id="${column.id}">
        <div class="column-header">
          <h3 class="column-title">${this.escapeHtml(column.name)}</h3>
          <span class="column-count">${cards.length}</span>
          <div class="column-actions">
            <button class="btn-icon-small" data-action="edit-column" data-column-id="${column.id}">✏️</button>
            <button class="btn-icon-small" data-action="delete-column" data-column-id="${column.id}">🗑️</button>
          </div>
        </div>
        <div class="column-body">
          ${cards.length === 0 
            ? `<div class="empty-column">${this.t('emptyColumn')}</div>`
            : cards.map(card => this.renderCard(card)).join('')
          }
          <button class="btn-add-card" data-action="create-card" data-column-id="${column.id}">
            ➕ ${this.t('createCard')}
          </button>
        </div>
      </div>
    `;
  }

  renderCard(card) {
    const tags = card.tags || [];
    const contentPreview = this.getContentPreview(card.content);

    return `
      <div class="card ${card.isPinned ? 'pinned' : ''}" 
           data-card-id="${card.id}"
           data-action="select-card">
        ${card.isPinned ? '<div class="pin-indicator">📌</div>' : ''}
        <h4 class="card-title">${this.escapeHtml(card.title)}</h4>
        ${contentPreview ? `<p class="card-preview">${contentPreview}</p>` : ''}
        ${tags.length > 0 ? `
          <div class="card-tags">
            ${tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-meta">
          <span class="card-date">${this.formatDate(card.updated_at)}</span>
        </div>
      </div>
    `;
  }

  renderListView(columns, cards) {
    return `
      <div class="list-view">
        <table class="card-table">
          <thead>
            <tr>
              <th>${this.t('cardTitle')}</th>
              <th>Column</th>
              <th>Tags</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${cards.map(card => {
              const column = columns.find(c => c.id === card.column_id);
              return `
                <tr data-card-id="${card.id}" data-action="select-card">
                  <td>${this.escapeHtml(card.title)}</td>
                  <td>${column ? this.escapeHtml(column.name) : '-'}</td>
                  <td>${(card.tags || []).map(t => `#${t}`).join(' ')}</td>
                  <td>${this.formatDate(card.updated_at)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderCardDetail(card) {
    if (this.state.editingCard) {
      return this.renderCardEditor(this.state.editingCard);
    }

    return `
      <div class="card-detail-panel">
        <div class="card-detail-header">
          <h2>${this.escapeHtml(card.title)}</h2>
          <button class="btn-icon" data-action="close-detail">✕</button>
        </div>
        <div class="card-detail-body">
          <div class="card-content">
            ${this.renderMarkdown(card.content)}
          </div>
          ${this.state.showBacklinks ? this.renderBacklinks(card) : ''}
        </div>
        <div class="card-detail-footer">
          <button class="btn-secondary" data-action="edit-card-detail">
            ${this.t('edit')}
          </button>
          <button class="btn-secondary" data-action="delete-card-detail">
            ${this.t('delete')}
          </button>
          <button class="btn-secondary" data-action="toggle-backlinks">
            ${this.t('backlinks')}
          </button>
        </div>
      </div>
    `;
  }

  renderBacklinks(card) {
    const backlinks = this.linkParser.findBacklinks(card.id, card.title, this.state.cards);
    
    return `
      <div class="backlinks-section">
        <h3>${this.t('backlinks')}</h3>
        ${backlinks.length === 0 
          ? `<p class="empty-state">${this.t('noBacklinks')}</p>`
          : `<ul class="backlinks-list">
              ${backlinks.map(bl => `
                <li data-card-id="${bl.cardId}" data-action="select-card">
                  ${this.escapeHtml(bl.cardTitle)}
                </li>
              `).join('')}
            </ul>`
        }
      </div>
    `;
  }

  renderSearchResults() {
    const results = this.state.searchResults || [];

    return `
      <div class="search-results">
        <div class="search-results-header">
          <h3>${this.t('searchResults')}</h3>
          <span class="search-results-count">${results.length}</span>
        </div>
        ${results.length === 0
          ? `<div class="empty-state">${this.t('noResults')}</div>`
          : `
            <ul class="search-results-list">
              ${results.map(card => `
                <li data-card-id="${card.id}" data-action="select-card">
                  <div class="result-title">${this.escapeHtml(card.title)}</div>
                  <div class="result-meta">
                    <span>${this.getColumnName(card.column_id)}</span>
                    <span>${this.formatDate(card.updated_at)}</span>
                  </div>
                </li>
              `).join('')}
            </ul>
          `
        }
      </div>
    `;
  }

  // ==================== Event Handling ====================

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', async (e) => {
      const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      e.preventDefault();
      await this.handleAction(action, e.target.closest('[data-action]'));
    });

    const searchInput = this.container.querySelector('.sidebar-search .search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    const contentInput = this.container.querySelector('.editor-textarea[data-field="content"]');
    if (contentInput) {
      contentInput.addEventListener('input', (e) => {
        if (this.state.editingCard) {
          this.state.editingCard.content = e.target.value;
        }
        const preview = this.container.querySelector('.editor-preview .card-content');
        if (preview) {
          preview.innerHTML = this.renderMarkdown(e.target.value);
        }
      });
    }
  }

  async handleAction(action, element) {
    const handlers = {
      'create-module': () => this.createModule(),
      'select-module': () => this.selectModule(element.dataset.moduleId),
      'edit-module': () => this.editModule(element.dataset.moduleId),
      'delete-module': () => this.deleteModule(element.dataset.moduleId),
      'create-column': () => this.createColumn(),
      'edit-column': () => this.editColumn(element.dataset.columnId),
      'delete-column': () => this.deleteColumn(element.dataset.columnId),
      'create-card': () => this.createCard(element.dataset.columnId),
      'select-card': () => this.selectCard(element.dataset.cardId),
      'edit-card-detail': () => this.editCard(this.state.selectedCard?.id),
      'delete-card-detail': () => this.deleteCard(this.state.selectedCard?.id),
      'close-detail': () => this.closeDetail(),
      'save-card': () => this.saveCardEdits(),
      'cancel-edit': () => this.cancelEdit(),
      'toggle-backlinks': () => this.toggleBacklinks(),
      'switch-view': () => this.switchView(element.dataset.view),
      'search': () => this.handleSearch(element.value)
    };

    const handler = handlers[action];
    if (handler) {
      await handler();
    }
  }

  bindGlobalShortcuts() {
    this.globalKeyHandler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        this.context.router.navigate('/plugin/wiki');
      }
    };
    document.addEventListener('keydown', this.globalKeyHandler);
  }

  unbindGlobalShortcuts() {
    if (this.globalKeyHandler) {
      document.removeEventListener('keydown', this.globalKeyHandler);
    }
  }

  // ==================== Data Operations ====================

  async loadModules() {
    this.state.modules = await this.wikiService.getModules();
    
    // Select first module by default
    if (this.state.modules.length > 0 && !this.state.currentModule) {
      await this.selectModule(this.state.modules[0].id);
    }
  }

  async selectModule(moduleId) {
    this.state.currentModule = await this.wikiService.getModule(moduleId);
    this.state.columns = await this.wikiService.getColumns(moduleId);
    this.state.cards = await this.wikiService.getAllCards(moduleId);
    this.state.selectedCard = null;
    
    await this.render();
  }

  async createModule() {
    const name = prompt(this.t('moduleName'));
    if (!name) return;

    const module = await this.wikiService.createModule({ name });
    this.state.modules.push(module);
    await this.selectModule(module.id);
  }

  async editModule(moduleId) {
    const module = await this.wikiService.getModule(moduleId);
    const newName = prompt(this.t('moduleName'), module.name);
    if (!newName) return;

    await this.wikiService.updateModule(moduleId, { name: newName });
    await this.loadModules();
    await this.render();
  }

  async deleteModule(moduleId) {
    if (!confirm(this.t('deleteConfirm'))) return;

    await this.wikiService.deleteModule(moduleId);
    await this.loadModules();
    
    if (this.state.currentModule?.id === moduleId) {
      this.state.currentModule = null;
      this.state.columns = [];
      this.state.cards = [];
    }
    
    await this.render();
  }

  async createColumn() {
    if (!this.state.currentModule) return;

    const name = prompt(this.t('columnName'));
    if (!name) return;

    const column = await this.wikiService.createColumn({
      moduleId: this.state.currentModule.id,
      name
    });
    
    this.state.columns.push(column);
    await this.render();
  }

  async editColumn(columnId) {
    const column = await this.wikiService.getColumn(columnId);
    const newName = prompt(this.t('columnName'), column.name);
    if (!newName) return;

    await this.wikiService.updateColumn(columnId, { name: newName });
    await this.selectModule(this.state.currentModule.id);
  }

  async deleteColumn(columnId) {
    if (!confirm(this.t('deleteConfirm'))) return;

    await this.wikiService.deleteColumn(columnId);
    await this.selectModule(this.state.currentModule.id);
  }

  async createCard(columnId) {
    const title = prompt(this.t('cardTitle'));
    if (!title) return;

    const card = await this.wikiService.createCard({
      columnId,
      title,
      content: ''
    });
    
    this.state.cards.push(card);
    await this.render();
  }

  async selectCard(cardId) {
    this.state.selectedCard = await this.wikiService.getCard(cardId);
    this.state.showBacklinks = false;
    this.state.editingCard = null;
    await this.render();
  }

  async editCard(cardId) {
    const card = await this.wikiService.getCard(cardId);
    if (!card) return;

    this.state.editingCard = {
      ...card,
      tagsInput: (card.tags || []).join(', ')
    };
    this.state.showBacklinks = false;
    await this.render();
  }

  async deleteCard(cardId) {
    if (!cardId) return;
    if (!confirm(this.t('deleteConfirm'))) return;

    await this.wikiService.deleteCard(cardId);
    await this.selectModule(this.state.currentModule.id);
  }

  closeDetail() {
    this.state.selectedCard = null;
    this.state.showBacklinks = false;
    this.state.editingCard = null;
    this.render();
  }

  toggleBacklinks() {
    this.state.showBacklinks = !this.state.showBacklinks;
    this.render();
  }

  switchView(view) {
    this.state.view = view;
    this.render();
  }

  async handleSearch(query) {
    this.state.searchQuery = query;
    
    if (!query.trim()) {
      this.state.searchResults = [];
      await this.render();
      return;
    }

    // Debounce search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(async () => {
      const results = await this.wikiService.search(query);
      this.state.searchResults = results;
      await this.render();
    }, 300);
  }

  // ==================== Helper Methods ====================

  t(key) {
    return this.i18n?.t?.(key) || key;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  getContentPreview(content, maxLength = 100) {
    if (!content) return '';
    
    const text = content
      .replace(/[#*`\[\]]/g, '')
      .replace(/\n/g, ' ')
      .trim();
    
    if (text.length <= maxLength) return this.escapeHtml(text);
    return this.escapeHtml(text.slice(0, maxLength) + '...');
  }

  renderMarkdown(content) {
    if (!content) return '';
    
    // Simple markdown rendering (in real implementation, use a proper markdown library)
    let html = content;
    
    // Render links
    html = this.linkParser.renderLinks(html, this.state.cards);
    
    // Basic markdown (simplified)
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(this.locale);
  }

  renderCardEditor(card) {
    return `
      <div class="card-detail-panel">
        <div class="card-detail-header">
          <h2>${this.escapeHtml(card.title)}</h2>
          <button class="btn-icon" data-action="cancel-edit">✕</button>
        </div>
        <div class="card-detail-body">
          <label class="editor-label">${this.t('cardTitle')}</label>
          <input class="editor-input" data-field="title" type="text" value="${this.escapeHtml(card.title)}" />

          <label class="editor-label">${this.t('tags')}</label>
          <input class="editor-input" data-field="tags" type="text" value="${this.escapeHtml(card.tagsInput || '')}" placeholder="${this.t('tagsHint')}" />

          <label class="editor-label">${this.t('cardContent')}</label>
          <textarea class="editor-textarea" data-field="content" rows="12">${this.escapeHtml(card.content || '')}</textarea>

          <div class="editor-preview">
            <h4>${this.t('preview')}</h4>
            <div class="card-content">${this.renderMarkdown(card.content || '')}</div>
          </div>
        </div>
        <div class="card-detail-footer">
          <button class="btn-secondary" data-action="cancel-edit">${this.t('cancel')}</button>
          <button class="btn-primary" data-action="save-card">${this.t('save')}</button>
        </div>
      </div>
    `;
  }

  async saveCardEdits() {
    if (!this.container || !this.state.editingCard) return;

    const titleInput = this.container.querySelector('.editor-input[data-field="title"]');
    const tagsInput = this.container.querySelector('.editor-input[data-field="tags"]');
    const contentInput = this.container.querySelector('.editor-textarea[data-field="content"]');

    const title = titleInput?.value?.trim() || this.state.editingCard.title;
    const content = contentInput?.value || '';
    const tags = this.parseTags(tagsInput?.value || '');

    await this.wikiService.updateCard(this.state.editingCard.id, {
      title,
      content,
      tags
    });

    this.state.editingCard = null;
    await this.selectModule(this.state.currentModule.id);
    this.showToast(this.t('saveSuccess'));
  }

  cancelEdit() {
    this.state.editingCard = null;
    this.render();
  }

  parseTags(raw) {
    if (!raw) return [];
    return raw
      .split(/[,#]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  getColumnName(columnId) {
    const column = this.state.columns.find(col => col.id === columnId);
    return column ? this.escapeHtml(column.name) : this.t('unknownColumn');
  }

  showToast(message, type = 'success') {
    this.context.ui?.toast?.(message, type);
  }

  startAutoSave() {
    const interval = this.context.settings?.autoSaveInterval || 5000;
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingChanges.size > 0) {
        await this.savePendingChanges();
      }
    }, interval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  async savePendingChanges() {
    for (const [cardId, changes] of this.pendingChanges) {
      try {
        await this.wikiService.updateCard(cardId, changes);
      } catch (error) {
        console.error('Failed to save card:', cardId, error);
      }
    }
    this.pendingChanges.clear();
  }
}

export default WikiPlugin;
