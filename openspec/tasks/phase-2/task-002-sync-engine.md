# Task 002: 同步引擎开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase2-task-002-sync-engine |
| 阶段 | Phase 2 - 服务端与同步 |
| 优先级 | P0 (最高) |
| 预估工时 | 20 小时 |
| 依赖 | task-001-sync-server |
| 产出 | 前端同步引擎模块 |
| 状态 | 🔵 开发中（主类骨架 + 事件调度 + 基础单测） |

## 文档关系

```
本任务 (task-002-sync-engine.md)
├── 规格来源:
│   ├── specs/07-sync-engine.md       (主要规格)
│   ├── specs/04-communication.md     (通信层接口)
│   └── specs/05-database.md          (本地数据库)
├── 依赖任务:
│   ├── phase-0/task-003-communication.md  (通信层)
│   ├── phase-0/task-004-database.md       (数据库服务)
│   └── phase-2/task-001-sync-server.md    (服务端)
├── 被依赖:
│   └── 所有需要同步的插件 (wiki, task, chat 等)
└── 集成:
    └── 需要与 Sync Server 进行端到端测试
```

## 目标

开发客户端同步引擎，实现：
1. 本地变更追踪
2. 自动推送到服务器
3. 增量拉取服务器变更
4. 冲突检测与解决
5. 离线队列管理

## 核心流程

```
┌─────────────────────────────────────────────────────────────┐
│                     用户操作 (CRUD)                          │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    ChangeTracker                             │
│                    (变更追踪器)                              │
│         记录变更 → 更新 sync_status → 入队                  │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                     SyncQueue                                │
│                    (同步队列)                                │
│      pending → sending → success/failed/conflict            │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  CommunicationLayer                          │
│                    (通信层)                                  │
│              HTTP/WebSocket → Sync Server                   │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Sync Server                               │
│              处理变更 / 返回冲突 / 广播通知                  │
└─────────────────────────────────────────────────────────────┘
```

## 文件结构

```
src/frontend/desktop/services/
├── sync/
│   ├── index.js                 # 主入口
│   ├── sync-engine.js           # 同步引擎主类
│   ├── change-tracker.js        # 变更追踪器
│   ├── sync-queue.js            # 同步队列
│   ├── conflict-resolver.js     # 冲突解决器
│   ├── pull-service.js          # 拉取服务
│   ├── push-service.js          # 推送服务
│   └── sync-status.js           # 同步状态管理
```

## 实现步骤

### Step 1: 同步引擎主类 (3h)

