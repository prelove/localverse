package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import services.ProxyService;
import services.ProxyService.ProxyResponse;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 代理处理器 - 转发到 Sync Server
 */
public class ProxyHandler implements HttpHandler {
    private final Config config;
    private final ProxyService proxyService;

    public ProxyHandler(Config config, ProxyService proxyService) {
        this.config = config;
        this.proxyService = proxyService;
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

        // 检查同步是否启用
        if (!config.client().syncEnabled()) {
            sendError(exchange, 503, "Sync is disabled");
            return;
        }

        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        
        try {
            // 提取请求头
            Map<String, String> headers = extractHeaders(exchange);
            
            // 转发请求
            ProxyResponse response = switch (method) {
                case "GET" -> proxyService.forwardGet(path, headers);
                case "POST" -> {
                    byte[] body = exchange.getRequestBody().readAllBytes();
                    yield proxyService.forwardPost(path, headers, body);
                }
                case "PUT" -> {
                    byte[] body = exchange.getRequestBody().readAllBytes();
                    yield proxyService.forwardPut(path, headers, body);
                }
                case "DELETE" -> proxyService.forwardDelete(path, headers);
                default -> throw new IOException("Unsupported method: " + method);
            };

            // 返回响应
            forwardResponse(exchange, response);

        } catch (IOException e) {
            e.printStackTrace();
            sendError(exchange, 502, "Proxy error: " + e.getMessage());
        }
    }

    /**
     * 提取请求头
     */
    private Map<String, String> extractHeaders(HttpExchange exchange) {
        Map<String, String> headers = new HashMap<>();
        
        exchange.getRequestHeaders().forEach((key, values) -> {
            if (!values.isEmpty()) {
                // 跳过某些不应转发的头
                if (!key.equalsIgnoreCase("Host") && 
                    !key.equalsIgnoreCase("Connection")) {
                    headers.put(key, values.get(0));
                }
            }
        });
        
        return headers;
    }

    /**
     * 转发响应
     */
    private void forwardResponse(HttpExchange exchange, ProxyResponse response) 
            throws IOException {
        // 设置响应头
        response.headers().forEach((key, values) -> {
            if (!values.isEmpty()) {
                // 跳过某些不应设置的头
                if (!key.equalsIgnoreCase("Transfer-Encoding") &&
                    !key.equalsIgnoreCase("Content-Length")) {
                    exchange.getResponseHeaders().set(key, values.get(0));
                }
            }
        });

        // 发送响应
        byte[] body = response.body();
        exchange.sendResponseHeaders(response.statusCode(), body.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(body);
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

    private void sendError(HttpExchange exchange, int statusCode, String message) 
            throws IOException {
        String response = "{\"success\":false,\"message\":\"" + message + "\"}";
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        byte[] bytes = response.getBytes("UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
