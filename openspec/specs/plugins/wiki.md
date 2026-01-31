# Wiki 插件规格

## 概述

Wiki 是 Localverse 的核心知识管理插件，提供类似 Notion/Obsidian 的知识库能力：
1. 模块-列表-卡片三级结构
2. Markdown 编辑和渲染
3. 双向链接
4. 标签系统
5. 全文搜索

## 功能特性

1. **三级结构**：模块 → 列表（列）→ 卡片
2. **富文本编辑**：Markdown + 所见即所得
3. **双向链接**：`[[卡片名]]` 语法
4. **标签系统**：`#标签` 语法
5. **附件支持**：图片、文件拖拽上传
6. **版本历史**：自动保存和版本回溯
7. **导入导出**：支持 Markdown、JSON 格式

## manifest.json

```json
{
  "id": "wiki",
  "name": {
    "zh": "知识库",
    "ja": "ナレッジベース",
    "en": "Wiki"
  },
  "version": "1.0.0",
  "description": {
    "zh": "模块化知识管理，支持 Markdown 和双向链接",
    "ja": "モジュール式ナレッジ管理、Markdownと双方向リンク対応",
    "en": "Modular knowledge management with Markdown and bidirectional links"
  },
  "icon": "📚",
  "category": "productivity",
  
  "entry": "./index.js",
  "style": "./style.css",
  
  "location": {
    "sidebar": {
      "enabled": true,
      "order": 2
    },
    "shortcut": {
      "global": "Ctrl+Shift+W"
    }
  },
  
  "permissions": [
    "database:read",
    "database:write",
    "filesystem:read",
    "filesystem:write",
    "clipboard:read",
    "clipboard:write"
  ],
  
  "dependencies": {
    "services": ["DatabaseService", "SearchService", "FileSystemService"]
  },
  
  "settings": {
    "defaultView": {
      "type": "select",
      "options": ["board", "list", "grid"],
      "default": "board",
      "label": { "zh": "默认视图", "en": "Default view" }
    },
    "autoSaveInterval": {
      "type": "number",
      "default": 5000,
      "min": 1000,
      "max": 60000,
      "label": { "zh": "自动保存间隔(ms)", "en": "Auto-save interval(ms)" }
    },
    "enableBidirectionalLinks": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "启用双向链接", "en": "Enable bidirectional links" }
    },
    "enableVersionHistory": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "启用版本历史", "en": "Enable version history" }
    }
  }
}
```

## 数据模型

```typescript
interface Module {
  id: string;              // UUID v7
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  syncStatus: SyncStatus;
  deleted: boolean;
}

interface Column {
  id: string;
  moduleId: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  syncStatus: SyncStatus;
  deleted: boolean;
}

interface Card {
  id: string;
  columnId: string;
  title: string;
  content: string;
  contentType: 'markdown' | 'richtext';
  tags: string[];
  attachments: Attachment[];
  metadata: Record<string, any>;
  sortOrder: number;
  isPinned: boolean;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  syncStatus: SyncStatus;
  deleted: boolean;
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

interface CardLink {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  linkType: 'reference' | 'embed';
  createdAt: number;
}

type SyncStatus = 'local' | 'syncing' | 'synced' | 'modified' | 'conflict';
```

## 插件实现

