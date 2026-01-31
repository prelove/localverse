# Finder 插件规格

## 概述

Finder 是 Localverse 的文件搜索插件，提供类似 Everything 的快速文件搜索能力。

## 功能特性

1. **实时文件搜索**：输入即搜索，毫秒级响应
2. **全文检索**：支持文件内容搜索
3. **文件预览**：支持文本、图片、PDF 预览
4. **文件操作**：打开、复制路径、显示在文件夹中
5. **搜索过滤**：按类型、大小、日期过滤
6. **搜索历史**：记录和快速访问历史搜索

## manifest.json

```json
{
  "id": "finder",
  "name": {
    "zh": "文件搜索",
    "ja": "ファイル検索",
    "en": "Finder"
  },
  "version": "1.0.0",
  "description": {
    "zh": "快速搜索本地文件，支持全文检索和实时预览",
    "ja": "ローカルファイルを高速検索、全文検索とプレビュー対応",
    "en": "Fast local file search with full-text and preview support"
  },
  "icon": "🔍",
  "category": "productivity",
  
  "entry": "./index.js",
  "style": "./style.css",
  
  "location": {
    "sidebar": {
      "enabled": true,
      "order": 1
    },
    "shortcut": {
      "global": "Ctrl+Shift+F"
    }
  },
  
  "permissions": [
    "filesystem:read",
    "filesystem:watch",
    "database:read",
    "database:write",
    "clipboard:write"
  ],
  
  "dependencies": {
    "services": ["FileSystemService", "SearchService", "DatabaseService"]
  },
  
  "settings": {
    "watchPaths": {
      "type": "array",
      "default": [],
      "label": { "zh": "监视路径", "en": "Watch paths" }
    },
    "maxResults": {
      "type": "number",
      "default": 100,
      "min": 10,
      "max": 1000,
      "label": { "zh": "最大结果数", "en": "Max results" }
    },
    "includeHidden": {
      "type": "boolean",
      "default": false,
      "label": { "zh": "包含隐藏文件", "en": "Include hidden files" }
    },
    "enableContentSearch": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "启用内容搜索", "en": "Enable content search" }
    },
    "indexExtensions": {
      "type": "array",
      "default": ["txt", "md", "json", "js", "java", "py", "html", "css"],
      "label": { "zh": "索引的扩展名", "en": "Extensions to index" }
    }
  }
}
```

## 插件实现

