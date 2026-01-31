# 05 - 数据库规格

## 概述

Localverse 使用 SQLite 作为主要数据存储，支持两种访问方式：
1. **WASM 模式**：浏览器内通过 sql.js 访问
2. **JAR 模式**：通过 JDBC 访问本地文件

## 设计原则

- **离线优先**：所有数据本地存储
- **UUID 主键**：避免离线冲突
- **版本控制**：乐观锁支持
- **软删除**：数据可恢复

## 数据库文件

```
data/
├── localverse.db        # 主数据库
├── localverse.db-wal    # WAL 日志
├── localverse.db-shm    # 共享内存
└── backups/
    ├── localverse_20260131.db
    └── ...
```

## 通用字段规范

### 主键
- 类型：`TEXT`
- 格式：UUID v7
- 生成：前端生成（保证离线可用）

### 时间戳
- 类型：`INTEGER`
- 格式：Unix 毫秒时间戳
- 时区：UTC

### JSON 字段
- 类型：`TEXT`
- 格式：JSON 字符串
- 查询：使用 SQLite JSON 函数

### 软删除
- 字段：`deleted INTEGER DEFAULT 0`
- 删除时间：`deleted_at INTEGER`
- 删除者：`deleted_by TEXT`

### 版本控制
- 字段：`version INTEGER DEFAULT 1`
- 更新时：`version = version + 1`
- 冲突检测：`WHERE version = ?`

## 核心表结构

### 系统配置表 (system_config)

```sql
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    value_type TEXT DEFAULT 'string',  -- string | number | boolean | json
    description TEXT,
    updated_at INTEGER NOT NULL
);

-- 初始数据
INSERT INTO system_config (key, value, value_type, description, updated_at) VALUES
('db_version', '1', 'number', '数据库版本', 1709888888000),
('user_id', '', 'string', '当前用户ID', 1709888888000),
('user_name', '', 'string', '当前用户名', 1709888888000),
('department', '', 'string', '部门', 1709888888000),
('theme', 'light', 'string', '主题', 1709888888000),
('language', 'zh', 'string', '语言', 1709888888000),
('sync_enabled', 'true', 'boolean', '是否启用同步', 1709888888000),
('last_sync_time', '0', 'number', '上次同步时间', 1709888888000);
```

### 模块表 (modules)

```sql
CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    version INTEGER DEFAULT 1,
    sync_status TEXT DEFAULT 'local',
    deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT
);

CREATE INDEX idx_modules_sort ON modules(sort_order);
CREATE INDEX idx_modules_sync ON modules(sync_status);
```

### 列表列表 (columns)

```sql
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
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (module_id) REFERENCES modules(id)
);

CREATE INDEX idx_columns_module ON columns(module_id);
CREATE INDEX idx_columns_sort ON columns(module_id, sort_order);
```

### 卡片表 (cards)

```sql
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'markdown',  -- markdown | richtext | code
    tags TEXT,                              -- JSON 数组
    attachments TEXT,                       -- JSON 数组
    metadata TEXT,                          -- JSON 对象
    sort_order INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    version INTEGER DEFAULT 1,
    sync_status TEXT DEFAULT 'local',
    deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (column_id) REFERENCES columns(id)
);

CREATE INDEX idx_cards_column ON cards(column_id);
CREATE INDEX idx_cards_sort ON cards(column_id, sort_order);
CREATE INDEX idx_cards_pinned ON cards(is_pinned);
CREATE INDEX idx_cards_sync ON cards(sync_status);

-- 全文搜索
CREATE VIRTUAL TABLE cards_fts USING fts5(
    title,
    content,
    tags,
    content='cards',
    content_rowid='rowid',
    tokenize='unicode61'
);

-- 触发器：同步 FTS
CREATE TRIGGER cards_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, title, content, tags)
    VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
END;

CREATE TRIGGER cards_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, content, tags)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
END;

CREATE TRIGGER cards_au AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, content, tags)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
    INSERT INTO cards_fts(rowid, title, content, tags)
    VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
END;
```

