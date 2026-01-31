# Search Service 规格

## 概述

SearchService 提供全文搜索能力：
1. SQLite FTS5 全文检索
2. 文件名/路径搜索
3. 多实体联合搜索
4. 搜索建议和历史

## 接口定义

### TypeScript 接口

```typescript
interface SearchService {
  // 全局搜索
  search(query: string, options?: SearchOptions): Promise<SearchResults>;
  
  // 实体搜索
  searchCards(query: string, options?: EntitySearchOptions): Promise<CardSearchResult[]>;
  searchTasks(query: string, options?: EntitySearchOptions): Promise<TaskSearchResult[]>;
  searchFiles(query: string, options?: FileSearchOptions): Promise<FileSearchResult[]>;
  searchChat(query: string, options?: ChatSearchOptions): Promise<ChatSearchResult[]>;
  
  // 索引���理
  reindex(entityType?: string): Promise<void>;
  getIndexStats(): Promise<IndexStats>;
  
  // 搜索建议
  getSuggestions(prefix: string, limit?: number): Promise<string[]>;
  
  // 搜索历史
  getHistory(limit?: number): Promise<SearchHistoryItem[]>;
  clearHistory(): Promise<void>;
  
  // 高级搜索
  advancedSearch(query: AdvancedQuery): Promise<SearchResults>;
}

interface SearchOptions {
  types?: SearchType[];           // 搜索的实体类型
  limit?: number;                 // 最大结果数
  offset?: number;                // 偏移量
  sortBy?: 'relevance' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
  dateRange?: {
    start?: number;
    end?: number;
  };
  tags?: string[];
  includeDeleted?: boolean;
}

type SearchType = 'card' | 'task' | 'file' | 'chat' | 'all';

interface SearchResults {
  total: number;
  items: SearchResultItem[];
  facets?: SearchFacets;
  took: number;                   // 耗时（毫秒）
}

interface SearchResultItem {
  type: SearchType;
  id: string;
  title: string;
  snippet: string;
  score: number;
  highlights: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

interface SearchFacets {
  types: { type: string; count: number }[];
  tags: { tag: string; count: number }[];
  dates: { date: string; count: number }[];
}

interface AdvancedQuery {
  must?: QueryClause[];           // AND 条件
  should?: QueryClause[];         // OR 条件
  mustNot?: QueryClause[];        // NOT 条件
  filter?: FilterClause[];        // 过滤条件
}

interface QueryClause {
  field: string;
  value: string;
  type: 'match' | 'prefix' | 'wildcard' | 'phrase';
}

interface FilterClause {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: any;
}

interface IndexStats {
  totalDocuments: number;
  indexSize: number;
  lastIndexTime: number;
  entityCounts: Record<string, number>;
}

interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}
```

## 实现

