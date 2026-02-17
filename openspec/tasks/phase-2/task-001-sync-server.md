# Task 001: Sync Server 开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase2-task-001-sync-server |
| 阶段 | Phase 2 - 服务端与同步 |
| 优先级 | P0 (最高) |
| 预估工时 | 24 小时 |
| 依赖 | Phase 0 + Phase 1 完成 |
| 产出 | localverse.jar (服务端模式) |
| 状态 | ✅ 已完成（持久化 + 冲突检测 + 广播 + 冒烟/并发验证） |

## 文档关系

```
本任务 (task-001-sync-server.md)
├── 规格来源:
│   ├── specs/03-sync-server.md      (主要规格)
│   ├── specs/04-communication.md    (通信协议)
│   └── specs/05-database.md         (数据库结构)
├── 依赖任务:
│   ├── phase-0/task-002-local-jar.md (共用 HTTP/WS 框架)
│   └── phase-0/task-004-database.md  (共用数据库层)
├── 被依赖:
│   └── task-002-sync-engine.md       (客户端同步依赖服务端)
└── 测试依赖:
    └── 需要 Phase 1 前端进行集成测试
```

## 目标

开发 localverse.jar 的服务端模式，实现：
1. HTTP API 服务
2. WebSocket 实时通信
3. 数据同步服务
4. 用户/设备管理
5. 静态文件托管

## 与客户端模式的代码复用

```
src/java/
├── core/                           # 共用核心
│   ├── Main.java                   # 统一入口，根据 mode 分发
│   ├── config/                     # 配置加载（共用）
│   ├── database/                   # 数据库服务（共用）
│   └── http/                       # HTTP 基础框架（共用）
│
├── client/                         # 客户端模式专用
│   ├── ClientServer.java
│   ├── handlers/
│   │   ├── LocalFileHandler.java
│   │   └── ProxyHandler.java
│   └── services/
│       └── FileWatchService.java
│
└── server/                         # 服务端模式专用 [本任务]
    ├── SyncServer.java             # 服务端主类
    ├── handlers/
    │   ├── AuthHandler.java        # 认证 API
    │   ├── SyncHandler.java        # 同步 API
    │   ├── EntityHandler.java      # 实体 CRUD
    │   ├── ChatHandler.java        # 聊天 API
    │   ├── UserHandler.java        # 用户 API
    │   └── StaticHandler.java      # 静态文件
    ├── websocket/
    │   ├── WsServer.java           # WebSocket 服务
    │   ├── WsSessionManager.java   # 会话管理
    │   └── ChannelManager.java     # 频道管理
    ├── services/
    │   ├── SyncService.java        # 同步服务
    │   ├── ConflictService.java    # 冲突处理
    │   ├── BroadcastService.java   # 广播服务
    │   ├── UserService.java        # 用户服务
    │   └── ChangelogService.java   # 变更日志
    └── models/
        ├── SyncRequest.java
        ├── SyncResponse.java
        └── ...
```

## 实现步骤

### Step 1: 项目结构和入口 (2h)

```java
// core/Main.java

public class Main {
    public static void main(String[] args) {
        Config config = ConfigLoader.load(args);
        
        if ("server".equals(config.getMode())) {
            SyncServer server = new SyncServer(config);
            server.start();
        } else {
            ClientServer server = new ClientServer(config);
            server.start();
        }
        
        // 优雅关闭
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            // cleanup
        }));
    }
}
```

