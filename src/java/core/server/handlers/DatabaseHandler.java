package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import services.DatabaseService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 数据库处理器
 */
public class DatabaseHandler implements HttpHandler {
    private final Config config;
    private final DatabaseService databaseService;

    public DatabaseHandler(Config config, DatabaseService databaseService) {
        this.config = config;
        this.databaseService = databaseService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // CORS 处理
        addCorsHeaders(exchange);

        // OPTIONS 请求直接返回
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();

        try {
            if (!"POST".equals(method)) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }

            if (path.endsWith("/query")) {
                handleQuery(exchange);
            } else if (path.endsWith("/exec")) {
                handleExec(exchange);
            } else {
                sendError(exchange, 404, "Not found");
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendError(exchange, 500, "Internal error: " + e.getMessage());
        }
    }

    /**
     * 处理查询请求
     */
    private void handleQuery(HttpExchange exchange) throws IOException {
        try {
            // 读取请求体
            String body = new String(exchange.getRequestBody().readAllBytes(), 
                                    StandardCharsets.UTF_8);
            
            Map<String, Object> request = JsonUtil.fromJson(body, Map.class);
            
            String sql = (String) request.get("sql");
            List<Object> paramsList = (List<Object>) request.get("params");
            Object[] params = paramsList != null ? paramsList.toArray() : new Object[0];

            if (sql == null || sql.isEmpty()) {
                sendError(exchange, 400, "Missing 'sql' parameter");
                return;
            }

            // 执行查询
            List<List<Object>> rows = databaseService.query(sql, params);
            
            Map<String, Object> result = Map.of(
                "rows", rows,
                "rowCount", rows.size()
            );

            String response = JsonUtil.success(result);
            sendResponse(exchange, 200, response);

        } catch (Exception e) {
            sendError(exchange, 400, "Query failed: " + e.getMessage());
        }
    }

    /**
     * 处理执行请求
     */
    private void handleExec(HttpExchange exchange) throws IOException {
        try {
            // 读取请求体
            String body = new String(exchange.getRequestBody().readAllBytes(), 
                                    StandardCharsets.UTF_8);
            
            Map<String, Object> request = JsonUtil.fromJson(body, Map.class);
            
            String sql = (String) request.get("sql");
            List<Object> paramsList = (List<Object>) request.get("params");
            Object[] params = paramsList != null ? paramsList.toArray() : new Object[0];

            if (sql == null || sql.isEmpty()) {
                sendError(exchange, 400, "Missing 'sql' parameter");
                return;
            }

            // 执行语句
            int affected = databaseService.execute(sql, params);
            
            Map<String, Object> result = Map.of(
                "affectedRows", affected,
                "message", "Execution successful"
            );

            String response = JsonUtil.success(result);
            sendResponse(exchange, 200, response);

        } catch (Exception e) {
            sendError(exchange, 400, "Execution failed: " + e.getMessage());
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        if (config.security().enableCORS()) {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", 
                "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", 
                "Content-Type, Authorization");
        }
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String response) 
            throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        byte[] bytes = response.getBytes("UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void sendError(HttpExchange exchange, int statusCode, String message) 
            throws IOException {
        String response = JsonUtil.error(message);
        sendResponse(exchange, statusCode, response);
    }
}
