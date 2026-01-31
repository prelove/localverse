# 02 - Local JAR 服务规格

## 概述

Local JAR（localverse.jar）是运行在用户本机的 Java 服务，提供：
1. HTTP/WebSocket 服务器（供浏览器访问）
2. 文件系统操作（WatchService、读写）
3. 代理转发（到 Sync Server）
4. 系统级功能（加密、打印等）

## 设计原则

- **轻量**：不使用 Spring 等重型框架
- **标准**：使用 JDK 内置 API
- **同构**：与 Sync Server 共用核心代码

## 技术选型

| 功能 | 技术 | 说明 |
|------|------|------|
| HTTP Server | com.sun.net.httpserver | JDK 内置 |
| WebSocket | Java-WebSocket 库 | 轻量级 |
| JSON | Gson 或 Jackson | 序列化 |
| 数据库 | SQLite JDBC | 本地存储 |
| 文件监视 | WatchService | JDK 内置 |
| HTTP Client | java.net.http | JDK 11+ |

## 启动模式

```bash
# 客户端模式（默认）
java -jar localverse.jar

# 服务器模式
java -jar localverse.jar --mode=server --port=8080

# 混合模式
java -jar localverse.jar --mode=hybrid --port=8080

# 指定配置文件
java -jar localverse.jar --config=/path/to/config.json
```

## 配置文件

```json
{
  "mode": "client",
  
  "client": {
    "httpPort": 8765,
    "wsPort": 8766,
    "bindAddress": "127.0.0.1",
    "syncServer": "http://192.168.1.100:8080",
    "syncEnabled": true,
    "autoConnect": true,
    "reconnectInterval": 5000
  },
  
  "server": {
    "httpPort": 8080,
    "wsPort": 8081,
    "bindAddress": "0.0.0.0",
    "maxConnections": 1000,
    "sessionTimeout": 3600
  },
  
  "database": {
    "path": "./data/localverse.db",
    "maxConnections": 10
  },
  
  "filesystem": {
    "watchPaths": ["D:/Documents", "D:/Projects"],
    "excludePatterns": ["*.tmp", "node_modules/**"],
    "maxFileSize": 104857600
  },
  
  "security": {
    "jwtSecret": "your-secret-key",
    "tokenExpiry": 86400,
    "enableCORS": true,
    "allowedOrigins": ["http://127.0.0.1:*", "file://"]
  },
  
  "user": {
    "id": "user_001",
    "name": "张三",
    "department": "dev"
  },
  
  "logging": {
    "level": "INFO",
    "file": "./logs/localverse.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

## 模块结构

```
src/java/core/
├── Main.java                    # 入口点
├── config/
│   ├── Config.java              # 配置类
│   └── ConfigLoader.java        # 配置加载器
├── server/
│   ├── HttpServer.java          # HTTP 服务器
│   ├── WebSocketServer.java     # WebSocket 服务器
│   └── handlers/
│       ├── LocalApiHandler.java # 本地 API 处理
│       ├── ProxyHandler.java    # 代理转发
│       ├── StaticHandler.java   # 静态文件
│       └── HealthHandler.java   # 健康检查
├── services/
│   ├── FileSystemService.java   # 文件系统服务
│   ├── DatabaseService.java     # 数据库服务
│   ├── SearchService.java       # 搜索服务
│   ├── CryptoService.java       # 加密服务
│   └── SyncService.java         # 同步服务
├── sync/
│   ├── SyncClient.java          # 同步客户端
│   ├── SyncQueue.java           # 同步队列
│   └── ConflictResolver.java    # 冲突解决
├── utils/
│   ├── JsonUtil.java            # JSON 工具
│   ├── UUIDUtil.java            # UUID 生成
│   └── HashUtil.java            # 哈希工具
└── models/
    ├── Message.java             # 消息模型
    ├── User.java                # 用户模型
    └── ...
```

## API 路由

### 本地 API（/api/local/）

```
GET  /api/local/health           # 健康检查
GET  /api/local/config           # 获取配置
PUT  /api/local/config           # 更新配置

GET  /api/local/files            # 文件列表
GET  /api/local/files/:path      # 读取文件
POST /api/local/files            # 上传文件
PUT  /api/local/files/:path      # 更新文件
DELETE /api/local/files/:path    # 删除文件

GET  /api/local/db/query         # 数据库查询
POST /api/local/db/exec          # 数据库执行

GET  /api/local/search           # 全文搜索
POST /api/local/index            # 更新索引

POST /api/local/crypto/encrypt   # 加密
POST /api/local/crypto/decrypt   # 解密
POST /api/local/crypto/hash      # 哈希