```java
// server/SyncServer.java

public class SyncServer {
    private final ServerConfig config;
    private HttpServer httpServer;
    private WsServer wsServer;
    private DatabaseService database;
    
    // Services
    private SyncService syncService;
    private BroadcastService broadcastService;
    private UserService userService;
    
    public SyncServer(Config config) {
        this.config = config.getServerConfig();
    }
    
    public void start() {
        try {
            // 1. 初始化数据库
            initDatabase();
            
            // 2. 初始化服务
            initServices();
            
            // 3. 启动 HTTP 服务
            startHttpServer();
            
            // 4. 启动 WebSocket 服务
            startWsServer();
            
            log.info("Sync Server started on port {}", config.getPort());
            
        } catch (Exception e) {
            log.error("Failed to start server", e);
            System.exit(1);
        }
    }
    
    private void initDatabase() throws SQLException {
        database = new JdbcDatabaseService(config.getDatabasePath());
        database.init();
        database.runMigrations();
    }
    
    private void initServices() {
        syncService = new SyncServiceImpl(database);
        broadcastService = new BroadcastServiceImpl();
        userService = new UserServiceImpl(database);
    }
    
    private void startHttpServer() throws IOException {
        httpServer = HttpServer.create(
            new InetSocketAddress(config.getHost(), config.getPort()), 
            0
        );
        
        // 静态文件
        httpServer.createContext("/", new StaticHandler("./static"));
        
        // API 路由
        httpServer.createContext("/api/health", new HealthHandler());
        httpServer.createContext("/api/auth", new AuthHandler(userService));
        httpServer.createContext("/api/sync", new SyncHandler(syncService, broadcastService));
        httpServer.createContext("/api/cards", new EntityHandler("cards", database, syncService));
        httpServer.createContext("/api/tasks", new EntityHandler("tasks", database, syncService));
        httpServer.createContext("/api/chat", new ChatHandler(database, broadcastService));
        httpServer.createContext("/api/users", new UserHandler(userService));
        httpServer.createContext("/api/files", new FileHandler(config.getStoragePath()));
        
        // 线程池
        httpServer.setExecutor(Executors.newFixedThreadPool(10));
        httpServer.start();
    }
    
    private void startWsServer() {
        wsServer = new WsServer(config.getWsPort(), broadcastService, userService);
        wsServer.start();
    }
    
    public void stop() {
        if (httpServer != null) httpServer.stop(0);
        if (wsServer != null) wsServer.stop();
        if (database != null) database.close();
    }
}
```

### Step 2: 同步服务核心 (6h)

