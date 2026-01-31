/**
 * Finder Plugin
 * Fast file search plugin with full-text search and preview support
 */

import { getFileIcon, getFileCategory } from './utils/file-icons.js';
import { formatSize, formatDate, escapeHtml, highlightMatch, buildFtsQuery } from './utils/formatters.js';

export default class FinderPlugin {
  static id = 'finder';
  
  constructor(context) {
    this.context = context;
    this.services = context.services;
    this.settings = context.settings || {};
    
    // Plugin state
    this.state = {
      query: '',
      results: [],
      loading: false,
      selectedIndex: 0,
      filters: {
        type: 'all',
        dateRange: null,
        sizeRange: null
      },
      preview: null
    };
    
    this.searchDebounceTimer = null;
    this.container = null;
    
    // Bind methods
    this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }
  
  // ============ Lifecycle Hooks ============
  
  async onInstall() {
    console.log('Finder plugin: Installing...');
    
    try {
      // Create file index tables
      await this.initDatabase();
      console.log('Finder plugin: Database initialized');
    } catch (error) {
      console.error('Finder plugin: Installation failed:', error);
      throw error;
    }
  }
  
  async onActivate() {
    console.log('Finder plugin: Activating...');
    
    try {
      // Bind global shortcut
      document.addEventListener('keydown', this.handleGlobalKeydown);
      
      // Start file watch in full mode
      if (this.context.mode === 'full') {
        await this.startFileWatch();
      }
      
      // Build initial index if watch paths configured
      const watchPaths = this.getSetting('watchPaths');
      if (watchPaths && watchPaths.length > 0) {
        // Index in background
        this.buildIndex().catch(error => {
          console.error('Finder plugin: Index build failed:', error);
        });
      }
      
      console.log('Finder plugin: Activated successfully');
    } catch (error) {
      console.error('Finder plugin: Activation failed:', error);
      throw error;
    }
  }
  
  async onDeactivate() {
    console.log('Finder plugin: Deactivating...');
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    
    // Stop file watch
    this.stopFileWatch();
    
    console.log('Finder plugin: Deactivated');
  }
  
  async onUninstall() {
    console.log('Finder plugin: Uninstalling...');
    
    try {
      // Clean up database
      await this.cleanupDatabase();
      console.log('Finder plugin: Uninstalled successfully');
    } catch (error) {
      console.error('Finder plugin: Uninstall failed:', error);
    }
  }
  
  // ============ Database Operations ============
  