```javascript
// sync/sync-engine.js

import { ChangeTracker } from './change-tracker.js';
import { SyncQueue } from './sync-queue.js';
import { ConflictResolver } from './conflict-resolver.js';
import { PullService } from './pull-service.js';
import { PushService } from './push-service.js';

export class SyncEngine {
  constructor(options) {
    this.db = options.database;
    this.comm = options.communicationLayer;
    this.eventBus = options.eventBus;
    
    this.config = {
      pullInterval: 30000,        // 30秒拉取一次
      pushDebounce: 1000,         // 1秒防抖后推送
      batchSize: 50,              // 批量大小
      maxRetries: 5,              // 最大重试次数
      autoSync: true,             // 自动同步
      ...options.config
    };
    
    this.state = {
      running: false,
      syncing: false,
      lastPullTime: null,
      lastPushTime: null,
      pendingCount: 0,
      conflictCount: 0,
      failedCount: 0
    };
    
    // 子模块
    this.changeTracker = new ChangeTracker(this.db);
    this.syncQueue = new SyncQueue(this.db);
    this.conflictResolver = new ConflictResolver(this.db, this.eventBus);
    this.pullService = new PullService(this.db, this.comm);
    this.pushService = new PushService(this.db, this.comm, this.syncQueue);
    
    // 定时器
    this.pullTimer = null;
    this.pushTimer = null;
    this.pushDebounceTimer = null;
  }
  
  // ========== 生命周期 ==========
  
  async start() {
    if (this.state.running) return;
    
    this.state.running = true;
    
    // 初始化同步状态表
    await this.initSyncState();
    
    // 监听通信层状态
    this.comm.on('connected', () => this.onOnline());
    this.comm.on('disconnected', () => this.onOffline());
    this.comm.on('sync:change', (msg) => this.onRemoteChange(msg));
    
    // 如果在线，立即同步
    if (this.comm.isOnline()) {
      await this.syncNow();
    }
    
    // 启动定时拉取
    if (this.config.autoSync) {
      this.startPullTimer();
    }
    
    this.eventBus.emit('sync:started');
  }
  
  stop() {
    this.state.running = false;
    
    this.stopPullTimer();
    this.stopPushTimer();
    
    this.eventBus.emit('sync:stopped');
  }
  
  async initSyncState() {
    // 创建同步状态表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        entity_type TEXT PRIMARY KEY,
        last_pull_version INTEGER DEFAULT 0,
        last_pull_time INTEGER DEFAULT 0,
        last_push_time INTEGER DEFAULT 0
      )
    `);
    
    // 初始化各实体类型
    const entityTypes = ['cards', 'tasks', 'chat_messages', 'files'];
    for (const type of entityTypes) {
      await this.db.run(`
        INSERT OR IGNORE INTO sync_state (entity_type) VALUES (?)
      `, [type]);
    }
  }
  
  // ========== 主要操作 ==========
  
  async syncNow() {
    if (this.state.syncing) return;
    if (!this.comm.isOnline()) return;
    
    this.state.syncing = true;
    this.eventBus.emit('sync:start');
    
    try {
      // 1. 先推送本地变更
      await this.push();
      
      // 2. 再拉取远程变更
      await this.pull();
      
      this.eventBus.emit('sync:complete', this.getStatus());
      
    } catch (error) {
      console.error('Sync failed:', error);
      this.eventBus.emit('sync:error', error);
      
    } finally {
      this.state.syncing = false;
    }
  }
  
  async push() {
    const result = await this.pushService.pushAll();
    
    this.state.lastPushTime = Date.now();
    this.state.pendingCount = result.remaining;
    this.state.failedCount = result.failed;
    
    // 处理冲突
    if (result.conflicts.length > 0) {
      for (const conflict of result.conflicts) {
        await this.conflictResolver.createConflict(conflict);
      }
      this.state.conflictCount = await this.conflictResolver.getConflictCount();
    }
    
    return result;
  }
  
  async pull() {
    const entityTypes = ['cards', 'tasks', 'chat_messages', 'files'];
    
    for (const entityType of entityTypes) {
      await this.pullEntityType(entityType);
    }
    
    this.state.lastPullTime = Date.now();
  }
  
  async pullEntityType(entityType) {
    // 获取上次同步版本
    const syncState = await this.db.queryOne(
      'SELECT last_pull_version FROM sync_state WHERE entity_type = ?',
      [entityType]
    );
    const sinceVersion = syncState?.last_pull_version || 0;
    
    // 拉取变更
    const result = await this.pullService.pull(entityType, sinceVersion);
    
    // 应用变更
    for (const change of result.changes) {
      await this.applyRemoteChange(change);
    }
    
    // 更新同步状态
    if (result.changes.length > 0) {
      await this.db.run(
        'UPDATE sync_state SET last_pull_version = ?, last_pull_time = ? WHERE entity_type = ?',
        [result.nextVersion, Date.now(), entityType]
      );
    }
    
    // 如果还有更多，继续拉取
    if (result.hasMore) {
      await this.pullEntityType(entityType);
    }
  }
  
  async applyRemoteChange(change) {
    const { entityType, entityId, actionType, data, version } = change;
    const table = this.getTableName(entityType);
    
    // 检查本地是否有未同步的修改
    const localRecord = await this.db.queryOne(
      `SELECT * FROM ${table} WHERE id = ?`,
      [entityId]
    );
    
    if (localRecord && localRecord.sync_status === 'modified') {
      // 本地有修改，可能需要合并或标记冲突
      // 简化处理：远程优先
      console.warn(`Local modification overwritten: ${entityType}/${entityId}`);
    }
    
    switch (actionType) {
      case 'create':
      case 'update':
        await this.upsertEntity(table, entityId, data, version);
        break;
        
      case 'delete':
        await this.db.run(
          `UPDATE ${table} SET deleted = 1, sync_status = 'synced', version = ? WHERE id = ?`,
          [version, entityId]
        );
        break;
    }
    
    // 触发更新事件
    this.eventBus.emit(`${entityType}:updated`, { entityId, actionType });
  }
  
  async upsertEntity(table, entityId, data, version) {
    const existing = await this.db.queryOne(
      `SELECT id FROM ${table} WHERE id = ?`,
      [entityId]
    );
    
    if (existing) {
      // 更新
      const fields = Object.keys(data).filter(k => k !== 'id');
      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => 
        typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]
      );
      
      await this.db.run(
        `UPDATE ${table} SET ${setClause}, version = ?, sync_status = 'synced' WHERE id = ?`,
        [...values, version, entityId]
      );
    } else {
      // 插入
      const fields = Object.keys(data);
      const placeholders = fields.map(() => '?').join(', ');
      const values = fields.map(f => 
        typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]
      );
      
      await this.db.run(
        `INSERT INTO ${table} (${fields.join(', ')}, version, sync_status) VALUES (${placeholders}, ?, 'synced')`,
        [...values, version]
      );
    }
  }
  
  // ========== 变更追踪 ==========
  
  trackCreate(entityType, entity) {
    this.changeTracker.trackCreate(entityType, entity);
    this.schedulePush();
  }
  
  trackUpdate(entityType, entityId, oldData, newData) {
    this.changeTracker.trackUpdate(entityType, entityId, oldData, newData);
    this.schedulePush();
  }
  
  trackDelete(entityType, entityId, entity) {
    this.changeTracker.trackDelete(entityType, entityId, entity);
    this.schedulePush();
  }
  
  schedulePush() {
    if (!this.config.autoSync) return;
    if (!this.comm.isOnline()) return;
    
    // 防抖
    clearTimeout(this.pushDebounceTimer);
    this.pushDebounceTimer = setTimeout(() => {
      this.push().catch(console.error);
    }, this.config.pushDebounce);
  }
  
  // ========== 实时通知处理 ==========
  
  async onRemoteChange(message) {
    const { entityType, entityId, action, version, excludeDevice } = message.payload;
    
    // 排除自己的变更
    const myDeviceId = this.getDeviceId();
    if (excludeDevice === myDeviceId) return;
    
    // 立即拉取该实体的最新数据
    try {
      const result = await this.pullService.pullEntity(entityType, entityId);
      if (result) {
        await this.applyRemoteChange(result);
      }
    } catch (error) {
      console.error('Failed to apply remote change:', error);
    }
  }
  
  onOnline() {
    console.log('Sync engine: online');
    
    // 恢复在线后，立即同步
    this.syncNow();
    
    // 重启定时拉取
    this.startPullTimer();
  }
  
  onOffline() {
    console.log('Sync engine: offline');
    
    // 停止定时拉取
    this.stopPullTimer();
  }
  
  // ========== 定时器 ==========
  
  startPullTimer() {
    this.stopPullTimer();
    
    this.pullTimer = setInterval(() => {
      if (this.comm.isOnline() && !this.state.syncing) {
        this.pull().catch(console.error);
      }
    }, this.config.pullInterval);
  }
  
  stopPullTimer() {
    if (this.pullTimer) {
      clearInterval(this.pullTimer);
      this.pullTimer = null;
    }
  }
  
  stopPushTimer() {
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
      this.pushDebounceTimer = null;
    }
  }
  
  // ========== 冲突处理 ==========
  
  async getConflicts() {
    return this.conflictResolver.getConflicts();
  }
  
  async resolveConflict(conflictId, resolution, mergedData) {
    await this.conflictResolver.resolve(conflictId, resolution, mergedData);
    this.state.conflictCount = await this.conflictResolver.getConflictCount();
    
    // 解决后重新推送
    this.schedulePush();
  }
  
  // ========== 状态查询 ==========
  
  getStatus() {
    return {
      running: this.state.running,
      syncing: this.state.syncing,
      online: this.comm.isOnline(),
      lastPullTime: this.state.lastPullTime,
      lastPushTime: this.state.lastPushTime,
      pendingCount: this.state.pendingCount,
      conflictCount: this.state.conflictCount,
      failedCount: this.state.failedCount
    };
  }
  
  async getQueueStatus() {
    return this.syncQueue.getStatus();
  }
  
  // ========== 工具方法 ==========
  
  getTableName(entityType) {
    const mapping = {
      cards: 'cards',
      tasks: 'tasks',
      chat_messages: 'chat_messages',
      files: 'files',
      modules: 'modules',
      columns: 'columns'
    };
    return mapping[entityType] || entityType;
  }
  
  getDeviceId() {
    return localStorage.getItem('localverse_device_id');
  }
}

