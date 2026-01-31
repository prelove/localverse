# 07 - 同步引擎规格

## 概述

同步引擎负责：
1. 本地数据与 Sync Server 的双向同步
2. 离线操作的队列管理
3. 冲突检测与解决
4. 增量同步优化

## 设计原则

- **离线优先**：所有操作先写本地，后台同步
- **最终一致**：允许短暂不一致，最终达成一致
- **用户可控**：冲突时用户决定如何处理
- **性能优化**：增量同步，批量处理

## 同步架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端应用                              │
│  Card/Task/File 等业务模块                                  │
└─────────────────────────┬───────────────────────────────────┘
                          ↓ 调用
┌─────────────────────────────────────────────────────────────┐
│                      SyncEngine                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ChangeTracker│  │ SyncQueue   │  │ ConflictResolver    │ │
│  │ 变更追踪    │  │ 同步队列    │  │ 冲突解决            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ DeltaCalc   │  │ BatchProc   │  │ VersionManager      │ │
│  │ 增量计算    │  │ 批量处理    │  │ 版本管理            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   CommunicationLayer                         │
│                   通信层（WebSocket/HTTP）                   │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      Sync Server                             │
└─────────────────────────────────────────────────────────────┘
```

## 同步状态机

### 实体同步状态

```
sync_status 字段值：
├─ local     - 仅本地存在，未同步
├─ syncing   - 正在同步中
├─ synced    - 已同步，与服务器一致
├─ modified  - 本地已修改，待同步
├─ conflict  - 存在冲突，需要解决
└─ deleted   - 标记删除，待同步删除
```

### 状态转换

```
                    ┌─────────┐
        创建        │  local  │
       ─────────────→         │
                    └────┬────┘
                         │ 同步成功
                         ↓
                    ┌─────────┐
                    │ synced  │←──────────┐
                    └────┬────┘           │
                         │ 本地修改       │ 同步成功
                         ↓                │
                    ┌─────────┐           │
                    │modified │───────────┘
                    └────┬────┘
                         │ 发现冲突
                         ↓
                    ┌─────────┐
                    │conflict │
                    └────┬────┘
                         │ 解决冲突
                         ↓
                    ┌─────────┐
                    │ synced  │
                    └─────────┘
```

## 变更追踪

### 变更记录结构

```typescript
interface ChangeRecord {
  id: string;                    // UUID
  entityType: string;            // card | task | file | ...
  entityId: string;              // 实体 UUID
  changeType: ChangeType;        // create | update | delete
  changedFields: string[];       // 变更的字段列表
  oldValues: Record<string, any>;// 旧值（update/delete时）
  newValues: Record<string, any>;// 新值（create/update时）
  timestamp: number;             // 变更时间
  userId: string;                // 操作用户
  version: number;               // 变更后的版本号
  synced: boolean;               // 是否已同步
}

type ChangeType = 'create' | 'update' | 'delete';
```

### 变更捕获

```javascript
class ChangeTracker {
  // 记录创建
  trackCreate(entityType, entity) {
    const change = {
      id: uuidv7(),
      entityType,
      entityId: entity.id,
      changeType: 'create',
      changedFields: Object.keys(entity),
      oldValues: {},
      newValues: entity,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      version: 1,
      synced: false
    };
    
    this.saveChange(change);
    this.updateEntitySyncStatus(entityType, entity.id, 'local');
  }
  
  // 记录更新
  trackUpdate(entityType, entityId, oldEntity, newEntity) {
    const changedFields = this.getChangedFields(oldEntity, newEntity);
    if (changedFields.length === 0) return;
    
    const change = {
      id: uuidv7(),
      entityType,
      entityId,
      changeType: 'update',
      changedFields,
      oldValues: this.pickFields(oldEntity, changedFields),
      newValues: this.pickFields(newEntity, changedFields),
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      version: newEntity.version,
      synced: false
    };
    
    this.saveChange(change);
    this.updateEntitySyncStatus(entityType, entityId, 'modified');
  }
  
  // 记录删除
  trackDelete(entityType, entityId, entity) {
    const change = {
      id: uuidv7(),
      entityType,
      entityId,
      changeType: 'delete',
      changedFields: [],
      oldValues: entity,
      newValues: {},
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      version: entity.version + 1,
      synced: false
    };
    
    this.saveChange(change);
    this.updateEntitySyncStatus(entityType, entityId, 'deleted');
  }
  
