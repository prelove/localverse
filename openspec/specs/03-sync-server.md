# 03 - Sync Server 规格

## 概述

Sync Server 是 Localverse 的中央同步服务器，部署在内网环境，提供：
1. 多客户端数据同步
2. 静态资源托管（前端 + 移动端）
3. 实时消息广播
4. 用户和设备管理

## 文档关系

```
本文档 (03-sync-server.md)
├── 被引用于:
│   ├── 00-architecture.md     (整体架构中的服务端部分)
│   ├── 04-communication.md    (通信协议的服务端实现)
│   ├── 07-sync-engine.md      (同步引擎的服务端配合)
│   └── 10-mobile.md           (移动端直连 Sync Server)
├── 依赖:
│   ├── 05-database.md         (数据库结构)
│   └── 06-authentication.md   (认证机制)
└── 对应任务:
    └── tasks/phase-2/task-001-sync-server.md
```

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    内网环境 (192.168.x.x)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Sync Server (Java 21)                  │  │
│   │                  端口: 8080                         │  │
│   ├─────────────────────────────────────────────────────┤  │
│   │                                                     │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │  │
│   │  │ HTTP Server │  │  WebSocket  │  │ SSE Server │ │  │
│   │  │   (静态+API) │  │   Server    │  │            │ │  │
│   │  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │  │
│   │         │                │               │        │  │
│   │         └────────┬───────┴───────┬───────┘        │  │
│   │                  ↓               ↓                │  │
│   │  ┌─────────────────────────────────────────────┐ │  │
│   │  │              Service Layer                   │ │  │
│   │  │  ┌─────────┐ ┌─────────┐ ┌───────────────┐ │ │  │
│   │  │  │  Sync   │ │  Auth   │ │  Broadcast    │ │ │  │
│   │  │  │ Service │ │ Service │ │  Service      │ │ │  │
│   │  │  └─────────┘ └─────────┘ └───────────────┘ │ │  │
│   │  └─────────────────────┬───────────────────────┘ │  │
│   │                        ↓                         │  │
│   │  ┌─────────────────────────────────────────────┐ │  │
│   │  │           SQLite Database                    │ │  │
│   │  │           (data/server.db)                  │ │  │
│   │  └─────────────────────────────────────────────┘ │  │
│   │                                                     │  │
│   └─────────────────────────────────────────────────────┘  │
│                              ↑                              │
│              ┌───────────────┼───────────────┐             │
│              ↓               ↓               ↓             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │   PC Client  │  │   PC Client  │  │   Mobile     │    │
│   │  (Browser)   │  │  (Browser)   │  │  (Browser)   │    │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 启动模式

localverse.jar 支持两种模式，通过参数切换：

```bash
# 客户端模式（默认）
java -jar localverse.jar
java -jar localverse.jar --mode=client

# 服务端模式
java -jar localverse.jar --mode=server
java -jar localverse.jar --mode=server --port=8080
```

## 目录结构

```
sync-server/
├── localverse.jar           # 主程序
├── config/
│   └── server.json          # 服务端配置
├── data/
│   ├── server.db            # 服务端数据库
│   └── files/               # 同步文件存储
│       ├── attachments/     # 附件
│       └── avatars/         # 头像
├── static/
│   ├── desktop/             # PC 端前端
│   │   ├── index.html
│   │   ├── app.js
│   │   └── ...
│   ├── mobile/              # 移动端前端
│   │   ├── index.html
│   │   ├── app.js
│   │   └── ...
│   └── wasm/                # WASM 文件
│       └── sqlite.dat
└── logs/
    └── server.log
```

## 配置文件

```json
// config/server.json
{
  "mode": "server",
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "wsPort": 8081,
    "maxConnections": 1000,
    "sessionTimeout": 86400000
  },
  "database": {
    "path": "./data/server.db",
    "maxConnections": 10
  },
  "storage": {
    "path": "./data/files",
    "maxFileSize": 104857600,
    "allowedTypes": ["image/*", "application/pdf", "text/*"]
  },
  "sync": {
    "batchSize": 100,
    "conflictStrategy": "server-wins",
    "retentionDays": 30
  },
  "security": {
    "enableCORS": true,
    "allowedOrigins": ["*"],
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  },
  "logging": {
    "level": "INFO",
    "file": "./logs/server.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

## HTTP API 端点

### 认证相关

```
POST /api/auth/register
  - 功能: 注册设备
  - 请求体: { userId, userName, department, deviceId, deviceName, platform }
  - 响应: { success, token, serverTime }

POST /api/auth/verify
  - 功能: 验证令牌
  - 请求头: Authorization: Bearer <token>
  - 响应: { valid, user, expiresAt }

GET /api/auth/devices
  - 功能: 获取用户的所有设备
  - 响应: { devices: [{ deviceId, deviceName, platform, lastSeen }] }