export default SyncEngine;
```

### Step 2: 变更追踪器 (3h)

```javascript
// sync/change-tracker.js

export class ChangeTracker {
  constructor(db) {
    this.db = db;
  }
  
  async trackCreate(entityType, entity) {
    const table = this.getTableName(entityType);
    
    // 更新实体状态
    await this.db.run(
      `UPDATE ${table} SET sync_status = 'local' WHERE id = ?`,
      [entity.id]
    );
    
    // 记录到同步队列
    await this.enqueue({
      actionType: 'create',
      entityType,
      entityId: entity.id,
      data: entity,
      baseVersion: 0
    });
  }
  
  async trackUpdate(entityType, entityId, oldData, newData) {
    const table = this.getTableName(entityType);
    
    // 计算变更字段
    const changedFields = this.getChangedFields(oldData, newData);
    if (changedFields.length === 0) return;
    
    // 更新实体状态
    await this.db.run(
      `UPDATE ${table} SET sync_status = 'modified' WHERE id = ?`,
      [entityId]
    );
    
    // 检查队列中是否已有该实体的待同步项
    const existing = await this.db.queryOne(
      `SELECT id, action_type FROM sync_queue 
       WHERE entity_type = ? AND entity_id = ? AND status = 'pending'`,
      [entityType, entityId]
    );
    
    if (existing) {
      if (existing.action_type === 'create') {
        // 创建后又修改，更新创建数据
        await this.db.run(
          `UPDATE sync_queue SET payload = ? WHERE id = ?`,
          [JSON.stringify(newData), existing.id]
        );
      } else {
        // 更新待同步数据
        await this.db.run(
          `UPDATE sync_queue SET payload = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(newData), Date.now(), existing.id]
        );
      }
    } else {
      // 新增队列项
      await this.enqueue({
        actionType: 'update',
        entityType,
        entityId,
        data: newData,
        baseVersion: oldData.version || 0
      });
    }
  }
  
  async trackDelete(entityType, entityId, entity) {
    const table = this.getTableName(entityType);
    
    // 更新实体状态
    await this.db.run(
      `UPDATE ${table} SET sync_status = 'deleted' WHERE id = ?`,
      [entityId]
    );
    
    // 检查队列中是否有该实体
    const existing = await this.db.queryOne(
      `SELECT id, action_type FROM sync_queue 
       WHERE entity_type = ? AND entity_id = ? AND status = 'pending'`,
      [entityType, entityId]
    );
    
    if (existing) {
      if (existing.action_type === 'create') {
        // 创建后又删除，直接移除队列项，无需同步
        await this.db.run('DELETE FROM sync_queue WHERE id = ?', [existing.id]);
        await this.db.run(`DELETE FROM ${table} WHERE id = ?`, [entityId]);
        return;
      } else {
        // 更改为删除操作
        await this.db.run(
          `UPDATE sync_queue SET action_type = 'delete', payload = '{}' WHERE id = ?`,
          [existing.id]
        );
      }
    } else {
      // 新增删除队列项
      await this.enqueue({
        actionType: 'delete',
        entityType,
        entityId,
        data: {},
        baseVersion: entity.version || 0
      });
    }
  }
  
  async enqueue(item) {
    const id = this.generateId();
    const now = Date.now();
    
    await this.db.run(`
      INSERT INTO sync_queue 
      (id, action_type, entity_type, entity_id, payload, base_version, status, priority, created_at, next_attempt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      id,
      item.actionType,
      item.entityType,
      item.entityId,
      JSON.stringify(item.data),
      item.baseVersion,
      this.getPriority(item.entityType),
      now,
      now
    ]);
  }
  
  getChangedFields(oldObj, newObj) {
    const fields = new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ]);
    
    const changed = [];
    const ignoreFields = ['id', 'version', 'sync_status', 'updated_at', 'created_at'];
    
    for (const field of fields) {
      if (ignoreFields.includes(field)) continue;
      
      const oldVal = JSON.stringify(oldObj?.[field]);
      const newVal = JSON.stringify(newObj?.[field]);
      
      if (oldVal !== newVal) {
        changed.push(field);
      }
    }
    
    return changed;
  }
  
