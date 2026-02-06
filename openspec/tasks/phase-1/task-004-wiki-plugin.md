# Task 004: Wiki 知识库插件开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase1-task-004-wiki-plugin |
| 阶段 | Phase 1 - 核心应用 |
| 优先级 | P0 (最高) |
| 预估工时 | 16 小时 |
| 依赖 | Phase 0 所有任务 + task-001-frontend-core |
| 产出 | Wiki 知识库插件 |
| 状态 | 🔵 开发中 |

## 目标

开发 Wiki 知识库插件，实现：
1. 模块-列表-卡片三级结构
2. Markdown 编辑和渲染
3. 双向链接系统
4. 标签管理
5. 全文搜索集成
6. 版本历史

## 详细需求

### 1. 三级数据结构

```
模块 (Module)
  └── 列 (Column)
        └── 卡片 (Card)

示例：
📚 技术文档 (模块)
  ├── 📋 前端开发 (列)
  │     ├── 📝 React 最佳实践 (卡片)
  │     └── 📝 CSS 技巧集锦 (卡片)
  └── 📋 后端开发 (列)
        ├── 📝 Java 多线程 (卡片)
        └── 📝 数据库优化 (卡片)
```

### 2. 核心功能

#### 模块管理
- ✅ 创建/编辑/删除模块
- ✅ 模块排序
- ✅ 模块图标和颜色自定义
- ✅ 模块描述

#### 列管理
- ✅ 在模块内创建/编辑/删除列
- ✅ 列排序（拖拽）
- ✅ 列颜色自定义

#### 卡片管理
- ✅ 创建/编辑/删除卡片
- ✅ 卡片在列间移动（拖拽）
- ✅ 卡片排序
- ✅ 卡片置顶
- ✅ Markdown 内容编辑
- ✅ 标签添加/删除
- ✅ 附件上传

#### 编辑器功能
- ✅ Markdown 实时预览
- ✅ 双向链接 `[[卡片名]]`
- ✅ 标签 `#标签名`
- ✅ 图片拖拽上传
- ✅ 代码高亮
- ✅ 表格支持
- ✅ 任务列表 `- [ ]`

#### 搜索功能
- ✅ 全文搜索卡片内容
- ✅ 按标签筛选
- ✅ 按模块/列筛选
- ✅ 搜索结果高亮

### 3. 数据库设计

```sql
-- 模块表
CREATE TABLE wiki_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT DEFAULT 'local',
  deleted INTEGER DEFAULT 0
);

-- 列表
CREATE TABLE wiki_columns (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT DEFAULT 'local',
  deleted INTEGER DEFAULT 0,
  FOREIGN KEY (module_id) REFERENCES wiki_modules(id) ON DELETE CASCADE
);

-- 卡片表
CREATE TABLE wiki_cards (
  id TEXT PRIMARY KEY,
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT DEFAULT 'markdown',
  tags TEXT,
  attachments TEXT,
  metadata TEXT,
  sort_order INTEGER NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT DEFAULT 'local',
  deleted INTEGER DEFAULT 0,
  FOREIGN KEY (column_id) REFERENCES wiki_columns(id) ON DELETE CASCADE
);

-- 卡片链接表 (双向链接)
CREATE TABLE wiki_card_links (
  id TEXT PRIMARY KEY,
  source_card_id TEXT NOT NULL,
  target_card_id TEXT NOT NULL,
  link_type TEXT DEFAULT 'reference',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (target_card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE
);

-- 卡片历史表
CREATE TABLE wiki_card_history (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_wiki_modules_order ON wiki_modules(sort_order);
CREATE INDEX idx_wiki_columns_module ON wiki_columns(module_id, sort_order);
CREATE INDEX idx_wiki_cards_column ON wiki_cards(column_id, sort_order);
CREATE INDEX idx_wiki_cards_tags ON wiki_cards(tags);
CREATE INDEX idx_wiki_card_links_source ON wiki_card_links(source_card_id);
CREATE INDEX idx_wiki_card_links_target ON wiki_card_links(target_card_id);

-- 全文搜索
CREATE VIRTUAL TABLE wiki_fts USING fts5(
  title,
  content,
  tags,
  content='wiki_cards',
  content_rowid='rowid',
  tokenize='unicode61'
);
```

## 实现步骤

### Step 1: 插件目录结构 (0.5h)

```
src/frontend/desktop/plugins/wiki/
├── manifest.json
├── index.js
├── style.css
├── components/
│   ├── module-view.js
│   ├── column-view.js
│   ├── card-list.js
│   ├── card-editor.js
│   ├── markdown-editor.js
│   ├── card-renderer.js
│   ├── link-picker.js
│   └── tag-input.js
├── services/
│   ├── wiki-service.js
│   ├── link-parser.js
│   └── version-manager.js
├── locales/
│   ├── zh.json
│   ├── en.json
│   └── ja.json
└── assets/
    └── icons.svg
```