```javascript
// plugins/finder/index.js

import Plugin from '../../core/plugin-base.js';

class FinderPlugin extends Plugin {
  static id = 'finder';
  
  constructor(context) {
    super(context);
    
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
    this.fileIndex = new Map();
  }
  
  // ============ 生命周期 ============
  
  async onInstall() {
    // 创建文件索引表
    await this.services.DatabaseService.exec(`
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
      );
      
      CREATE INDEX IF NOT EXISTS idx_finder_name ON finder_index(name);
      CREATE INDEX IF NOT EXISTS idx_finder_ext ON finder_index(extension);
      CREATE INDEX IF NOT EXISTS idx_finder_path ON finder_index(path);
      
      CREATE VIRTUAL TABLE IF NOT EXISTS finder_fts USING fts5(
        name,
        path,
        content,
        content='finder_index',
        content_rowid='rowid',
        tokenize='unicode61'
      );
    `);
  }
  
  async onActivate() {
    // 绑定全局快捷键
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
    
    // 启动文件监视（如果是完整模式）
    if (this.context.mode === 'full') {
      await this.startFileWatch();
    }
    
    // 初始索引
    await this.buildIndex();
  }
  
  async onDeactivate() {
    document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this));
    
    if (this.watchHandle) {
      this.watchHandle.stop();
    }
  }
  
  // ============ 渲染 ============
  
  render() {
    const { query, results, loading, selectedIndex, preview, filters } = this.state;
    
    return `
      <div class="finder">
        <div class="finder-header">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" 
                   class="search-input" 
                   placeholder="${this.t('searchPlaceholder')}"
                   value="${this.escapeHtml(query)}"
                   autofocus>
            <span class="search-shortcut">Ctrl+F</span>
          </div>
          
          <div class="filters">
            <select class="filter-type" value="${filters.type}">
              <option value="all">${this.t('allTypes')}</option>
              <option value="document">${this.t('documents')}</option>
              <option value="image">${this.t('images')}</option>
              <option value="code">${this.t('code')}</option>
              <option value="other">${this.t('other')}</option>
            </select>
          </div>
        </div>
        
        <div class="finder-body">
          <div class="results-panel ${preview ? 'with-preview' : ''}">
            ${loading ? this.renderLoading() : this.renderResults(results, selectedIndex)}
          </div>
          
          ${preview ? this.renderPreview(preview) : ''}
        </div>
        
        <div class="finder-footer">
          <span class="result-count">
            ${results.length} ${this.t('results')}
          </span>
          <span class="shortcuts-hint">
            ↑↓ ${this.t('navigate')} · Enter ${this.t('open')} · Ctrl+C ${this.t('copyPath')}
          </span>
        </div>
      </div>
    `;
  }
  
  renderResults(results, selectedIndex) {
    if (results.length === 0) {
      return `
        <div class="empty-state">
          <span class="empty-icon">📂</span>
          <p>${this.t('noResults')}</p>
        </div>
      `;
    }
    
    return `
      <ul class="result-list">
        ${results.map((result, index) => `
          <li class="result-item ${index === selectedIndex ? 'selected' : ''}"
              data-index="${index}"
              data-path="${this.escapeHtml(result.path)}">
            <span class="file-icon">${this.getFileIcon(result)}</span>
            <div class="file-info">
              <div class="file-name">${this.highlightMatch(result.name, this.state.query)}</div>
              <div class="file-path">${this.escapeHtml(result.path)}</div>
            </div>
            <div class="file-meta">
              <span class="file-size">${this.formatSize(result.size)}</span>
              <span class="file-date">${this.formatDate(result.modifiedAt)}</span>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }
  
  renderPreview(file) {
    return `
      <div class="preview-panel">
        <div class="preview-header">
          <span class="preview-title">${this.escapeHtml(file.name)}</span>
          <button class="preview-close" data-action="close-preview">×</button>
        </div>
        <div class="preview-content">
          ${this.getPreviewContent(file)}
        </div>
      </div>
    `;
  }
  
  renderLoading() {
    return `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${this.t('searching')}</p>
      </div>
    `;
  }
  
  // ============ 事件处理 ============
  
  bindEvents() {
    // 搜索输入
    this.$('.search-input')?.addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });
    
    // 过滤器
    this.$('.filter-type')?.addEventListener('change', (e) => {
      this.setState({
        filters: { ...this.state.filters, type: e.target.value }
      });
      this.performSearch();
    });
    
    // 结果项点击
    this.$('.result-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.result-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.selectResult(index);
        
        if (e.detail === 2) {  // 双击
          this.openSelectedFile();
        }
      }
    });
    
    // 键盘导航
    this.shadowRoot?.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
    
    // 关闭预览
    this.$('[data-action="close-preview"]')?.addEventListener('click', () => {
      this.setState({ preview: null });
    });
  }
  
  handleSearchInput(query) {
    this.setState({ query, loading: true });
    
    // 防抖
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
        }
        break;
    }
    
    // Ctrl+C 复制路径
    if (e.ctrlKey && e.key === 'c' && results[selectedIndex]) {
      this.copyPath(results[selectedIndex].path);
    }
  }
  
  handleGlobalKeydown(e) {
    // Ctrl+Shift+F 打开搜索
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      this.focus();
    }
  }
  
  // ============ 搜索逻辑 ============
  
  async performSearch() {
    const { query, filters } = this.state;
    
    if (!query.trim()) {
      this.setState({ results: [], loading: false });
      return;
    }
    
    try {
      let results;
      
      if (this.context.mode === 'full') {
        // 完整模式：通过 JAR 搜���真实文件系统
        results = await this.services.FileSystemService.search(query, {
          maxResults: this.getSetting('maxResults'),
          includeHidden: this.getSetting('includeHidden'),
          includeContent: this.getSetting('enableContentSearch')
        });
      } else {
        // 轻量模式：搜索本地索引
        results = await this.searchLocalIndex(query);
      }
      
      // 应用过滤器
      results = this.applyFilters(results, filters);
      
      this.setState({
        results,
        loading: false,
        selectedIndex: 0
      });
      
    } catch (error) {
      console.error('Search failed:', error);
      this.setState({ results: [], loading: false });
      this.context.ui.showToast(this.t('searchError'), 'error');
    }
  }
  
  async searchLocalIndex(query) {
    const ftsQuery = this.buildFtsQuery(query);
    
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
    `, [ftsQuery, this.getSetting('maxResults')]);
    
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
      // 类型过滤
      if (filters.type !== 'all') {
        const category = this.getFileCategory(result.extension);
        if (category !== filters.type) return false;
      }
      
      // 大小过滤
      if (filters.sizeRange) {
        if (result.size < filters.sizeRange.min || result.size > filters.sizeRange.max) {
          return false;
        }
      }
      
      // 日期过滤
      if (filters.dateRange) {
        if (result.modifiedAt < filters.dateRange.start || 
            result.modifiedAt > filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  // ============ 文件索引 ============
  
  async buildIndex() {
    const watchPaths = this.getSetting('watchPaths');
    
    if (watchPaths.length === 0) {
      return;
    }
    
    this.emit('index_start');
    
    try {
      for (const path of watchPaths) {
        await this.indexDirectory(path);
      }
      
      this.emit('index_complete');
    } catch (error) {
      console.error('Index build failed:', error);
      this.emit('index_error', error);
    }
  }
  
  async indexDirectory(dirPath) {
    const files = await this.services.FileSystemService.listDir(dirPath, {
      recursive: true,
      includeHidden: this.getSetting('includeHidden')
    });
    
    const batch = [];
    const now = Date.now();
    
    for (const file of files) {
      if (file.isDirectory) continue;
      
      batch.push({
        sql: `
          INSERT OR REPLACE INTO finder_index 
          (id, path, name, extension, size, mime_type, modified_at, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          this.generateId(),
          file.path,
          file.name,
          file.extension,
          file.size,
          file.mimeType,
          file.modifiedAt,
          now
        ]
      });
    }
    
    await this.services.DatabaseService.batch(batch);
    
    // 更新 FTS
    await this.services.DatabaseService.exec(`
      INSERT INTO finder_fts(finder_fts) VALUES('rebuild');
    `);
  }
  
  async startFileWatch() {
    const watchPaths = this.getSetting('watchPaths');
    
    if (watchPaths.length === 0) return;
    
    this.watchHandle = await this.services.FileSystemService.watch(
      watchPaths,
      (event) => this.handleFileChange(event)
    );
  }
  
  handleFileChange(event) {
    // 更新索引
    switch (event.type) {
      case 'created':
      case 'modified':
        this.indexFile(event.path);
        break;
      case 'deleted':
        this.removeFromIndex(event.path);
        break;
    }
  }
  
  // ============ 文件操作 ============
  
  selectResult(index) {
    const results = this.state.results;
    if (index >= 0 && index < results.length) {
      this.setState({
        selectedIndex: index,
        preview: results[index]
      });
      
      // 滚动到可见
      const item = this.$(`.result-item[data-index="${index}"]`);
      item?.scrollIntoView({ block: 'nearest' });
    }
  }
  
  async openSelectedFile() {
    const { results, selectedIndex } = this.state;
    const file = results[selectedIndex];
    
    if (!file) return;
    
    if (this.context.mode === 'full') {
      // 通过 JAR 打开文件
      await this.callService('FileSystemService', 'openFile', file.path);
    } else {
      // 虚拟模式：尝试预览或下载
      this.previewFile(file);
    }
  }
  
  async copyPath(path) {
    try {
      await navigator.clipboard.writeText(path);
      this.context.ui.showToast(this.t('pathCopied'), 'success');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }
  
  previewFile(file) {
    this.setState({ preview: file });
  }
  
  // ============ 辅助方法 ============
  
  getFileIcon(file) {
    const icons = {
      document: '📄',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      code: '📝',
      archive: '📦',
      folder: '📁',
      default: '📄'
    };
    
    const category = this.getFileCategory(file.extension);
    return icons[category] || icons.default;
  }
  
  getFileCategory(extension) {
    const categories = {
      document: ['txt', 'md', 'doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
      video: ['mp4', 'avi', 'mkv', 'mov', 'wmv'],
      audio: ['mp3', 'wav', 'flac', 'aac', 'ogg'],
      code: ['js', 'ts', 'java', 'py', 'html', 'css', 'json', 'xml', 'sql'],
      archive: ['zip', 'rar', '7z', 'tar', 'gz']
    };
    
    const ext = extension?.toLowerCase();
    
    for (const [category, exts] of Object.entries(categories)) {
      if (exts.includes(ext)) return category;
    }
    
    return 'other';
  }
  
  getPreviewContent(file) {
    const category = this.getFileCategory(file.extension);
    
    switch (category) {
      case 'image':
        return `<img src="${file.dataUrl || ''}" alt="${file.name}" class="preview-image">`;
      case 'code':
      case 'document':
        return `<pre class="preview-text">${this.escapeHtml(file.content || '')}</pre>`;
      default:
        return `<div class="preview-unsupported">${this.t('previewUnsupported')}</div>`;
    }
  }
  
  highlightMatch(text, query) {
    if (!query) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
  }
  
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  buildFtsQuery(query) {
    return query.split(/\s+/).filter(Boolean).join(' AND ');
  }
  
  generateId() {
    return 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  
  focus() {
    this.$('.search-input')?.focus();
  }
}

export default FinderPlugin;
```

## 样式

```css
/* plugins/finder/style.css */

.finder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-color);
}

.finder-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.search-box {
  display: flex;
  align-items: center;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 12px;
}

.search-icon {
  font-size: 16px;
  margin-right: 8px;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  height: 40px;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
}

.search-shortcut {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--gray-200);
  padding: 2px 6px;
  border-radius: 4px;
}

.filters {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.filter-type {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  font-size: 13px;
}

.finder-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.results-panel {
  flex: 1;
  overflow-y: auto;
}

.results-panel.with-preview {
  flex: 0 0 50%;
  border-right: 1px solid var(--border-color);
}

.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.result-item:hover {
  background: var(--hover-bg);
}

.result-item.selected {
  background: var(--active-bg);
}

.file-icon {
  font-size: 24px;
  margin-right: 12px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-name mark {
  background: var(--warning-color);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}

.file-path {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-panel {
  flex: 0 0 50%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.preview-title {
  flex: 1;
  font-weight: 500;
}

.preview-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: 4px;
}

.preview-close:hover {
  background: var(--hover-bg);
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.preview-image {
  max-width: 100%;
  height: auto;
}

.preview-text {
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}

.finder-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

## 多语言

```json
// plugins/finder/locales/zh.json
{
  "searchPlaceholder": "搜索文件...",
  "allTypes": "所有类型",
  "documents": "文档",
  "images": "图片",
  "code": "代码",
  "other": "其他",
  "results": "个结果",
  "noResults": "没有找到匹配的文件",
  "searching": "搜索中...",
  "navigate": "导航",
  "open": "打开",
  "copyPath": "复制路径",
  "pathCopied": "路径已复制",
  "searchError": "搜索出错",
  "previewUnsupported": "无法预览此文件类型"
}
```

## 测试用例

```javascript
describe('FinderPlugin', () => {
  let plugin;
  let mockContext;
  
  beforeEach(() => {
    mockContext = createMockPluginContext();
    plugin = new FinderPlugin(mockContext);
  });
  
  describe('搜索', () => {
    test('输入触发搜索', async () => {
      plugin.handleSearchInput('test');
      
      await wait(200);  // 等待防抖
      
      expect(plugin.state.loading).toBe(false);
    });
    
    test('空查询不搜索', async () => {
      plugin.handleSearchInput('');
      
      expect(plugin.state.results).toEqual([]);
    });
  });
  
  describe('键盘导航', () => {
    test('上下键选择', () => {
      plugin.setState({ results: [{}, {}, {}], selectedIndex: 0 });
      
      plugin.handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
      expect(plugin.state.selectedIndex).toBe(1);
      
      plugin.handleKeydown({ key: 'ArrowUp', preventDefault: () => {} });
      expect(plugin.state.selectedIndex).toBe(0);
    });
  });
  
  describe('过滤器', () => {
    test('类型过滤', () => {
      const results = [
        { extension: 'jpg' },
        { extension: 'txt' },
        { extension: 'js' }
      ];
      
      const filtered = plugin.applyFilters(results, { type: 'image' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].extension).toBe('jpg');
    });
  });
});
```

## 相关规格

- `services/filesystem-service.md`
- `services/search-service.md`
- `08-plugin-system.md`

## 相关任务

- `tasks/phase-1/task-003-finder-plugin.md`