  getPriority(entityType) {
    const priorities = {
      chat_messages: 10,  // 聊天消息最高优先级
      tasks: 8,
      cards: 5,
      files: 3
    };
    return priorities[entityType] || 5;
  }
  
  getTableName(entityType) {
    const mapping = {
      cards: 'cards',
      tasks: 'tasks',
      chat_messages: 'chat_messages',
      files: 'files'
    };
    return mapping[entityType] || entityType;
  }
  
  generateId() {
    return 'chg_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
```

### Step 3: 同步队列 (3h)

```javascript
// sync/sync-queue.js

export class SyncQueue {
  constructor(db) {
    this.db = db;
    this.processing = false;
  }
  
  async getStatus() {
    const counts = await this.db.query(`
      SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status
    `);
    
    const result = {
      pending: 0,
      sending: 0,
      failed: 0,
      conflict: 0
    };
    
    for (const row of counts) {
      result[row.status] = row.count;
    }
    
    return result;
  }
  
  async getPendingItems(limit = 50) {
    return await this.db.query(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending' AND next_attempt <= ?
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `, [Date.now(), limit]);
  }
  
  async getFailedItems() {
    return await this.db.query(`
      SELECT * FROM sync_queue WHERE status = 'failed'
    `);
  }
  
  async markSending(ids) {
    if (ids.length === 0) return;
    
    const placeholders = ids.map(() => '?').join(',');
    await this.db.run(
      `UPDATE sync_queue SET status = 'sending', last_attempt = ? WHERE id IN (${placeholders})`,
      [Date.now(), ...ids]
    );
  }
  
  async markSuccess(id) {
    await this.db.run('DELETE FROM sync_queue WHERE id = ?', [id]);
  }
  
  async markFailed(id, error, retryCount) {
    const maxRetries = 5;
    
    if (retryCount >= maxRetries) {
      await this.db.run(
        `UPDATE sync_queue SET status = 'failed', error_message = ? WHERE id = ?`,
        [error, id]
      );
    } else {
      // 指数退避
      const delay = Math.pow(2, retryCount) * 1000;
      const nextAttempt = Date.now() + delay;
      
      await this.db.run(
        `UPDATE sync_queue SET 
          status = 'pending', 
          retry_count = ?, 
          next_attempt = ?,
          error_message = ?
         WHERE id = ?`,
        [retryCount + 1, nextAttempt, error, id]
      );
    }
  }
  
  async markConflict(id, conflictData) {
    await this.db.run(
      `UPDATE sync_queue SET status = 'conflict', error_message = ? WHERE id = ?`,
      [JSON.stringify(conflictData), id]
    );
  }
  
  async retryFailed() {
    await this.db.run(`
      UPDATE sync_queue 
      SET status = 'pending', retry_count = 0, next_attempt = ?
      WHERE status = 'failed'
    `, [Date.now()]);
  }
  
  async clearFailed() {
    await this.db.run(`DELETE FROM sync_queue WHERE status = 'failed'`);
  }
  
  async clear() {
    await this.db.run('DELETE FROM sync_queue');
  }
}
```

### Step 4: 推送服务 (3h)

```javascript
// sync/push-service.js

export class PushService {
  constructor(db, comm, queue) {
    this.db = db;
    this.comm = comm;
    this.queue = queue;
  }
  
  async pushAll() {
    const result = {
      success: 0,
      failed: 0,
      conflicts: [],
      remaining: 0
    };
    
    // 获取待推送项
    const items = await this.queue.getPendingItems(50);
    
    if (items.length === 0) {
      return result;
    }
    
    // 标记为发送中
    const ids = items.map(i => i.id);
    await this.queue.markSending(ids);
    
    // 构建请求
    const changes = items.map(item => ({
      actionType: item.action_type,
      entityType: item.entity_type,
      entityId: item.entity_id,
      data: JSON.parse(item.payload),
      baseVersion: item.base_version
    }));
    
    try {
      // 发送到服务器
      const response = await this.comm.sendAndWait({
        type: 'data',
        action: 'sync_push',
        payload: { changes }
      }, 30000);
      
      // 处理结果
      for (let i = 0; i < response.payload.results.length; i++) {
        const itemResult = response.payload.results[i];
        const item = items[i];
        
        if (itemResult.success) {
          // 成功
          await this.queue.markSuccess(item.id);
          await this.updateEntitySynced(item.entity_type, item.entity_id, itemResult.newVersion);
          result.success++;
          
        } else if (itemResult.conflict) {
          // 冲突
          await this.queue.markConflict(item.id, itemResult.conflict);
          result.conflicts.push({
            entityType: item.entity_type,
            entityId: item.entity_id,
            localData: JSON.parse(item.payload),
            remoteData: itemResult.conflict.serverData,
            remoteVersion: itemResult.conflict.serverVersion
          });
          
        } else {
          // 失败
          await this.queue.markFailed(item.id, itemResult.error, item.retry_count);
          result.failed++;
        }
      }
      
    } catch (error) {
      // 网络错误，全部重置为待发送
      for (const item of items) {
        await this.queue.markFailed(item.id, error.message, item.retry_count);
      }
      result.failed = items.length;
    }
    
    // 获取剩余待同步数
    const status = await this.queue.getStatus();
    result.remaining = status.pending;
    
    return result;
  }
  
  async updateEntitySynced(entityType, entityId, newVersion) {
    const table = this.getTableName(entityType);
    
    await this.db.run(
      `UPDATE ${table} SET sync_status = 'synced', version = ? WHERE id = ?`,
      [newVersion, entityId]
    );
  }
  
  getTableName(entityType) {
    const mapping = {
      cards: 'cards',
      tasks: 'tasks',
      chat_messages: 'chat_messages',
      files: 'files'
    };
    return mapping[entityType] || entityType;
  }
}
```

### Step 5: 拉取服务 (2h)

```javascript
// sync/pull-service.js

export class PullService {
  constructor(db, comm) {
    this.db = db;
    this.comm = comm;
  }
  
  async pull(entityType, sinceVersion, limit = 100) {
    const response = await this.comm.sendAndWait({
      type: 'data',
      action: 'sync_pull',
      payload: {
        entityType,
        sinceVersion,
        limit
      }
    }, 30000);
    
    return response.payload;
  }
  
  async pullEntity(entityType, entityId) {
    const response = await this.comm.sendAndWait({
      type: 'data',
      action: 'sync_get',
      payload: {
        entityType,
        entityId
      }
    }, 10000);
    
    return response.payload.entity;
  }
  
  async getServerStatus() {
    const response = await this.comm.sendAndWait({
      type: 'data',
      action: 'sync_status',
      payload: {}
    }, 10000);
    
    return response.payload;
  }
}
```

### Step 6: 冲突解决器 (3h)

```javascript
// sync/conflict-resolver.js

export class ConflictResolver {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    
    // 可自动合并的字段
    this.autoMergeFields = ['tags', 'status', 'priority', 'assignee'];
    
    // 需要手动合并的字段
    this.manualMergeFields = ['title', 'content', 'description'];
  }
  
  async createConflict(conflictData) {
    const id = this.generateId();
    const now = Date.now();
    
    // 检测冲突字段
    const conflictFields = this.detectConflictFields(
      conflictData.localData,
      conflictData.remoteData
    );
    
    await this.db.run(`
      INSERT INTO sync_conflicts 
      (id, entity_type, entity_id, local_data, remote_data, conflict_fields, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      id,
      conflictData.entityType,
      conflictData.entityId,
      JSON.stringify(conflictData.localData),
      JSON.stringify(conflictData.remoteData),
      JSON.stringify(conflictFields),
      now
    ]);
    
    // 尝试自动解决
    const autoResolved = await this.tryAutoResolve(id);
    
    if (!autoResolved) {
      // 需要手动解决，通知用户
      this.eventBus.emit('sync:conflict', {
        conflictId: id,
        entityType: conflictData.entityType,
        entityId: conflictData.entityId,
        conflictFields
      });
    }
    
    return id;
  }
  
  detectConflictFields(localData, remoteData) {
    const conflictFields = [];
    const allFields = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(remoteData || {})
    ]);
    
    const ignoreFields = ['id', 'version', 'sync_status', 'updated_at', 'created_at'];
    
    for (const field of allFields) {
      if (ignoreFields.includes(field)) continue;
      
      const localVal = JSON.stringify(localData?.[field]);
      const remoteVal = JSON.stringify(remoteData?.[field]);
      
      if (localVal !== remoteVal) {
        conflictFields.push(field);
      }
    }
    
    return conflictFields;
  }
  