  // 获取变更的字段
  getChangedFields(oldObj, newObj) {
    const fields = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    const changed = [];
    
    for (const field of fields) {
      if (JSON.stringify(oldObj[field]) !== JSON.stringify(newObj[field])) {
        changed.push(field);
      }
    }
    
    return changed;
  }
}
```

## 同步队列

### 队列项结构

```typescript
interface SyncQueueItem {
  id: string;                    // UUID
  actionType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  payload: any;                  // 完整数据或增量数据
  baseVersion: number;           // 基于的版本号
  status: QueueItemStatus;
  priority: number;              // 1-10, 越大越优先
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt: number | null;
  nextAttempt: number;
  errorMessage: string | null;
}

type QueueItemStatus = 'pending' | 'sending' | 'failed' | 'conflict';
```

### 队列处理器

```javascript
class SyncQueue {
  constructor(options) {
    this.db = options.db;
    this.comm = options.communicationLayer;
    this.batchSize = options.batchSize || 10;
    this.retryInterval = options.retryInterval || 5000;
    this.processing = false;
  }
  
  // 入队
  async enqueue(item) {
    const queueItem = {
      id: uuidv7(),
      ...item,
      status: 'pending',
      retryCount: 0,
      maxRetries: 5,
      createdAt: Date.now(),
      lastAttempt: null,
      nextAttempt: Date.now(),
      errorMessage: null
    };
    
    await this.db.run(
      `INSERT INTO sync_queue 
       (id, action_type, entity_type, entity_id, payload, base_version, 
        status, priority, retry_count, max_retries, created_at, 
        last_attempt, next_attempt, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [queueItem.id, queueItem.actionType, queueItem.entityType,
       queueItem.entityId, JSON.stringify(queueItem.payload),
       queueItem.baseVersion, queueItem.status, queueItem.priority,
       queueItem.retryCount, queueItem.maxRetries, queueItem.createdAt,
       queueItem.lastAttempt, queueItem.nextAttempt, queueItem.errorMessage]
    );
    
    // 触发处理
    this.processQueue();
  }
  
  // 处理队列
  async processQueue() {
    if (this.processing) return;
    if (!this.comm.isOnline()) return;
    
    this.processing = true;
    
    try {
      // 获取待处理项
      const items = await this.db.query(
        `SELECT * FROM sync_queue 
         WHERE status = 'pending' AND next_attempt <= ?
         ORDER BY priority DESC, created_at ASC
         LIMIT ?`,
        [Date.now(), this.batchSize]
      );
      
      if (items.length === 0) {
        this.processing = false;
        return;
      }
      
      // 批量处理
      for (const item of items) {
        await this.processItem(item);
      }
      
    } finally {
      this.processing = false;
    }
    
    // 检查是否还有待处理项
    const remaining = await this.getPendingCount();
    if (remaining > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }
  
  // 处理单个项
  async processItem(item) {
    // 更新状态为 sending
    await this.updateItemStatus(item.id, 'sending');
    
    try {
      const response = await this.comm.sendAndWait({
        type: 'data',
        action: 'sync',
        payload: {
          actionType: item.action_type,
          entityType: item.entity_type,
          entityId: item.entity_id,
          data: JSON.parse(item.payload),
          baseVersion: item.base_version
        }
      }, 30000);
      
      if (response.payload.success) {
        // 同步成功
        await this.removeItem(item.id);
        await this.updateEntitySyncStatus(
          item.entity_type, 
          item.entity_id, 
          'synced',
          response.payload.newVersion
        );
      } else if (response.payload.conflict) {
        // 发现冲突
        await this.handleConflict(item, response.payload);
      } else {
        // 其他错误
        throw new Error(response.payload.error);
      }
      
    } catch (error) {
      await this.handleItemError(item, error);
    }
  }
  
  // 处理错误
  async handleItemError(item, error) {
    const retryCount = item.retry_count + 1;
    
    if (retryCount >= item.max_retries) {
      // 超过最大重试次数
      await this.updateItem(item.id, {
        status: 'failed',
        retryCount,
        lastAttempt: Date.now(),
        errorMessage: error.message
      });
      
      // 通知用户
      this.emit('syncFailed', { item, error });
      
    } else {
      // 计算下次重试时间（指数退避）
      const delay = Math.pow(2, retryCount) * 1000;
      
      await this.updateItem(item.id, {
        status: 'pending',
        retryCount,
        lastAttempt: Date.now(),
        nextAttempt: Date.now() + delay,
        errorMessage: error.message
      });
    }
  }
  
  // 获取队列状态
  async getStatus() {
    const counts = await this.db.query(
      `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`
    );
    
    return {
      pending: counts.find(c => c.status === 'pending')?.count || 0,
      sending: counts.find(c => c.status === 'sending')?.count || 0,
      failed: counts.find(c => c.status === 'failed')?.count || 0,
      conflict: counts.find(c => c.status === 'conflict')?.count || 0
    };
  }
}
```

## 冲突检测与解决

### 冲突类型

```
1. 版本冲突（Version Conflict）
   - 本地版本 != 服务器期望版本
   - 说明有其他人修改了同一条数据

2. 删除冲突（Delete Conflict）
   - 本地修改了一条数据，但服务器上已被删除
   - 或者本地删除了，服务器上有新修改

3. 创建冲突（Create Conflict）
   - 极少发生（UUID 冲突）
   - 自动用新 UUID 重试
```

### 冲突记录结构

```typescript
interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: any;              // 本地版本
  remoteData: any;             // 服务器版本
  baseData: any | null;        // 共同祖先版本（如果有）
  conflictFields: string[];    // 冲突的字段
  conflictType: ConflictType;
  status: ConflictStatus;
  resolution: Resolution | null;
  resolvedData: any | null;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

type ConflictType = 'version' | 'delete' | 'create';
type ConflictStatus = 'pending' | 'resolved' | 'ignored';
type Resolution = 'local' | 'remote' | 'merged' | 'manual';
```

### 冲突解决器

```javascript
class ConflictResolver {
  constructor(options) {
    this.db = options.db;
    this.autoMergeFields = options.autoMergeFields || [
      'tags', 'status', 'priority', 'assignee', 'due_date'
    ];
    this.manualMergeFields = options.manualMergeFields || [
      'title', 'content', 'description'
    ];
  }
  
  // 检测冲突
  detectConflict(localData, remoteData, baseData) {
    const conflictFields = [];
    const allFields = new Set([
      ...Object.keys(localData),
      ...Object.keys(remoteData)
    ]);
    
    for (const field of allFields) {
      const localValue = localData[field];
      const remoteValue = remoteData[field];
      const baseValue = baseData?.[field];
      
      // 跳过系统字段
      if (['id', 'version', 'sync_status', 'updated_at'].includes(field)) {
        continue;
      }
      
      // 本地和远程都修改了同一字段
      const localChanged = JSON.stringify(localValue) !== JSON.stringify(baseValue);
      const remoteChanged = JSON.stringify(remoteValue) !== JSON.stringify(baseValue);
      
      if (localChanged && remoteChanged && 
          JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
        conflictFields.push(field);
      }
    }
    
    return conflictFields;
  }
  
  // 尝试自动解决
  async tryAutoResolve(conflict) {
    const { localData, remoteData, baseData, conflictFields } = conflict;
    
    // 检查是否所有冲突字段都可以自动合并
    const canAutoMerge = conflictFields.every(
      field => this.autoMergeFields.includes(field)
    );
    
    if (!canAutoMerge) {
      return null;  // 需要手动解决
    }
    
    // 自动合并
    const merged = { ...remoteData };
    
    for (const field of conflictFields) {
      // 策略：本地修改优先
      if (localData[field] !== baseData?.[field]) {
        merged[field] = localData[field];
      }
    }
    
    merged.version = Math.max(localData.version, remoteData.version) + 1;
    
    return {
      resolution: 'merged',
      resolvedData: merged
    };
  }
  
  // 手动解决
  async resolveManually(conflictId, resolution, resolvedData) {
    const conflict = await this.db.queryOne(
      'SELECT * FROM sync_conflicts WHERE id = ?',
      [conflictId]
    );
    
    if (!conflict) {
      throw new Error('Conflict not found');
    }
    
    // 更新冲突记录
    await this.db.run(
      `UPDATE sync_conflicts 
       SET status = 'resolved', resolution = ?, resolved_data = ?,
           resolved_at = ?, resolved_by = ?
       WHERE id = ?`,
      [resolution, JSON.stringify(resolvedData), Date.now(), 
       getCurrentUserId(), conflictId]
    );
    
    // 更新实体
    await this.applyResolution(conflict, resolvedData);
    
    // 重新入队同步
    await this.requeueForSync(conflict.entity_type, conflict.entity_id, resolvedData);
  }
  
  // 应用解决结果
  async applyResolution(conflict, resolvedData) {
    const tableName = this.getTableName(conflict.entity_type);
    
    const fields = Object.keys(resolvedData).filter(
      f => !['id'].includes(f)
    );
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => 
      typeof resolvedData[f] === 'object' 
        ? JSON.stringify(resolvedData[f]) 
        : resolvedData[f]
    );
    
    await this.db.run(
      `UPDATE ${tableName} SET ${setClause}, sync_status = 'modified' WHERE id = ?`,
      [...values, conflict.entity_id]
    );
  }
}
```

### 冲突解决 UI

```html
<div class="conflict-dialog">
  <h2>⚠️ 数据冲突</h2>
  <p>"{entityTitle}" 存在编辑冲突，请选择如何处理：</p>
  
  <div class="conflict-comparison">
    <div class="version local">
      <h3>📱 本地版本</h3>
      <p class="meta">修改时间: {localTime}</p>
      <p class="meta">修改人: 我</p>
      <div class="content">{localContent}</div>
    </div>
    
    <div class="version remote">
      <h3>☁️ 服务器版本</h3>
      <p class="meta">修改时间: {remoteTime}</p>
      <p class="meta">修改人: {remoteUser}</p>
      <div class="content">{remoteContent}</div>
    </div>
  </div>
  
  <div class="conflict-fields">
    <h4>冲突字段：</h4>
    <ul>
      <li v-for="field in conflictFields">
        <strong>{field}:</strong>
        <span class="local">{localValue}</span> vs 
        <span class="remote">{remoteValue}</span>
      </li>
    </ul>
  </div>
  
  <div class="actions">
    <button class="btn-local" @click="resolveWithLocal">
      保留本地版本
    </button>
    <button class="btn-remote" @click="resolveWithRemote">
      使用服务器版本
    </button>
    <button class="btn-merge" @click="openMergeEditor">
      手动合并
    </button>
  </div>
</div>
```

## 增量同步

### 增量请求

```javascript
async function requestIncrementalSync(entityType) {
  // 获取上次同步版本
  const lastSync = await db.queryOne(
    'SELECT last_sync_version, last_sync_time FROM sync_states WHERE entity_type = ?',
    [entityType]
  );
  
  const response = await comm.sendAndWait({
    type: 'data',
    action: 'sync_pull',
    payload: {
      entityType,
      sinceVersion: lastSync?.last_sync_version || 0,
      sinceTime: lastSync?.last_sync_time || 0
    }
  });
  
  return response.payload.changes;
}
```

### 增量响应处理

```javascript
async function applyIncrementalChanges(entityType, changes) {
  await db.transaction(async () => {
    for (const change of changes) {
      switch (change.type) {
        case 'create':
        case 'update':
          await upsertEntity(entityType, change.data);
          break;
        case 'delete':
          await markDeleted(entityType, change.entityId);
          break;
      }
    }
    
    // 更新同步状态
    const maxVersion = Math.max(...changes.map(c => c.version));
    await db.run(
      `INSERT OR REPLACE INTO sync_states 
       (entity_type, last_sync_version, last_sync_time)
       VALUES (?, ?, ?)`,
      [entityType, maxVersion, Date.now()]
    );
  });
}
```

## 批量同步

### 批量上传

```javascript
async function batchUpload(items) {
  const batches = chunkArray(items, 50);  // 每批50条
  
  for (const batch of batches) {
    const response = await comm.sendAndWait({
      type: 'data',
      action: 'sync_batch',
      payload: {
        items: batch.map(item => ({
          actionType: item.actionType,
          entityType: item.entityType,
          entityId: item.entityId,
          data: item.payload,
          baseVersion: item.baseVersion
        }))
      }
    }, 60000);
    
    // 处理结果
    for (const result of response.payload.results) {
      if (result.success) {
        await markSynced(result.entityType, result.entityId, result.newVersion);
      } else if (result.conflict) {
        await createConflict(result);
      } else {
        await markFailed(result.entityType, result.entityId, result.error);
      }
    }
  }
}
```

## 同步策略配置

```javascript
const syncConfig = {
  // 同步间隔
  pullInterval: 30000,        // 30秒拉取一次
  pushDebounce: 1000,         // 1秒防抖后推送
  
  // 批量设置
  batchSize: 50,              // 批量大小
  maxConcurrent: 3,           // 最大并发数
  
  // 重试设置
  maxRetries: 5,
  retryBackoff: 'exponential', // linear | exponential
  
  // 冲突设置
  autoMerge: true,            // 是否自动合并
  autoMergeFields: ['tags', 'status', 'priority'],
  
  // 实体优先级
  entityPriority: {
    'chat_message': 10,       // 聊天消息最优先
    'task': 8,
    'card': 5,
    'file': 3
  }
};
```

## 同步服务接口

```typescript
interface SyncEngine {
  // 启动/停止
  start(): void;
  stop(): void;
  
  // 手动触发
  syncNow(): Promise<void>;
  syncEntity(entityType: string, entityId: string): Promise<void>;
  
  // 队列操作
  getQueueStatus(): Promise<QueueStatus>;
  retryFailed(): Promise<void>;
  clearQueue(): Promise<void>;
  
  // 冲突操作
  getConflicts(): Promise<SyncConflict[]>;
  resolveConflict(id: string, resolution: Resolution, data?: any): Promise<void>;
  
  // 事件
  on(event: 'syncStart' | 'syncComplete' | 'syncError' | 'conflict', handler: Function): void;
  
  // 状态
  getStatus(): SyncStatus;
}

interface SyncStatus {
  running: boolean;
  lastSyncTime: number | null;
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  currentOperation: string | null;
}
```

## 测试要点

### 单元测试

1. **变更追踪**
   - 创建/更新/删除的变更记录正确
   - 字段变更检测准确

2. **队列操作**
   - 入队/出队
   - 优先级排序
   - 重试计算

3. **冲突检测**
   - 版本冲突检测
   - 字段级冲突检测
   - 自动合并逻辑

### 集成测试

1. **完整同步流程**
   - 本地修改 → 同步 → 服务器确认
   - 服务器推送 → 本地更新

2. **冲突场景**
   - 同时编辑同一条数据
   - 删除冲突
   - 自动合并

3. **离线场景**
   - 离线编辑 → 队列累积 → 在线同步
   - 长时间离线后的同步

### 压力测试

1. **大量数据同步**
   - 1000+ 条变更批量同步
   - 持续高频变更

2. **网络不稳定**
   - 频繁断连
   - 部分请求失败

## 相关规格

- `04-communication.md` - 通信层
- `05-database.md` - 数据库设计
- `03-sync-server.md` - 服务端同步

## 相关任务

- `tasks/phase-2/task-002-sync-engine.md`



# 07 - 同步引擎规格（补充部分）

## 文档关系

```
本文档 (07-sync-engine.md)
├── 被引用于:
│   ├── 03-sync-server.md    (服务端配合)
│   └── tasks/phase-2/task-002-sync-engine.md
├── 依赖:
│   ├── 04-communication.md  (通信层)
│   ├── 05-database.md       (本地数据库)
│   └── 03-sync-server.md    (服务端 API)
└── 使用者:
    └── 所有需要同步的插件
```

## 与其他文档的配合

### 与 Sync Server 的配合

同步引擎作为客户端，调用 Sync Server 的以下 API：

```
POST /api/sync/push    → PushService.pushAll()
POST /api/sync/pull    → PullService.pull()
POST /api/sync/resolve → ConflictResolver.resolve()
GET  /api/sync/status  → getServerStatus()
```

### 与通信层的配合

同步引擎使用通信层的以下能力：

```javascript
// 发送并等待响应
comm.sendAndWait(message, timeout)

// 监听实时通知
comm.on('sync:change', handler)

// 检查连接状态
comm.isOnline()
```

### 与数据库的配合

同步引擎操作以下数据库表：

```
实体表:        cards, tasks, chat_messages, files
同步队列:      sync_queue
同步状态:      sync_state
冲突记录:      sync_conflicts
```

## 插件集成指南

插件如何使用同步引擎：

```javascript
class MyPlugin extends Plugin {
  async createItem(data) {
    // 1. 创建本地记录
    const item = { id: this.generateId(), ...data };
    await this.db.run('INSERT INTO my_items ...', [...]);
    
    // 2. 通知同步引擎追踪
    this.context.syncEngine.trackCreate('my_items', item);
    
    return item;
  }
  
  async updateItem(id, data) {
    // 1. 获取旧数据
    const oldItem = await this.db.queryOne('SELECT * FROM my_items WHERE id = ?', [id]);
    
    // 2. 更新本地
    await this.db.run('UPDATE my_items SET ... WHERE id = ?', [..., id]);
    
    // 3. 通知同步引擎
    this.context.syncEngine.trackUpdate('my_items', id, oldItem, { ...oldItem, ...data });
  }
  
  async deleteItem(id) {
    const item = await this.db.queryOne('SELECT * FROM my_items WHERE id = ?', [id]);
    
    await this.db.run('UPDATE my_items SET deleted = 1 WHERE id = ?', [id]);
    
    this.context.syncEngine.trackDelete('my_items', id, item);
  }
}
```