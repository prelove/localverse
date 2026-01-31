package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import services.DatabaseService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Database operations handler
 */
public class DatabaseHandler implements HttpHandler {
    private final DatabaseService dbService;

    public DatabaseHandler(DatabaseService dbService) {
        this.dbService = dbService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        
        if ("OPTIONS".equals(method)) {
            addCorsHeaders(exchange);
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        addCorsHeaders(exchange);

        if (!"POST".equals(method)) {
            exchange.sendResponseHeaders(405, -1);
            return;
        }

        try {
            String path = exchange.getRequestURI().getPath();
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            
            String response;
            if (path.endsWith("/query")) {
                response = handleQuery(body);
            } else if (path.endsWith("/exec")) {
                response = handleExec(body);
            } else {
                sendErrorResponse(exchange, 404, "Not found");
                return;
            }

            sendJsonResponse(exchange, 200, response);
        } catch (Exception e) {
            sendErrorResponse(exchange, 500, e.getMessage());
        }
    }

    private String handleQuery(String body) {
        Map<String, Object> request = JsonUtil.fromJson(body, Map.class);
        String sql = (String) request.get("sql");
        Object[] params = request.containsKey("params") ? 
            ((java.util.List<?>) request.get("params")).toArray() : new Object[0];
        
        return dbService.query(sql, params);
    }

    private String handleExec(String body) {
        Map<String, Object> request = JsonUtil.fromJson(body, Map.class);
        String sql = (String) request.get("sql");
        Object[] params = request.containsKey("params") ? 
            ((java.util.List<?>) request.get("params")).toArray() : new Object[0];
        
        return dbService.execute(sql, params);
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void sendErrorResponse(HttpExchange exchange, int statusCode, String message) throws IOException {
        String json = JsonUtil.toJson(Map.of("error", message));
        sendJsonResponse(exchange, statusCode, json);
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
}