  async tryAutoResolve(conflictId) {
    const conflict = await this.db.queryOne(
      'SELECT * FROM sync_conflicts WHERE id = ?',
      [conflictId]
    );
    
    if (!conflict) return false;
    
    const localData = JSON.parse(conflict.local_data);
    const remoteData = JSON.parse(conflict.remote_data);
    const conflictFields = JSON.parse(conflict.conflict_fields);
    
    // 检查是否所有冲突字段都可以自动合并
    const canAutoMerge = conflictFields.every(
      field => this.autoMergeFields.includes(field)
    );
    
    if (!canAutoMerge) {
      return false;
    }
    
    // 自动合并：本地修改优先
    const merged = { ...remoteData };
    for (const field of conflictFields) {
      merged[field] = localData[field];
    }
    
    await this.resolve(conflictId, 'merged', merged);
    return true;
  }
  
  async resolve(conflictId, resolution, mergedData = null) {
    const conflict = await this.db.queryOne(
      'SELECT * FROM sync_conflicts WHERE id = ?',
      [conflictId]
    );
    
    if (!conflict) {
      throw new Error('Conflict not found');
    }
    
    const localData = JSON.parse(conflict.local_data);
    const remoteData = JSON.parse(conflict.remote_data);
    
    let resolvedData;
    switch (resolution) {
      case 'local':
        resolvedData = localData;
        break;
      case 'remote':
        resolvedData = remoteData;
        break;
      case 'merged':
        resolvedData = mergedData || localData;
        break;
      default:
        throw new Error('Invalid resolution');
    }
    
    // 更新冲突记录
    await this.db.run(`
      UPDATE sync_conflicts 
      SET status = 'resolved', resolution = ?, resolved_data = ?, resolved_at = ?
      WHERE id = ?
    `, [resolution, JSON.stringify(resolvedData), Date.now(), conflictId]);
    
    // 更新本地实体
    await this.applyResolution(conflict.entity_type, conflict.entity_id, resolvedData);
    
    // 更新同步队列（重新入队）
    await this.requeueForSync(conflict.entity_type, conflict.entity_id, resolvedData);
    
    this.eventBus.emit('sync:conflict-resolved', { conflictId });
  }
  