```java
// server/services/SyncService.java

public interface SyncService {
    PushResult push(List<ChangeRequest> changes, String clientId);
    PullResult pull(String entityType, long sinceVersion, int limit);
    void resolveConflict(String conflictId, String resolution, Map<String, Object> mergedData);
    SyncStatus getStatus();
    long getCurrentVersion(String entityType);
}

// server/services/impl/SyncServiceImpl.java

public class SyncServiceImpl implements SyncService {
    private final DatabaseService db;
    private final ConflictService conflictService;
    private final ChangelogService changelogService;
    
    public SyncServiceImpl(DatabaseService db) {
        this.db = db;
        this.conflictService = new ConflictServiceImpl(db);
        this.changelogService = new ChangelogServiceImpl(db);
    }
    
    @Override
    public PushResult push(List<ChangeRequest> changes, String clientId) {
        List<ChangeResult> results = new ArrayList<>();
        
        for (ChangeRequest change : changes) {
            try {
                ChangeResult result = processChange(change, clientId);
                results.add(result);
            } catch (Exception e) {
                results.add(ChangeResult.error(change.getEntityId(), e.getMessage()));
            }
        }
        
        return new PushResult(results);
    }
    
    private ChangeResult processChange(ChangeRequest change, String clientId) {
        String entityType = change.getEntityType();
        String entityId = change.getEntityId();
        
        return db.transaction(() -> {
            // 获取当前服务端版本
            Optional<EntityRecord> serverRecord = getEntityRecord(entityType, entityId);
            
            // 检查冲突
            if (serverRecord.isPresent()) {
                int serverVersion = serverRecord.get().getVersion();
                
                if (change.getBaseVersion() < serverVersion) {
                    // 版本冲突
                    Conflict conflict = conflictService.createConflict(
                        entityType, entityId,
                        change.getData(), serverRecord.get().getData(),
                        change.getBaseVersion(), serverVersion
                    );
                    
                    return ChangeResult.conflict(entityId, conflict);
                }
            }
            
            // 应用变更
            int newVersion = applyChange(change);
            
            // 记录变更日志
            changelogService.recordChange(
                entityType, entityId, 
                change.getActionType(), 
                change.getData(),
                newVersion, clientId
            );
            
            return ChangeResult.success(entityId, newVersion);
        });
    }
    
    private int applyChange(ChangeRequest change) {
        String table = getTableName(change.getEntityType());
        String entityId = change.getEntityId();
        Map<String, Object> data = change.getData();
        
        switch (change.getActionType()) {
            case "create":
                return insertEntity(table, entityId, data);
                
            case "update":
                return updateEntity(table, entityId, data);
                
            case "delete":
                return deleteEntity(table, entityId);
                
            default:
                throw new IllegalArgumentException("Unknown action: " + change.getActionType());
        }
    }
    
    private int insertEntity(String table, String entityId, Map<String, Object> data) {
        // 构建 INSERT SQL
        data.put("id", entityId);
        data.put("version", 1);
        data.put("created_at", System.currentTimeMillis());
        data.put("updated_at", System.currentTimeMillis());
        
        List<String> columns = new ArrayList<>(data.keySet());
        String placeholders = columns.stream().map(c -> "?").collect(Collectors.joining(", "));
        String sql = String.format(
            "INSERT INTO %s (%s) VALUES (%s)",
            table, String.join(", ", columns), placeholders
        );
        
        Object[] values = columns.stream().map(data::get).toArray();
        db.run(sql, values);
        
        return 1;
    }
    
    private int updateEntity(String table, String entityId, Map<String, Object> data) {
        // 获取当前版本
        EntityRecord current = getEntityRecord(table, entityId)
            .orElseThrow(() -> new EntityNotFoundException(entityId));
        
        int newVersion = current.getVersion() + 1;
        data.put("version", newVersion);
        data.put("updated_at", System.currentTimeMillis());
        
        // 构建 UPDATE SQL
        List<String> setClauses = data.keySet().stream()
            .map(k -> k + " = ?")
            .collect(Collectors.toList());
        
        String sql = String.format(
            "UPDATE %s SET %s WHERE id = ?",
            table, String.join(", ", setClauses)
        );
        
        List<Object> values = new ArrayList<>(data.values());
        values.add(entityId);
        
        db.run(sql, values.toArray());
        
        return newVersion;
    }
    
    private int deleteEntity(String table, String entityId) {
        EntityRecord current = getEntityRecord(table, entityId)
            .orElseThrow(() -> new EntityNotFoundException(entityId));
        
        int newVersion = current.getVersion() + 1;
        
        db.run(
            String.format("UPDATE %s SET deleted = 1, deleted_at = ?, version = ? WHERE id = ?", table),
            new Object[]{ System.currentTimeMillis(), newVersion, entityId }
        );
        
        return newVersion;
    }
    
    @Override
    public PullResult pull(String entityType, long sinceVersion, int limit) {
        List<ChangeRecord> changes = changelogService.getChangesSince(
            entityType, sinceVersion, limit + 1
        );
        
        boolean hasMore = changes.size() > limit;
        if (hasMore) {
            changes = changes.subList(0, limit);
        }
        
        long nextVersion = changes.isEmpty() 
            ? sinceVersion 
            : changes.get(changes.size() - 1).getVersion();
        
        return new PullResult(changes, hasMore, nextVersion);
    }
    
    @Override
    public void resolveConflict(String conflictId, String resolution, Map<String, Object> mergedData) {
        conflictService.resolve(conflictId, resolution, mergedData);
    }
    
    @Override
    public SyncStatus getStatus() {
        Map<String, Long> versions = new HashMap<>();
        versions.put("cards", getCurrentVersion("cards"));
        versions.put("tasks", getCurrentVersion("tasks"));
        // ...
        
        return new SyncStatus(versions, System.currentTimeMillis());
    }
    
    @Override
    public long getCurrentVersion(String entityType) {
        return changelogService.getCurrentVersion(entityType);
    }
}
```

### Step 3: 变更日志服务 (2h)

