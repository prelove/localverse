# Task 002: 搜索服务开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase1-task-002-search-service |
| 阶段 | Phase 1 - 核心应用 |
| 优先级 | P0 (最高) |
| 预估工时 | 8 小时 |
| 依赖 | Phase 1 Task 001 (Frontend Core) |
| 产出 | 全文搜索服务 |
| 状态 | ✅ **已完成** |

## 目标

开发全文搜索服务，支持：
1. SQLite FTS5 全文检索
2. 多实体搜索（卡片、任务、文件、聊天）
3. 搜索历史和建议
4. 高级搜索功能

## 详细需求

### 1. 核心功能

- **全局搜索**: 跨所有实体类型搜索
- **实体搜索**: 针对特定类型的搜索
- **全文索引**: 基于 SQLite FTS5 的高性能索引
- **搜索排序**: 按相关度、日期、名称排序
- **搜索过滤**: 按类型、标签、日期范围过滤

### 2. 搜索类型

支持以下实体类型的搜索：
- Cards (卡片/知识库)
- Tasks (任务)
- Files (文件)
- Chat (聊天消息)

### 3. 高级功能

- **搜索建议**: 根据输入前缀提供建议
- **搜索历史**: 记录和管理搜索历史
- **Facets**: 提供搜索结果的分面统计
- **高亮显示**: 在搜索结果中高亮匹配文本

## 已实现内容

### Java 后端实现

**位置**: `src/java/core/services/SearchService.java`

**主要功能**:
```java
public class SearchService {
    // 全局搜索
    public SearchResults search(String query, SearchOptions options)
    
    // 实体搜索
    public List<SearchResultItem> searchCards(String query, SearchOptions options)
    public List<SearchResultItem> searchTasks(String query, SearchOptions options)
    public List<SearchResultItem> searchFiles(String query, SearchOptions options)
    public List<SearchResultItem> searchChat(String query, SearchOptions options)
    
    // 索引管理
    public void reindex(String entityType)
    public IndexStats getIndexStats()
    
    // 搜索辅助
    public List<String> getSuggestions(String prefix, int limit)
    public List<SearchHistoryItem> getHistory(int limit)
    public void clearHistory()
}
```

**特性**:
- ✅ SQLite FTS5 全文索引
- ✅ BM25 相关度评分
- ✅ 搜索结果高亮
- ✅ 分页支持
- ✅ 多字段搜索
- ✅ 日期和标签过滤

### JavaScript 前端实现

**位置**: `src/frontend/desktop/services/search/search-service.js`

**主要功能**:
```javascript
class SearchService {
    // 全局搜索
    async search(query, options)
    
    // 实体搜索
    async searchCards(query, options)
    async searchTasks(query, options)
    async searchFiles(query, options)
    async searchChat(query, options)
    
    // 索引管理
    async reindex(entityType)
    async getIndexStats()
    
    // 搜索辅助
    async getSuggestions(prefix, limit)
    async getHistory(limit)
    async clearHistory()
    
    // 高级搜索
    async advancedSearch(query)
}
```

**特性**:
- ✅ 支持 Mock 模式用于开发
- ✅ HTTP API 调用
- ✅ 错误处理
- ✅ 自动降级策略

### HTTP API 端点

**位置**: `src/java/core/server/handlers/SearchHandler.java`

**端点**:
```
POST /api/local/search                 - 全局搜索
POST /api/local/search/cards          - 搜索卡片
POST /api/local/search/tasks          - 搜索任务
POST /api/local/search/files          - 搜索文件
POST /api/local/search/chat           - 搜索聊天
POST /api/local/search/reindex        - 重建索引
GET  /api/local/search/stats          - 索引统计
GET  /api/local/search/suggestions    - 搜索建议
GET  /api/local/search/history        - 搜索历史
DELETE /api/local/search/history      - 清空历史
POST /api/local/search/advanced       - 高级搜索
```

## 数据库表结构

### FTS5 虚拟表

```sql
-- 卡片全文索引
CREATE VIRTUAL TABLE cards_fts USING fts5(
    title,
    content,
    tags,
    content='cards',
    content_rowid='id'
);

-- 任务全文索引
CREATE VIRTUAL TABLE tasks_fts USING fts5(
    title,
    description,
    tags,
    content='tasks',
    content_rowid='id'
);

-- 文件全文索引
CREATE VIRTUAL TABLE files_fts USING fts5(
    name,
    path,
    content,
    content='files',
    content_rowid='id'
);

-- 聊天消息全文索引
CREATE VIRTUAL TABLE chat_fts USING fts5(
    content,
    sender,
    channel,
    content='messages',
    content_rowid='id'
);
```

### 搜索历史表

```sql
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    result_count INTEGER,
    timestamp INTEGER NOT NULL,
    user_id TEXT
);

CREATE INDEX idx_search_history_user_time 
    ON search_history(user_id, timestamp DESC);
```

## 测试验收

### 功能测试

- [x] 全局搜索返回正确结果
- [x] 各实体类型搜索正常
- [x] 搜索结果正确排序
- [x] 分页功能正常
- [x] 搜索过滤正常工作
- [x] 搜索历史记录和获取
- [x] 搜索建议准确
- [x] 索引重建功能

### 性能测试

- [x] 1000条记录搜索响应时间 < 100ms
- [x] 10000条记录搜索响应时间 < 500ms
- [x] 索引构建时间合理
- [x] 内存占用在可接受范围

### 边界测试

- [x] 空查询处理
- [x] 特殊字符处理
- [x] 超长查询处理
- [x] 无结果情况处理
- [x] 并发搜索支持

## 验收标准

- [x] Java 后端服务实现完整
- [x] JavaScript 前端服务实现完整
- [x] HTTP API 端点正常工作
- [x] FTS5 索引正确创建
- [x] 搜索功能测试通过
- [x] 性能指标达标
- [x] API 文档完整

## 使用示例

### 前端调用

```javascript
// 初始化
const searchService = new SearchService({
    useMock: false,
    apiBase: '/api/local/search'
});

// 全局搜索
const results = await searchService.search('项目管理', {
    types: ['card', 'task'],
    limit: 20,
    sortBy: 'relevance'
});

// 搜索文件
const files = await searchService.searchFiles('设计文档', {
    extensions: ['md', 'pdf'],
    dateRange: {
        start: Date.now() - 30 * 24 * 3600 * 1000  // 最近30天
    }
});

// 获取搜索建议
const suggestions = await searchService.getSuggestions('pro', 10);

// 查看搜索历史
const history = await searchService.getHistory(20);
```

### 后端调用

```java
// 创建服务实例
SearchService searchService = new SearchService(connection);

// 执行搜索
SearchOptions options = new SearchOptions();
options.types = List.of("card", "task");
options.limit = 20;
options.sortBy = "relevance";

SearchResults results = searchService.search("项目管理", options);

// 重建索引
searchService.reindex("cards");

// 获取统计
IndexStats stats = searchService.getIndexStats();
```

## 相关文档

- [搜索服务规格](../../specs/services/search-service.md)
- [数据库服务规格](../../specs/services/database-service.md)
- [Phase 0 Task 004: Database Service](../phase-0/task-004-database.md)

## 下一步

搜索服务已完成，可以继续：
- [Task 003: Finder Plugin](./task-003-finder-plugin.md) - 文件搜索插件
- [Task 004: Wiki Plugin](./task-004-wiki-plugin.md) - Wiki 知识库插件（可并行）
