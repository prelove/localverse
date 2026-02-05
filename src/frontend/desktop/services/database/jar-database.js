/**
 * JAR 数据库服务
 * 通过 HTTP API 访问本地 JAR 服务的 SQLite 数据库
 */

export class JarDatabaseService {
  constructor(baseUrl = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl;
    this.ready = false;
  }
  
  /**
   * 初始化数据库连接
   */
  async init() {
    // 测试 JAR 服务是否可用
    try {
      const response = await fetch(`${this.baseUrl}/api/local/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 秒超时
      });
      
      if (!response.ok) {
        throw new Error('JAR service unavailable');
      }
      
      this.ready = true;
      
      // 触发迁移（JAR 端会自动执行）
      await this.runMigrations();
    } catch (error) {
      throw new Error(`Failed to connect to JAR service: ${error.message}`);
    }
  }
  
  /**
   * 关闭数据库连接
   */
  async close() {
    this.ready = false;
  }
  
  /**
   * 查询多行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Array} 查询结果数组
   */
  async query(sql, params = []) {
    this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/local/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Query failed' }));
      throw new Error(error.message || 'Query failed');
    }
    
    const result = await response.json();
    return result.rows || [];
  }
  
  /**
   * 查询单行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Object|null} 查询结果对象或 null
   */
  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 执行 SQL（带参数）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   * @returns {Object} 执行结果 { changes, lastInsertRowid }
   */
  async run(sql, params = []) {
    this.ensureReady();
    
    const response = await fetch(`${this.baseUrl}/api/local/db/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Exec failed' }));
      throw new Error(error.message || 'Exec failed');
    }
    
    const result = await response.json();
    return {
      changes: result.changes || 0,
      lastInsertRowid: result.lastInsertRowid || 0
    };
  }
  
  /**
   * 执行 SQL（无参数，可以是多条语句）
   * @param {string} sql - SQL 语句
   */
  async exec(sql) {
    await this.run(sql, []);
  }

  /**
   * 执行 SQL（execute 别名）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   */
  async execute(sql, params = []) {
    return this.run(sql, params);
  }
  
  /**
   * 事务执行
   * @param {Function} callback - 事务回调函数
   * @returns {*} 回调函数的返回值
   */
  async transaction(callback) {
    this.ensureReady();
    
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
  
  /**
   * 运行数据库迁移
   * JAR 端会自动处理迁移
   */
  async runMigrations() {
    try {
      const response = await fetch(`${this.baseUrl}/api/local/db/migrate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Migration failed');
      }
    } catch (error) {
      // 如果迁移端点不存在，忽略错误（可能是旧版本 JAR）
      console.warn('Migration endpoint not available:', error.message);
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
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }
  
  /**
   * 获取数据库模式
   * @returns {string} 'jar'
   */
  getMode() {
    return 'jar';
  }
}
