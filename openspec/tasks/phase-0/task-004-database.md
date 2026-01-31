# Task 004: 数据库服务开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | task-004-database |
| 阶段 | Phase 0 - 基础设施 |
| 优先级 | P0 (最高) |
| 预估工时 | 12 小时 |
| 依赖 | task-003-communication |
| 产出 | 数据库服务模块 (WASM + JDBC) |

## 目标

开发双模式数据库服务：
1. WASM 模式：浏览器内 sql.js
2. JAR 模式：通过 API 访问 SQLite JDBC
3. 统一的接口抽象
4. 数据迁移支持

## 详细需求

### 1. 统一接口

```typescript
interface DatabaseService {
  // 初始化
  init(): Promise<void>;
  close(): Promise<void>;
  
  // 查询
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  
  // 执行
  run(sql: string, params?: any[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  
  // 事务
  transaction<T>(callback: () => Promise<T>): Promise<T>;
  
  // 迁移
  runMigrations(): Promise<void>;
  
  // 状态
  isReady(): boolean;
  getMode(): 'wasm' | 'jar';
}
```

### 2. WASM 模式

- 使用 sql.js (SQLite 编译为 WASM)
- 数据持久化到 IndexedDB
- 自动保存机制
- 支持全文搜索 (FTS5)

### 3. JAR 模式

- 通过 HTTP API 访问
- JAR 端使用 SQLite JDBC
- 支持并发访问
- 文件级持久化

### 4. 迁移系统

- 版本化迁移脚本
- 自动执行未运行的迁移
- 回滚支持

## 技术规格

### 文件结构

```
src/frontend/desktop/services/
├── database/
│   ├── index.js                 # 主入口（工厂）
│   ├── database-service.js      # 接口定义
│   ├── wasm-database.js         # WASM 实现
│   ├── jar-database.js          # JAR API 实现
│   ├── migrations/
│   │   ├── index.js             # 迁移管理器
│   │   ├── 001_initial.js       # 初始迁移
│   │   ├── 002_add_tasks.js     # 任务表
│   │   └── 003_add_chat.js      # 聊天表
│   └── utils/
│       ├── uuid.js              # UUID v7 生成
│       └── schema.js            # Schema 工具
```

## 实现步骤

### Step 1: 接口定义和工厂 (1h)

```javascript
// database/index.js

import { WasmDatabaseService } from './wasm-database.js';
import { JarDatabaseService } from './jar-database.js';

export class DatabaseServiceFactory {
  static async create(mode) {
    let service;
    
    if (mode === 'wasm' || mode === 'light' || mode === 'pure') {
      service = new WasmDatabaseService();
    } else {
      // 尝试 JAR，失败则降级到 WASM
      try {
        service = new JarDatabaseService();
        await service.init();
        return service;
      } catch (error) {
        console.warn('JAR database unavailable, falling back to WASM');
        service = new WasmDatabaseService();
      }
    }
    
    await service.init();
    return service;
  }
}

export { WasmDatabaseService, JarDatabaseService };
```

### Step 2: WASM 实现 (4h)

```javascript
// database/wasm-database.js

import initSqlJs from '/lib/sql.js/sql-wasm.js';

export class WasmDatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.ready = false;
    this.autoSaveInterval = null;
  }
  
  async init() {
    // 加载 sql.js
    this.SQL = await initSqlJs({
      locateFile: file => `/wasm/${file.replace('.wasm', '.dat')}`
    });
    
    // 从 IndexedDB 加载
    const savedData = await this.loadFromStorage();
    
    if (savedData) {
      this.db = new this.SQL.Database(savedData);
    } else {
      this.db = new this.SQL.Database();
    }
    
    // 配置
    this.db.run('PRAGMA foreign_keys = ON');
    
    // 运行迁移
    await this.runMigrations();
    
    // 启动自动保存
    this.startAutoSave();
    
    this.ready = true;
  }
  
  async close() {
    await this.saveToStorage();
    this.stopAutoSave();
    this.db.close();
    this.db = null;
    this.ready = false;
  }
  
  query(sql, params = []) {
    this.ensureReady();
    
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  }
  
  queryOne(sql, params = []) {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  run(sql, params = []) {
    this.ensureReady();
    this.db.run(sql, params);
    
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: this.queryOne('SELECT last_insert_rowid() as id')?.id || 0
    };
  }
  
  exec(sql) {
    this.ensureReady();
    this.db.exec(sql);
  }
  
  async transaction(callback) {
    this.ensureReady();
    
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      this.db.run('COMMIT');
      return result;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }
  
  // IndexedDB 持久化
  async loadFromStorage() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_db', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('database')) {
          db.createObjectStore('database');
        }
      };
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('database', 'readonly');
        const store = tx.objectStore('database');
        const getRequest = store.get('main');
        
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async saveToStorage() {
    if (!this.db) return;
    
    const data = this.db.export();
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_db', 1);
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('database', 'readwrite');
        const store = tx.objectStore('database');
        store.put(data, 'main');
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  startAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      this.saveToStorage().catch(console.error);
    }, 30000);
    
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
    });
  }
  
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
  
  async runMigrations() {
    // 创建迁移表
    this.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at INTEGER NOT NULL
      )
    `);
    
    const migrations = await this.getMigrations();
    const executed = this.query('SELECT version FROM schema_migrations');
    const executedVersions = new Set(executed.map(r => r.version));
    
    for (const migration of migrations) {
      if (!executedVersions.has(migration.version)) {
        console.log(`Running migration: ${migration.name}`);
        
        await this.transaction(async () => {
          this.exec(migration.sql);
          this.run(
            'INSERT INTO schema_migrations (version, name, executed_at) VALUES (?, ?, ?)',
            [migration.version, migration.name, Date.now()]
          );
        });
      }
    }
  }
  
  async getMigrations() {
    const { migrations } = await import('./migrations/index.js');
    return migrations;
  }
  
  ensureReady() {
    if (!this.ready || !this.db) {
      throw new Error('Database not initialized');
    }
  }
  
  isReady() {
    return this.ready;
  }
  
  getMode() {
    return 'wasm';
  }
}
```

### Step 3: JAR API 实现 (2h)

```javascript
// database/jar-database.js