```javascript
// services/search-service.js

class SearchService {
  constructor(db) {
    this.db = db;
  }
  
  /**
   * 全局搜索
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    const types = options.types || ['card', 'task', 'file', 'chat'];
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const results = [];
    
    // 并行搜索各类型
    const searches = [];
    
    if (types.includes('card')) {
      searches.push(this.searchCards(query, options).then(r => 
        r.map(item => ({ ...item, type: 'card' }))
      ));
    }
    
    if (types.includes('task')) {
      searches.push(this.searchTasks(query, options).then(r => 
        r.map(item => ({ ...item, type: 'task' }))
      ));
    }
    
    if (types.includes('file')) {
      searches.push(this.searchFiles(query, options).then(r => 
        r.map(item => ({ ...item, type: 'file' }))
      ));
    }
    
    if (types.includes('chat')) {
      searches.push(this.searchChat(query, options).then(r => 
        r.map(item => ({ ...item, type: 'chat' }))
      ));
    }
    
    const searchResults = await Promise.all(searches);
    
    // 合并结果
    for (const typeResults of searchResults) {
      results.push(...typeResults);
    }
    
    // 排序
    this.sortResults(results, options.sortBy || 'relevance', options.sortOrder || 'desc');
    
    // 分页
    const total = results.length;
    const items = results.slice(offset, offset + limit);
    
    // 计算 facets
    const facets = this.calculateFacets(results);
    
    // 记录搜索历史
    await this.recordHistory(query, total);
    
    return {
      total,
      items,
      facets,
      took: Date.now() - startTime
    };
  }
  
  /**
   * 搜索卡片
   */
  async searchCards(query, options = {}) {
    const ftsQuery = this.buildFtsQuery(query);
    
    let sql = `
      SELECT 
        c.id,
        c.title,
        c.content,
        c.tags,
        c.created_at,
        c.updated_at,
        highlight(cards_fts, 0, '<mark>', '</mark>') as title_hl,
        highlight(cards_fts, 1, '<mark>', '</mark>') as content_hl,
        bm25(cards_fts) as score
      FROM cards c
      JOIN cards_fts ON c.rowid = cards_fts.rowid
      WHERE cards_fts MATCH ?
        AND c.deleted = 0
    `;
    
    const params = [ftsQuery];
    
    // 日期过滤
    if (options.dateRange?.start) {
      sql += ' AND c.created_at >= ?';
      params.push(options.dateRange.start);
    }
    if (options.dateRange?.end) {
      sql += ' AND c.created_at <= ?';
      params.push(options.dateRange.end);
    }
    
    // 标签过滤
    if (options.tags?.length > 0) {
      for (const tag of options.tags) {
        sql += ` AND c.tags LIKE ?`;
        params.push(`%"${tag}"%`);
      }
    }
    
    sql += ' ORDER BY score LIMIT 100';
    
    const results = await this.db.query(sql, params);
    
    return results.map(row => ({
      id: row.id,
      title: row.title,
      snippet: this.extractSnippet(row.content, query),
      score: Math.abs(row.score),
      highlights: [row.title_hl, row.content_hl].filter(Boolean),
      metadata: {
        tags: JSON.parse(row.tags || '[]')
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  /**
   * 搜索任务
   */
  async searchTasks(query, options = {}) {
    const ftsQuery = this.buildFtsQuery(query);
    
    let sql = `
      SELECT 
        t.id,
        t.title,
        t.content,
        t.status,
        t.priority,
        t.tags,
        t.assignee,
        t.due_date,
        t.created_at,
        t.updated_at,
        highlight(tasks_fts, 0, '<mark>', '</mark>') as title_hl,
        bm25(tasks_fts) as score
      FROM tasks t
      JOIN tasks_fts ON t.rowid = tasks_fts.rowid
      WHERE tasks_fts MATCH ?
        AND t.deleted = 0
    `;
    
    const params = [ftsQuery];
    
    // 状态过滤
    if (options.status) {
      sql += ' AND t.status = ?';
      params.push(options.status);
    }
    
    sql += ' ORDER BY score LIMIT 100';
    
    const results = await this.db.query(sql, params);
    
    return results.map(row => ({
      id: row.id,
      title: row.title,
      snippet: this.extractSnippet(row.content, query),
      score: Math.abs(row.score),
      highlights: [row.title_hl].filter(Boolean),
      metadata: {
        status: row.status,
        priority: row.priority,
        assignee: row.assignee,
        dueDate: row.due_date,
        tags: JSON.parse(row.tags || '[]')
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  /**
   * 搜索文件
   */
  async searchFiles(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    
    let sql = `
      SELECT 
        id,
        name,
        path,
        size,
        mime_type,
        created_at,
        updated_at
      FROM files
      WHERE deleted = 0
        AND (LOWER(name) LIKE ? OR LOWER(path) LIKE ?)
    `;
    
    const params = [`%${lowerQuery}%`, `%${lowerQuery}%`];
    
    // 扩展名过滤
    if (options.extensions?.length > 0) {
      const extPlaceholders = options.extensions.map(() => '?').join(',');
      sql += ` AND LOWER(SUBSTR(name, INSTR(name, '.') + 1)) IN (${extPlaceholders})`;
      params.push(...options.extensions.map(e => e.toLowerCase()));
    }
    
    sql += ' ORDER BY updated_at DESC LIMIT 100';
    
    const results = await this.db.query(sql, params);
    
    return results.map(row => ({
      id: row.id,
      title: row.name,
      snippet: row.path,
      score: row.name.toLowerCase().includes(lowerQuery) ? 1.0 : 0.5,
      highlights: [],
      metadata: {
        path: row.path,
        size: row.size,
        mimeType: row.mime_type
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  
  /**
   * 搜索聊天消息
   */
  async searchChat(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    
    let sql = `
      SELECT 
        m.id,
        m.content,
        m.sender_id,
        m.sender_name,
        m.room_id,
        r.name as room_name,
        m.created_at
      FROM chat_messages m
      LEFT JOIN chat_rooms r ON m.room_id = r.id
      WHERE m.deleted = 0
        AND LOWER(m.content) LIKE ?
    `;
    
    const params = [`%${lowerQuery}%`];
    
    // 房间过滤
    if (options.roomId) {
      sql += ' AND m.room_id = ?';
      params.push(options.roomId);
    }
    
    sql += ' ORDER BY m.created_at DESC LIMIT 100';
    
    const results = await this.db.query(sql, params);
    
    return results.map(row => ({
      id: row.id,
      title: `${row.sender_name} in ${row.room_name}`,
      snippet: this.extractSnippet(row.content, query),
      score: 0.5,
      highlights: [],
      metadata: {
        senderId: row.sender_id,
        senderName: row.sender_name,
        roomId: row.room_id,
        roomName: row.room_name
      },
      createdAt: row.created_at,
      updatedAt: row.created_at
    }));
  }
  
  /**
   * 构建 FTS 查询
   */
  buildFtsQuery(query) {
    // 处理特殊字符
    let ftsQuery = query
      .replace(/[^\w\s\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g, ' ')
      .trim();
    
    // 如果是多个词，使用 AND 连接
    const words = ftsQuery.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      ftsQuery = words.join(' AND ');
    }
    
    // 添加前缀匹配
    if (words.length === 1 && words[0].length > 1) {
      ftsQuery = `"${words[0]}"* OR ${words[0]}`;
    }
    
    return ftsQuery;
  }
  
  /**
   * 提取摘要片段
   */
  extractSnippet(content, query, maxLength = 150) {
    if (!content) return '';
    
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index < 0) {
      return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);
    
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }
  
  /**
   * 排序结果
   */
  sortResults(results, sortBy, sortOrder) {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    
    results.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return (b.score - a.score) * multiplier;
        case 'date':
          return (b.updatedAt - a.updatedAt) * multiplier;
        case 'name':
          return a.title.localeCompare(b.title) * multiplier;
        default:
          return 0;
      }
    });
  }
  
  /**
   * 计算 facets
   */
  calculateFacets(results) {
    const types = {};
    const tags = {};
    
    for (const result of results) {
      // 类型统计
      types[result.type] = (types[result.type] || 0) + 1;
      
      // 标签统计
      if (result.metadata?.tags) {
        for (const tag of result.metadata.tags) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      }
    }
    
    return {
      types: Object.entries(types).map(([type, count]) => ({ type, count })),
      tags: Object.entries(tags)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };
  }
  
  /**
   * 重建索引
   */
  async reindex(entityType) {
    if (!entityType || entityType === 'card') {
      await this.db.exec('DELETE FROM cards_fts');
      await this.db.exec(`
        INSERT INTO cards_fts(rowid, title, content, tags)
        SELECT rowid, title, content, tags FROM cards WHERE deleted = 0
      `);
    }
    
    if (!entityType || entityType === 'task') {
      await this.db.exec('DELETE FROM tasks_fts');
      await this.db.exec(`
        INSERT INTO tasks_fts(rowid, title, content, tags)
        SELECT rowid, title, content, tags FROM tasks WHERE deleted = 0
      `);
    }
  }
  
  /**
   * 获取索引统计
   */
  async getIndexStats() {
    const cardCount = await this.db.queryOne('SELECT COUNT(*) as c FROM cards_fts');
    const taskCount = await this.db.queryOne('SELECT COUNT(*) as c FROM tasks_fts');
    
    return {
      totalDocuments: (cardCount?.c || 0) + (taskCount?.c || 0),
      indexSize: 0,  // SQLite FTS 不直接暴露索引大小
      lastIndexTime: Date.now(),
      entityCounts: {
        card: cardCount?.c || 0,
        task: taskCount?.c || 0
      }
    };
  }
  
  /**
   * 获取搜索建议
   */
  async getSuggestions(prefix, limit = 10) {
    if (!prefix || prefix.length < 2) return [];
    
    const lowerPrefix = prefix.toLowerCase();
    
    // 从卡片标题获取建议
    const cardTitles = await this.db.query(`
      SELECT DISTINCT title FROM cards 
      WHERE LOWER(title) LIKE ? AND deleted = 0
      LIMIT ?
    `, [`${lowerPrefix}%`, limit]);
    
    // 从任务标题获取建议
    const taskTitles = await this.db.query(`
      SELECT DISTINCT title FROM tasks 
      WHERE LOWER(title) LIKE ? AND deleted = 0
      LIMIT ?
    `, [`${lowerPrefix}%`, limit]);
    
    // 从搜索历史获取建议
    const history = await this.db.query(`
      SELECT DISTINCT query FROM search_history 
      WHERE LOWER(query) LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [`${lowerPrefix}%`, limit]);
    
    const suggestions = new Set();
    
    for (const row of [...history, ...cardTitles, ...taskTitles]) {
      suggestions.add(row.title || row.query);
      if (suggestions.size >= limit) break;
    }
    
    return Array.from(suggestions);
  }
  
  /**
   * 获取搜索历史
   */
  async getHistory(limit = 20) {
    const rows = await this.db.query(`
      SELECT query, result_count, created_at
      FROM search_history
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);
    
    return rows.map(row => ({
      query: row.query,
      timestamp: row.created_at,
      resultCount: row.result_count
    }));
  }
  
  /**
   * 清除搜索历史
   */
  async clearHistory() {
    await this.db.exec('DELETE FROM search_history');
  }
  
  /**
   * 记录搜索历史
   */
  async recordHistory(query, resultCount) {
    if (!query || query.length < 2) return;
    
    await this.db.run(`
      INSERT INTO search_history (id, query, result_count, created_at)
      VALUES (?, ?, ?, ?)
    `, [this.generateId(), query, resultCount, Date.now()]);
    
    // 保留最近 1000 条
    await this.db.exec(`
      DELETE FROM search_history 
      WHERE id NOT IN (
        SELECT id FROM search_history ORDER BY created_at DESC LIMIT 1000
      )
    `);
  }
  
  generateId() {
    return 'search_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

export default SearchService;
```

## 搜索历史表

```sql
CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    search_type TEXT DEFAULT 'global',
    result_count INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);
CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(created_at DESC);
```

## 测试用例

```javascript
describe('SearchService', () => {
  let searchService;
  let db;
  
  beforeEach(async () => {
    db = new WasmDatabaseService();
    await db.init();
    searchService = new SearchService(db);
    
    // 插入测试数据
    await insertTestData(db);
  });
  
  describe('全局搜索', () => {
    test('搜索返回多类型结果', async () => {
      const results = await searchService.search('测试');
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.items.length).toBeGreaterThan(0);
      expect(results.took).toBeDefined();
    });
    
    test('支持类型过滤', async () => {
      const results = await searchService.search('测试', {
        types: ['card']
      });
      
      for (const item of results.items) {
        expect(item.type).toBe('card');
      }
    });
    
    test('支持分页', async () => {
      const page1 = await searchService.search('测试', { limit: 5, offset: 0 });
      const page2 = await searchService.search('测试', { limit: 5, offset: 5 });
      
      expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
    });
  });
  
  describe('FTS 搜索', () => {
    test('中文搜索', async () => {
      await db.run(`
        INSERT INTO cards (id, column_id, title, content, created_at, updated_at)
        VALUES ('c1', 'col1', '中文标题测试', '这是中文内容', ?, ?)
      `, [Date.now(), Date.now()]);
      
      await searchService.reindex('card');
      
      const results = await searchService.searchCards('中文');
      expect(results.length).toBeGreaterThan(0);
    });
    
    test('日文搜索', async () => {
      await db.run(`
        INSERT INTO cards (id, column_id, title, content, created_at, updated_at)
        VALUES ('c2', 'col1', '日本語テスト', 'これはテストです', ?, ?)
      `, [Date.now(), Date.now()]);
      
      await searchService.reindex('card');
      
      const results = await searchService.searchCards('テスト');
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('搜索建议', () => {
    test('返回匹配的建议', async () => {
      const suggestions = await searchService.getSuggestions('测');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
  
  describe('搜索历史', () => {
    test('记录搜索历史', async () => {
      await searchService.search('测试查询');
      
      const history = await searchService.getHistory();
      expect(history[0]?.query).toBe('测试查询');
    });
    
    test('清除历史', async () => {
      await searchService.search('测试');
      await searchService.clearHistory();
      
      const history = await searchService.getHistory();
      expect(history.length).toBe(0);
    });
  });
});
```

## 相关规格

- `05-database.md` - FTS 表结构
- `plugins/finder.md` - 文件搜索插件

## 相关任务

- `tasks/phase-1/task-002-search-service.md`