DELETE /api/auth/devices/:deviceId
  - 功能: 注销设备
  - 响应: { success }
```

### 同步相关

```
POST /api/sync/push
  - 功能: 推送本地变更到服务器
  - 请求体: {
      changes: [{
        actionType: 'create' | 'update' | 'delete',
        entityType: 'card' | 'task' | 'file' | ...,
        entityId: 'uuid',
        data: { ... },
        baseVersion: number,
        clientTime: number
      }]
    }
  - 响应: {
      results: [{
        entityId: 'uuid',
        success: boolean,
        newVersion?: number,
        conflict?: {
          serverData: { ... },
          serverVersion: number
        },
        error?: string
      }]
    }

POST /api/sync/pull
  - 功能: 拉取服务器变更
  - 请求体: {
      entityType: 'card' | 'task' | 'all',
      sinceVersion: number,
      sinceTime: number,
      limit: number
    }
  - 响应: {
      changes: [{
        actionType: 'create' | 'update' | 'delete',
        entityType: string,
        entityId: string,
        data: { ... },
        version: number,
        serverTime: number
      }],
      hasMore: boolean,
      nextVersion: number
    }

GET /api/sync/status
  - 功能: 获取同步状态
  - 响应: {
      serverVersion: number,
      serverTime: number,
      pendingChanges: number,
      lastSyncTime: number
    }

POST /api/sync/resolve
  - 功能: 解决冲突
  - 请求体: {
      conflictId: 'uuid',
      resolution: 'local' | 'remote' | 'merged',
      mergedData?: { ... }
    }
  - 响应: { success, newVersion }
```

### 实体 CRUD API

```
# 卡片
GET    /api/cards                    # 列表
GET    /api/cards/:id                # 详情
POST   /api/cards                    # 创建
PUT    /api/cards/:id                # 更新
DELETE /api/cards/:id                # 删除

# 任务
GET    /api/tasks                    # 列表
GET    /api/tasks/:id                # 详情
POST   /api/tasks                    # 创建
PUT    /api/tasks/:id                # 更新
DELETE /api/tasks/:id                # 删除

# 文件
GET    /api/files                    # 列表
GET    /api/files/:id                # 详情/下载
POST   /api/files                    # 上传
DELETE /api/files/:id                # 删除

# 聊天
GET    /api/chat/rooms               # 房间列表
POST   /api/chat/rooms               # 创建房间
GET    /api/chat/rooms/:id/messages  # 消息列表
POST   /api/chat/rooms/:id/messages  # 发送消息
```

### 用户相关

```
GET /api/users
  - 功能: 获取用户列表
  - 查询参数: ?department=dev&online=true
  - 响应: { users: [{ userId, userName, department, online, lastSeen }] }

GET /api/users/:id
  - 功能: 获取用户详情
  - 响应: { user: { ... } }

GET /api/users/online
  - 功能: 获取在线用户
  - 响应: { users: [...] }
```

### 系统相关

```
GET /api/health
  - 功能: 健康检查
  - 响应: { status: 'ok', version: '1.0.0', uptime: 3600, connections: 10 }

GET /api/stats
  - 功能: 统计信息
  - 响应: {
      users: { total, online },
      data: { cards, tasks, files, messages },
      sync: { pendingChanges, lastSyncTime }
    }

POST /api/broadcast
  - 功能: 广播消息（仅管理员）
  - 请求体: { type: 'announcement', content: '...' }
  - 响应: { success, recipients }
```

## WebSocket 协议

### 连接

```
ws://server:8081/ws?token=<base64_token>
```

### 消息格式

```typescript
// 客户端 → 服务端
interface ClientMessage {
  id: string;
  type: 'subscribe' | 'unsubscribe' | 'message' | 'ping';
  channel?: string;
  payload?: any;
}

// 服务端 → 客户端
interface ServerMessage {
  id: string;
  type: 'event' | 'ack' | 'error' | 'pong';
  channel?: string;
  payload?: any;
  replyTo?: string;
}
```

### 频道订阅

```javascript
// 订阅
{ "type": "subscribe", "channel": "sync" }
{ "type": "subscribe", "channel": "chat:room_123" }
{ "type": "subscribe", "channel": "user:zhangsan" }

// 取消订阅
{ "type": "unsubscribe", "channel": "chat:room_123" }
```

### 事件类型

```
sync:change          - 数据变更通知
chat:message         - 新聊天消息
chat:typing          - 正在输入
user:online          - 用户上线
user:offline         - 用户下线
announcement         - 系统公告
```

## SSE 端点

```
GET /api/events?token=<token>&channels=sync,chat
```

SSE 作为 WebSocket 的降级方案，事件格式：

```
event: sync:change
data: {"entityType":"card","entityId":"xxx","action":"update"}