```java
// server/services/ChangelogService.java

public interface ChangelogService {
    void recordChange(String entityType, String entityId, String actionType, 
                      Map<String, Object> data, int version, String clientId);
    List<ChangeRecord> getChangesSince(String entityType, long sinceVersion, int limit);
    long getCurrentVersion(String entityType);
}

// server/services/impl/ChangelogServiceImpl.java

public class ChangelogServiceImpl implements ChangelogService {
    private final DatabaseService db;
    
    @Override
    public void recordChange(String entityType, String entityId, String actionType,
                             Map<String, Object> data, int version, String clientId) {
        // 获取并递增全局版本号
        long globalVersion = incrementGlobalVersion(entityType);
        
        db.run(
            """
            INSERT INTO sync_changelog 
            (id, entity_type, entity_id, action_type, version, data, client_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            new Object[]{
                UUID.randomUUID().toString(),
                entityType,
                entityId,
                actionType,
                globalVersion,
                toJson(data),
                clientId,
                System.currentTimeMillis()
            }
        );
    }
    
    private long incrementGlobalVersion(String entityType) {
        return db.transaction(() -> {
            // 获取当前版本
            Long current = db.queryOne(
                "SELECT current_version FROM sync_versions WHERE entity_type = ?",
                new Object[]{ entityType },
                rs -> rs.getLong("current_version")
            ).orElse(0L);
            
            long newVersion = current + 1;
            
            // 更新版本
            db.run(
                """
                INSERT INTO sync_versions (entity_type, current_version, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(entity_type) DO UPDATE SET 
                    current_version = ?, updated_at = ?
                """,
                new Object[]{ 
                    entityType, newVersion, System.currentTimeMillis(),
                    newVersion, System.currentTimeMillis()
                }
            );
            
            return newVersion;
        });
    }
    
    @Override
    public List<ChangeRecord> getChangesSince(String entityType, long sinceVersion, int limit) {
        String sql = """
            SELECT * FROM sync_changelog 
            WHERE entity_type = ? AND version > ?
            ORDER BY version ASC
            LIMIT ?
            """;
        
        if ("all".equals(entityType)) {
            sql = """
                SELECT * FROM sync_changelog 
                WHERE version > ?
                ORDER BY version ASC
                LIMIT ?
                """;
            return db.query(sql, new Object[]{ sinceVersion, limit }, this::mapChangeRecord);
        }
        
        return db.query(sql, new Object[]{ entityType, sinceVersion, limit }, this::mapChangeRecord);
    }
    
    @Override
    public long getCurrentVersion(String entityType) {
        return db.queryOne(
            "SELECT current_version FROM sync_versions WHERE entity_type = ?",
            new Object[]{ entityType },
            rs -> rs.getLong("current_version")
        ).orElse(0L);
    }
    
    private ChangeRecord mapChangeRecord(ResultSet rs) throws SQLException {
        return new ChangeRecord(
            rs.getString("id"),
            rs.getString("entity_type"),
            rs.getString("entity_id"),
            rs.getString("action_type"),
            rs.getLong("version"),
            fromJson(rs.getString("data")),
            rs.getLong("created_at")
        );
    }
}
```

### Step 4: WebSocket 服务 (4h)