  async applyResolution(entityType, entityId, data) {
    const table = this.getTableName(entityType);
    
    const fields = Object.keys(data).filter(f => 
      !['id', 'version', 'sync_status'].includes(f)
    );
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => 
      typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]
    );
    
    await this.db.run(
      `UPDATE ${table} SET ${setClause}, sync_status = 'modified' WHERE id = ?`,
      [...values, entityId]
    );
  }
  
  async requeueForSync(entityType, entityId, data) {
    // 删除旧的队列项
    await this.db.run(
      `DELETE FROM sync_queue WHERE entity_type = ? AND entity_id = ?`,
      [entityType, entityId]
    );
    
    // 添加新的队列项
    const id = this.generateId();
    await this.db.run(`
      INSERT INTO sync_queue 
      (id, action_type, entity_type, entity_id, payload, base_version, status, priority, created_at, next_attempt)
      VALUES (?, 'update', ?, ?, ?, ?, 'pending', 5, ?, ?)
    `, [id, entityType, entityId, JSON.stringify(data), data.version || 0, Date.now(), Date.now()]);
  }
  
  async getConflicts() {
    const rows = await this.db.query(`
      SELECT * FROM sync_conflicts WHERE status = 'pending' ORDER BY created_at DESC
    `);
    
    return rows.map(row => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      localData: JSON.parse(row.local_data),
      remoteData: JSON.parse(row.remote_data),
      conflictFields: JSON.parse(row.conflict_fields),
      createdAt: row.created_at
    }));
  }
  
  async getConflictCount() {
    const result = await this.db.queryOne(
      `SELECT COUNT(*) as count FROM sync_conflicts WHERE status = 'pending'`
    );
    return result?.count || 0;
  }
  
  getTableName(entityType) {
    const mapping = {
      cards: 'cards',
      tasks: 'tasks',
      chat_messages: 'chat_messages',
      files: 'files'
    };
    return mapping[entityType] || entityType;
  }
  
  generateId() {
    return 'cfl_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
```

### Step 7: 同步状态 UI 组件 (2h)

```javascript
// components/sync-status.js

import LVComponent from './base.js';

class LVSyncStatus extends LVComponent {
  constructor() {
    super();
    this._state = {
      online: false,
      syncing: false,
      pendingCount: 0,
      conflictCount: 0,
      lastSyncTime: null
    };
  }
  
  connectedCallback() {
    super.connectedCallback();
    
    // 监听同步事件
    window.app?.eventBus?.on('sync:start', () => this.setState({ syncing: true }));
    window.app?.eventBus?.on('sync:complete', (status) => this.updateStatus(status));
    window.app?.eventBus?.on('sync:error', () => this.setState({ syncing: false }));
    window.app?.eventBus?.on('sync:conflict', () => this.incrementConflicts());
  }
  
  updateStatus(status) {
    this.setState({
      online: status.online,
      syncing: false,
      pendingCount: status.pendingCount,
      conflictCount: status.conflictCount,
      lastSyncTime: status.lastPullTime || status.lastPushTime
    });
  }
  
  incrementConflicts() {
    this.setState({ conflictCount: this.state.conflictCount + 1 });
  }
  
  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--gray-400);
      }
      
      .status-dot.online { background: var(--success-color); }
      .status-dot.offline { background: var(--gray-400); }
      .status-dot.syncing { 
        background: var(--primary-color);
        animation: pulse 1s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .badge {
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 11px;
        cursor: pointer;
      }
      
      .badge.pending {
        background: var(--warning-color);
        color: white;
      }
      
      .badge.conflict {
        background: var(--error-color);
        color: white;
      }
    `;
  }
  
  template() {
    const { online, syncing, pendingCount, conflictCount, lastSyncTime } = this.state;
    
    let statusClass = online ? 'online' : 'offline';
    if (syncing) statusClass = 'syncing';
    
    return `
      <span class="status-dot ${statusClass}"></span>
      <span class="status-text">
        ${syncing ? '同步中...' : (online ? '已连接' : '离线')}
      </span>
      
      ${pendingCount > 0 ? `
        <span class="badge pending" title="待同步">
          ${pendingCount}
        </span>
      ` : ''}
      
      ${conflictCount > 0 ? `
        <span class="badge conflict" title="有冲突" data-action="show-conflicts">
          ${conflictCount} 冲突
        </span>
      ` : ''}
      
      ${lastSyncTime ? `
        <span class="last-sync" title="上次同步">
          ${this.formatTime(lastSyncTime)}
        </span>
      ` : ''}
    `;
  }
  
  bindEvents() {
    this.$('[data-action="show-conflicts"]')?.addEventListener('click', () => {
      window.app?.showConflictResolver();
    });
  }
  
  formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    return new Date(timestamp).toLocaleTimeString();
  }
}

customElements.define('lv-sync-status', LVSyncStatus);
export default LVSyncStatus;
```

### Step 8: 数据库迁移补充 (1h)

```javascript
// 添加到 migrations/index.js

{
  version: 5,
  name: 'add_sync_tables',
  sql: `
    -- 同步队列表
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      base_version INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 5,
      retry_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      last_attempt INTEGER,
      next_attempt INTEGER,
      error_message TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status 
      ON sync_queue(status, next_attempt);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity 
      ON sync_queue(entity_type, entity_id);
    
    -- 同步状态表
    CREATE TABLE IF NOT EXISTS sync_state (
      entity_type TEXT PRIMARY KEY,
      last_pull_version INTEGER DEFAULT 0,
      last_pull_time INTEGER DEFAULT 0,
      last_push_time INTEGER DEFAULT 0
    );
    
    -- 冲突记录表
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      local_data TEXT NOT NULL,
      remote_data TEXT NOT NULL,
      conflict_fields TEXT,
      status TEXT DEFAULT 'pending',
      resolution TEXT,
      resolved_data TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status 
      ON sync_conflicts(status);
  `
}
```

## 测试要点

### 单元测试

```javascript
describe('SyncEngine', () => {
  test('trackCreate enqueues item');
  test('trackUpdate merges with pending create');
  test('trackDelete cancels pending create');
  test('push sends batch to server');
  test('push handles conflicts');
  test('pull applies remote changes');
  test('conflict auto-resolves simple fields');
});

describe('ChangeTracker', () => {
  test('detects changed fields');
  test('ignores system fields');
  test('merges consecutive updates');
});

describe('ConflictResolver', () => {
  test('auto-merges safe fields');
  test('requires manual resolution for content');
  test('applies resolution correctly');
});
```

### 集成测试

```javascript
describe('End-to-end sync', () => {
  test('create on client A, appears on client B');
  test('update on client A, reflected on client B');
  test('delete on client A, removed on client B');
  test('concurrent edits create conflict');
  test('offline changes sync on reconnect');
});
```


## 进度更新

- 2026-02-17 07:35 UTC: 完成 `src/frontend/desktop/services/sync/` 模块骨架，新增 `SyncEngine` 生命周期/事件调度实现与 `sync-engine.test.mjs` 基础单测。

## 验收标准

- [ ] 变更追踪正确
- [ ] 推送批量处理正确
- [ ] 拉取增量工作
- [ ] 冲突检测正确
- [ ] 自动合并简单冲突
- [ ] 手动解决复杂冲突
- [ ] 离线队列持久化
- [ ] 重连后自动同步
- [ ] 状态 UI 实时更新

## 参考规格

- `specs/07-sync-engine.md` - 完整规格
- `specs/04-communication.md` - 通信层
- `specs/03-sync-server.md` - 服务端 API

## 下一步

Phase 2 核心完成后，可以：
1. 开发具体插件（wiki, task, chat）
2. 开发移动端
3. 添加更多功能