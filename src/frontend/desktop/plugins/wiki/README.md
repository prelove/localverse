# Wiki Plugin

知识库插件 - 模块化知识管理，支持 Markdown 和双向链接

## 功能特性

- ✅ **三级结构**: 模块 → 列 → 卡片
- ✅ **Markdown 编辑**: 支持 Markdown 语法
- ✅ **双向链接**: 使用 `[[卡片名]]` 语法
- ✅ **标签系统**: 使用 `#标签` 语法
- ✅ **全文搜索**: 搜索卡片标题和内容
- ✅ **版本历史**: 自动保存版本历史
- ✅ **多视图**: 看板视图、列表视图
- ✅ **响应式设计**: 支持桌面和移动端

## 安装

Wiki 插件是 Localverse 的内置插件，随系统一起安装。

## 使用方法

### 创建模块

1. 点击侧边栏顶部的 ➕ 按钮
2. 输入模块名称
3. 点击确定

### 创建列

1. 选择一个模块
2. 点击顶部的"创建列"按钮
3. 输入列名
4. 点击确定

### 创建卡片

1. 在列的底部点击"创建卡片"按钮
2. 输入卡片标题
3. 点击卡片进入编辑模式

### 使用双向链接

在卡片内容中使用 `[[卡片名]]` 语法创建链接：

```markdown
这是一个引用 [[其他卡片]] 的例子
```

### 使用标签

在卡片内容中使用 `#标签` 语法添加标签：

```markdown
这是关于 #前端开发 和 #React 的笔记
```

## 快捷键

- `Ctrl+Shift+W`: 打开 Wiki 插件

## 数据结构

### 模块 (Module)

```javascript
{
  id: string,
  name: string,
  description?: string,
  icon?: string,
  color?: string,
  sortOrder: number,
  createdAt: number,
  updatedAt: number
}
```

### 列 (Column)

```javascript
{
  id: string,
  moduleId: string,
  name: string,
  description?: string,
  color?: string,
  sortOrder: number,
  createdAt: number,
  updatedAt: number
}
```

### 卡片 (Card)

```javascript
{
  id: string,
  columnId: string,
  title: string,
  content: string,
  tags: string[],
  attachments: Attachment[],
  sortOrder: number,
  isPinned: boolean,
  createdAt: number,
  updatedAt: number
}
```

## API

### WikiService

```javascript
// 模块操作
await wikiService.createModule({ name: '模块名' });
await wikiService.getModules();
await wikiService.updateModule(id, { name: '新名称' });
await wikiService.deleteModule(id);

// 列操作
await wikiService.createColumn({ moduleId, name: '列名' });
await wikiService.getColumns(moduleId);
await wikiService.updateColumn(id, { name: '新名称' });
await wikiService.deleteColumn(id);

// 卡片操作
await wikiService.createCard({ columnId, title: '标题', content: '内容' });
await wikiService.getCards(columnId);
await wikiService.updateCard(id, { content: '新内容' });
await wikiService.deleteCard(id);

// 搜索
await wikiService.search('关键词');

// 链接
await wikiService.createLink(sourceCardId, targetCardId);
await wikiService.getBacklinks(cardId);
```

### LinkParser

```javascript
// 解析链接
const links = linkParser.parseLinks(content);

// 渲染链接
const html = linkParser.renderLinks(content, cards);

// 查找反向链接
const backlinks = linkParser.findBacklinks(cardId, cardTitle, allCards);
```

### VersionManager

```javascript
// 保存版本
await versionManager.saveVersion(cardId, title, content, version, userId);

// 获取版本历史
const versions = await versionManager.getVersions(cardId);

// 恢复版本
await versionManager.restoreVersion(cardId, versionId, userId);
```

## 配置

在插件设置中可以配置：

- **默认视图**: 看板视图 / 列表视图
- **自动保存间隔**: 1-60 秒
- **启用双向链接**: 是 / 否
- **启用版本历史**: 是 / 否

## 开发

### 目录结构

```
src/frontend/desktop/plugins/wiki/
├── manifest.json         # 插件清单
├── index.js             # 主入口文件
├── style.css            # 样式文件
├── components/          # UI 组件
├── services/            # 服务层
│   ├── wiki-service.js      # 数据库操作
│   ├── link-parser.js       # 链接解析
│   └── version-manager.js   # 版本管理
├── locales/             # 多语言
│   ├── zh.json
│   └── en.json
└── assets/              # 资源文件
```

### 运行测试

```bash
node tests/plugins/wiki/wiki-plugin.test.js
```

## 已知问题

- [ ] Markdown 编辑器功能较为基础，待增强
- [ ] 拖拽排序功能待实现
- [ ] 附件上传功能待实现
- [ ] 导入导出功能待实现

## 路线图

- [ ] 富文本编辑器
- [ ] 图片拖拽上传
- [ ] 附件管理
- [ ] 模板系统
- [ ] 导入导出
- [ ] 协作编辑

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关文档

- [Wiki 插件规格](../../../openspec/specs/plugins/wiki.md)
- [任务文档](../../../openspec/tasks/phase-1/task-004-wiki-plugin.md)
- [插件系统](../../../openspec/specs/08-plugin-system.md)