GET  /api/local/watch/status     # 文件监视状态
POST /api/local/watch/start      # 开始监视
POST /api/local/watch/stop       # 停止监视
```

### 代理 API（/api/sync/）

```
# 所有 /api/sync/* 请求转发到 Sync Server
GET  /api/sync/announcements     # → 192.168.1.100:8080/api/announcements
POST /api/sync/chat/send         # → 192.168.1.100:8080/api/chat/send
...
```

### WebSocket

```
ws://127.0.0.1:8766/ws

消息类型：
- auth: 认证
- subscribe: 订阅频道
- message: 普通消息
- command: 命令（来自 Server）
- event: 事件通知
- heartbeat: 心跳
```

## 核心服务接口

### FileSystemService
```java
public interface FileSystemService {
    // 读取
    byte[] readFile(String path) throws IOException;
    String readText(String path, Charset charset) throws IOException;
    List<FileInfo> listDirectory(String path) throws IOException;
    FileInfo getFileInfo(String path) throws IOException;
    
    // 写入
    void writeFile(String path, byte[] content) throws IOException;
    void writeText(String path, String content, Charset charset) throws IOException;
    void appendText(String path, String content) throws IOException;
    
    // 操作
    void createDirectory(String path) throws IOException;
    void delete(String path) throws IOException;
    void move(String src, String dest) throws IOException;
    void copy(String src, String dest) throws IOException;
    
    // 监视
    void startWatch(List<String> paths, FileWatchListener listener);
    void stopWatch();
    boolean isWatching();
    
    // 搜索
    List<FileInfo> search(String query, SearchOptions options);
}

public record FileInfo(
    String path,
    String name,
    String extension,
    long size,
    Instant createdAt,
    Instant modifiedAt,
    boolean isDirectory,
    Map<String, Object> metadata
) {}

public interface FileWatchListener {
    void onCreated(String path);
    void onModified(String path);
    void onDeleted(String path);
}
```

### DatabaseService
```java
public interface DatabaseService {
    // 查询
    <T> List<T> query(String sql, Object[] params, RowMapper<T> mapper);
    <T> Optional<T> queryOne(String sql, Object[] params, RowMapper<T> mapper);
    
    // 执行
    int execute(String sql, Object[] params);
    long insert(String sql, Object[] params);
    
    // 批量
    int[] batchExecute(String sql, List<Object[]> paramsList);
    
    // 事务
    <T> T transaction(TransactionCallback<T> callback);
    
    // 备份
    void backup(String path);
    void restore(String path);
}
```

### SyncService
```java
public interface SyncService {
    // 连接
    void connect();
    void disconnect();
    boolean isConnected();
    ConnectionState getState();
    
    // 发送
    void send(Message message);
    CompletableFuture<Message> sendAndWait(Message message, Duration timeout);
    
    // 接收
    void subscribe(String channel, MessageHandler handler);
    void unsubscribe(String channel);
    
    // 同步队列
    void enqueue(PendingAction action);
    List<PendingAction> getPendingActions();
    void processQueue();
    
    // 状态
    SyncStatus getStatus();
}

public record SyncStatus(
    boolean connected,
    String transport,          // websocket/sse/polling
    int latencyMs,
    int pendingCount,
    Instant lastSyncTime
) {}
```

## 自举更新流程

当 localverse.jar 检测到新版本时：

```java
// 1. 检查更新
VersionInfo remote = fetchRemoteVersion();
if (isNewer(remote, current)) {
    
    // 2. 下载新版本
    downloadToTemp(remote.jarUrl, "temp/localverse-" + remote.jar + ".jar");
    
    // 3. 验证哈希
    String hash = computeHash("temp/localverse-" + remote.jar + ".jar");
    if (!hash.equals(remote.jarHash)) {
        deleteTemp();
        return;
    }
    
    // 4. 写入更新标记
    Files.writeString(Path.of("update_pending.flag"), remote.jar);
    
    // 5. 通知前端
    broadcastToClients(new Message("system", "update_ready", remote));
    
    // 6. 等待用户确认或自动重启
    if (config.autoUpdate || userConfirmed) {
        // 7. 请求 Launcher 重启
        System.exit(100);
    }
}
```

## 测试要点

1. **HTTP 服务测试**
   - 所有 API 端点可访问
   - CORS 正确处理
   - 错误响应格式正确

2. **WebSocket 测试**
   - 连接建立和断开
   - 消息收发
   - 心跳保活
   - 重连机制

3. **代理测试**
   - 请求正确转发
   - 响应正确返回
   - 超时处理
   - Server 不可用时的降级

4. **文件系统测试**
   - 读写操作
   - 监视事件
   - 大文件处理
   - 权限错误处理

5. **同步测试**
   - 队列入队出队
   - 网络恢复后自动同步
   - 冲突检测

## 相关任务

- `tasks/phase-0/task-002-local-jar.md`