### 文件表 (files)

```sql
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT,                              -- 本地路径（JAR模式）
    blob_data BLOB,                         -- 二进制数据（WASM模式）
    size INTEGER NOT NULL,
    mime_type TEXT,
    hash TEXT,                              -- SHA-256
    parent_id TEXT,                         -- 所属实体 ID
    parent_type TEXT,                       -- card | task | chat
    thumbnail BLOB,                         -- 缩略图
    metadata TEXT,                          -- JSON: 图片尺寸、视频时长等
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    version INTEGER DEFAULT 1,
    sync_status TEXT DEFAULT 'local',
    deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT
);

CREATE INDEX idx_files_parent ON files(parent_id, parent_type);
CREATE INDEX idx_files_hash ON files(hash);
CREATE INDEX idx_files_sync ON files(sync_status);
```

### 任务表 (tasks)

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'todo',             -- todo | doing | done | cancelled
    priority INTEGER DEFAULT 5,             -- 1-10
    tags TEXT,                              -- JSON 数组
    assignee TEXT,                          -- 用户 ID
    due_date INTEGER,                       -- 截止时间
    reminder_at INTEGER,                    -- 提醒时间
    project_id TEXT,                        -- 项目 ID
    parent_id TEXT,                         -- 父任务 ID（子任务）
    estimated_hours REAL,                   -- 预估工时
    actual_hours REAL,                      -- 实际工时
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    version INTEGER DEFAULT 1,
    sync_status TEXT DEFAULT 'local',
    deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_sync ON tasks(sync_status);

-- 全文搜索
CREATE VIRTUAL TABLE tasks_fts USING fts5(
    title,
    content,
    tags,
    content='tasks',
    content_rowid='rowid',
    tokenize='unicode61'
);
```

### 聊天消息表 (chat_messages)

```sql
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',       -- text | image | file | system
    attachments TEXT,                       -- JSON 数组
    reply_to TEXT,                          -- 回复的消息 ID
    mentions TEXT,                          -- JSON: @的用户ID列表
    reactions TEXT,                         -- JSON: 表情反应
    created_at INTEGER NOT NULL,
    edited_at INTEGER,
    deleted INTEGER DEFAULT 0,
    deleted_at INTEGER
);

CREATE INDEX idx_chat_room ON chat_messages(room_id, created_at);
CREATE INDEX idx_chat_sender ON chat_messages(sender_id);
```

### 同步队列表 (sync_queue)

```sql
CREATE TABLE sync_queue (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,              -- create | update | delete
    entity_type TEXT NOT NULL,              -- card | task | file | ...
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,                  -- JSON: 完整数据
    status TEXT DEFAULT 'pending',          -- pending | sending | failed | done
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    priority INTEGER DEFAULT 5,
    created_at INTEGER NOT NULL,
    last_attempt INTEGER,
    next_attempt INTEGER,
    error_message TEXT
);

CREATE INDEX idx_sync_status ON sync_queue(status, next_attempt);
CREATE INDEX idx_sync_entity ON sync_queue(entity_type, entity_id);
```

### 同步冲突表 (sync_conflicts)

```sql
CREATE TABLE sync_conflicts (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    local_data TEXT NOT NULL,               -- JSON
    remote_data TEXT NOT NULL,              -- JSON
    base_data TEXT,                         -- JSON
    conflict_fields TEXT,                   -- JSON: 冲突字段列表
    status TEXT DEFAULT 'pending',          -- pending | resolved | ignored
    resolution TEXT,                        -- local | remote | merged
    resolved_data TEXT,                     -- JSON
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolved_by TEXT
);

CREATE INDEX idx_conflicts_status ON sync_conflicts(status);
CREATE INDEX idx_conflicts_entity ON sync_conflicts(entity_type, entity_id);
```

### 版本历史表 (version_history)

```sql
CREATE TABLE version_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,                     -- JSON: 完整快照
    change_type TEXT NOT NULL,              -- create | update | delete
    changed_fields TEXT,                    -- JSON: 变更的字段
    changed_by TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_history_entity ON version_history(entity_type, entity_id, version);