  async initDatabase() {
    const db = this.services.DatabaseService;
    
    // Create file index table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS finder_index (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        extension TEXT,
        size INTEGER,
        mime_type TEXT,
        content_hash TEXT,
        content_indexed INTEGER DEFAULT 0,
        created_at INTEGER,
        modified_at INTEGER,
        indexed_at INTEGER NOT NULL
      )
    `);
    
    // Create indexes
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_name ON finder_index(name)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_ext ON finder_index(extension)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_path ON finder_index(path)`);
    
    // Create FTS5 virtual table
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS finder_fts USING fts5(
        name,
        path,
        content,
        content='finder_index',
        content_rowid='rowid',
        tokenize='unicode61'
      )
    `);
  }
  
  async cleanupDatabase() {
    const db = this.services.DatabaseService;
    
    await db.execute('DROP TABLE IF EXISTS finder_fts');
    await db.execute('DROP TABLE IF EXISTS finder_index');
  }
  
  // ============ Mount/Unmount ============
  
  mount(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }
  
  unmount() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
  
  // ============ Rendering ============
  
  render() {
    if (!this.container) return;
    
    const { query, results, loading, selectedIndex, preview, filters } = this.state;
    
    this.container.innerHTML = `
      <div class="finder">
        <div class="finder-header">
          ${this.renderSearchBox()}
          ${this.renderFilterBar()}
        </div>
        <div class="finder-body">
          <div class="results-panel ${preview ? 'with-preview' : ''}">
            ${loading ? this.renderLoading() : this.renderResults()}
          </div>
          ${preview ? this.renderPreview() : ''}
        </div>
        <div class="finder-footer">
          ${this.renderFooter()}
        </div>
      </div>
    `;
    
    // Re-bind events after render
    this.bindEvents();
  }
  
  renderSearchBox() {
    const { query } = this.state;
    
    return `
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input 
          type="text" 
          class="search-input" 
          placeholder="${this.t('searchPlaceholder') || 'Search files...'}"
          value="${escapeHtml(query)}"
          autofocus
        >
        <span class="search-shortcut">Ctrl+Shift+F</span>
      </div>
    `;
  }
  
  renderFilterBar() {
    const { filters } = this.state;
    
    return `
      <div class="filter-bar">
        <select class="filter-type" value="${filters.type}">
          <option value="all">${this.t('allTypes') || 'All Types'}</option>
          <option value="document">${this.t('documents') || 'Documents'}</option>
          <option value="image">${this.t('images') || 'Images'}</option>
          <option value="code">${this.t('code') || 'Code'}</option>
          <option value="other">${this.t('other') || 'Other'}</option>
        </select>
      </div>
    `;
  }
  
  renderResults() {
    const { results, selectedIndex, query } = this.state;
    
    if (results.length === 0) {
      return `
        <div class="empty-state">
          <span class="empty-icon">📂</span>
          <p>${this.t('noResults') || 'No files found'}</p>
        </div>
      `;
    }
    
    return `
      <ul class="result-list">
        ${results.map((result, index) => `
          <li class="result-item ${index === selectedIndex ? 'selected' : ''}"
              data-index="${index}"
              data-path="${escapeHtml(result.path)}">
            <span class="file-icon">${getFileIcon(result)}</span>
            <div class="file-info">
              <div class="file-name">${highlightMatch(result.name, query)}</div>
              <div class="file-path">${escapeHtml(result.path)}</div>
            </div>
            <div class="file-meta">
              <span class="file-size">${formatSize(result.size)}</span>
              <span class="file-date">${formatDate(result.modifiedAt)}</span>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }
  
  renderPreview() {
    const { preview } = this.state;
    
    if (!preview) return '';
    
    return `
      <div class="preview-panel">
        <div class="preview-header">
          <span class="preview-title">${escapeHtml(preview.name)}</span>
          <button class="preview-close" data-action="close-preview">×</button>
        </div>
        <div class="preview-content">
          ${this.getPreviewContent(preview)}
        </div>
      </div>
    `;
  }
  
  renderLoading() {
    return `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${this.t('searching') || 'Searching...'}</p>
      </div>
    `;
  }
  
  renderFooter() {
    const { results } = this.state;
    
    return `
      <span class="result-count">
        ${results.length} ${this.t('results') || 'results'}
      </span>
      <span class="shortcuts-hint">
        ↑↓ ${this.t('navigate') || 'navigate'} · 
        Enter ${this.t('open') || 'open'} · 
        Ctrl+C ${this.t('copyPath') || 'copy path'}
      </span>
    `;
  }
  
  getPreviewContent(file) {
    // Simplified preview - just show file info for now
    return `
      <div class="preview-info">
        <p><strong>Name:</strong> ${escapeHtml(file.name)}</p>
        <p><strong>Path:</strong> ${escapeHtml(file.path)}</p>
        <p><strong>Size:</strong> ${formatSize(file.size)}</p>
        <p><strong>Modified:</strong> ${formatDate(file.modifiedAt)}</p>
        <p><em>Preview functionality coming soon...</em></p>
      </div>
    `;
  }
  
  // ============ Event Handling ============
  
  bindEvents() {
    if (!this.container) return;
    
    // Search input
    const searchInput = this.container.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearchInput(e.target.value);
      });
      searchInput.addEventListener('keydown', this.handleKeydown);
    }
    
    // Filter change
    const filterType = this.container.querySelector('.filter-type');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.setState({
          filters: { ...this.state.filters, type: e.target.value }
        });
        this.performSearch();
      });
    }
    
    // Result list click
    const resultList = this.container.querySelector('.result-list');
    if (resultList) {
      resultList.addEventListener('click', (e) => {
        const item = e.target.closest('.result-item');
        if (item) {
          const index = parseInt(item.dataset.index);
          this.selectResult(index);
          
          if (e.detail === 2) {  // Double click
            this.openSelectedFile();
          }
        }
      });
    }
    
    // Close preview
    const closeBtn = this.container.querySelector('[data-action="close-preview"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.setState({ preview: null });
      });
    }
  }
  
  handleSearchInput(query) {
    this.setState({ query, loading: true });
    
    // Debounce search
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.performSearch();
    }, 150);
  }
  
  handleKeydown(e) {
    const { results, selectedIndex } = this.state;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.selectResult(Math.max(0, selectedIndex - 1));
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this.selectResult(Math.min(results.length - 1, selectedIndex + 1));
        break;
        
      case 'Enter':
        e.preventDefault();
        this.openSelectedFile();
        break;
        
      case 'Escape':
        if (this.state.preview) {
          this.setState({ preview: null });
        } else {
          this.setState({ query: '', results: [] });
        }
        break;
        
      case ' ':  // Space
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.previewSelectedFile();
        }
        break;
    }
    
    // Ctrl+C - Copy path
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && results[selectedIndex]) {
      e.preventDefault();
      this.copyPath(results[selectedIndex].path);
    }
  }
  
  handleGlobalKeydown(e) {
    // Ctrl+Shift+F - Open Finder
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      this.focus();
    }
  }
  
  // ============ Search Operations ============
  
  async performSearch() {
    const { query, filters } = this.state;
    
    if (!query.trim()) {
      this.setState({ results: [], loading: false });
      return;
    }
    
    try {
      let results;
      
      if (this.context.mode === 'full' && this.services.FileSystemService) {
        // Full mode: search through FileSystemService
        results = await this.searchFilesystem(query);
      } else {
        // Light/Pure mode: search local index
        results = await this.searchLocalIndex(query);
      }
      
      // Apply filters
      results = this.applyFilters(results, filters);
      
      this.setState({
        results,
        loading: false,
        selectedIndex: 0
      });
      
    } catch (error) {
      console.error('Finder plugin: Search failed:', error);
      this.setState({ results: [], loading: false });
      this.showError(this.t('searchError') || 'Search failed');
    }
  }
  
  async searchFilesystem(query) {
    // Search through FileSystemService
    // This is a simplified implementation - actual implementation would depend on the service API
    return await this.services.SearchService.searchFiles(query, {
      maxResults: this.getSetting('maxResults') || 100,
      includeHidden: this.getSetting('includeHidden') || false
    });
  }
  
  async searchLocalIndex(query) {
    const ftsQuery = buildFtsQuery(query);
    const maxResults = this.getSetting('maxResults') || 100;
    
    const results = await this.services.DatabaseService.query(`
      SELECT 
        f.id,
        f.path,
        f.name,
        f.extension,
        f.size,
        f.mime_type,
        f.modified_at,
        bm25(finder_fts) as score
      FROM finder_index f
      JOIN finder_fts ON f.rowid = finder_fts.rowid
      WHERE finder_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `, [ftsQuery, maxResults]);
    
    return results.map(r => ({
      id: r.id,
      path: r.path,
      name: r.name,
      extension: r.extension,
      size: r.size,
      mimeType: r.mime_type,
      modifiedAt: r.modified_at,
      score: r.score
    }));
  }
  
  applyFilters(results, filters) {
    return results.filter(result => {
      // Type filter
      if (filters.type !== 'all') {
        const category = getFileCategory(result.extension);
        if (category !== filters.type) return false;
      }
      
      // Size filter
      if (filters.sizeRange) {
        if (result.size < filters.sizeRange.min || result.size > filters.sizeRange.max) {
          return false;
        }
      }
      
      // Date filter
      if (filters.dateRange) {
        if (result.modifiedAt < filters.dateRange.start || 
            result.modifiedAt > filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  // ============ File Operations ============
  
  selectResult(index) {
    this.setState({ selectedIndex: index });
    
    // Scroll selected item into view
    const item = this.container?.querySelector(`.result-item[data-index="${index}"]`);
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  
  async openSelectedFile() {
    const { results, selectedIndex } = this.state;
    const file = results[selectedIndex];
    
    if (!file) return;
    
    try {
      // Attempt to open file through FileSystemService
      if (this.services.FileSystemService && this.services.FileSystemService.openFile) {
        await this.services.FileSystemService.openFile(file.path);
      } else {
        // Fallback: try to download/open via browser
        window.open(file.path, '_blank');
      }
    } catch (error) {
      console.error('Finder plugin: Failed to open file:', error);
      this.showError(this.t('openError') || 'Failed to open file');
    }
  }
  
  async previewSelectedFile() {
    const { results, selectedIndex } = this.state;
    const file = results[selectedIndex];
    
    if (!file) return;
    
    this.setState({ preview: file });
  }
  
  async copyPath(path) {
    try {
      await navigator.clipboard.writeText(path);
      this.showSuccess(this.t('pathCopied') || 'Path copied to clipboard');
    } catch (error) {
      console.error('Finder plugin: Failed to copy path:', error);
      this.showError(this.t('copyError') || 'Failed to copy path');
    }
  }
  
  // ============ File Indexing ============
  
  async buildIndex() {
    const watchPaths = this.getSetting('watchPaths') || [];
    
    if (watchPaths.length === 0) {
      console.log('Finder plugin: No watch paths configured');
      return;
    }
    
    console.log('Finder plugin: Building index for paths:', watchPaths);
    
    this.emit('index_start');
    
    try {
      for (const path of watchPaths) {
        await this.indexDirectory(path);
      }
      
      this.emit('index_complete');
      console.log('Finder plugin: Index build complete');
    } catch (error) {
      console.error('Finder plugin: Index build failed:', error);
      this.emit('index_error', error);
    }
  }
  
  async indexDirectory(dirPath) {
    // This would require FileSystemService to list directory recursively
    // Simplified implementation for now
    console.log('Finder plugin: Indexing directory:', dirPath);
  }
  
  async startFileWatch() {
    // File watching would be implemented here
    // Would require FileSystemService support
    console.log('Finder plugin: File watch started');
  }
  
  stopFileWatch() {
    // Stop file watching
    console.log('Finder plugin: File watch stopped');
  }
  
  // ============ Utility Methods ============
  
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.render();
  }
  
  getSetting(key) {
    return this.settings[key];
  }
  
  t(key) {
    // Translation helper - simplified
    // Would integrate with i18n service in real implementation
    const translations = {
      searchPlaceholder: 'Search files...',
      allTypes: 'All Types',
      documents: 'Documents',
      images: 'Images',
      code: 'Code',
      other: 'Other',
      noResults: 'No files found',
      searching: 'Searching...',
      results: 'results',
      navigate: 'navigate',
      open: 'open',
      copyPath: 'copy path',
      searchError: 'Search failed',
      openError: 'Failed to open file',
      copyError: 'Failed to copy path',
      pathCopied: 'Path copied to clipboard'
    };
    
    return translations[key] || key;
  }
  
  emit(event, data) {
    // Event emitter - simplified
    console.log('Finder plugin event:', event, data);
  }
  
  focus() {
    const searchInput = this.container?.querySelector('.search-input');
    searchInput?.focus();
  }
  
  showError(message) {
    // Show error toast
    console.error('Finder plugin:', message);
    if (this.context.ui && this.context.ui.showToast) {
      this.context.ui.showToast(message, 'error');
    }
  }
  
  showSuccess(message) {
    // Show success toast
    console.log('Finder plugin:', message);
    if (this.context.ui && this.context.ui.showToast) {
      this.context.ui.showToast(message, 'success');
    }
  }
}
