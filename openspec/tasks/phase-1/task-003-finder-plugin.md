# Task 003: Finder 插件开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase1-task-003-finder-plugin |
| 阶段 | Phase 1 - 核心应用 |
| 优先级 | P1 (高) |
| 预估工时 | 12 小时 |
| 依赖 | Phase 1 Task 001 (Frontend Core), Task 002 (Search Service) |
| 产出 | 文件搜索插件 |
| 状态 | 测试中（基础单元测试已完成） |

## 目标

开发 Finder 文件搜索插件，提供类似 Everything 的快速文件搜索能力：
1. 实时文件搜索（毫秒级响应）
2. 全文检索（搜索文件内容）
3. 文件预览（文本、图片、PDF）
4. 文件操作（打开、复制路径、显示文件夹）
5. 搜索过滤和历史记录

## 详细需求

### 1. 核心功能

#### 搜索功能
- **实时搜索**: 输入即搜索，150ms 防抖
- **文件名搜索**: 基于文件名和路径快速匹配
- **内容搜索**: 全文检索文件内容（可配置）
- **智能排序**: BM25 相关度评分
- **搜索高亮**: 高亮显示匹配的文本

#### 过滤功能
- **类型过滤**: 文档、图片、代码、其他
- **大小过滤**: 按文件大小范围筛选
- **日期过滤**: 按修改时间范围筛选
- **扩展名过滤**: 按文件扩展名筛选

#### 文件操作
- **打开文件**: 双击或 Enter 打开
- **复制路径**: Ctrl+C 复制文件路径
- **显示位置**: 在文件管理器中显示
- **文件预览**: Space 键快速预览

#### 预览功能
- **文本预览**: txt, md, json, js, css, html 等
- **图片预览**: jpg, png, gif, svg, webp 等
- **代码预览**: 带语法高亮
- **PDF 预览**: 内嵌 PDF 查看器（可选）

### 2. 用户界面

```
┌─────────────────────────────────────────────────────┐
│ 🔍 [搜索框                              ] Ctrl+Shift+F │
│ [类型▾] [大小▾] [日期▾]                               │
├─────────────────────────────────────────────────────┤
│ 📄 project.md                        1.2KB  2天前     │
│    /docs/project.md                                  │
│ 📄 README.md                         4.5KB  1周前     │
│    /README.md                                        │
│ 📄 design.md                         2.3KB  3天前     │
│    /docs/design.md                                   │
│ ...                                                  │
├─────────────────────────────────────────────────────┤
│ 125 个结果  ↑↓ 导航 · Enter 打开 · Ctrl+C 复制路径  │
└─────────────────────────────────────────────────────┘
```

### 3. 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Shift+F | 全局打开 Finder |
| Ctrl+F | 聚焦搜索框 |
| ↑/↓ | 导航结果 |
| Enter | 打开选中文件 |
| Space | 预览选中文件 |
| Ctrl+C | 复制文件路径 |
| Escape | 关闭预览/清空搜索 |

## 实现步骤

### Step 1: 插件目录结构 (1h)

创建插件目录结构：

```
src/frontend/desktop/plugins/finder/
├── manifest.json         # 插件清单
├── index.js             # 主入口
├── style.css            # 样式
├── components/
│   ├── search-box.js    # 搜索框组件
│   ├── result-list.js   # 结果列表组件
│   ├── preview.js       # 预览组件
│   └── filter-bar.js    # 过滤栏组件
├── services/
│   ├── indexer.js       # 文件索引服务
│   └── preview.js       # 预览服务
└── utils/
    ├── file-icons.js    # 文件图标工具
    └── formatters.js    # 格式化工具
```

### Step 2: manifest.json (1h)

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

### Step 3: 主插件类 (2h)

