package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import services.ProxyService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Proxy handler for forwarding requests to Sync Server
 */
public class ProxyHandler implements HttpHandler {
    private final ProxyService proxyService;

    public ProxyHandler(ProxyService proxyService) {
        this.proxyService = proxyService;
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

        try {
            // Extract path after /api/sync/
            String fullPath = exchange.getRequestURI().getPath();
            String proxyPath = fullPath.substring("/api/sync".length());
            
            // Get query string if present
            String query = exchange.getRequestURI().getQuery();
            if (query != null) {
                proxyPath += "?" + query;
            }

            // Extract headers
            Map<String, String> headers = new HashMap<>();
            exchange.getRequestHeaders().forEach((key, values) -> {
                if (!values.isEmpty()) {
                    headers.put(key, values.get(0));
                }
            });

            ProxyService.ProxyResponse response;

            switch (method) {
                case "GET" -> response = proxyService.forwardGet(proxyPath, headers);
                case "POST" -> {
                    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    response = proxyService.forwardPost(proxyPath, body, headers);
                }
                case "PUT" -> {
                    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    response = proxyService.forwardPut(proxyPath, body, headers);
                }
                case "DELETE" -> response = proxyService.forwardDelete(proxyPath, headers);
                default -> {
                    exchange.sendResponseHeaders(405, -1);
                    return;
                }
            }

            // Forward response headers
            response.headers().forEach((key, values) -> {
                if (!key.equalsIgnoreCase("Transfer-Encoding") && 
                    !key.equalsIgnoreCase("Content-Length")) {
                    for (String value : values) {
                        exchange.getResponseHeaders().add(key, value);
                    }
                }
            });

            // Send response
            byte[] responseBytes = response.body().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(response.statusCode(), responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            sendErrorResponse(exchange, 500, "Request interrupted");
        } catch (Exception e) {
            sendErrorResponse(exchange, 502, "Sync server unavailable: " + e.getMessage());
        }
    }

    private void sendErrorResponse(HttpExchange exchange, int statusCode, String message) throws IOException {
        String json = JsonUtil.toJson(Map.of("error", message));
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
}
