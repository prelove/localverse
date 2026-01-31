# Database Service 规格

## 概述

DatabaseService 是 Localverse 的核心数据服务，提供：
1. SQLite 数据库访问（WASM/JDBC 双模式）
2. 统一的查询接口
3. 事务支持
4. 迁移管理

## 接口定义

### TypeScript 接口（前端）

```typescript
interface DatabaseService {
  // 初始化
  init(): Promise<void>;
  close(): Promise<void>;
  
  // 查询
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  
  // 执行
  run(sql: string, params?: any[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  
  // 批量
  batch(statements: Statement[]): Promise<void>;
  
  // 事务
  transaction<T>(callback: () => Promise<T>): Promise<T>;
  
  // 备份恢复
  backup(): Promise<Uint8Array>;
  restore(data: Uint8Array): Promise<void>;
  exportToFile(path: string): Promise<void>;
  importFromFile(path: string): Promise<void>;
  
  // 迁移
  runMigrations(): Promise<void>;
  getMigrationStatus(): Promise<MigrationStatus[]>;
  
  // 状态
  getStats(): Promise<DatabaseStats>;
  isReady(): boolean;
}

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

interface Statement {
  sql: string;
  params?: any[];
}

interface DatabaseStats {
  size: number;
  tables: TableInfo[];
  version: number;
}

interface TableInfo {
  name: string;
  rowCount: number;
  indexCount: number;
}

interface MigrationStatus {
  version: number;
  name: string;
  executedAt: number | null;
  pending: boolean;
}
```

### Java 接口（后端）

```java
public interface DatabaseService {
    // 初始化
    void init() throws SQLException;
    void close() throws SQLException;
    
    // ��询
    <T> List<T> query(String sql, Object[] params, RowMapper<T> mapper) throws SQLException;
    <T> Optional<T> queryOne(String sql, Object[] params, RowMapper<T> mapper) throws SQLException;
    
    // 执行
    int run(String sql, Object[] params) throws SQLException;
    void exec(String sql) throws SQLException;
    
    // 批量
    int[] batch(List<Statement> statements) throws SQLException;
    
    // 事务
    <T> T transaction(TransactionCallback<T> callback) throws SQLException;
    
    // 备份恢复
    void backup(String path) throws SQLException;
    void restore(String path) throws SQLException;
    
    // 迁移
    void runMigrations() throws SQLException;
    List<MigrationStatus> getMigrationStatus() throws SQLException;
    
    // 状态
    DatabaseStats getStats() throws SQLException;
    boolean isReady();
}

@FunctionalInterface
public interface RowMapper<T> {
    T map(ResultSet rs) throws SQLException;
}

@FunctionalInterface
public interface TransactionCallback<T> {
    T execute() throws SQLException;
}
```

## WASM 实现（前端）