export class JarDatabaseService {
  constructor(baseUrl = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl;
    this.ready = false;
  }
  
  async init() {
    // 测试连接
    const response = await fetch(`${this.baseUrl}/api/local/health`);
    if (!response.ok) {
      throw new Error('JAR service unavailable');
    }
    
    this.ready = true;
  }
  
  async close() {
    this.ready = false;
  }
  
  async query(sql, params = []) {
    this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/local/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Query failed');
    }
    
    const result = await response.json();
    return result.rows;
  }
  
  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  async run(sql, params = []) {
    this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/local/db/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Exec failed');
    }
    
    return await response.json();
  }
  
  async exec(sql) {
    return this.run(sql, []);
  }
  
  async transaction(callback) {
    // JAR 端处理事务
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }
  
  async runMigrations() {
    // JAR 端自动运行迁移
    const response = await fetch(`${this.baseUrl}/api/local/db/migrate`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Migration failed');
    }
  }
  
  ensureReady() {
    if (!this.ready) {
      throw new Error('Database not initialized');
    }
  }
  
  isReady() {
    return this.ready;
  }
  
  getMode() {
    return 'jar';
  }
}
```

### Step 4: 迁移脚本 (3h)

```javascript
// database/migrations/index.js

export const migrations = [
  {
    version: 1,
    name: 'initial',
    sql: `
      -- 系统配置表
      CREATE TABLE system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- 模块表
      CREATE TABLE modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        deleted_by TEXT
      );
      
      -- 列表表
      CREATE TABLE columns (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (module_id) REFERENCES modules(id)
      );
      
      -- 卡片表
      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'markdown',
        tags TEXT,
        attachments TEXT,
        metadata TEXT,
        sort_order INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (column_id) REFERENCES columns(id)
      );
      
      -- 卡片全文搜索
      CREATE VIRTUAL TABLE cards_fts USING fts5(
        title, content, tags,
        content='cards',
        content_rowid='rowid',
        tokenize='unicode61'
      );
      
      -- 卡片链接表
      CREATE TABLE card_links (
        id TEXT PRIMARY KEY,
        source_card_id TEXT NOT NULL,
        target_card_id TEXT NOT NULL,
        link_type TEXT DEFAULT 'reference',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_card_id) REFERENCES cards(id),
        FOREIGN KEY (target_card_id) REFERENCES cards(id)
      );
      
      -- 文件表
      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT,
        size INTEGER NOT NULL,
        mime_type TEXT,
        hash TEXT,
        parent_id TEXT,
        parent_type TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );
      
      -- 同步队列表
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        priority INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        last_attempt INTEGER,
        next_attempt INTEGER,
        error_message TEXT
      );
      
      -- 版本历史表
      CREATE TABLE version_history (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        change_type TEXT NOT NULL,
        changed_by TEXT,
        created_at INTEGER NOT NULL
      );
      
      -- 索引
      CREATE INDEX idx_modules_sort ON modules(sort_order);
      CREATE INDEX idx_columns_module ON columns(module_id);
      CREATE INDEX idx_cards_column ON cards(column_id);
      CREATE INDEX idx_cards_sync ON cards(sync_status);
      CREATE INDEX idx_files_parent ON files(parent_id, parent_type);
      CREATE INDEX idx_sync_queue_status ON sync_queue(status, next_attempt);
      CREATE INDEX idx_version_history_entity ON version_history(entity_type, entity_id);
    `
  },
  {
    version: 2,
    name: 'add_tasks',
    sql: `
      -- 任务项目表
      CREATE TABLE task_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        members TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      );
      
      -- 任务表
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'todo',
        priority INTEGER DEFAULT 3,
        tags TEXT,
        assignee TEXT,
        assignee_name TEXT,
        due_date INTEGER,
        reminder_at INTEGER,
        project_id TEXT,
        parent_id TEXT,
        estimated_hours REAL,
        actual_hours REAL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES task_projects(id),
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );
      
      -- 任务全文搜索
      CREATE VIRTUAL TABLE tasks_fts USING fts5(
        title, content, tags,
        content='tasks',
        content_rowid='rowid',
        tokenize='unicode61'
      );
      
      -- 索引
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_assignee ON tasks(assignee);
      CREATE INDEX idx_tasks_due ON tasks(due_date);
      CREATE INDEX idx_tasks_project ON tasks(project_id);
    `
  },
  {
    version: 3,
    name: 'add_chat',
    sql: `
      -- 聊天室表
      CREATE TABLE chat_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        room_type TEXT DEFAULT 'group',
        description TEXT,
        avatar TEXT,
        members TEXT,
        admins TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message_at INTEGER,
        last_message TEXT,
        last_read_at INTEGER DEFAULT 0,
        muted INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0
      );
      
      -- 聊天消息表
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        sender_avatar TEXT,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        attachments TEXT,
        reply_to TEXT,
        mentions TEXT,
        reactions TEXT,
        created_at INTEGER NOT NULL,
        edited_at INTEGER,
        status TEXT DEFAULT 'sent',
        deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
      );
      
      -- 索引
      CREATE INDEX idx_chat_rooms_type ON chat_rooms(room_type);
      CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
      CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
    `
  },
  {
    version: 4,
    name: 'add_search_history',
    sql: `
      -- 搜索历史表
      CREATE TABLE search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        search_type TEXT DEFAULT 'global',
        result_count INTEGER,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX idx_search_history_time ON search_history(created_at DESC);
    `
  }
];
```

### Step 5: UUID v7 工具 (1h)

```javascript
// database/utils/uuid.js