CREATE INDEX idx_history_time ON version_history(created_at);
```

### 搜索历史表 (search_history)

```sql
CREATE TABLE search_history (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    search_type TEXT DEFAULT 'global',      -- global | cards | files | tasks
    result_count INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_search_time ON search_history(created_at DESC);
```

## 数据库迁移

### 迁移文件结构

```
migrations/
├── 001_initial.sql
├── 002_add_tasks.sql
├── 003_add_chat.sql
└── ...
```

### 迁移记录表

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    executed_at INTEGER NOT NULL
);
```

### 迁移执行逻辑

```javascript
async function runMigrations(db) {
  // 获取已执行的版本
  const executed = await db.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const executedVersions = new Set(executed.map(r => r.version));
  
  // 获取所有迁移文件
  const migrations = getMigrationFiles();
  
  // 执行未执行的迁移
  for (const migration of migrations) {
    if (!executedVersions.has(migration.version)) {
      await db.transaction(async () => {
        await db.exec(migration.sql);
        await db.run(
          'INSERT INTO schema_migrations (version, name, executed_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, Date.now()]
        );
      });
      console.log(`Migrated: ${migration.name}`);
    }
  }
}
```

## UUID v7 生成

```javascript
function uuidv7() {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    '7' + randomHex.slice(0, 3),
    ((parseInt(randomHex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) + randomHex.slice(4, 7),
    randomHex.slice(7, 19)
  ].join('-');
}
```

## 数据库服务接口

### TypeScript 接口

```typescript
interface DatabaseService {
  // 查询
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  
  // 执行
  run(sql: string, params?: any[]): Promise<{ changes: number; lastId: number }>;
  exec(sql: string): Promise<void>;
  
  // 批量
  batch(statements: Array<{ sql: string; params?: any[] }>): Promise<void>;
  
  // 事务
  transaction<T>(callback: () => Promise<T>): Promise<T>;
  
  // 备份
  backup(path: string): Promise<void>;
  restore(path: string): Promise<void>;
  
  // 状态
  getStats(): Promise<DatabaseStats>;
}

interface DatabaseStats {
  size: number;           // 文件大小（字节）
  tableCount: number;     // 表数量
  indexCount: number;     // 索引数量
  rowCounts: Record<string, number>;  // 各表行数
}
```

### Java 接口

```java
public interface DatabaseService {
    <T> List<T> query(String sql, Object[] params, RowMapper<T> mapper);
    <T> Optional<T> queryOne(String sql, Object[] params, RowMapper<T> mapper);
    
    int run(String sql, Object[] params);
    void exec(String sql);
    
    void batch(List<Statement> statements);
    
    <T> T transaction(Callable<T> callback);
    
    void backup(String path);
    void restore(String path);
    
    DatabaseStats getStats();
}
```

## 测试要点

### 单元测试

1. **CRUD 操作**
   - 各表的增删改查
   - 级联删除
   - 软删除恢复

2. **全文搜索**
   - 中文搜索
   - 日文搜索
   - 英文搜索
   - 混合搜索

3. **UUID 生成**
   - 格式正确
   - 时间排序
   - 无冲突

4. **迁移**
   - 顺序执行
   - 幂等性
   - 回滚

### 集成测试

1. **WASM 模式**
   - sql.js 加载
   - 数据持久化
   - 大数据量

2. **JAR 模式**
   - JDBC 连接
   - 事务
   - 并发

3. **模式切换**
   - WASM → JAR 数据迁移
   - JAR → WASM 数据迁移

## 相关规格

- `07-sync-engine.md` - 同步引擎
- `services/database-service.md` - 数据库服务详细设计

## 相关任务

- `tasks/phase-0/task-004-database.md`