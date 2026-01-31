package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Health check handler
 */
public class HealthHandler implements HttpHandler {
    private final long startTime;
    private final String version;
    private final String mode;

    public HealthHandler(String version, String mode) {
        this.startTime = System.currentTimeMillis();
        this.version = version;
        this.mode = mode;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if ("GET".equals(exchange.getRequestMethod())) {
            long uptime = (System.currentTimeMillis() - startTime) / 1000;
            
            Map<String, Object> response = Map.of(
                "status", "ok",
                "version", version,
                "uptime", uptime,
                "mode", mode
            );

            String jsonResponse = JsonUtil.toJson(response);
            byte[] bytes = jsonResponse.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            addCorsHeaders(exchange);
            exchange.sendResponseHeaders(200, bytes.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        } else if ("OPTIONS".equals(exchange.getRequestMethod())) {
            addCorsHeaders(exchange);
            exchange.sendResponseHeaders(204, -1);
        } else {
            exchange.sendResponseHeaders(405, -1);
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
}
