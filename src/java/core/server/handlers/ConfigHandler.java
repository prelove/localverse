package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import config.ConfigLoader;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;

/**
 * Configuration handler
 */
public class ConfigHandler implements HttpHandler {
    private Config config;
    private final String configPath;

    public ConfigHandler(Config config, String configPath) {
        this.config = config;
        this.configPath = configPath;
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

        if ("GET".equals(method)) {
            handleGet(exchange);
        } else if ("PUT".equals(method)) {
            handlePut(exchange);
        } else {
            exchange.sendResponseHeaders(405, -1);
        }
    }

    private void handleGet(HttpExchange exchange) throws IOException {
        String jsonResponse = JsonUtil.toPrettyJson(config);
        byte[] bytes = jsonResponse.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);

        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void handlePut(HttpExchange exchange) throws IOException {
        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        
        try {
            // Parse new config
            Config newConfig = JsonUtil.fromJson(body, Config.class);
            
            // Save to file
            ConfigLoader.save(newConfig, Paths.get(configPath));
            
            // Update in memory
            this.config = newConfig;

            String response = JsonUtil.toJson(java.util.Map.of("success", true, "message", "Configuration updated"));
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        } catch (Exception e) {
            String errorResponse = JsonUtil.toJson(java.util.Map.of("error", e.getMessage()));
            byte[] bytes = errorResponse.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(400, bytes.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
}
