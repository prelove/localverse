package server.handlers;

import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 服务端同步处理器（Phase 2 初始实现）。
 *
 * <p>当前阶段目标：
 * 1) 提供 server 模式下可用的 /api/sync 基础接口，避免仅有 client 代理时的空路由问题。
 * 2) 给后续真正数据库驱动的同步逻辑保留稳定的请求/响应结构。
 */
public class SyncServerHandler implements HttpHandler {
    // 用于解析 JSON body 的泛型类型声明。
    private static final Type MAP_TYPE = new TypeToken<Map<String, Object>>() {}.getType();

    private final Config config;

    /**
     * 使用线程安全容器临时保存变更日志。
     * key: 实体类型（如 card/task）
     * value: 按时间追加的变更列表
     */
    private final Map<String, List<Map<String, Object>>> changeLogByEntity = new ConcurrentHashMap<>();

    public SyncServerHandler(Config config) {
        this.config = config;
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
     * 处理增量拉取：GET /api/sync?entity=card&since=0&limit=100
     */
    private void handlePull(HttpExchange exchange) throws IOException {
        Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
        String entity = query.getOrDefault("entity", "default");
        long since = parseLongOrDefault(query.get("since"), 0L);
        int limit = (int) parseLongOrDefault(query.get("limit"), 100L);

        List<Map<String, Object>> allChanges = changeLogByEntity.getOrDefault(entity, List.of());
        List<Map<String, Object>> filtered = new ArrayList<>();

        // 线性过滤 since + limit，先保证语义正确，后续可替换为数据库分页。
        for (Map<String, Object> change : allChanges) {
            long version = parseLongOrDefault(String.valueOf(change.getOrDefault("version", 0)), 0L);
            if (version > since) {
                filtered.add(change);
            }
            if (filtered.size() >= Math.max(1, limit)) {
                break;
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("entity", entity);
        payload.put("since", since);
        payload.put("count", filtered.size());
        payload.put("changes", filtered);
        payload.put("serverTime", System.currentTimeMillis());

        sendResponse(exchange, 200, JsonUtil.success(payload));
    }

    /**
     * 处理变更推送：POST /api/sync
     * body 示例：
     * {
     *   "entity": "card",
     *   "changes": [{"id":"1","op":"upsert","data":{...}}]
     * }
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

        List<Map<String, Object>> normalized = new ArrayList<>();
        List<Map<String, Object>> current = changeLogByEntity.computeIfAbsent(entity, ignored -> new ArrayList<>());

        synchronized (current) {
            long baseVersion = current.size();

            for (int i = 0; i < rawList.size(); i++) {
                Object item = rawList.get(i);
                if (!(item instanceof Map<?, ?> mapItem)) {
                    continue;
                }

                Map<String, Object> change = new LinkedHashMap<>();
                mapItem.forEach((k, v) -> change.put(String.valueOf(k), v));

                // 统一补齐服务端写入的元信息，便于后续冲突处理和排序。
                change.put("version", baseVersion + i + 1);
                change.put("serverTimestamp", System.currentTimeMillis());

                current.add(change);
                normalized.add(change);
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("entity", entity);
        payload.put("accepted", normalized.size());
        payload.put("changes", normalized);

        sendResponse(exchange, 200, JsonUtil.success(payload));
    }

    /**
     * 解析 URL query 参数。
     */
    private Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> query = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return query;
        }

        for (String pair : rawQuery.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                query.put(kv[0], kv[1]);
            }
        }

        return query;
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
