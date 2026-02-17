package server.handlers;

import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import services.DatabaseService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.net.URLDecoder;
import java.net.URI;

/**
 * 服务端同步处理器（Phase 2 持久化基线实现）。
 *
 * <p>当前阶段目标：
 * 1) 提供 server 模式下可用的 /api/sync 基础接口；
 * 2) 将推送变更持久化到 SQLite，保证服务重启后可拉取历史增量；
 * 3) 保持与后续冲突处理/广播能力兼容的请求结构。
 */
public class SyncServerHandler implements HttpHandler {
    // 用于解析 JSON body 的泛型类型声明。
    private static final Type MAP_TYPE = new TypeToken<Map<String, Object>>() {}.getType();

    private final Config config;
    private final DatabaseService databaseService;

    /**
     * 广播回调：用于将同步结果通知到 WS/SSE 等通道。
     */
    private SyncBroadcastBroadcaster broadcaster;

    /**
     * 同步广播回调接口。
     */
    @FunctionalInterface
    public interface SyncBroadcastBroadcaster {
        void broadcast(String entity, List<Map<String, Object>> accepted, List<Map<String, Object>> conflicts);
    }

    public SyncServerHandler(Config config, DatabaseService databaseService) {
        this.config = config;
        this.databaseService = databaseService;
        // 启动时确保同步日志表存在，避免首次请求才失败。
        initializeSchema();
    }

    /**
     * 注入广播器：由外层服务器在 WebSocket 启动后绑定。
     */
    public void setBroadcaster(SyncBroadcastBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        // 统一处理预检请求，减少前端跨域调用复杂度。
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if (!config.isServerMode()) {
            sendError(exchange, 400, "Sync server API is only available in server mode");
            return;
        }

        try {
            String method = exchange.getRequestMethod();
            URI uri = exchange.getRequestURI();
            String path = uri == null ? "" : uri.getPath();

            // 支持 /api/sync/status 查询服务端同步统计信息。
            if ("GET".equals(method) && path != null && path.endsWith("/status")) {
                handleStatus(exchange);
                return;
            }

            switch (method) {
                case "GET" -> handlePull(exchange);
                case "POST" -> handlePush(exchange);
                default -> sendError(exchange, 405, "Method not allowed");
            }
        } catch (Exception e) {
            sendError(exchange, 500, "Sync handler internal error: " + e.getMessage());
        }
    }

    /**
     * 初始化同步日志表。
     */
    private void initializeSchema() {
        String ddl = """
            CREATE TABLE IF NOT EXISTS sync_change_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entity_type TEXT NOT NULL,
              version INTEGER NOT NULL,
              payload TEXT NOT NULL,
              server_timestamp INTEGER NOT NULL
            )
            """;

        String index = """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_change_log_entity_version
            ON sync_change_log(entity_type, version)
            """;

        try {
            databaseService.execute(ddl, null);
            databaseService.execute(index, null);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to initialize sync schema", e);
        }
    }

    /**
     * 同步状态接口：GET /api/sync/status
     * 返回全局变更量与按实体的最新版本，便于运维与联调观察。
     */
    private void handleStatus(HttpExchange exchange) throws IOException {
        try {
            long totalChanges = queryTotalChanges();
            List<Map<String, Object>> entityVersions = queryEntityVersions();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("status", "ok");
            payload.put("totalChanges", totalChanges);
            payload.put("entityVersions", entityVersions);
            payload.put("serverTime", System.currentTimeMillis());

            sendResponse(exchange, 200, JsonUtil.success(payload));
        } catch (SQLException e) {
            sendError(exchange, 500, "Failed to query sync status: " + e.getMessage());
        }
    }

