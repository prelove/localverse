/**
 * WASM 数据库服务
 * 使用 sql.js (SQLite 编译为 WASM) 在浏览器中运行
 * 数据持久化到 IndexedDB
 */

export class WasmDatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.ready = false;
    this.autoSaveInterval = null;
  }
  
  /**
   * 初始化数据库
   */
  async init() {
    // 动态加载 sql.js
    // 注意：sql.js 需要预先下载到 /lib/sql.js/ 目录
    const initSqlJs = await this._loadSqlJs();
    
    this.SQL = await initSqlJs({
      locateFile: file => `/wasm/${file.replace('.wasm', '.dat')}`
    });
    
    // 从 IndexedDB 加载已有数据
    const savedData = await this.loadFromStorage();
    
    if (savedData) {
      this.db = new this.SQL.Database(savedData);
    } else {
      this.db = new this.SQL.Database();
    }
    
    // 配置数据库
    this.db.run('PRAGMA foreign_keys = ON');
    
    // 运行迁移
    await this.runMigrations();
    
    // 启动自动保存
    this.startAutoSave();
    
    this.ready = true;
  }
  
  /**
   * 动态加载 sql.js
   * 此处仅为占位，实际需要真实的 sql.js 库
   */
  async _loadSqlJs() {
    // 在实际环境中，应该从 /lib/sql.js/sql-wasm.js 加载
    // 这里返回一个模拟的加载函数用于开发
    if (typeof window !== 'undefined' && window.initSqlJs) {
      return window.initSqlJs;
    }
    
    // 如果 sql.js 不可用，抛出错误
    throw new Error('sql.js not available. Please include sql-wasm.js in your project.');
  }
  
  /**
   * 关闭数据库
   */
  async close() {
    await this.saveToStorage();
    this.stopAutoSave();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.ready = false;
  }
  
  /**
   * 查询多行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Array} 查询结果数组
   */
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
  
  /**
   * 查询单行数据
   * @param {string} sql - SQL 查询语句
   * @param {Array} params - 参数
   * @returns {Object|null} 查询结果对象或 null
   */
  queryOne(sql, params = []) {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 执行 SQL（带参数）
   * @param {string} sql - SQL 语句
   * @param {Array} params - 参数
   * @returns {Object} 执行结果 { changes, lastInsertRowid }
   */
  run(sql, params = []) {
    this.ensureReady();
    this.db.run(sql, params);
    
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: this.queryOne('SELECT last_insert_rowid() as id')?.id || 0
    };
  }
  
  /**
   * 执行 SQL（可选参数；有参数时等价于 run()，无参数时支持多条语句）
   * @param {string} sql - SQL 语句
   * @param {Array} [params] - 绑定参数（可选）
   */
  exec(sql, params) {
    this.ensureReady();
    if (params !== undefined) {
      this.db.run(sql, params);
    } else {
      this.db.exec(sql);
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
   * @param {Function} callback - 事务回调函数
   * @returns {*} 回调函数的返回值
   */
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
  
  /**
   * 从 IndexedDB 加载数据
   * @returns {Uint8Array|null} 数据库数据或 null
   */
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
  
  /**
   * 保存数据到 IndexedDB
   */
  async saveToStorage() {
    if (!this.db) return;
    
    const data = this.db.export();
    
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
        const tx = db.transaction('database', 'readwrite');
        const store = tx.objectStore('database');
        store.put(data, 'main');
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 启动自动保存
   */
  startAutoSave() {
    // 每 30 秒自动保存一次
    this.autoSaveInterval = setInterval(() => {
      this.saveToStorage().catch(console.error);
    }, 30000);
    
    // 页面卸载前保存
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveToStorage();
      });
    }
  }
  
  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
  
  /**
   * 运行数据库迁移
   */
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
  
  /**
   * 获取所有迁移
   * @returns {Array} 迁移列表
   */
  async getMigrations() {
    const { migrations } = await import('./migrations/index.js');
    return migrations;
  }
  
  /**
   * 确保数据库已就绪
   */
  ensureReady() {
    if (!this.ready || !this.db) {
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
   * @returns {string} 'wasm'
   */
  getMode() {
    return 'wasm';
  }
}