```java
// server/websocket/WsServer.java

public class WsServer extends WebSocketServer {
    private final BroadcastService broadcastService;
    private final UserService userService;
    private final WsSessionManager sessionManager;
    private final ChannelManager channelManager;
    
    public WsServer(int port, BroadcastService broadcastService, UserService userService) {
        super(new InetSocketAddress(port));
        this.broadcastService = broadcastService;
        this.userService = userService;
        this.sessionManager = new WsSessionManager();
        this.channelManager = new ChannelManager();
        
        // 注册广播监听
        broadcastService.setMessageHandler(this::handleBroadcast);
    }
    
    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        // 验证 token
        String token = extractToken(handshake);
        if (token == null) {
            conn.close(4001, "Missing token");
            return;
        }
        
        try {
            TokenInfo tokenInfo = userService.verifyToken(token);
            
            // 创建会话
            WsSession session = sessionManager.createSession(conn, tokenInfo);
            
            // 更新用户在线状态
            userService.setOnline(tokenInfo.getUserId(), true);
            
            // 自动订阅用户频道
            channelManager.subscribe(session.getId(), "user:" + tokenInfo.getUserId());
            
            // 通知其他用户
            broadcastService.broadcast("users", new Message("user:online", Map.of(
                "userId", tokenInfo.getUserId(),
                "userName", tokenInfo.getUserName()
            )));
            
            log.info("WebSocket connected: {}", session.getId());
            
        } catch (Exception e) {
            conn.close(4002, "Invalid token");
        }
    }
    
    @Override
    public void onMessage(WebSocket conn, String message) {
        WsSession session = sessionManager.getSession(conn);
        if (session == null) return;
        
        try {
            ClientMessage msg = JsonUtil.fromJson(message, ClientMessage.class);
            handleClientMessage(session, msg);
        } catch (Exception e) {
            sendError(conn, "Invalid message format");
        }
    }
    
    private void handleClientMessage(WsSession session, ClientMessage msg) {
        switch (msg.getType()) {
            case "subscribe":
                handleSubscribe(session, msg.getChannel());
                break;
                
            case "unsubscribe":
                handleUnsubscribe(session, msg.getChannel());
                break;
                
            case "message":
                handleMessage(session, msg);
                break;
                
            case "ping":
                sendPong(session.getConnection(), msg.getId());
                break;
        }
    }
    
    private void handleSubscribe(WsSession session, String channel) {
        // 权限检查
        if (!canSubscribe(session, channel)) {
            sendError(session.getConnection(), "Cannot subscribe to channel: " + channel);
            return;
        }
        
        channelManager.subscribe(session.getId(), channel);
        sendAck(session.getConnection(), "subscribed", channel);
    }
    
    private void handleUnsubscribe(WsSession session, String channel) {
        channelManager.unsubscribe(session.getId(), channel);
        sendAck(session.getConnection(), "unsubscribed", channel);
    }
    
    private void handleMessage(WsSession session, ClientMessage msg) {
        // 根据 channel 处理消息
        String channel = msg.getChannel();
        
        if (channel != null && channel.startsWith("chat:")) {
            // 聊天消息，广播到房间
            broadcastService.broadcast(channel, new Message("chat:message", msg.getPayload()));
        }
    }
    
    private void handleBroadcast(String channel, Message message) {
        Set<String> sessionIds = channelManager.getSubscribers(channel);
        
        for (String sessionId : sessionIds) {
            WsSession session = sessionManager.getSession(sessionId);
            if (session != null && session.getConnection().isOpen()) {
                sendMessage(session.getConnection(), message);
            }
        }
    }
    
    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        WsSession session = sessionManager.getSession(conn);
        if (session != null) {
            // 更新用户在线状态
            userService.setOnline(session.getUserId(), false);
            
            // 取消所有订阅
            channelManager.unsubscribeAll(session.getId());
            
            // 移除会话
            sessionManager.removeSession(conn);
            
            // 通知其他用户
            broadcastService.broadcast("users", new Message("user:offline", Map.of(
                "userId", session.getUserId()
            )));
            
            log.info("WebSocket closed: {}", session.getId());
        }
    }
    
    @Override
    public void onError(WebSocket conn, Exception ex) {
        log.error("WebSocket error", ex);
    }
    
    // 辅助方法
    private void sendMessage(WebSocket conn, Message msg) {
        if (conn.isOpen()) {
            conn.send(JsonUtil.toJson(msg));
        }
    }
    
    private void sendAck(WebSocket conn, String action, String channel) {
        sendMessage(conn, new Message("ack", Map.of("action", action, "channel", channel)));
    }
    
    private void sendError(WebSocket conn, String error) {
        sendMessage(conn, new Message("error", Map.of("message", error)));
    }
    
    private void sendPong(WebSocket conn, String id) {
        sendMessage(conn, new Message("pong", Map.of("replyTo", id)));
    }
}
```

### Step 5: 会话和频道管理 (2h)