    /**
     * 处理增量拉取：GET /api/sync?entity=card&since=0&limit=100
     */
    private void handlePull(HttpExchange exchange) throws IOException {
        Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
        String entity = query.getOrDefault("entity", "default");
        long since = parseLongOrDefault(query.get("since"), 0L);
        int limit = (int) parseLongOrDefault(query.get("limit"), 100L);
        int normalizedLimit = Math.max(1, Math.min(limit, 500));

        List<Map<String, Object>> changes;
        try {
            changes = loadChanges(entity, since, normalizedLimit);
        } catch (SQLException e) {
            sendError(exchange, 500, "Failed to load changes: " + e.getMessage());
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("entity", entity);
        payload.put("since", since);
        payload.put("count", changes.size());
        payload.put("changes", changes);
        payload.put("serverTime", System.currentTimeMillis());

        sendResponse(exchange, 200, JsonUtil.success(payload));
    }

    /**
     * 处理变更推送：POST /api/sync
     */
    @SuppressWarnings("unchecked")
    private void handlePush(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, Object> request = JsonUtil.fromJson(body, MAP_TYPE);

        String entity = String.valueOf(request.getOrDefault("entity", "default"));
        Object rawChanges = request.get("changes");

        if (!(rawChanges instanceof List<?> rawList)) {
            sendError(exchange, 400, "Field 'changes' must be an array");
            return;
        }

        // 冲突检测结果与接受结果分开返回，便于客户端执行重试或提示用户。
        Map<String, List<Map<String, Object>>> result;
        try {
            result = appendChanges(entity, rawList);
        } catch (SQLException e) {
            sendError(exchange, 500, "Failed to append changes: " + e.getMessage());
            return;
        }

        List<Map<String, Object>> accepted = result.getOrDefault("accepted", List.of());
        List<Map<String, Object>> conflicts = result.getOrDefault("conflicts", List.of());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("entity", entity);
        payload.put("accepted", accepted.size());
        payload.put("conflicts", conflicts.size());
        payload.put("changes", accepted);
        payload.put("conflictDetails", conflicts);

        // 推送完成后广播同步结果，便于在线客户端即时刷新。
        if (broadcaster != null && (!accepted.isEmpty() || !conflicts.isEmpty())) {
            broadcaster.broadcast(entity, accepted, conflicts);
        }

        sendResponse(exchange, 200, JsonUtil.success(payload));
    }

    /**
     * 将变更批量写入数据库并回填 version/timestamp，同时返回冲突明细。
     *
     * <p>说明：此处使用 synchronized 保证同一 JVM 进程内版本分配连续，
     * 后续若扩展多实例部署，可替换为数据库事务 + 悲观锁策略。
     */
    private synchronized Map<String, List<Map<String, Object>>> appendChanges(String entity, List<?> rawList) throws SQLException {
        List<Map<String, Object>> accepted = new ArrayList<>();
        List<Map<String, Object>> conflicts = new ArrayList<>();

        // 记录请求开始时的服务端版本：用于判断客户端是否基于过期快照提交。
        long initialServerVersion = getCurrentVersion(entity);
        long version = initialServerVersion;

        for (Object item : rawList) {
            if (!(item instanceof Map<?, ?> mapItem)) {
                continue;
            }

            Map<String, Object> incoming = new LinkedHashMap<>();
            mapItem.forEach((k, v) -> incoming.put(String.valueOf(k), v));

            // 基线冲突检测：客户端若携带 baseVersion，且落后于请求开始时的服务端版本，则判定冲突。
            // 说明：这里使用 initialServerVersion，避免同一批次内后续变更被前序写入“误判冲突”。
            long baseVersion = parseLongOrDefault(
                String.valueOf(incoming.getOrDefault("baseVersion", initialServerVersion)),
                initialServerVersion
            );
            if (baseVersion < initialServerVersion) {
                Map<String, Object> conflict = new LinkedHashMap<>();
                conflict.put("reason", "stale_base_version");
                conflict.put("entity", entity);
                conflict.put("serverVersion", initialServerVersion);
                conflict.put("clientBaseVersion", baseVersion);
                conflict.put("change", incoming);
                conflicts.add(conflict);
                continue;
            }

            version += 1;
            long now = System.currentTimeMillis();

            incoming.put("version", version);
            incoming.put("serverTimestamp", now);

            String payloadJson = JsonUtil.toCompactJson(incoming);
            databaseService.execute(
                "INSERT INTO sync_change_log(entity_type, version, payload, server_timestamp) VALUES (?, ?, ?, ?)",
                new Object[]{entity, version, payloadJson, now}
            );

            accepted.add(incoming);
        }

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        result.put("accepted", accepted);
        result.put("conflicts", conflicts);
        return result;
    }

    /**
     * 拉取指定实体在某个版本之后的变更。
     */
    private List<Map<String, Object>> loadChanges(String entity, long since, int limit) throws SQLException {
        List<List<Object>> rows = databaseService.query(
            "SELECT payload FROM sync_change_log WHERE entity_type = ? AND version > ? ORDER BY version ASC LIMIT ?",
            new Object[]{entity, since, limit}
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (List<Object> row : rows) {
            if (row.isEmpty() || row.get(0) == null) {
                continue;
            }

            String payloadJson = String.valueOf(row.get(0));
            Map<String, Object> payload = JsonUtil.fromJson(payloadJson, MAP_TYPE);
            result.add(payload);
        }

        return result;
    }

    /**
     * 查询当前实体的最新版本号。
     */
    private long getCurrentVersion(String entity) throws SQLException {
        List<List<Object>> rows = databaseService.query(
            "SELECT COALESCE(MAX(version), 0) FROM sync_change_log WHERE entity_type = ?",
            new Object[]{entity}
        );

        if (rows.isEmpty() || rows.get(0).isEmpty() || rows.get(0).get(0) == null) {
            return 0L;
        }

        Object value = rows.get(0).get(0);
        if (value instanceof Number number) {
            return number.longValue();
        }

        return parseLongOrDefault(String.valueOf(value), 0L);
    }

    /**
     * 查询同步日志总数。
     */
    private long queryTotalChanges() throws SQLException {
        List<List<Object>> rows = databaseService.query(
            "SELECT COUNT(1) FROM sync_change_log",
            null
        );

        if (rows.isEmpty() || rows.get(0).isEmpty() || rows.get(0).get(0) == null) {
            return 0L;
        }

        Object value = rows.get(0).get(0);
        if (value instanceof Number number) {
            return number.longValue();
        }

        return parseLongOrDefault(String.valueOf(value), 0L);
    }

    /**
     * 查询每个实体类型的最新版本。
     */
    private List<Map<String, Object>> queryEntityVersions() throws SQLException {
        List<List<Object>> rows = databaseService.query(
            "SELECT entity_type, COALESCE(MAX(version), 0) FROM sync_change_log GROUP BY entity_type ORDER BY entity_type ASC",
            null
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (List<Object> row : rows) {
            if (row.size() < 2) {
                continue;
            }

            String entity = String.valueOf(row.get(0));
            long version = parseLongOrDefault(String.valueOf(row.get(1)), 0L);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("entity", entity);
            item.put("latestVersion", version);
            result.add(item);
        }

        return result;
    }

    /**
     * 解析 URL query 参数（包含 URL decode）。
     */
    private Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> query = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return query;
        }

        for (String pair : rawQuery.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                query.put(urlDecode(kv[0]), urlDecode(kv[1]));
            }
        }

        return query;
    }

    /**
     * URL 解码工具方法，失败时返回原值。
     */
    private String urlDecode(String value) {
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return value;
        }
    }

    /**
     * 安全解析 long，解析失败返回默认值。
     */
    private long parseLongOrDefault(String value, long defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        if (config.security().enableCORS()) {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        sendResponse(exchange, statusCode, JsonUtil.error(message));
    }
}
