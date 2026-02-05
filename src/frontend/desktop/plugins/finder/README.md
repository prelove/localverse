# Finder Plugin

快速文件搜索插件，支持全文检索和实时预览。

## 功能特性

- 🔍 **实时搜索**: 输入即搜索，150ms 防抖
- 📄 **全文检索**: 搜索文件名和内容
- ⚡ **快速响应**: 基于 SQLite FTS5 的高性能索引
- 🎨 **文件预览**: 支持文本、图片等多种文件类型
- 🎯 **智能过滤**: 按类型、大小、日期过滤
- ⌨️ **快捷键支持**: 全局快捷键和键盘导航

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+F` | 全局打开 Finder |
| `↑` / `↓` | 导航结果列表 |
| `Enter` | 打开选中文件 |
| `Space` | 预览选中文件 |
| `Ctrl+C` | 复制文件路径 |
| `Escape` | 关闭预览/清空搜索 |

## 配置选项

```json
{
  "watchPaths": [],
  "maxResults": 100,
  "includeHidden": false,
  "enableContentSearch": true,
  "indexExtensions": ["txt", "md", "json", "js", "java", "py", "html", "css"]
}
```

### 配置说明

- **watchPaths**: 监视的目录路径列表（用于自动索引）
- **maxResults**: 最大搜索结果数（10-1000）
- **includeHidden**: 是否包含隐藏文件
- **enableContentSearch**: 是否启用文件内容搜索
- **indexExtensions**: 需要索引内容的文件扩展名列表

## 使用示例

### 基本搜索

1. 按 `Ctrl+Shift+F` 打开 Finder
2. 输入搜索关键词
3. 使用 `↑` `↓` 键浏览结果
4. 按 `Enter` 打开文件

### 过滤搜索

1. 在搜索框输入关键词
2. 从类型下拉菜单选择文件类型
3. 结果会自动过滤

### 复制路径

1. 选中目标文件
2. 按 `Ctrl+C` 复制路径到剪贴板

## 目录结构

```
finder/
├── manifest.json          # 插件清单
├── index.js              # 主入口文件
├── style.css             # 样式文件
├── README.md             # 说明文档
├── components/           # UI 组件
├── services/             # 服务模块
│   ├── indexer.js       # 文件索引服务
│   └── preview.js       # 预览服务
└── utils/                # 工具函数
    ├── file-icons.js    # 文件图标
    └── formatters.js    # 格式化工具
```

## 依赖服务

- **FileSystemService**: 文件系统访问
- **SearchService**: 全文搜索
- **DatabaseService**: 数据库存储

## 权限要求

- `filesystem:read` - 读取文件系统
- `filesystem:watch` - 监视文件变化
- `database:read` - 读取数据库
- `database:write` - 写入数据库
- `clipboard:write` - 写入剪贴板

## 数据库表

### finder_index

文件索引表，存储文件元数据：

```sql
CREATE TABLE finder_index (
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
```

### finder_fts

FTS5 全文搜索虚拟表：

```sql
CREATE VIRTUAL TABLE finder_fts USING fts5(
  name,
  path,
  content,
  content='finder_index',
  content_rowid='rowid',
  tokenize='unicode61'
);
```

## 性能指标

- 搜索响应时间: < 100ms (1000 文件)
- 索引速度: > 1000 文件/秒
- 内存占用: < 50MB (10000 文件索引)
- UI 流畅度: 60fps

## 已知限制

1. 文件内容搜索仅支持文本文件
2. 预览功能仅支持部分文件类型
3. 大文件（>10MB）不会被索引内容
4. 文件监视功能需要 Full 模式支持

## 开发计划

- [ ] 增强预览功能（PDF、图片等）
- [ ] 支持正则表达式搜索
- [ ] 添加搜索历史记录
- [ ] 文件标签功能
- [ ] 批量操作支持

## License

MIT