```java
// server/websocket/WsSessionManager.java

public class WsSessionManager {
    private final Map<WebSocket, WsSession> connToSession = new ConcurrentHashMap<>();
    private final Map<String, WsSession> idToSession = new ConcurrentHashMap<>();
    
    public WsSession createSession(WebSocket conn, TokenInfo tokenInfo) {
        String sessionId = UUID.randomUUID().toString();
        WsSession session = new WsSession(sessionId, conn, tokenInfo);
        
        connToSession.put(conn, session);
        idToSession.put(sessionId, session);
        
        return session;
    }
    
    public WsSession getSession(WebSocket conn) {
        return connToSession.get(conn);
    }
    
    public WsSession getSession(String sessionId) {
        return idToSession.get(sessionId);
    }
    
    public void removeSession(WebSocket conn) {
        WsSession session = connToSession.remove(conn);
        if (session != null) {
            idToSession.remove(session.getId());
        }
    }
    
    public Collection<WsSession> getAllSessions() {
        return idToSession.values();
    }
    
    public List<WsSession> getSessionsByUser(String userId) {
        return idToSession.values().stream()
            .filter(s -> userId.equals(s.getUserId()))
            .collect(Collectors.toList());
    }
}

// server/websocket/ChannelManager.java

public class ChannelManager {
    // channel -> set of session ids
    private final Map<String, Set<String>> channelSubscribers = new ConcurrentHashMap<>();
    // session id -> set of channels
    private final Map<String, Set<String>> sessionChannels = new ConcurrentHashMap<>();
    
    public void subscribe(String sessionId, String channel) {
        channelSubscribers.computeIfAbsent(channel, k -> ConcurrentHashMap.newKeySet())
            .add(sessionId);
        sessionChannels.computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet())
            .add(channel);
    }
    
    public void unsubscribe(String sessionId, String channel) {
        Set<String> subscribers = channelSubscribers.get(channel);
        if (subscribers != null) {
            subscribers.remove(sessionId);
        }
        
        Set<String> channels = sessionChannels.get(sessionId);
        if (channels != null) {
            channels.remove(channel);
        }
    }
    
    public void unsubscribeAll(String sessionId) {
        Set<String> channels = sessionChannels.remove(sessionId);
        if (channels != null) {
            for (String channel : channels) {
                Set<String> subscribers = channelSubscribers.get(channel);
                if (subscribers != null) {
                    subscribers.remove(sessionId);
                }
            }
        }
    }
    
    public Set<String> getSubscribers(String channel) {
        Set<String> subscribers = channelSubscribers.get(channel);
        return subscribers != null ? new HashSet<>(subscribers) : Collections.emptySet();
    }
    
    public Set<String> getChannels(String sessionId) {
        Set<String> channels = sessionChannels.get(sessionId);
        return channels != null ? new HashSet<>(channels) : Collections.emptySet();
    }
}
```

### Step 6: HTTP API Handlers (4h)

```java
// server/handlers/SyncHandler.java

public class SyncHandler implements HttpHandler {
    private final SyncService syncService;
    private final BroadcastService broadcastService;
    
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        
        try {
            // 认证检查
            TokenInfo token = AuthUtil.authenticate(exchange);
            if (token == null) {
                HttpUtil.sendError(exchange, 401, "Unauthorized");
                return;
            }
            
            if ("POST".equals(method) && path.endsWith("/push")) {
                handlePush(exchange, token);
            } else if ("POST".equals(method) && path.endsWith("/pull")) {
                handlePull(exchange, token);
            } else if ("GET".equals(method) && path.endsWith("/status")) {
                handleStatus(exchange);
            } else if ("POST".equals(method) && path.endsWith("/resolve")) {
                handleResolve(exchange, token);
            } else {
                HttpUtil.sendError(exchange, 404, "Not found");
            }
            
        } catch (Exception e) {
            log.error("Sync handler error", e);
            HttpUtil.sendError(exchange, 500, e.getMessage());
        }
    }
    
    private void handlePush(HttpExchange exchange, TokenInfo token) throws IOException {
        PushRequest request = HttpUtil.readBody(exchange, PushRequest.class);
        
        PushResult result = syncService.push(request.getChanges(), token.getDeviceId());
        
        // 广播变更通知
        for (ChangeResult change : result.getResults()) {
            if (change.isSuccess()) {
                broadcastService.broadcast("sync", new Message("sync:change", Map.of(
                    "entityType", change.getEntityType(),
                    "entityId", change.getEntityId(),
                    "action", change.getAction(),
                    "version", change.getNewVersion(),
                    "excludeDevice", token.getDeviceId()
                )));
            }
        }
        
        HttpUtil.sendJson(exchange, 200, result);
    }
    
    private void handlePull(HttpExchange exchange, TokenInfo token) throws IOException {
        PullRequest request = HttpUtil.readBody(exchange, PullRequest.class);
        
        PullResult result = syncService.pull(
            request.getEntityType(),
            request.getSinceVersion(),
            request.getLimit()
        );
        
        HttpUtil.sendJson(exchange, 200, result);
    }
    
    private void handleStatus(HttpExchange exchange) throws IOException {
        SyncStatus status = syncService.getStatus();
        HttpUtil.sendJson(exchange, 200, status);
    }
    
    private void handleResolve(HttpExchange exchange, TokenInfo token) throws IOException {
        ResolveRequest request = HttpUtil.readBody(exchange, ResolveRequest.class);
        
        syncService.resolveConflict(
            request.getConflictId(),
            request.getResolution(),
            request.getMergedData()
        );
        
        HttpUtil.sendJson(exchange, 200, Map.of("success", true));
    }
}
```