event: chat:message
data: {"roomId":"xxx","message":{...}}
```

## 数据库结构（服务端）

### 同步元数据表

```sql
-- 全局版本号
CREATE TABLE sync_versions (
    entity_type TEXT PRIMARY KEY,
    current_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- 变更日志（用于增量同步）
CREATE TABLE sync_changelog (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    data TEXT,
    client_id TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_changelog_type_version ON sync_changelog(entity_type, version);
CREATE INDEX idx_changelog_time ON sync_changelog(created_at);

-- 冲突记录
CREATE TABLE sync_conflicts (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    client_data TEXT NOT NULL,
    server_data TEXT NOT NULL,
    client_version INTEGER,
    server_version INTEGER,
    status TEXT DEFAULT 'pending',
    resolution TEXT,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
);
```

### 设备和会话表

```sql
-- 注册的设备
CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT,
    platform TEXT,
    token_hash TEXT,
    registered_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    last_sync_at INTEGER
);

CREATE INDEX idx_devices_user ON devices(user_id);

-- 活跃会话
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    connection_type TEXT,
    connected_at INTEGER NOT NULL,
    last_activity INTEGER,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### 用户目录表

```sql
-- 用户目录（汇总所有注册用户）
CREATE TABLE user_directory (
    user_id TEXT PRIMARY KEY,
    user_name TEXT NOT NULL,
    department TEXT,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    online INTEGER DEFAULT 0
);

CREATE INDEX idx_users_department ON user_directory(department);
CREATE INDEX idx_users_online ON user_directory(online);
```

## 服务端核心类

```java
// 主入口
public class SyncServerMain {
    public static void main(String[] args) {
        ServerConfig config = ConfigLoader.load(args);
        SyncServer server = new SyncServer(config);
        server.start();
    }
}

// 服务器
public class SyncServer {
    private HttpServer httpServer;
    private WebSocketServer wsServer;
    private DatabaseService database;
    private SyncService syncService;
    private BroadcastService broadcastService;
    private AuthService authService;
    
    public void start();
    public void stop();
}

// 同步服务
public interface SyncService {
    PushResult push(List<ChangeRequest> changes, String clientId);
    PullResult pull(String entityType, long sinceVersion, int limit);
    void resolveConflict(String conflictId, Resolution resolution, Object mergedData);
    SyncStatus getStatus();
}

// 广播服务
public interface BroadcastService {
    void broadcast(String channel, Message message);
    void sendToUser(String userId, Message message);
    void sendToDevice(String deviceId, Message message);
    void subscribe(String sessionId, String channel);
    void unsubscribe(String sessionId, String channel);
}
```

## 冲突处理策略

### 服务端优先（默认）

```java
if (clientVersion < serverVersion) {
    return ConflictResult.conflict(serverData);
}
```

### 客户端优先

```java
// 配置 conflictStrategy: "client-wins"
// 直接接受客户端数据，覆盖服务端
```

### 字段级合并

```java
// 对于某些字段可以自动合并
// 例如: tags 数组可以合并
Set<String> mergedTags = new HashSet<>();
mergedTags.addAll(clientData.tags);
mergedTags.addAll(serverData.tags);
```

### 手动解决

```java
// 返回冲突信息，等待客户端决定
return ConflictResult.needsResolution(clientData, serverData);
```

## 性能优化

### 连接池

```java
// 数据库连接池
HikariConfig config = new HikariConfig();
config.setMaximumPoolSize(10);
config.setMinimumIdle(2);
```

### 批量处理

```java
// 批量插入变更
public void batchInsertChanges(List<Change> changes) {
    String sql = "INSERT INTO sync_changelog (...) VALUES (?, ?, ?, ...)";
    try (PreparedStatement stmt = conn.prepareStatement(sql)) {
        for (Change change : changes) {
            stmt.setString(1, change.id);
            // ...
            stmt.addBatch();
        }
        stmt.executeBatch();
    }
}
```

### 增量同步

```java
// 只返回版本号之后的变更
public List<Change> getChangesSince(String entityType, long sinceVersion, int limit) {
    return db.query(
        "SELECT * FROM sync_changelog WHERE entity_type = ? AND version > ? ORDER BY version LIMIT ?",
        entityType, sinceVersion, limit
    );
}
```

## 测试要点

### 单元测试
1. API 请求处理
2. 同步逻辑
3. 冲突检测
4. 版本管理

### 集成测试
1. 多客户端同步
2. 断线重连
3. 大数据量同步
4. 冲突场景

### 压力测试
1. 100 并发连接
2. 1000 条/秒消息
3. 长时间运行稳定性

## 相关规格

- `00-architecture.md` - 整体架构
- `04-communication.md` - 通信协议
- `05-database.md` - 数据库结构
- `07-sync-engine.md` - 客户端同步引擎

## 相关任务

- `tasks/phase-2/task-001-sync-server.md`