```javascript
// plugins/finder/index.js

import Plugin from '../../core/plugin/plugin-base.js';

export default class FinderPlugin extends Plugin {
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
  }
  
  // 生命周期钩子
  async onInstall() {
    // 创建文件索引表
    await this.initDatabase();
  }
  
  async onActivate() {
    // 绑定全局快捷键
    document.addEventListener('keydown', this.handleGlobalKeydown);
    
    // 启动文件监视
    if (this.context.mode === 'full') {
      await this.startFileWatch();
    }
    
    // 构建初始索引
    await this.buildIndex();
  }
  
  async onDeactivate() {
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    this.stopFileWatch();
  }
  
  // 渲染方法
  render() {
    return `
      <div class="finder">
        <div class="finder-header">
          ${this.renderSearchBox()}
          ${this.renderFilterBar()}
        </div>
        <div class="finder-body">
          ${this.renderResults()}
          ${this.state.preview ? this.renderPreview() : ''}
        </div>
        <div class="finder-footer">
          ${this.renderFooter()}
        </div>
      </div>
    `;
  }
  
  // 搜索逻辑
  async performSearch() {
    const { query, filters } = this.state;
    
    if (!query.trim()) {
      this.setState({ results: [], loading: false });
      return;
    }
    
    this.setState({ loading: true });
    
    try {
      let results = await this.services.SearchService.searchFiles(query, {
        maxResults: this.getSetting('maxResults'),
        includeContent: this.getSetting('enableContentSearch')
      });
      
      results = this.applyFilters(results, filters);
      
      this.setState({
        results,
        loading: false,
        selectedIndex: 0
      });
    } catch (error) {
      console.error('Search failed:', error);
      this.showError(this.t('searchError'));
      this.setState({ results: [], loading: false });
    }
  }
}
```

### Step 4: 搜索组件 (2h)

实现搜索框、结果列表等 UI 组件。

### Step 5: 文件索引服务 (2h)

```javascript
// plugins/finder/services/indexer.js

export class FileIndexer {
  constructor(services, settings) {
    this.db = services.DatabaseService;
    this.fs = services.FileSystemService;
    this.settings = settings;
  }
  
  async buildIndex(paths) {
    for (const path of paths) {
      await this.indexDirectory(path);
    }
  }
  
  async indexDirectory(dirPath) {
    const files = await this.fs.listDir(dirPath, {
      recursive: true,
      includeHidden: this.settings.includeHidden
    });
    
    for (const file of files) {
      await this.indexFile(file);
    }
  }
  
  async indexFile(file) {
    const shouldIndexContent = 
      this.settings.enableContentSearch &&
      this.settings.indexExtensions.includes(file.extension);
    
    let content = null;
    if (shouldIndexContent) {
      content = await this.fs.readFile(file.path, 'text');
    }
    
    await this.db.exec(`
      INSERT OR REPLACE INTO finder_index 
      (id, path, name, extension, size, mime_type, modified_at, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      file.id,
      file.path,
      file.name,
      file.extension,
      file.size,
      file.mimeType,
      file.modifiedAt,
      Date.now()
    ]);
    
    if (content) {
      await this.db.exec(`
        INSERT INTO finder_fts(rowid, name, path, content)
        VALUES (last_insert_rowid(), ?, ?, ?)
      `, [file.name, file.path, content]);
    }
  }
}
```

### Step 6: 预览组件 (2h)

```javascript
// plugins/finder/services/preview.js

export class PreviewService {
  constructor(services) {
    this.fs = services.FileSystemService;
  }
  
  async getPreview(file) {
    const category = this.getFileCategory(file.extension);
    
    switch (category) {
      case 'text':
        return await this.previewText(file);
      case 'image':
        return await this.previewImage(file);
      case 'code':
        return await this.previewCode(file);
      default:
        return this.previewDefault(file);
    }
  }
  
  async previewText(file) {
    const content = await this.fs.readFile(file.path, 'text');
    return {
      type: 'text',
      content: this.escapeHtml(content)
    };
  }
  
  async previewImage(file) {
    const dataUrl = await this.fs.readFile(file.path, 'dataurl');
    return {
      type: 'image',
      src: dataUrl
    };
  }
  
  async previewCode(file) {
    const content = await this.fs.readFile(file.path, 'text');
    return {
      type: 'code',
      language: file.extension,
      content: content
    };
  }
}
```

### Step 7: 样式实现 (1h)

```css
/* plugins/finder/style.css */

.finder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.finder-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 1rem;
  outline: none;
}

.result-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.result-item:hover,
.result-item.selected {
  background: var(--bg-hover);
}