```java
// server/handlers/StaticHandler.java

public class StaticHandler implements HttpHandler {
    private final String basePath;
    private final Map<String, String> mimeTypes;
    
    public StaticHandler(String basePath) {
        this.basePath = basePath;
        this.mimeTypes = Map.of(
            "html", "text/html",
            "js", "application/javascript",
            "css", "text/css",
            "json", "application/json",
            "png", "image/png",
            "jpg", "image/jpeg",
            "svg", "image/svg+xml",
            "woff2", "font/woff2"
        );
    }
    
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        
        // 默认文件
        if (path.equals("/") || path.equals("/desktop") || path.equals("/desktop/")) {
            path = "/desktop/index.html";
        } else if (path.equals("/mobile") || path.equals("/mobile/")) {
            path = "/mobile/index.html";
        }
        
        // 安全检查
        if (path.contains("..")) {
            HttpUtil.sendError(exchange, 403, "Forbidden");
            return;
        }
        
        File file = new File(basePath + path);
        
        if (!file.exists() || !file.isFile()) {
            // SPA 路由支持：对于不存在的路径返回 index.html
            if (path.startsWith("/desktop/") && !path.contains(".")) {
                file = new File(basePath + "/desktop/index.html");
            } else if (path.startsWith("/mobile/") && !path.contains(".")) {
                file = new File(basePath + "/mobile/index.html");
            }
            
            if (!file.exists()) {
                HttpUtil.sendError(exchange, 404, "Not found");
                return;
            }
        }
        
        String ext = getExtension(path);
        String mimeType = mimeTypes.getOrDefault(ext, "application/octet-stream");
        
        exchange.getResponseHeaders().set("Content-Type", mimeType);
        exchange.getResponseHeaders().set("Cache-Control", getCacheControl(ext));
        exchange.sendResponseHeaders(200, file.length());
        
        try (OutputStream os = exchange.getResponseBody();
             FileInputStream fis = new FileInputStream(file)) {
            fis.transferTo(os);
        }
    }
    
    private String getExtension(String path) {
        int dot = path.lastIndexOf('.');
        return dot > 0 ? path.substring(dot + 1) : "";
    }
    
    private String getCacheControl(String ext) {
        // HTML 不缓存，其他资源长缓存
        if ("html".equals(ext)) {
            return "no-cache";
        }
        return "public, max-age=31536000";
    }
}
```

### Step 7: 服务端数据库迁移 (2h)

```java
// 服务端专用迁移
public class ServerMigrations {
    public static List<Migration> getMigrations() {
        return List.of(
            new Migration(100, "server_sync_tables", """
                -- 全局版本号
                CREATE TABLE IF NOT EXISTS sync_versions (
                    entity_type TEXT PRIMARY KEY,
                    current_version INTEGER NOT NULL DEFAULT 0,
                    updated_at INTEGER NOT NULL
                );
                
                -- 变更日志
                CREATE TABLE IF NOT EXISTS sync_changelog (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    data TEXT,
                    client_id TEXT,
                    created_at INTEGER NOT NULL
                );
                
                CREATE INDEX IF NOT EXISTS idx_changelog_type_version 
                    ON sync_changelog(entity_type, version);
                CREATE INDEX IF NOT EXISTS idx_changelog_time 
                    ON sync_changelog(created_at);
                
                -- 冲突记录
                CREATE TABLE IF NOT EXISTS sync_conflicts (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    client_data TEXT NOT NULL,
                    server_data TEXT NOT NULL,
                    client_version INTEGER,
                    server_version INTEGER,
                    status TEXT DEFAULT 'pending',
                    resolution TEXT,
                    resolved_data TEXT,
                    created_at INTEGER NOT NULL,
                    resolved_at INTEGER
                );
                
                -- 设备表
                CREATE TABLE IF NOT EXISTS devices (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    device_name TEXT,
                    platform TEXT,
                    token_hash TEXT,
                    registered_at INTEGER NOT NULL,
                    last_seen_at INTEGER,
                    last_sync_at INTEGER
                );
                
                CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
                
                -- 用户目录
                CREATE TABLE IF NOT EXISTS user_directory (
                    user_id TEXT PRIMARY KEY,
                    user_name TEXT NOT NULL,
                    department TEXT,
                    role TEXT DEFAULT 'user',
                    avatar_url TEXT,
                    first_seen_at INTEGER NOT NULL,
                    last_seen_at INTEGER,
                    online INTEGER DEFAULT 0
                );
                
                CREATE INDEX IF NOT EXISTS idx_users_department ON user_directory(department);
                CREATE INDEX IF NOT EXISTS idx_users_online ON user_directory(online);
            """)
        );
    }
}
```

