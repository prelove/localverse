/**
 * Finder Plugin
 * Fast file search plugin with full-text search and preview support
 */

import { getFileCategory } from './utils/file-icons.js';
import { formatSize, formatDate } from './utils/formatters.js';
import { t as translate } from './i18n.js';
import { FinderIndexer } from './services/indexer.js';
import { PreviewService } from './services/preview.js';
import { renderSearchBox } from './components/search-box.js';
import { renderFilterBar } from './components/filter-bar.js';
import { renderResultList } from './components/result-list.js';
import { renderPreview } from './components/preview.js';

export default class FinderPlugin {
  static id = 'finder';
  
  constructor(context) {
    this.context = context;
    this.services = context.services;
    this.settings = context.settings || {};
    
    // Detect locale from context or default to 'en'
    this.locale = context.locale || (context.i18n && context.i18n.locale) || 'en';
    
    // Plugin state
    this.state = {
      query: '',
      results: [],
      loading: false,
      selectedIndex: 0,
      filters: {
        type: 'all',
        dateRange: 'any',
        sizeRange: 'any',
        extension: ''
      },
      preview: null
    };
    
    this.searchDebounceTimer = null;
    this.container = null;
    this.indexer = null;
    this.previewService = null;
    this.previewData = null;
    
    // Bind methods
    this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }
  
  // ============ Lifecycle Hooks ============
  
  async onInstall() {
    console.log('Finder plugin: Installing...');
    
    try {
      this.indexer = new FinderIndexer({
        db: this.services.DatabaseService,
        fs: this.services.FileSystemService,
        settings: this.settings
      });
      this.previewService = new PreviewService({
        fs: this.services.FileSystemService
      });

      // Create file index tables
      await this.indexer.ensureSchema();
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
      await this.indexer?.clearSchema();
      console.log('Finder plugin: Uninstalled successfully');
    } catch (error) {
      console.error('Finder plugin: Uninstall failed:', error);
    }
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
          <div class="results-panel ${preview ? 'with-preview' : ''}" tabindex="0">
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

    return renderSearchBox({
      query,
      placeholder: this.t('searchPlaceholder') || 'Search files...',
      shortcut: 'Ctrl+Shift+F'
    });
  }
  
  renderFilterBar() {
    const { filters } = this.state;

    return renderFilterBar({
      filters,
      labels: {
        allTypes: this.t('allTypes') || 'All Types',
        documents: this.t('documents') || 'Documents',
        images: this.t('images') || 'Images',
        code: this.t('code') || 'Code',
        other: this.t('other') || 'Other',
        allSizes: this.t('allSizes') || 'Any Size',
        sizeSmall: this.t('sizeSmall') || 'Small (<1MB)',
        sizeMedium: this.t('sizeMedium') || 'Medium (1-10MB)',
        sizeLarge: this.t('sizeLarge') || 'Large (>10MB)',
        allDates: this.t('allDates') || 'Any Time',
        dateDay: this.t('dateDay') || 'Last 24h',
        dateWeek: this.t('dateWeek') || 'Last 7 days',
        dateMonth: this.t('dateMonth') || 'Last 30 days',
        dateYear: this.t('dateYear') || 'Last year',
        extensionPlaceholder: this.t('extensionPlaceholder') || 'Extension'
      }
    });
  }
  
  renderResults() {
    const { results, selectedIndex, query } = this.state;

    return renderResultList({
      results,
      selectedIndex,
      query,
      locale: this.locale,
      emptyLabel: this.t('noResults') || 'No files found'
    });
  }
  
  renderPreview() {
    const { preview } = this.state;

    const fallbackPreview = {
      type: 'info',
      content: this.t('previewNotAvailable') || 'Preview not available'
    };

    return renderPreview({
      file: preview,
      preview: this.previewData || fallbackPreview,
      labels: {
        filePath: this.t('filePath') || 'File Path:'
      }
    });
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
        ${this.t('previewShortcut') || 'Space preview'} ·
        Ctrl+C ${this.t('copyPath') || 'copy path'}
      </span>
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

    const filterSize = this.container.querySelector('.filter-size');
    if (filterSize) {
      filterSize.addEventListener('change', (e) => {
        this.setState({
          filters: { ...this.state.filters, sizeRange: e.target.value }
        });
        this.performSearch();
      });
    }

    const filterDate = this.container.querySelector('.filter-date');
    if (filterDate) {
      filterDate.addEventListener('change', (e) => {
        this.setState({
          filters: { ...this.state.filters, dateRange: e.target.value }
        });
        this.performSearch();
      });
    }

    const filterExtension = this.container.querySelector('.filter-extension');
    if (filterExtension) {
      filterExtension.addEventListener('input', (e) => {
        this.setState({
          filters: { ...this.state.filters, extension: e.target.value }
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
          this.container?.querySelector('.results-panel')?.focus();
          
          if (e.detail === 2) {  // Double click
            this.openSelectedFile();
          }
        }
      });
    }

    const resultsPanel = this.container.querySelector('.results-panel');
    if (resultsPanel) {
      resultsPanel.addEventListener('keydown', this.handleKeydown);
    }
    
    // Close preview
    const closeBtn = this.container.querySelector('[data-action="close-preview"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.previewData = null;
        this.setState({ preview: null });
      });
    }
  }
  
  handleSearchInput(query) {
    this.previewData = null;
    this.setState({ query, loading: true, preview: null });
    
    // Debounce search
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.performSearch();
    }, 150);
  }
  
  handleKeydown(e) {
    const { results, selectedIndex } = this.state;
    const isInputTarget = e.target?.classList?.contains('search-input');
    
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
        if (!isInputTarget) {
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
    const maxResults = this.getSetting('maxResults') || 100;

    if (!this.indexer) return [];

    return this.indexer.searchIndex(query, maxResults);
  }
  
  applyFilters(results, filters) {
    const sizeRanges = {
      small: { max: 1024 * 1024 },
      medium: { min: 1024 * 1024, max: 10 * 1024 * 1024 },
      large: { min: 10 * 1024 * 1024 }
    };
    const now = Date.now();
    const dateRanges = {
      day: now - 24 * 60 * 60 * 1000,
      week: now - 7 * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
      year: now - 365 * 24 * 60 * 60 * 1000
    };

    return results.filter(result => {
      // Type filter
      if (filters.type !== 'all') {
        const category = getFileCategory(result.extension);
        if (category !== filters.type) return false;
      }
      
      // Size filter
      if (filters.sizeRange && filters.sizeRange !== 'any') {
        const range = sizeRanges[filters.sizeRange];
        if (result.size == null) return false;
        if (range?.min && result.size < range.min) return false;
        if (range?.max && result.size > range.max) return false;
      }
      
      // Date filter
      if (filters.dateRange && filters.dateRange !== 'any') {
        const start = dateRanges[filters.dateRange];
        if (start && result.modifiedAt < start) return false;
      }

      if (filters.extension) {
        const fallbackExtension = result.name?.includes('.') ? result.name.split('.').pop() : '';
        const extension = (result.extension || fallbackExtension || '').toLowerCase();
        const target = filters.extension.trim().replace(/^\./, '').toLowerCase();
        if (target && extension !== target) return false;
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

    this.previewData = await this.previewService?.getPreview(file);
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
      await this.indexer?.buildIndex(watchPaths);
      
      this.emit('index_complete');
      console.log('Finder plugin: Index build complete');
    } catch (error) {
      console.error('Finder plugin: Index build failed:', error);
      this.emit('index_error', error);
    }
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
    // Translation helper using the i18n module
    return translate(key, this.locale);
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