```javascript
// services/database-wasm.js

import initSqlJs from '/lib/sql.js/sql-wasm.js';

class WasmDatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.ready = false;
    this.dbName = 'localverse';
  }
  
  async init() {
    // 加载 sql.js
    this.SQL = await initSqlJs({
      locateFile: file => `/wasm/${file.replace('.wasm', '.dat')}`
    });
    
    // 尝试从 IndexedDB 加载已有数据库
    const savedData = await this.loadFromIndexedDB();
    
    if (savedData) {
      this.db = new this.SQL.Database(savedData);
    } else {
      this.db = new this.SQL.Database();
      await this.runMigrations();
    }
    
    // 启用 WAL 模式（如果支持）
    try {
      this.db.run('PRAGMA journal_mode = WAL');
    } catch (e) {
      // WAL 在某些环境不支持
    }
    
    // 启用外键
    this.db.run('PRAGMA foreign_keys = ON');
    
    this.ready = true;
    
    // 定期保存到 IndexedDB
    this.startAutoSave();
  }
  
  async close() {
    await this.saveToIndexedDB();
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
  
  batch(statements) {
    this.ensureReady();
    
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const stmt of statements) {
        this.db.run(stmt.sql, stmt.params || []);
      }
      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
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
  
  backup() {
    this.ensureReady();
    return this.db.export();
  }
  
  async restore(data) {
    if (this.db) {
      this.db.close();
    }
    this.db = new this.SQL.Database(data);
    await this.saveToIndexedDB();
  }
  
  // IndexedDB 持久化
  async loadFromIndexedDB() {
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
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async saveToIndexedDB() {
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
    // 每 30 秒自动保存
    setInterval(() => {
      if (this.ready) {
        this.saveToIndexedDB().catch(console.error);
      }
    }, 30000);
    
    // 页面关闭前保存
    window.addEventListener('beforeunload', () => {
      if (this.ready) {
        // 同步保存（不推荐但必要）
        const data = this.db.export();
        const blob = new Blob([data]);
        // 使用 sendBeacon 或 localStorage 临时保存
      }
    });
  }
  
  async runMigrations() {
    const migrations = await this.loadMigrations();
    
    // 创建迁移表
    this.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at INTEGER NOT NULL
      )
    `);
    
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
  
  async loadMigrations() {
    // 内置迁移脚本
    return [
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
            deleted INTEGER DEFAULT 0
          );
          
          -- 列表表
          CREATE TABLE columns (
            id TEXT PRIMARY KEY,
            module_id TEXT NOT NULL,
            name TEXT NOT NULL,
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
            tags TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            version INTEGER DEFAULT 1,
            sync_status TEXT DEFAULT 'local',
            deleted INTEGER DEFAULT 0,
            FOREIGN KEY (column_id) REFERENCES columns(id)
          );
          
          -- 全文搜索
          CREATE VIRTUAL TABLE cards_fts USING fts5(
            title, content, tags,
            content='cards',
            content_rowid='rowid',
            tokenize='unicode61'
          );
          
          -- 同步队列
          CREATE TABLE sync_queue (
            id TEXT PRIMARY KEY,
            action_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            retry_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            next_attempt INTEGER
          );
          
          -- 索引
          CREATE INDEX idx_modules_sort ON modules(sort_order);
          CREATE INDEX idx_columns_module ON columns(module_id);
          CREATE INDEX idx_cards_column ON cards(column_id);
          CREATE INDEX idx_sync_queue_status ON sync_queue(status, next_attempt);
        `
      },
      {
        version: 2,
        name: 'add_tasks',
        sql: `
          CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'todo',
            priority INTEGER DEFAULT 5,
            tags TEXT,
            assignee TEXT,
            due_date INTEGER,
            created_by TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            version INTEGER DEFAULT 1,
            sync_status TEXT DEFAULT 'local',
            deleted INTEGER DEFAULT 0
          );
          
          CREATE INDEX idx_tasks_status ON tasks(status);
          CREATE INDEX idx_tasks_assignee ON tasks(assignee);
          CREATE INDEX idx_tasks_due ON tasks(due_date);
          
          CREATE VIRTUAL TABLE tasks_fts USING fts5(
            title, content, tags,
            content='tasks',
            content_rowid='rowid',
            tokenize='unicode61'
          );
        `
      },
      {
        version: 3,
        name: 'add_chat',
        sql: `
          CREATE TABLE chat_rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            room_type TEXT DEFAULT 'group',
            members TEXT,
            created_at INTEGER NOT NULL
          );
          
          CREATE TABLE chat_messages (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_name TEXT,
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',
            created_at INTEGER NOT NULL,
            deleted INTEGER DEFAULT 0,
            FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
          );
          
          CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
        `
      },
      {
        version: 4,
        name: 'add_files',
        sql: `
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
          
          CREATE INDEX idx_files_parent ON files(parent_id, parent_type);
          CREATE INDEX idx_files_hash ON files(hash);
        `
      }
    ];
  }
  
  getStats() {
    this.ensureReady();
    
    const tables = this.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableInfos = tables.map(t => {
      const count = this.queryOne(`SELECT COUNT(*) as count FROM ${t.name}`);
      const indexes = this.query(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='index' AND tbl_name=?
      `, [t.name]);
      
      return {
        name: t.name,
        rowCount: count?.count || 0,
        indexCount: indexes[0]?.count || 0
      };
    });
    
    const data = this.db.export();
    
    return {
      size: data.byteLength,
      tables: tableInfos,
      version: this.queryOne('SELECT MAX(version) as v FROM schema_migrations')?.v || 0
    };
  }
  
  ensureReady() {
    if (!this.ready || !this.db) {
      throw new Error('Database not initialized');
    }
  }
  
  isReady() {
    return this.ready;
  }
}