### Step 8: 测试 (2h)

```java
// 测试用例列表

@Test void testPushSingleChange();
@Test void testPushMultipleChanges();
@Test void testPushWithConflict();
@Test void testPullNoChanges();
@Test void testPullWithChanges();
@Test void testPullPagination();
@Test void testWebSocketConnect();
@Test void testWebSocketSubscribe();
@Test void testWebSocketBroadcast();
@Test void testStaticFileServing();
@Test void testSPARouting();
```


## 进度更新

- 2026-02-17 07:35 UTC: 验收标准全部完成，task-001 收口并切换到 task-002-sync-engine。
- 2026-02-17 06:55 UTC: 扩展冒烟脚本覆盖静态文件托管与双客户端并发 push，收口“静态托管正常 / 多客户端并发测试通过”验收项。
- 2026-02-17 06:20 UTC: 新增 `openspec/tests/integration/sync-server-smoke.test.mjs` 冒烟脚本，验证 server 启动、双前缀 sync API、status 接口与 WebSocket `sync-updated` 广播。
- 2026-02-17 04:57 UTC: `/api/sync` 增加 `/api/local/sync` 兼容路由，client/server 两种模式统一支持双前缀访问。
- 2026-02-17 04:49 UTC: 新增 `GET /api/sync/status`，可查看总变更数与各实体最新版本。
- 2026-02-17 04:49 UTC: 修正批量 push 冲突判定基线，避免同批次后续变更被误判冲突。
- 2026-02-17 04:41 UTC: 打通 `/api/sync` -> WebSocket 广播桥，push 后实时下发 `sync-updated` 事件。
- 2026-02-17 04:29 UTC: 新增 `baseVersion` 基线冲突检测，推送接口返回 `conflictDetails` 供客户端重试与提示。
- 2026-02-06 10:52 UTC: 完成 `/api/sync` SQLite 持久化改造，服务重启后可继续按版本增量拉取。
- 2026-02-06 10:26 UTC: 完成 server 模式 `/api/sync` 基础实现（支持 GET 拉取、POST 推送），并保留 client 模式代理转发路径。
- 2026-02-06 10:26 UTC: 已完成配置加载校验与 API 双前缀路由整理，进入后续数据库持久化与冲突处理实现。

## 验收标准

- [x] 服务端正常启动（冒烟脚本）
- [x] HTTP API 全部可用（sync 相关接口冒烟验证）
- [x] WebSocket 连接稳定（单连接冒烟验证）
- [x] 同步推送正确（SQLite 持久化基线）
- [x] 同步拉取正确（SQLite 持久化基线）
- [x] 冲突检测正常（基线版本冲突检测）
- [x] 广播功能正常（WebSocket 基线广播）
- [x] 静态文件托管正常（根路径 HTML 冒烟验证）
- [x] 多客户端并发测试通过（双客户端并发 push 冒烟验证）

## 参考规格

- `specs/03-sync-server.md` - 完整规格
- `specs/04-communication.md` - 通信协议
- `specs/05-database.md` - 数据库结构

## 下一步

完成后进入 `task-002-sync-engine.md` - 客户端同步引擎开发