```javascript
// plugins/wiki/index.js

import Plugin from '../../core/plugin-base.js';
import MarkdownEditor from './components/markdown-editor.js';
import CardRenderer from './components/card-renderer.js';

class WikiPlugin extends Plugin {
  static id = 'wiki';
  
  constructor(context) {
    super(context);
    
    this.state = {
      modules: [],
      currentModule: null,
      columns: [],
      cards: [],
      selectedCard: null,
      editingCard: null,
      view: 'board',
      searchQuery: '',
      filters: {
        tags: [],
        dateRange: null
      }
    };
    
    this.editor = null;
    this.autoSaveTimer = null;
    this.pendingChanges = new Map();
  }
  
  // ============ 生命周期 ============
  
  async onInstall() {
    // 创建默认模块
    await this.createModule({
      name: this.t('defaultModuleName'),
      icon: '📝',
      color: '#1976d2'
    });
  }
  
  async onActivate() {
    // 加载数据
    await this.loadModules();
    
    // 选择第一个模块
    if (this.state.modules.length > 0) {
      await this.selectModule(this.state.modules[0].id);
    }
    
    // 启动自动保存
    this.startAutoSave();
    
    // 监听键盘快捷键
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }
  
  async onDeactivate() {
    // 保存未保存的更改
    await this.saveAllPending();
    
    // 停止自动保存
    this.stopAutoSave();
    
    document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }
  
  // ============ 数据操作 ============
  
  async loadModules() {
    const modules = await this.services.DatabaseService.query(`
      SELECT * FROM modules 
      WHERE deleted = 0 
      ORDER BY sort_order, created_at
    `);
    
    this.setState({ modules });
  }
  
  async selectModule(moduleId) {
    const module = this.state.modules.find(m => m.id === moduleId);
    if (!module) return;
    
    // 加载列
    const columns = await this.services.DatabaseService.query(`
      SELECT * FROM columns 
      WHERE module_id = ? AND deleted = 0 
      ORDER BY sort_order, created_at
    `, [moduleId]);
    
    // 加载卡片
    const cards = await this.services.DatabaseService.query(`
      SELECT * FROM cards 
      WHERE column_id IN (SELECT id FROM columns WHERE module_id = ?) 
        AND deleted = 0 
      ORDER BY sort_order, created_at
    `, [moduleId]);
    
    // 解析 JSON 字段
    const parsedCards = cards.map(card => ({
      ...card,
      tags: JSON.parse(card.tags || '[]'),
      attachments: JSON.parse(card.attachments || '[]'),
      metadata: JSON.parse(card.metadata || '{}')
    }));
    
    this.setState({
      currentModule: module,
      columns,
      cards: parsedCards,
      selectedCard: null,
      editingCard: null
    });
  }
  
  async createModule(data) {
    const id = this.generateId();
    const now = Date.now();
    const sortOrder = this.state.modules.length;
    
    await this.services.DatabaseService.run(`
      INSERT INTO modules (id, name, description, icon, color, sort_order, created_at, updated_at, version, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'local')
    `, [id, data.name, data.description || '', data.icon || '📁', data.color || '#666', sortOrder, now, now]);
    
    await this.loadModules();
    
    // 同步
    this.enqueueSync('create', 'module', id);
    
    return id;
  }
  
  async createColumn(moduleId, name) {
    const id = this.generateId();
    const now = Date.now();
    const columns = this.state.columns.filter(c => c.module_id === moduleId);
    const sortOrder = columns.length;
    
    await this.services.DatabaseService.run(`
      INSERT INTO columns (id, module_id, name, sort_order, created_at, updated_at, version, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'local')
    `, [id, moduleId, name, sortOrder, now, now]);
    
    // 重新加载
    await this.selectModule(moduleId);
    
    // 同步
    this.enqueueSync('create', 'column', id);
    
    return id;
  }
  
  async createCard(columnId, data = {}) {
    const id = this.generateId();
    const now = Date.now();
    const cards = this.state.cards.filter(c => c.column_id === columnId);
    const sortOrder = cards.length;
    
    const card = {
      id,
      column_id: columnId,
      title: data.title || this.t('newCard'),
      content: data.content || '',
      content_type: 'markdown',
      tags: JSON.stringify(data.tags || []),
      attachments: JSON.stringify(data.attachments || []),
      metadata: JSON.stringify(data.metadata || {}),
      sort_order: sortOrder,
      is_pinned: 0,
      created_at: now,
      updated_at: now,
      version: 1,
      sync_status: 'local'
    };
    
    await this.services.DatabaseService.run(`
      INSERT INTO cards (id, column_id, title, content, content_type, tags, attachments, metadata, sort_order, is_pinned, created_at, updated_at, version, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [card.id, card.column_id, card.title, card.content, card.content_type, card.tags, card.attachments, card.metadata, card.sort_order, card.is_pinned, card.created_at, card.updated_at, card.version, card.sync_status]);
    
    // 更新状态
    const newCard = {
      ...card,
      tags: data.tags || [],
      attachments: data.attachments || [],
      metadata: data.metadata || {}
    };
    
    this.setState({
      cards: [...this.state.cards, newCard],
      selectedCard: newCard,
      editingCard: newCard
    });
    
    // 同步
    this.enqueueSync('create', 'card', id);
    
    return id;
  }
  
  async updateCard(cardId, updates) {
    const card = this.state.cards.find(c => c.id === cardId);
    if (!card) return;
    
    const now = Date.now();
    const newVersion = card.version + 1;
    
    // 保存版本历史
    if (this.getSetting('enableVersionHistory')) {
      await this.saveCardVersion(card);
    }
    
    // 准备更新数据
    const updateFields = [];
    const updateValues = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = this.toSnakeCase(key);
      
      if (['tags', 'attachments', 'metadata'].includes(key)) {
        updateFields.push(`${dbKey} = ?`);
        updateValues.push(JSON.stringify(value));
      } else {
        updateFields.push(`${dbKey} = ?`);
        updateValues.push(value);
      }
    }
    
    updateFields.push('updated_at = ?', 'version = ?', "sync_status = 'modified'");
    updateValues.push(now, newVersion, cardId);
    
    await this.services.DatabaseService.run(`
      UPDATE cards SET ${updateFields.join(', ')} WHERE id = ?
    `, updateValues);
    
    // 更新状态
    const updatedCard = {
      ...card,
      ...updates,
      updated_at: now,
      version: newVersion,
      sync_status: 'modified'
    };
    
    this.setState({
      cards: this.state.cards.map(c => c.id === cardId ? updatedCard : c),
      selectedCard: this.state.selectedCard?.id === cardId ? updatedCard : this.state.selectedCard,
      editingCard: this.state.editingCard?.id === cardId ? updatedCard : this.state.editingCard
    });
    
    // 处理双向链接
    if (updates.content && this.getSetting('enableBidirectionalLinks')) {
      await this.updateCardLinks(cardId, updates.content);
    }
    
    // 标记待同步
    this.pendingChanges.set(cardId, updatedCard);
    
    // 同步
    this.enqueueSync('update', 'card', cardId);
  }
  
  async deleteCard(cardId) {
    const now = Date.now();
    
    await this.services.DatabaseService.run(`
      UPDATE cards SET deleted = 1, deleted_at = ?, sync_status = 'modified' WHERE id = ?
    `, [now, cardId]);
    
    this.setState({
      cards: this.state.cards.filter(c => c.id !== cardId),
      selectedCard: this.state.selectedCard?.id === cardId ? null : this.state.selectedCard,
      editingCard: this.state.editingCard?.id === cardId ? null : this.state.editingCard
    });
    
    // 同步
    this.enqueueSync('delete', 'card', cardId);
  }
  
  async moveCard(cardId, targetColumnId, targetIndex) {
    const card = this.state.cards.find(c => c.id === cardId);
    if (!card) return;
    
    const now = Date.now();
    
    // 更新卡片的列
    await this.services.DatabaseService.run(`
      UPDATE cards SET column_id = ?, sort_order = ?, updated_at = ?, sync_status = 'modified' WHERE id = ?
    `, [targetColumnId, targetIndex, now, cardId]);
    
    // 重新排序同列的其他卡片
    const cardsInColumn = this.state.cards
      .filter(c => c.column_id === targetColumnId && c.id !== cardId)
      .sort((a, b) => a.sort_order - b.sort_order);
    
    for (let i = 0; i < cardsInColumn.length; i++) {
      const order = i >= targetIndex ? i + 1 : i;
      if (cardsInColumn[i].sort_order !== order) {
        await this.services.DatabaseService.run(`
          UPDATE cards SET sort_order = ? WHERE id = ?
        `, [order, cardsInColumn[i].id]);
      }
    }
    
    // 重新加载
    await this.selectModule(this.state.currentModule.id);
  }
  
  // ============ 双向链接 ============
  
  async updateCardLinks(cardId, content) {
    // 解析 [[链接]] 语法
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const linkText = match[1];
      
      // 查找目标卡片
      const targetCard = this.state.cards.find(c => 
        c.title.toLowerCase() === linkText.toLowerCase()
      );
      
      if (targetCard) {
        links.push({
          id: this.generateId(),
          source_card_id: cardId,
          target_card_id: targetCard.id,
          link_type: 'reference',
          created_at: Date.now()
        });
      }
    }
    
    // 删除旧链接
    await this.services.DatabaseService.run(`
      DELETE FROM card_links WHERE source_card_id = ?
    `, [cardId]);
    
    // 插入新链接
    for (const link of links) {
      await this.services.DatabaseService.run(`
        INSERT INTO card_links (id, source_card_id, target_card_id, link_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [link.id, link.source_card_id, link.target_card_id, link.link_type, link.created_at]);
    }
  }
  
  async getBacklinks(cardId) {
    return await this.services.DatabaseService.query(`
      SELECT c.* FROM cards c
      JOIN card_links l ON c.id = l.source_card_id
      WHERE l.target_card_id = ? AND c.deleted = 0
    `, [cardId]);
  }
  
  // ============ 版本历史 ============
  
  async saveCardVersion(card) {
    await this.services.DatabaseService.run(`
      INSERT INTO version_history (id, entity_type, entity_id, version, data, change_type, created_at)
      VALUES (?, 'card', ?, ?, ?, 'update', ?)
    `, [this.generateId(), card.id, card.version, JSON.stringify(card), Date.now()]);
  }
  
  async getCardHistory(cardId) {
    return await this.services.DatabaseService.query(`
      SELECT * FROM version_history 
      WHERE entity_type = 'card' AND entity_id = ?
      ORDER BY version DESC
      LIMIT 50
    `, [cardId]);
  }
  
  async restoreCardVersion(cardId, version) {
    const history = await this.services.DatabaseService.queryOne(`
      SELECT data FROM version_history 
      WHERE entity_type = 'card' AND entity_id = ? AND version = ?
    `, [cardId, version]);
    
    if (!history) return;
    
    const oldData = JSON.parse(history.data);
    await this.updateCard(cardId, {
      title: oldData.title,
      content: oldData.content,
      tags: oldData.tags
    });
  }
  
  // ============ 渲染 ============
  
  render() {
    const { modules, currentModule, columns, cards, selectedCard, editingCard, view } = this.state;
    
    return `
      <div class="wiki">
        <div class="wiki-sidebar">
          ${this.renderModuleList(modules, currentModule)}
        </div>
        
        <div class="wiki-main">
          <div class="wiki-header">
            ${this.renderHeader(currentModule)}
          </div>
          
          <div class="wiki-content">
            ${view === 'board' 
              ? this.renderBoardView(columns, cards)
              : this.renderListView(cards)
            }
          </div>
        </div>
        
        ${editingCard ? this.renderEditor(editingCard) : ''}
        ${selectedCard && !editingCard ? this.renderCardDetail(selectedCard) : ''}
      </div>
    `;
  }
  
  renderModuleList(modules, currentModule) {
    return `
      <div class="module-list">
        <div class="module-list-header">
          <span>${this.t('modules')}</span>
          <button class="btn-icon" data-action="create-module">+</button>
        </div>
        <ul class="module-items">
          ${modules.map(mod => `
            <li class="module-item ${mod.id === currentModule?.id ? 'active' : ''}"
                data-module-id="${mod.id}">
              <span class="module-icon" style="color: ${mod.color}">${mod.icon}</span>
              <span class="module-name">${this.escapeHtml(mod.name)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }
  
  renderHeader(module) {
    if (!module) return '';
    
    return `
      <div class="wiki-header-content">
        <h1 class="module-title">
          <span class="title-icon">${module.icon}</span>
          ${this.escapeHtml(module.name)}
        </h1>
        
        <div class="header-actions">
          <div class="search-box">
            <input type="text" 
                   class="search-input" 
                   placeholder="${this.t('searchCards')}"
                   value="${this.state.searchQuery}">
          </div>
          
          <div class="view-switcher">
            <button class="btn-icon ${this.state.view === 'board' ? 'active' : ''}" 
                    data-view="board" title="${this.t('boardView')}">
              ☷
            </button>
            <button class="btn-icon ${this.state.view === 'list' ? 'active' : ''}" 
                    data-view="list" title="${this.t('listView')}">
              ☰
            </button>
          </div>
          
          <button class="btn-primary" data-action="create-card">
            + ${this.t('newCard')}
          </button>
        </div>
      </div>
    `;
  }
  
  renderBoardView(columns, cards) {
    return `
      <div class="board-view">
        ${columns.map(column => `
          <div class="board-column" data-column-id="${column.id}">
            <div class="column-header">
              <h3 class="column-title">${this.escapeHtml(column.name)}</h3>
              <span class="column-count">${cards.filter(c => c.column_id === column.id).length}</span>
              <button class="btn-icon" data-action="add-card" data-column-id="${column.id}">+</button>
            </div>
            <div class="column-cards" data-column-id="${column.id}">
              ${cards
                .filter(c => c.column_id === column.id)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(card => this.renderCardItem(card))
                .join('')}
            </div>
          </div>
        `).join('')}
        
        <div class="board-column add-column">
          <button class="btn-add-column" data-action="create-column">
            + ${this.t('addColumn')}
          </button>
        </div>
      </div>
    `;
  }
  
  renderCardItem(card) {
    const tagColors = ['#e3f2fd', '#fce4ec', '#e8f5e9', '#fff3e0', '#f3e5f5'];
    
    return `
      <div class="card-item ${card.is_pinned ? 'pinned' : ''}" 
           data-card-id="${card.id}"
           draggable="true">
        ${card.is_pinned ? '<span class="pin-icon">📌</span>' : ''}
        <h4 class="card-title">${this.escapeHtml(card.title)}</h4>
        ${card.content ? `
          <p class="card-preview">${this.escapeHtml(this.truncate(card.content, 100))}</p>
        ` : ''}
        ${card.tags.length > 0 ? `
          <div class="card-tags">
            ${card.tags.slice(0, 3).map((tag, i) => `
              <span class="tag" style="background: ${tagColors[i % tagColors.length]}">${tag}</span>
            `).join('')}
            ${card.tags.length > 3 ? `<span class="tag-more">+${card.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
        <div class="card-meta">
          <span class="card-date">${this.formatDate(card.updated_at)}</span>
          ${card.attachments.length > 0 ? `<span class="card-attachments">📎 ${card.attachments.length}</span>` : ''}
        </div>
      </div>
    `;
  }
  
  renderEditor(card) {
    return `
      <div class="editor-overlay">
        <div class="editor-container">
          <div class="editor-header">
            <input type="text" 
                   class="editor-title" 
                   value="${this.escapeHtml(card.title)}"
                   placeholder="${this.t('cardTitle')}">
            <div class="editor-actions">
              <button class="btn-icon" data-action="save-card" title="${this.t('save')}">💾</button>
              <button class="btn-icon" data-action="close-editor" title="${this.t('close')}">×</button>
            </div>
          </div>
          
          <div class="editor-body">
            <div class="editor-toolbar">
              <button class="toolbar-btn" data-format="bold" title="Bold">B</button>
              <button class="toolbar-btn" data-format="italic" title="Italic">I</button>
              <button class="toolbar-btn" data-format="link" title="Link">🔗</button>
              <button class="toolbar-btn" data-format="code" title="Code">{ }</button>
              <button class="toolbar-btn" data-format="list" title="List">☰</button>
              <span class="toolbar-divider"></span>
              <button class="toolbar-btn" data-action="upload-image" title="Image">🖼️</button>
              <button class="toolbar-btn" data-action="upload-file" title="File">📎</button>
            </div>
            
            <textarea class="editor-content" placeholder="${this.t('startWriting')}">${this.escapeHtml(card.content)}</textarea>
          </div>
          
          <div class="editor-footer">
            <div class="tag-editor">
              <span class="tag-label">${this.t('tags')}:</span>
              <div class="tag-list">
                ${card.tags.map(tag => `
                  <span class="tag editable">
                    ${tag}
                    <button class="tag-remove" data-tag="${tag}">×</button>
                  </span>
                `).join('')}
                <input type="text" class="tag-input" placeholder="${this.t('addTag')}">
              </div>
            </div>
            
            <div class="editor-meta">
              <span>${this.t('lastSaved')}: ${this.formatTime(card.updated_at)}</span>
              <span class="sync-status ${card.sync_status}">${this.t(card.sync_status)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  renderCardDetail(card) {
    return `
      <div class="card-detail-overlay" data-action="close-detail">
        <div class="card-detail" onclick="event.stopPropagation()">
          <div class="detail-header">
            <h2 class="detail-title">${this.escapeHtml(card.title)}</h2>
            <div class="detail-actions">
              <button class="btn-icon" data-action="edit-card" data-card-id="${card.id}">✏️</button>
              <button class="btn-icon" data-action="delete-card" data-card-id="${card.id}">🗑️</button>
              <button class="btn-icon" data-action="close-detail">×</button>
            </div>
          </div>
          
          <div class="detail-body">
            <div class="detail-content markdown-body">
              ${this.renderMarkdown(card.content)}
            </div>
            
            ${card.tags.length > 0 ? `
              <div class="detail-tags">
                ${card.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
              </div>
            ` : ''}
            
            ${card.attachments.length > 0 ? `
              <div class="detail-attachments">
                <h4>${this.t('attachments')}</h4>
                ${card.attachments.map(att => `
                  <a class="attachment-item" href="${att.url}" target="_blank">
                    <span class="attachment-icon">📎</span>
                    <span class="attachment-name">${att.name}</span>
                    <span class="attachment-size">${this.formatSize(att.size)}</span>
                  </a>
                `).join('')}
              </div>
            ` : ''}
          </div>
          
          <div class="detail-footer">
            <span>${this.t('created')}: ${this.formatDateTime(card.created_at)}</span>
            <span>${this.t('updated')}: ${this.formatDateTime(card.updated_at)}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // ============ 事件绑定 ============
  
  bindEvents() {
    // 模块选择
    this.$$('.module-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectModule(item.dataset.moduleId);
      });
    });
    
    // 创建模块
    this.$('[data-action="create-module"]')?.addEventListener('click', async () => {
      const name = await this.context.ui.showPrompt(this.t('moduleName'));
      if (name) {
        await this.createModule({ name });
      }
    });
    
    // 创建列
    this.$('[data-action="create-column"]')?.addEventListener('click', async () => {
      const name = await this.context.ui.showPrompt(this.t('columnName'));
      if (name && this.state.currentModule) {
        await this.createColumn(this.state.currentModule.id, name);
      }
    });
    
    // 创建卡片
    this.$$('[data-action="create-card"], [data-action="add-card"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const columnId = btn.dataset.columnId || this.state.columns[0]?.id;
        if (columnId) {
          await this.createCard(columnId);
        }
      });
    });
    
    // 卡片点击
    this.$$('.card-item').forEach(item => {
      item.addEventListener('click', () => {
        const cardId = item.dataset.cardId;
        const card = this.state.cards.find(c => c.id === cardId);
        this.setState({ selectedCard: card });
      });
      
      item.addEventListener('dblclick', () => {
        const cardId = item.dataset.cardId;
        const card = this.state.cards.find(c => c.id === cardId);
        this.setState({ editingCard: card });
      });
    });
    
    // 视图切换
    this.$$('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setState({ view: btn.dataset.view });
      });
    });
    
    // 搜索
    this.$('.search-input')?.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });
    
    // 编辑器事件
    this.bindEditorEvents();
    
    // 拖拽
    this.bindDragEvents();
  }
  
  bindEditorEvents() {
    // 标题变更
    this.$('.editor-title')?.addEventListener('input', (e) => {
      this.handleEditorChange('title', e.target.value);
    });
    
    // 内容变更
    this.$('.editor-content')?.addEventListener('input', (e) => {
      this.handleEditorChange('content', e.target.value);
    });
    
    // 保存
    this.$('[data-action="save-card"]')?.addEventListener('click', () => {
      this.saveCurrentCard();
    });
    
    // 关闭
    this.$('[data-action="close-editor"]')?.addEventListener('click', () => {
      this.closeEditor();
    });
    
    // 标签
    this.$('.tag-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        this.addTag(e.target.value.trim());
        e.target.value = '';
      }
    });
    
    this.$$('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeTag(btn.dataset.tag);
      });
    });
  }
  
  bindDragEvents() {
    this.$$('.card-item').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.cardId);
        card.classList.add('dragging');
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });
    
    this.$$('.column-cards').forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });
      
      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });
      
      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        const cardId = e.dataTransfer.getData('text/plain');
        const targetColumnId = column.dataset.columnId;
        const cards = column.querySelectorAll('.card-item');
        const targetIndex = cards.length;
        
        this.moveCard(cardId, targetColumnId, targetIndex);
      });
    });
  }
  
  // ============ 辅助方法 ============
  
  handleEditorChange(field, value) {
    if (!this.state.editingCard) return;
    
    // 更新本地状态
    const updated = {
      ...this.state.editingCard,
      [field]: value
    };
    
    this.setState({ editingCard: updated });
    
    // 标记待保存
    this.pendingChanges.set(updated.id, { [field]: value });
  }
  
  async saveCurrentCard() {
    const card = this.state.editingCard;
    if (!card) return;
    
    const changes = this.pendingChanges.get(card.id);
    if (changes) {
      await this.updateCard(card.id, changes);
      this.pendingChanges.delete(card.id);
    }
    
    this.context.ui.showToast(this.t('saved'), 'success');
  }
  
  closeEditor() {
    this.saveCurrentCard();
    this.setState({ editingCard: null });
  }
  
  addTag(tag) {
    const card = this.state.editingCard;
    if (!card || card.tags.includes(tag)) return;
    
    const newTags = [...card.tags, tag];
    this.handleEditorChange('tags', newTags);
    this.setState({
      editingCard: { ...card, tags: newTags }
    });
  }
  
  removeTag(tag) {
    const card = this.state.editingCard;
    if (!card) return;
    
    const newTags = card.tags.filter(t => t !== tag);
    this.handleEditorChange('tags', newTags);
    this.setState({
      editingCard: { ...card, tags: newTags }
    });
  }
  
  handleSearch(query) {
    this.setState({ searchQuery: query });
    // 实现搜索过滤逻辑
  }
  
  startAutoSave() {
    const interval = this.getSetting('autoSaveInterval');
    
    this.autoSaveTimer = setInterval(() => {
      this.saveAllPending();
    }, interval);
  }
  
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  async saveAllPending() {
    for (const [cardId, changes] of this.pendingChanges) {
      await this.updateCard(cardId, changes);
    }
    this.pendingChanges.clear();
  }
  
  enqueueSync(action, type, id) {
    // 添加到同步队列
    this.eventBus.emit('sync:enqueue', { action, entityType: type, entityId: id });
  }
  
  renderMarkdown(content) {
    // 简单的 Markdown 渲染（实际应使用专门的库）
    if (!content) return '';
    
    return content
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link" href="#/wiki/card/$1">$1</a>')
      .replace(/\n/g, '<br>');
  }
  
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
  
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString();
  }
  
  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }
  
  formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
  
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
  
  generateId() {
    return 'card_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  
  handleGlobalKeydown(e) {
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      this.saveCurrentCard();
    }
    
    // Escape 关闭编辑器
    if (e.key === 'Escape') {
      if (this.state.editingCard) {
        this.closeEditor();
      } else if (this.state.selectedCard) {
        this.setState({ selectedCard: null });
      }
    }
  }
}

export default WikiPlugin;
```

## 多语言

```json
// plugins/wiki/locales/zh.json
{
  "modules": "模块",
  "defaultModuleName": "我的知识库",
  "newCard": "新建卡片",
  "cardTitle": "卡片标题",
  "startWriting": "开始写作...",
  "searchCards": "搜索卡片...",
  "boardView": "看板视图",
  "listView": "列表视图",
  "addColumn": "添加列表",
  "moduleName": "请输入模块名称",
  "columnName": "请输入列表名称",
  "tags": "标签",
  "addTag": "添加标签",
  "attachments": "附件",
  "created": "创建于",
  "updated": "更新于",
  "lastSaved": "上次保存",
  "save": "保存",
  "close": "关闭",
  "saved": "已保存",
  "local": "本地",
  "syncing": "同步中",
  "synced": "已同步",
  "modified": "已修改",
  "conflict": "冲突"
}
```

## 测试用例

```javascript
describe('WikiPlugin', () => {
  let plugin;
  let mockContext;
  
  beforeEach(async () => {
    mockContext = createMockPluginContext();
    plugin = new WikiPlugin(mockContext);
    await plugin.onInstall();
    await plugin.onActivate();
  });
  
  describe('模块管理', () => {
    test('创建模块', async () => {
      const id = await plugin.createModule({ name: '测试模块' });
      expect(id).toBeDefined();
      expect(plugin.state.modules.find(m => m.id === id)).toBeDefined();
    });
  });
  
  describe('卡片管理', () => {
    test('创建卡片', async () => {
      const columnId = plugin.state.columns[0]?.id;
      const cardId = await plugin.createCard(columnId, { title: '测试卡片' });
      
      expect(cardId).toBeDefined();
      expect(plugin.state.cards.find(c => c.id === cardId)).toBeDefined();
    });
    
    test('更新卡片', async () => {
      const card = plugin.state.cards[0];
      await plugin.updateCard(card.id, { title: '更新后的标题' });
      
      const updated = plugin.state.cards.find(c => c.id === card.id);
      expect(updated.title).toBe('更新后的标题');
    });
    
    test('删除卡片', async () => {
      const card = plugin.state.cards[0];
      await plugin.deleteCard(card.id);
      
      expect(plugin.state.cards.find(c => c.id === card.id)).toBeUndefined();
    });
  });
  
  describe('双向链接', () => {
    test('解析链接', async () => {
      const card1 = await plugin.createCard(plugin.state.columns[0].id, { title: '卡片A' });
      const card2 = await plugin.createCard(plugin.state.columns[0].id, { 
        title: '卡片B',
        content: '链接到 [[卡片A]]'
      });
      
      const backlinks = await plugin.getBacklinks(card1);
      expect(backlinks.length).toBe(1);
    });
  });
});
```

## 相关规格

- `05-database.md` - 数据库设计
- `08-plugin-system.md` - 插件系统
- `services/search-service.md` - 搜索服务

## 相关任务

- `tasks/phase-1/task-004-wiki-plugin.md`