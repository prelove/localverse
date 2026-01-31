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
 * 配置处理器
 */
public class ConfigHandler implements HttpHandler {
    private final Config config;

    public ConfigHandler(Config config) {
        this.config = config;
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

        try {
            switch (method) {
                case "GET" -> handleGet(exchange);
                case "PUT" -> handlePut(exchange);
                default -> sendError(exchange, 405, "Method not allowed");
            }
        } catch (Exception e) {
            sendError(exchange, 500, "Internal error: " + e.getMessage());
        }
    }

    private void handleGet(HttpExchange exchange) throws IOException {
        // 返回配置（不包含敏感信息）
        Map<String, Object> safeConfig = Map.of(
            "mode", config.mode(),
            "httpPort", config.isClientMode() ? config.client().httpPort() : config.server().httpPort(),
            "wsPort", config.isClientMode() ? config.client().wsPort() : config.server().wsPort(),
            "syncEnabled", config.isClientMode() ? config.client().syncEnabled() : false,
            "version", Version.VERSION
        );

        String response = JsonUtil.success(safeConfig);
        sendResponse(exchange, 200, response);
    }

    private void handlePut(HttpExchange exchange) throws IOException {
        // 配置更新暂不实现
        sendError(exchange, 501, "Configuration update not implemented");
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