export function uuidv7() {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // UUID v7 格式
  return [
    timestampHex.slice(0, 8),                                    // 时间戳高位
    timestampHex.slice(8, 12),                                   // 时间戳低位
    '7' + randomHex.slice(0, 3),                                 // 版本 7 + 随机
    ((parseInt(randomHex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) + randomHex.slice(4, 7),  // 变体 + 随机
    randomHex.slice(7, 19)                                       // 随机
  ].join('-');
}

// 简化版本（带前缀）
export function generateId(prefix = '') {
  const id = uuidv7();
  return prefix ? `${prefix}_${id}` : id;
}
```

### Step 6: 测试 (1h)

```javascript
// tests/unit/database.test.js

import { WasmDatabaseService } from '../services/database/wasm-database.js';

describe('WasmDatabaseService', () => {
  let db;
  
  beforeEach(async () => {
    db = new WasmDatabaseService();
    await db.init();
  });
  
  afterEach(async () => {
    await db.close();
  });
  
  test('query returns array', () => {
    const results = db.query('SELECT 1 as num');
    expect(results).toHaveLength(1);
    expect(results[0].num).toBe(1);
  });
  
  test('queryOne returns single object', () => {
    const result = db.queryOne('SELECT 1 as num');
    expect(result.num).toBe(1);
  });
  
  test('run returns changes count', () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    const result = db.run('INSERT INTO test (name) VALUES (?)', ['test']);
    expect(result.changes).toBe(1);
  });
  
  test('transaction commits on success', async () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    
    await db.transaction(async () => {
      db.run('INSERT INTO test (name) VALUES (?)', ['a']);
      db.run('INSERT INTO test (name) VALUES (?)', ['b']);
    });
    
    const count = db.queryOne('SELECT COUNT(*) as c FROM test');
    expect(count.c).toBe(2);
  });
  
  test('transaction rolls back on error', async () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    
    try {
      await db.transaction(async () => {
        db.run('INSERT INTO test (name) VALUES (?)', ['a']);
        throw new Error('Test error');
      });
    } catch (e) {
      // Expected
    }
    
    const count = db.queryOne('SELECT COUNT(*) as c FROM test');
    expect(count.c).toBe(0);
  });
  
  test('migrations create tables', () => {
    const tables = db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('modules');
    expect(tableNames).toContain('cards');
    expect(tableNames).toContain('tasks');
  });
});
```

## 验收标准

- [ ] WASM 模式正常工作
- [ ] JAR 模式正常工作
- [ ] 模式自动降级
- [ ] 迁移系统正常
- [ ] IndexedDB 持久化
- [ ] 事务支持
- [ ] FTS 搜索工作
- [ ] UUID v7 生成正确

## 参考规格

- `specs/05-database.md` - 数据库详细规格
- `specs/services/database-service.md` - 服务接口

## 下一步

完成后进入 `task-005-authentication.md` - 认证系统开发