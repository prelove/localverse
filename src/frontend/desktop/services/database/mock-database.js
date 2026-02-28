/**
 * Mock 数据库服务
 * 用于单元测试，使用内存存储
 */

export class MockDatabaseService {
  constructor() {
    this.ready = false;
    this.tables = new Map(); // 表名 -> 行数组
    this.migrations = [];
  }
  
  /**
   * 初始化数据库
   */
  async init() {
    this.ready = true;
    await this.runMigrations();
  }
  
  /**
   * 关闭数据库
   */
  async close() {
    this.ready = false;
    this.tables.clear();
  }
  
  /**
   * 查询多行数据（简化实现）
   */
  query(sql, params = []) {
    this.ensureReady();
    
    // 简化的查询解析
    if (sql.includes('SELECT') && sql.includes('FROM')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        return this.tables.get(tableName) || [];
      }
    }
    
    // 特殊查询处理
    if (sql.includes('last_insert_rowid')) {
      return [{ id: this._lastInsertId || 0 }];
    }
    
    if (sql.includes('schema_migrations')) {
      return this.migrations;
    }
    
    return [];
  }
  
  /**
   * 查询单行数据
   */
  queryOne(sql, params = []) {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 执行 SQL（简化实现）
   */
  run(sql, params = []) {
    this.ensureReady();
    
    let changes = 0;
    
    // 简化的 INSERT 解析
    if (sql.includes('INSERT INTO')) {
      const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
        
        // 创建简单的行对象
        const row = {};
        params.forEach((param, i) => {
          row[`col${i}`] = param;
        });
        
        this.tables.get(tableName).push(row);
        this._lastInsertId = (this._lastInsertId || 0) + 1;
        changes = 1;
      }
    }
    
    // 简化的 UPDATE 解析
    if (sql.includes('UPDATE')) {
      changes = 1; // 假设更新了一行
    }
    
    // 简化的 DELETE 解析
    if (sql.includes('DELETE')) {
      changes = 1; // 假设删除了一行
    }
    
    return {
      changes,
      lastInsertRowid: this._lastInsertId || 0
    };
  }
  
  /**
   * 执行 SQL（可选参数；有参数时等价于 run()，无参数时处理 DDL 语句）
   * @param {string} sql - SQL 语句
   * @param {Array} [params] - 绑定参数（可选）
   */
  exec(sql, params) {
    this.ensureReady();
    if (params !== undefined) {
      return this.run(sql, params);
    }
    
    // 简化的 CREATE TABLE 解析
    if (sql.includes('CREATE TABLE')) {
      const matches = sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/gi);
      for (const match of matches) {
        const tableName = match[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    }
    
    // 简化的 CREATE VIRTUAL TABLE 解析（FTS）
    if (sql.includes('CREATE VIRTUAL TABLE')) {
      const matches = sql.matchAll(/CREATE VIRTUAL TABLE\s+(\w+)/gi);
      for (const match of matches) {
        const tableName = match[1];
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    }
  }

  /**
   * 执行 SQL（execute 别名）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   */
  execute(sql, params = []) {
    return this.run(sql, params);
  }
  
  /**
   * 事务执行
   */
  async transaction(callback) {
    this.ensureReady();
    
    // Mock 实现不做实际的事务处理
    try {
      return await callback();
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 运行数据库迁移
   */
  async runMigrations() {
    // 创建迁移表
    this.tables.set('schema_migrations', []);
    
    const { migrations: migrationList } = await import('./migrations/index.js');
    const executedVersions = new Set(this.migrations.map(r => r.version));
    
    for (const migration of migrationList) {
      if (!executedVersions.has(migration.version)) {
        this.exec(migration.sql);
        this.migrations.push({
          version: migration.version,
          name: migration.name,
          executed_at: Date.now()
        });
      }
    }
  }
  
  /**
   * 确保数据库已就绪
   */
  ensureReady() {
    if (!this.ready) {
      throw new Error('Database not initialized');
    }
  }
  
  /**
   * 检查数据库是否就绪
   */
  isReady() {
    return this.ready;
  }
  
  /**
   * 获取数据库模式
   */
  getMode() {
    return 'mock';
  }
}
