package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import utils.JsonUtil;
import utils.Version;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;

/**
 * 健康检查处理器
 */
public class HealthHandler implements HttpHandler {
    private final Config config;
    private final long startTime;

    public HealthHandler(Config config) {
        this.config = config;
        this.startTime = System.currentTimeMillis();
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

        // 只支持 GET
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method not allowed");
            return;
        }

        try {
            // 计算运行时间
            long uptime = (System.currentTimeMillis() - startTime) / 1000;

            Map<String, Object> health = Map.of(
                "status", "ok",
                "version", Version.VERSION,
                "uptime", uptime,
                "mode", config.mode(),
                "timestamp", System.currentTimeMillis()
            );

            String response = JsonUtil.success(health);
            sendResponse(exchange, 200, response);

        } catch (Exception e) {
            sendError(exchange, 500, "Internal error: " + e.getMessage());
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