export default WasmDatabaseService;
```

## JDBC 实现（后端）

```java
// services/JdbcDatabaseService.java

package com.localverse.services;

import java.sql.*;
import java.util.*;
import java.nio.file.*;

public class JdbcDatabaseService implements DatabaseService {
    private Connection connection;
    private String dbPath;
    private boolean ready = false;
    
    public JdbcDatabaseService(String dbPath) {
        this.dbPath = dbPath;
    }
    
    @Override
    public void init() throws SQLException {
        // 加载 SQLite JDBC 驱动
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            throw new SQLException("SQLite JDBC driver not found", e);
        }
        
        // 创建连接
        String url = "jdbc:sqlite:" + dbPath;
        connection = DriverManager.getConnection(url);
        
        // 配置
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("PRAGMA journal_mode = WAL");
            stmt.execute("PRAGMA foreign_keys = ON");
            stmt.execute("PRAGMA busy_timeout = 5000");
        }
        
        // 运行迁移
        runMigrations();
        
        ready = true;
    }
    
    @Override
    public void close() throws SQLException {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
        ready = false;
    }
    
    @Override
    public <T> List<T> query(String sql, Object[] params, RowMapper<T> mapper) throws SQLException {
        ensureReady();
        
        List<T> results = new ArrayList<>();
        
        try (PreparedStatement stmt = connection.prepareStatement(sql)) {
            bindParams(stmt, params);
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    results.add(mapper.map(rs));
                }
            }
        }
        
        return results;
    }
    
    @Override
    public <T> Optional<T> queryOne(String sql, Object[] params, RowMapper<T> mapper) throws SQLException {
        List<T> results = query(sql, params, mapper);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }
    
    @Override
    public int run(String sql, Object[] params) throws SQLException {
        ensureReady();
        
        try (PreparedStatement stmt = connection.prepareStatement(sql)) {
            bindParams(stmt, params);
            return stmt.executeUpdate();
        }
    }
    
    @Override
    public void exec(String sql) throws SQLException {
        ensureReady();
        
        try (Statement stmt = connection.createStatement()) {
            stmt.execute(sql);
        }
    }
    
    @Override
    public int[] batch(List<Statement> statements) throws SQLException {
        ensureReady();
        
        int[] results = new int[statements.size()];
        
        connection.setAutoCommit(false);
        try {
            for (int i = 0; i < statements.size(); i++) {
                Statement s = statements.get(i);
                try (PreparedStatement stmt = connection.prepareStatement(s.sql())) {
                    bindParams(stmt, s.params());
                    results[i] = stmt.executeUpdate();
                }
            }
            connection.commit();
        } catch (SQLException e) {
            connection.rollback();
            throw e;
        } finally {
            connection.setAutoCommit(true);
        }
        
        return results;
    }
    
    @Override
    public <T> T transaction(TransactionCallback<T> callback) throws SQLException {
        ensureReady();
        
        connection.setAutoCommit(false);
        try {
            T result = callback.execute();
            connection.commit();
            return result;
        } catch (SQLException e) {
            connection.rollback();
            throw e;
        } finally {
            connection.setAutoCommit(true);
        }
    }
    
    @Override
    public void backup(String path) throws SQLException {
        ensureReady();
        
        try (java.sql.Statement stmt = connection.createStatement()) {
            stmt.execute("VACUUM INTO '" + path + "'");
        }
    }
    
    @Override
    public void restore(String path) throws SQLException {
        close();
        
        try {
            Files.copy(Path.of(path), Path.of(dbPath), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new SQLException("Failed to restore database", e);
        }
        
        init();
    }
    
    @Override
    public void runMigrations() throws SQLException {
        // 创建迁移表
        exec("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                executed_at INTEGER NOT NULL
            )
            """);
        
        // 获取已执行的迁移
        Set<Integer> executed = new HashSet<>();
        query("SELECT version FROM schema_migrations", new Object[]{}, rs -> rs.getInt("version"))
            .forEach(executed::add);
        
        // 执行待处理的迁移
        for (Migration migration : getMigrations()) {
            if (!executed.contains(migration.version())) {
                System.out.println("Running migration: " + migration.name());
                
                transaction(() -> {
                    exec(migration.sql());
                    run("INSERT INTO schema_migrations (version, name, executed_at) VALUES (?, ?, ?)",
                        new Object[]{migration.version(), migration.name(), System.currentTimeMillis()});
                    return null;
                });
            }
        }
    }
    
    @Override
    public List<MigrationStatus> getMigrationStatus() throws SQLException {
        List<Migration> all = getMigrations();
        Map<Integer, Long> executed = new HashMap<>();
        
        query("SELECT version, executed_at FROM schema_migrations", new Object[]{}, rs -> {
            executed.put(rs.getInt("version"), rs.getLong("executed_at"));
            return null;
        });
        
        return all.stream().map(m -> new MigrationStatus(
            m.version(),
            m.name(),
            executed.get(m.version()),
            !executed.containsKey(m.version())
        )).toList();
    }
    
    @Override
    public DatabaseStats getStats() throws SQLException {
        ensureReady();
        
        List<TableInfo> tables = query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            new Object[]{},
            rs -> {
                String name = rs.getString("name");
                int rowCount = queryOne("SELECT COUNT(*) as c FROM " + name, new Object[]{}, 
                    r -> r.getInt("c")).orElse(0);
                return new TableInfo(name, rowCount, 0);
            }
        );
        
        long size = new java.io.File(dbPath).length();
        int version = queryOne("SELECT MAX(version) as v FROM schema_migrations", new Object[]{},
            rs -> rs.getInt("v")).orElse(0);
        
        return new DatabaseStats(size, tables, version);
    }
    
    @Override
    public boolean isReady() {
        return ready;
    }
    
    private void bindParams(PreparedStatement stmt, Object[] params) throws SQLException {
        if (params == null) return;
        
        for (int i = 0; i < params.length; i++) {
            Object param = params[i];
            if (param == null) {
                stmt.setNull(i + 1, Types.NULL);
            } else if (param instanceof String) {
                stmt.setString(i + 1, (String) param);
            } else if (param instanceof Integer) {
                stmt.setInt(i + 1, (Integer) param);
            } else if (param instanceof Long) {
                stmt.setLong(i + 1, (Long) param);
            } else if (param instanceof Double) {
                stmt.setDouble(i + 1, (Double) param);
            } else if (param instanceof byte[]) {
                stmt.setBytes(i + 1, (byte[]) param);
            } else {
                stmt.setObject(i + 1, param);
            }
        }
    }
    
    private void ensureReady() throws SQLException {
        if (!ready) {
            throw new SQLException("Database not initialized");
        }
    }
    
    private List<Migration> getMigrations() {
        // 返回迁移列表（与 WASM 版本相同）
        return List.of(
            new Migration(1, "initial", MIGRATION_1_SQL),
            new Migration(2, "add_tasks", MIGRATION_2_SQL),
            new Migration(3, "add_chat", MIGRATION_3_SQL),
            new Migration(4, "add_files", MIGRATION_4_SQL)
        );
    }
    
    // 迁移 SQL 常量
    private static final String MIGRATION_1_SQL = """
        -- 与 WASM 版本相同
        """;
    // ... 其他迁移
}

record Migration(int version, String name, String sql) {}
record MigrationStatus(int version, String name, Long executedAt, boolean pending) {}
record DatabaseStats(long size, List<TableInfo> tables, int version) {}
record TableInfo(String name, int rowCount, int indexCount) {}
record Statement(String sql, Object[] params) {}
```

## 测试用例

```javascript
// tests/unit/database-service.test.js

describe('DatabaseService', () => {
  let db;
  
  beforeEach(async () => {
    db = new WasmDatabaseService();
    await db.init();
  });
  
  afterEach(async () => {
    await db.close();
  });
  
  describe('基础操作', () => {
    test('query 返回数组', async () => {
      const results = db.query('SELECT 1 as num');
      expect(results).toHaveLength(1);
      expect(results[0].num).toBe(1);
    });
    
    test('queryOne 返回单个对象', async () => {
      const result = db.queryOne('SELECT 1 as num');
      expect(result.num).toBe(1);
    });
    
    test('queryOne 无结果返回 null', async () => {
      const result = db.queryOne('SELECT 1 WHERE 0');
      expect(result).toBeNull();
    });
    
    test('run 返回影响行数', async () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      const result = db.run('INSERT INTO test (name) VALUES (?)', ['test']);
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBe(1);
    });
  });
  
  describe('事务', () => {
    test('事务成功提交', async () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      
      await db.transaction(async () => {
        db.run('INSERT INTO test (name) VALUES (?)', ['a']);
        db.run('INSERT INTO test (name) VALUES (?)', ['b']);
      });
      
      const count = db.queryOne('SELECT COUNT(*) as c FROM test');
      expect(count.c).toBe(2);
    });
    
    test('事务失败回滚', async () => {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      
      try {
        await db.transaction(async () => {
          db.run('INSERT INTO test (name) VALUES (?)', ['a']);
          throw new Error('Test error');
        });
      } catch (e) {
        // 期望抛出错误
      }
      
      const count = db.queryOne('SELECT COUNT(*) as c FROM test');
      expect(count.c).toBe(0);
    });
  });
  
  describe('迁���', () => {
    test('迁移创建所有表', async () => {
      const tables = db.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('modules');
      expect(tableNames).toContain('cards');
      expect(tableNames).toContain('tasks');
    });
    
    test('迁移记录正确', async () => {
      const status = db.query('SELECT * FROM schema_migrations ORDER BY version');
      expect(status.length).toBeGreaterThan(0);
      expect(status[0].version).toBe(1);
    });
  });
  
  describe('全文搜索', () => {
    test('FTS 搜索工作', async () => {
      // 插入测试数据
      const cardId = 'test-card-1';
      db.run(`
        INSERT INTO cards (id, column_id, title, content, tags, created_at, updated_at)
        VALUES (?, 'col-1', '测试标题', '这是测试内容', '["tag1"]', ?, ?)
      `, [cardId, Date.now(), Date.now()]);
      
      // 同步到 FTS
      db.run(`
        INSERT INTO cards_fts (rowid, title, content, tags)
        SELECT rowid, title, content, tags FROM cards WHERE id = ?
      `, [cardId]);
      
      // 搜索
      const results = db.query(`
        SELECT c.* FROM cards c
        JOIN cards_fts fts ON c.rowid = fts.rowid
        WHERE cards_fts MATCH '测试'
      `);
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(cardId);
    });
  });
});
```

## 相关规格

- `05-database.md` - 数据库整体设计
- `07-sync-engine.md` - 同步引擎

## 相关任务

- `tasks/phase-0/task-004-database.md`