.file-icon {
  font-size: 1.5rem;
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

.file-path {
  font-size: 0.875rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-panel {
  flex: 1;
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}
```

### Step 8: 测试和验证 (1h)

编写测试确保功能正常工作。

## 数据库表结构

```sql
-- 文件索引表
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

CREATE INDEX idx_finder_name ON finder_index(name);
CREATE INDEX idx_finder_ext ON finder_index(extension);
CREATE INDEX idx_finder_path ON finder_index(path);

-- 全文搜索索引
CREATE VIRTUAL TABLE IF NOT EXISTS finder_fts USING fts5(
  name,
  path,
  content,
  content='finder_index',
  content_rowid='rowid',
  tokenize='unicode61'
);
```

## 测试要点

### 功能测试
- [ ] 搜索框输入触发实时搜索
- [ ] 搜索结果正确显示
- [ ] 过滤器正常工作
- [ ] 键盘导航正常
- [ ] 文件打开功能正常
- [ ] 路径复制功能正常
- [ ] 文件预览正常显示

### 性能测试
- [ ] 1000 个文件搜索响应时间 < 100ms
- [ ] 10000 个文件搜索响应时间 < 500ms
- [ ] 索引构建时间合理
- [ ] 内存占用在可接受范围

### 边界测试
- [x] 空搜索处理
- [ ] 无结果情况处理
- [x] 特殊字符文件名处理
- [ ] 大文件预览处理
- [ ] 权限错误处理

## 验收标准

- [x] 插件目录结构完整
- [x] manifest.json 配置正确
- [ ] 主插件类实现完整
- [ ] 搜索功能正常工作
- [ ] 过滤功能正常工作
- [ ] 文件预览正常工作
- [ ] 快捷键正常工作
- [ ] 样式美观统一
- [ ] 性能指标达标
- [ ] 所有测试通过
- [x] 文档完整

## 性能指标

- 搜索响应时间: < 100ms (1000 文件)
- 索引速度: > 1000 文件/秒
- 内存占用: < 50MB (10000 文件索引)
- UI 流畅度: 60fps

## 使用示例

```javascript
// 在主应用中注册插件
const finder = await pluginLoader.load('finder');

// 配置插件
await finder.configure({
  watchPaths: ['/home/user/documents', '/home/user/projects'],
  maxResults: 200,
  includeHidden: false,
  enableContentSearch: true
});

// 激活插件
await finder.activate();

// 执行搜索
const results = await finder.search('项目文档');

// 打开文件
await finder.openFile(results[0].path);

// 获取预览
const preview = await finder.getPreview(results[0]);
```

## 相关文档

- [Finder 插件规格](../../specs/plugins/finder.md)
- [搜索服务规格](../../specs/services/search-service.md)
- [文件系统服务规格](../../specs/services/filesystem-service.md)
- [插件系统规格](../../specs/08-plugin-system.md)
- [Phase 0 Task 006: Plugin System](../phase-0/task-006-plugin-system.md)
- [Phase 1 Task 002: Search Service](./task-002-search-service.md)

## 下一步

完成 Finder 插件后，可以继续：
- [Task 004: Wiki Plugin](./task-004-wiki-plugin.md) - Wiki 知识库插件

## 注意事项

1. **安全性**: 
   - 必须验证文件路径，防止路径遍历攻击
   - 限制文件大小，防止内存溢出
   - 文件内容搜索需要限制文件类型

2. **性能优化**:
   - 使用防抖避免过多搜索请求
   - 索引构建使用批处理
   - 结果列表使用虚拟滚动（大量结果时）
   - 预览内容限制大小

3. **用户体验**:
   - 提供清晰的加载状态
   - 错误提示友好
   - 快捷键与系统不冲突
   - 响应式设计，支持不同屏幕尺寸

4. **兼容性**:
   - 支持三种模式 (full/light/pure)
   - 优雅降级（无法访问文件系统时）
   - 跨平台文件路径处理

## 更新记录

- 2026-02-06: 增强过滤栏与搜索结果摘要展示，补充预览快捷键提示与扩展名筛选支持。
- 2026-02-06: 完善全模式检索回退与路径高亮，明确本地索引兜底流程。
- 2026-02-06: 补齐文件名/路径/内容检索兜底，完善预览渲染策略与大小限制，校准快捷键提示一致性。

- 2026-02-17: 新增 Finder 工具层单元测试（formatters/file-icons），完成基础质量回归并勾选对应验收项。