### Step 2: 插件主类实现 (2h)

```javascript
// plugins/wiki/index.js

import Plugin from '../../core/plugin-base.js';
import WikiService from './services/wiki-service.js';
import ModuleView from './components/module-view.js';
import ColumnView from './components/column-view.js';
import CardEditor from './components/card-editor.js';

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
    
    this.wikiService = null;
    this.autoSaveTimer = null;
  }
  
  async onInstall() {
    await this.createSchema();
  }
  
  async onActivate() {
    this.wikiService = new WikiService(this.services.DatabaseService);
    await this.loadModules();
    
    // 绑定快捷键
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }
  
  async onDeactivate() {
    this.stopAutoSave();
    document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }
  
  render() {
    const { modules, currentModule, columns, cards, view } = this.state;
    
    return `
      <div class="wiki">
        <div class="wiki-sidebar">
          ${this.renderModuleList(modules)}
        </div>
        <div class="wiki-main">
          ${currentModule ? this.renderModule(currentModule, columns, cards, view) : this.renderWelcome()}
        </div>
      </div>
    `;
  }
}

export default WikiPlugin;
```

### Step 3: 数据服务层 (2h)

实现 `WikiService` 类，封装所有数据库操作：
- 模块 CRUD
- 列 CRUD
- 卡片 CRUD
- 链接管理
- 搜索功能

### Step 4: UI 组件实现 (6h)

#### 4.1 模块视图 (1h)
- 模块列表显示
- 模块切换
- 模块创建/编辑/删除

#### 4.2 列视图 (1h)
- 看板式列显示
- 列的拖拽排序
- 列的创建/编辑/删除

#### 4.3 卡片列表 (1h)
- 卡片列表显示
- 卡片拖拽移动
- 卡片预览

#### 4.4 Markdown 编辑器 (2h)
- 编辑模式和预览模式切换
- Markdown 语法高亮
- 实时预览
- 工具栏（加粗、斜体、列表等）

#### 4.5 卡片渲染器 (1h)
- Markdown 渲染
- 双向链接解析和渲染
- 标签显示
- 代码高亮

### Step 5: 双向链接系统 (2h)

```javascript
// services/link-parser.js

class LinkParser {
  // 解析 [[卡片名]] 语法
  parseLinks(content) {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      links.push({
        text: match[1],
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    return links;
  }
  
  // 替换链接为可点击元素
  renderLinks(content, cards) {
    return content.replace(/\[\[([^\]]+)\]\]/g, (match, cardTitle) => {
      const card = cards.find(c => c.title === cardTitle);
      if (card) {
        return `<a href="#/plugin/wiki/card/${card.id}" class="wiki-link">${cardTitle}</a>`;
      } else {
        return `<span class="wiki-link-missing">${cardTitle}</span>`;
      }
    });
  }
  
  // 查找反向链接
  async findBacklinks(cardId, cards) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return [];
    
    const backlinks = [];
    for (const c of cards) {
      if (c.id === cardId) continue;
      
      const links = this.parseLinks(c.content);
      if (links.some(link => link.text === card.title)) {
        backlinks.push({
          cardId: c.id,
          cardTitle: c.title
        });
      }
    }
    
    return backlinks;
  }
}

export default LinkParser;
```

### Step 6: 标签系统 (1h)

```javascript
// components/tag-input.js

class TagInput {
  constructor(container, options = {}) {
    this.container = container;
    this.tags = options.tags || [];
    this.onChange = options.onChange || (() => {});
    
    this.render();
    this.bindEvents();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="tag-input">
        <div class="tag-list">
          ${this.tags.map(tag => `
            <span class="tag" data-tag="${tag}">
              #${tag}
              <button class="tag-remove" data-tag="${tag}">×</button>
            </span>
          `).join('')}
        </div>
        <input type="text" 
               class="tag-input-field" 
               placeholder="添加标签...">
      </div>
    `;
  }
  
  bindEvents() {
    const input = this.container.querySelector('.tag-input-field');
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        this.addTag(input.value.trim());
        input.value = '';
      }
    });
    
    this.container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = e.target.dataset.tag;
        this.removeTag(tag);
      });
    });
  }
  
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.render();
      this.bindEvents();
      this.onChange(this.tags);
    }
  }
  
  removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    this.render();
    this.bindEvents();
    this.onChange(this.tags);
  }
  
  getTags() {
    return this.tags;
  }
}

