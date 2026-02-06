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
      highlightQuery: '',
      focusedCardId: null,
      filters: {
        tags: [],
        dateRange: null
      },
      showBacklinks: false,
      editorPreviewEnabled: true
    };

    // Services
    this.wikiService = null;
    this.linkParser = new LinkParser();
    this.versionManager = null;

    // Auto-save
    this.autoSaveTimer = null;
    this.pendingChanges = new Map();
    this.editingOriginal = null;

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
    const isFocused = this.state.focusedCardId === card.id;

    return `
      <div class="card ${card.isPinned ? 'pinned' : ''} ${isFocused ? 'focused' : ''}" 
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
              const isFocused = this.state.focusedCardId === card.id;
              return `
                <tr data-card-id="${card.id}" data-action="select-card" class="${isFocused ? 'focused' : ''}">
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

    const backlinksCount = this.linkParser.findBacklinks(card.id, card.title, this.state.cards).length;
    const columnName = this.getColumnName(card.column_id);

    return `
      <div class="card-detail-panel">
        <div class="card-detail-header">
          <div class="card-detail-heading">
            <h2>${this.escapeHtml(card.title)}</h2>
            <div class="card-detail-subtitle">
              <span>${columnName}</span>
              <span>•</span>
              <span>${this.formatDate(card.updated_at)}</span>
            </div>
          </div>
          <button class="btn-icon" data-action="close-detail">✕</button>
        </div>
        <div class="card-detail-body">
          <div class="card-content">
            ${this.renderMarkdown(card.content, { highlightQuery: this.state.highlightQuery })}
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
            ${this.t('backlinks')} (${backlinksCount})
          </button>
        </div>
      </div>
    `;
  }

  renderBacklinks(card) {
    const backlinks = this.linkParser.findBacklinks(card.id, card.title, this.state.cards);
    
    return `
      <div class="backlinks-section">
        <div class="backlinks-header">
          <h3>${this.t('backlinks')}</h3>
          <span class="backlinks-count">${backlinks.length}</span>
        </div>
        ${backlinks.length === 0 
          ? `<p class="empty-state">${this.t('noBacklinks')}</p>`
          : `<ul class="backlinks-list">
              ${backlinks.map(bl => `
                <li data-card-id="${bl.cardId}" data-action="select-card">
                  <div class="backlink-title">${this.escapeHtml(bl.cardTitle)}</div>
                  <div class="backlink-meta">${this.getColumnName(bl.columnId)}</div>
                </li>
              `).join('')}
            </ul>`
        }
      </div>
    `;
  }

  renderSearchResults() {
    const results = this.state.searchResults || [];
    const query = this.state.searchQuery;

    return `
      <div class="search-results">
        <div class="search-results-header">
          <div>
            <h3>${this.t('searchResults')}</h3>
            <p class="search-results-subtitle">${this.t('searchResultsFor')} "${this.escapeHtml(query)}"</p>
          </div>
          <span class="search-results-count">${results.length}</span>
        </div>
        ${results.length === 0
          ? `<div class="empty-state">${this.t('noResults')}</div>`
          : `
            <ul class="search-results-list">
              ${results.map(card => `
                <li data-card-id="${card.id}" data-action="open-search-result">
                  <div class="result-title">${this.highlightText(card.title, query)}</div>
                  <div class="result-snippet">${this.getSearchSnippet(card, query)}</div>
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

    this.container.addEventListener('input', (e) => {
      const target = e.target;
      if (target.matches('.sidebar-search .search-input')) {
        this.handleSearch(target.value);
        return;
      }

      if (!this.state.editingCard) return;
      if (target.matches('.editor-input[data-field="title"]')) {
        this.state.editingCard.title = target.value;
      }
      if (target.matches('.editor-input[data-field="tags"]')) {
        this.state.editingCard.tagsInput = target.value;
        this.updateTagsPreview();
      }
      if (target.matches('.editor-textarea[data-field="content"]')) {
        this.state.editingCard.content = target.value;
      }

      this.updateEditorPreview();
    });
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
      'toggle-preview': () => this.togglePreview(),
      'switch-view': () => this.switchView(element.dataset.view),
      'search': () => this.handleSearch(element.value),
      'open-card-link': () => this.openCardFromLink(element.dataset.cardId),
      'create-missing-card': () => this.createMissingCardFromLink(element.dataset.linkTitle),
      'open-search-result': () => this.openSearchResult(element.dataset.cardId)
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
    this.state.highlightQuery = '';
    this.state.focusedCardId = null;
    
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

  async selectCard(cardId, options = {}) {
    const card = await this.wikiService.getCard(cardId);
    if (!card) {
      this.showToast(this.t('cardNotFound'), 'error');
      return;
    }

    this.state.selectedCard = card;
    this.state.showBacklinks = false;
    this.state.editingCard = null;
    this.editingOriginal = null;
    this.state.highlightQuery = options.highlightQuery || '';
    this.state.focusedCardId = options.focusedCardId || null;

    await this.render();
    this.scrollToFocusedCard();
    this.scrollToSearchHighlight();
  }

  async editCard(cardId) {
    const card = await this.wikiService.getCard(cardId);
    if (!card) return;

    this.state.editingCard = {
      ...card,
      tagsInput: (card.tags || []).join(', ')
    };
    this.editingOriginal = {
      title: card.title || '',
      content: card.content || '',
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

  async openCardById(cardId, options = {}) {
    const card = await this.wikiService.getCard(cardId);
    if (!card) {
      this.showToast(this.t('cardNotFound'), 'error');
      return;
    }

    const column = await this.wikiService.getColumn(card.column_id);
    if (column?.module_id && this.state.currentModule?.id !== column.module_id) {
      await this.selectModule(column.module_id);
    }

    await this.selectCard(cardId, options);
  }

  async openCardFromLink(cardId) {
    if (!cardId) return;
    await this.openCardById(cardId);
  }

  async openSearchResult(cardId) {
    if (!cardId) return;
    const highlightQuery = this.state.searchQuery;
    await this.openCardById(cardId, {
      highlightQuery,
      focusedCardId: cardId
    });
  }

  async createMissingCardFromLink(rawTitle) {
    const title = (rawTitle || '').trim();
    if (!title) return;

    if (!this.state.currentModule) {
      this.showToast(this.t('createModuleFirst'), 'warning');
      return;
    }

    const defaultColumn = this.state.columns[0];
    if (!defaultColumn) {
      this.showToast(this.t('createColumnFirst'), 'warning');
      return;
    }

    const card = await this.wikiService.createCard({
      columnId: defaultColumn.id,
      title,
      content: ''
    });

    await this.selectCard(card.id, { focusedCardId: card.id });
    await this.editCard(card.id);
  }

  closeDetail() {
    this.state.selectedCard = null;
    this.state.showBacklinks = false;
    this.state.editingCard = null;
    this.editingOriginal = null;
    this.state.highlightQuery = '';
    this.state.focusedCardId = null;
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

  togglePreview() {
    this.state.editorPreviewEnabled = !this.state.editorPreviewEnabled;
    this.render();
  }

  async handleSearch(query) {
    this.state.searchQuery = query;
    this.state.highlightQuery = '';
    this.state.focusedCardId = null;
    
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

  renderMarkdown(content, options = {}) {
    if (!content) return '';
    
    // Simple markdown rendering (in real implementation, use a proper markdown library)
    let html = content;
    
    // Render links
    html = this.linkParser.renderLinks(html, this.state.cards, {
      missingLinkTitle: this.t('missingLinkHint'),
      missingLinkAction: 'create-missing-card'
    });
    
    // Basic markdown (simplified)
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    
    const highlightQuery = options.highlightQuery;
    return this.applyHighlight(html, highlightQuery);
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(this.locale);
  }

  escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  highlightText(text, query) {
    const escaped = this.escapeHtml(text || '');
    if (!query) return escaped;
    const regex = new RegExp(this.escapeRegex(query), 'gi');
    return escaped.replace(regex, (match) => `<mark class="search-highlight">${match}</mark>`);
  }

  applyHighlight(html, query) {
    if (!query || !html) return html;
    const container = document.createElement('div');
    container.innerHTML = html;
    const regex = new RegExp(this.escapeRegex(query), 'gi');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach((node) => {
      const value = node.nodeValue;
      if (!value || !regex.test(value)) return;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      value.replace(regex, (match, offset) => {
        const before = value.slice(lastIndex, offset);
        if (before) {
          frag.appendChild(document.createTextNode(before));
        }
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = match;
        frag.appendChild(mark);
        lastIndex = offset + match.length;
        return match;
      });
      const after = value.slice(lastIndex);
      if (after) {
        frag.appendChild(document.createTextNode(after));
      }
      node.parentNode.replaceChild(frag, node);
    });
    return container.innerHTML;
  }

  getSearchSnippet(card, query, maxLength = 120) {
    const raw = (card.content || '')
      .replace(/[#*`\[\]]/g, '')
      .replace(/\n/g, ' ')
      .trim();
    if (!raw) return `<span class="result-snippet-empty">${this.t('noSnippet')}</span>`;
    if (!query) {
      return this.escapeHtml(raw.slice(0, maxLength)) + (raw.length > maxLength ? '...' : '');
    }
    const lower = raw.toLowerCase();
    const queryLower = query.toLowerCase();
    const index = lower.indexOf(queryLower);
    if (index === -1) {
      return this.escapeHtml(raw.slice(0, maxLength)) + (raw.length > maxLength ? '...' : '');
    }
    const start = Math.max(0, index - 40);
    const end = Math.min(raw.length, index + query.length + 40);
    const snippet = raw.slice(start, end);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < raw.length ? '...' : '';
    return `${prefix}${this.highlightText(snippet, query)}${suffix}`;
  }

  renderCardEditor(card) {
    const isDirty = this.isEditingDirty(card);
    const tagsPreview = this.parseTags(card.tagsInput || '').slice(0, 8);
    return `
      <div class="card-detail-panel">
        <div class="card-detail-header">
          <div class="card-detail-heading">
            <h2>${this.escapeHtml(card.title)}</h2>
            <div class="editor-status ${isDirty ? 'dirty' : ''}">
              ${isDirty ? this.t('unsavedChanges') : this.t('allChangesSaved')}
            </div>
          </div>
          <button class="btn-icon" data-action="cancel-edit">✕</button>
        </div>
        <div class="card-detail-body">
          <label class="editor-label">${this.t('cardTitle')}</label>
          <input class="editor-input" data-field="title" type="text" value="${this.escapeHtml(card.title)}" />

          <label class="editor-label">${this.t('tags')}</label>
          <input class="editor-input" data-field="tags" type="text" value="${this.escapeHtml(card.tagsInput || '')}" placeholder="${this.t('tagsHint')}" />
          <div class="tags-preview ${tagsPreview.length > 0 ? '' : 'is-empty'}" data-role="tags-preview">
            ${tagsPreview.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
          </div>

          <label class="editor-label">${this.t('cardContent')}</label>
          <textarea class="editor-textarea" data-field="content" rows="12">${this.escapeHtml(card.content || '')}</textarea>

          <div class="editor-hint">
            ${this.t('editorTips')}
          </div>

          ${this.state.editorPreviewEnabled ? `
            <div class="editor-preview">
              <div class="editor-preview-header">
                <h4>${this.t('preview')}</h4>
                <button class="btn-icon-small" data-action="toggle-preview">${this.t('hidePreview')}</button>
              </div>
              <div class="card-content">${this.renderMarkdown(card.content || '')}</div>
            </div>
          ` : `
            <button class="btn-secondary btn-preview-toggle" data-action="toggle-preview">${this.t('showPreview')}</button>
          `}
        </div>
        <div class="card-detail-footer">
          <button class="btn-secondary" data-action="cancel-edit">${this.t('cancel')}</button>
          <button class="btn-primary" data-action="save-card" ${isDirty ? '' : 'disabled'}>${this.t('save')}</button>
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

    try {
      await this.wikiService.updateCard(this.state.editingCard.id, {
        title,
        content,
        tags
      });

      this.state.editingCard = null;
      this.editingOriginal = null;
      await this.selectModule(this.state.currentModule.id);
      this.showToast(this.t('saveSuccess'));
    } catch (error) {
      console.error('Failed to save card', error);
      this.showToast(this.t('saveError'), 'error');
    }
  }

  cancelEdit() {
    if (this.isEditingDirty(this.state.editingCard)) {
      if (!confirm(this.t('discardChangesConfirm'))) return;
    }
    this.state.editingCard = null;
    this.editingOriginal = null;
    this.render();
  }

  parseTags(raw) {
    if (!raw) return [];
    return raw
      .split(/[,#]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  isEditingDirty(card) {
    if (!card || !this.editingOriginal) return false;
    return (
      (card.title || '') !== (this.editingOriginal.title || '') ||
      (card.content || '') !== (this.editingOriginal.content || '') ||
      (card.tagsInput || '') !== (this.editingOriginal.tagsInput || '')
    );
  }

  updateEditorPreview() {
    if (!this.container || !this.state.editingCard) return;
    const isDirty = this.isEditingDirty(this.state.editingCard);
    const status = this.container.querySelector('.editor-status');
    if (status) {
      status.textContent = isDirty ? this.t('unsavedChanges') : this.t('allChangesSaved');
      status.classList.toggle('dirty', isDirty);
    }
    const headerTitle = this.container.querySelector('.card-detail-header h2');
    if (headerTitle) {
      headerTitle.textContent = this.state.editingCard.title || this.t('cardTitle');
    }
    const saveButton = this.container.querySelector('.card-detail-footer .btn-primary');
    if (saveButton) {
      saveButton.disabled = !isDirty;
    }
    if (!this.state.editorPreviewEnabled) return;
    const preview = this.container.querySelector('.editor-preview .card-content');
    if (preview) {
      preview.innerHTML = this.renderMarkdown(this.state.editingCard.content || '');
    }
  }

  updateTagsPreview() {
    if (!this.container || !this.state.editingCard) return;
    const preview = this.container.querySelector('[data-role="tags-preview"]');
    if (!preview) return;
    const tags = this.parseTags(this.state.editingCard.tagsInput || '').slice(0, 8);
    preview.innerHTML = tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('');
    preview.classList.toggle('is-empty', tags.length === 0);
  }

  scrollToFocusedCard() {
    if (!this.container || !this.state.focusedCardId) return;
    requestAnimationFrame(() => {
      const selector = `[data-card-id="${this.state.focusedCardId}"]`;
      const cardEl = this.container.querySelector(`.card${selector}, .card-table tr${selector}`);
      if (cardEl?.scrollIntoView) {
        cardEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  scrollToSearchHighlight() {
    if (!this.container || !this.state.highlightQuery) return;
    requestAnimationFrame(() => {
      const highlight = this.container.querySelector('.card-detail-panel .search-highlight');
      if (highlight?.scrollIntoView) {
        highlight.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
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