export default TagInput;
```

### Step 7: 搜索集成 (1.5h)

集成全文搜索功能：
- 搜索框 UI
- 实时搜索
- 结果高亮
- 筛选功能

### Step 8: 版本历史 (1h)

实现自动保存和版本管理：
- 自动保存定时器
- 版本创建
- 版本查看
- 版本恢复

### Step 9: 测试和优化 (2h)

- 单元测试
- 集成测试
- 性能优化
- Bug 修复

## 测试要点

### 单元测试

```javascript
describe('WikiPlugin', () => {
  let plugin;
  let mockContext;
  
  beforeEach(() => {
    mockContext = createMockPluginContext();
    plugin = new WikiPlugin(mockContext);
  });
  
  describe('模块管理', () => {
    test('创建模块', async () => {
      const module = await plugin.wikiService.createModule({
        name: '测试模块'
      });
      
      expect(module.id).toBeDefined();
      expect(module.name).toBe('测试模块');
    });
    
    test('删除模块', async () => {
      const module = await plugin.wikiService.createModule({ name: '测试' });
      await plugin.wikiService.deleteModule(module.id);
      
      const modules = await plugin.wikiService.getModules();
      expect(modules.find(m => m.id === module.id)).toBeUndefined();
    });
  });
  
  describe('卡片管理', () => {
    test('创建卡片', async () => {
      const card = await plugin.wikiService.createCard({
        columnId: 'col-1',
        title: '测试卡片',
        content: '# 标题\n内容'
      });
      
      expect(card.title).toBe('测试卡片');
    });
    
    test('移动卡片', async () => {
      const card = await plugin.wikiService.createCard({
        columnId: 'col-1',
        title: '测试'
      });
      
      await plugin.wikiService.moveCard(card.id, 'col-2');
      
      const updated = await plugin.wikiService.getCard(card.id);
      expect(updated.columnId).toBe('col-2');
    });
  });
  
  describe('双向链接', () => {
    test('解析链接', () => {
      const content = '参考 [[另一个卡片]] 和 [[第三个卡片]]';
      const links = plugin.linkParser.parseLinks(content);
      
      expect(links).toHaveLength(2);
      expect(links[0].text).toBe('另一个卡片');
    });
    
    test('查找反向链接', async () => {
      const card1 = await plugin.wikiService.createCard({
        columnId: 'col-1',
        title: '卡片A',
        content: '引用 [[卡片B]]'
      });
      
      const card2 = await plugin.wikiService.createCard({
        columnId: 'col-1',
        title: '卡片B',
        content: '内容'
      });
      
      const backlinks = await plugin.linkParser.findBacklinks(
        card2.id,
        [card1, card2]
      );
      
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].cardId).toBe(card1.id);
    });
  });
  
  describe('搜索', () => {
    test('全文搜索', async () => {
      await plugin.wikiService.createCard({
        columnId: 'col-1',
        title: '搜索测试',
        content: '这是一段测试内容'
      });
      
      const results = await plugin.wikiService.search('测试内容');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
```

### 集成测试

1. **端到端流程测试**
   - 创建模块 → 创建列 → 创建卡片 → 编辑内容 → 保存
   - 添加双向链接 → 跳转 → 查看反向链接
   - 添加标签 → 按标签筛选

2. **拖拽功能测试**
   - 拖拽卡片在列间移动
   - 拖拽列改变顺序
   - 拖拽卡片改变排序

3. **搜索功能测试**
   - 搜索标题
   - 搜索内容
   - 搜索标签
   - 组合筛选

## 验收标准

- [ ] 可以创建、编辑、删除模块
- [ ] 可以创建、编辑、删除列
- [ ] 可以创建、编辑、删除卡片
- [ ] Markdown 编辑器正常工作
- [ ] Markdown 渲染正确
- [ ] 双向链接可以正常跳转
- [ ] 反向链接正确显示
- [ ] 标签系统正常工作
- [ ] 全文搜索正常工作
- [ ] 拖拽功能正常
- [ ] 自动保存正常
- [ ] 版本历史正常
- [ ] 响应式布局正常
- [ ] 所有测试通过
- [ ] 性能满足要求（<100ms 响应）

## 下一步

完成后可并行进行：
- `task-002-search-service.md` - 搜索服务优化
- `task-003-finder-plugin.md` - 文件搜索插件

或进入 Phase 2：
- `phase-2/task-001-sync-server.md` - 同步服务器开发

## 参考文档

- [Wiki 插件规格](../../specs/plugins/wiki.md)
- [插件系统规格](../../specs/08-plugin-system.md)
- [数据库服务规格](../../specs/services/database-service.md)
- [搜索服务规格](../../specs/services/search-service.md)

## 更新记录

- 2026-02-06: 完善双向链接跳转与缺失提示、优化编辑/预览体验、增强搜索结果交互与高亮反馈。
