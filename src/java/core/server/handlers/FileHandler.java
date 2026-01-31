package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import models.FileInfo;
import services.FileSystemService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * File operations handler
 */
public class FileHandler implements HttpHandler {
    private final FileSystemService fileService;

    public FileHandler(FileSystemService fileService) {
        this.fileService = fileService;
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
            switch (method) {
                case "GET" -> handleGet(exchange);
                case "POST" -> handlePost(exchange);
                case "PUT" -> handlePut(exchange);
                case "DELETE" -> handleDelete(exchange);
                default -> exchange.sendResponseHeaders(405, -1);
            }
        } catch (Exception e) {
            sendErrorResponse(exchange, 500, e.getMessage());
        }
    }

    private void handleGet(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String query = exchange.getRequestURI().getQuery();

        // Check if it's a list request
        if (path.equals("/api/local/files") || path.equals("/api/local/files/")) {
            // List directory
            String dirPath = parseQueryParam(query, "path", ".");
            boolean recursive = "true".equals(parseQueryParam(query, "recursive", "false"));

            List<FileInfo> files = fileService.listDirectory(dirPath, recursive);
            String response = JsonUtil.toJson(Map.of("files", files));
            sendJsonResponse(exchange, 200, response);
        } else {
            // Read file
            String filePath = path.substring("/api/local/files/".length());
            filePath = URLDecoder.decode(filePath, StandardCharsets.UTF_8);

            byte[] content = fileService.readFile(filePath);
            
            exchange.getResponseHeaders().set("Content-Type", "application/octet-stream");
            exchange.sendResponseHeaders(200, content.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(content);
            }
        }
    }

    private void handlePost(HttpExchange exchange) throws IOException {
        // Upload/create file
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, Object> request = JsonUtil.fromJson(body, Map.class);

        String filePath = (String) request.get("path");
        if (filePath == null || filePath.isEmpty()) {
            sendErrorResponse(exchange, 400, "Missing required parameter: path");
            return;
        }
        
        String contentStr = (String) request.get("content");
        byte[] content = contentStr != null ? contentStr.getBytes(StandardCharsets.UTF_8) : new byte[0];

        fileService.writeFile(filePath, content);

        String response = JsonUtil.toJson(Map.of("success", true, "path", filePath));
        sendJsonResponse(exchange, 200, response);
    }

    private void handlePut(HttpExchange exchange) throws IOException {
        // Update file
        String path = exchange.getRequestURI().getPath();
        String filePath = path.substring("/api/local/files/".length());
        filePath = URLDecoder.decode(filePath, StandardCharsets.UTF_8);

        byte[] content = exchange.getRequestBody().readAllBytes();
        fileService.writeFile(filePath, content);

        String response = JsonUtil.toJson(Map.of("success", true, "path", filePath));
        sendJsonResponse(exchange, 200, response);
    }

    private void handleDelete(HttpExchange exchange) throws IOException {
        // Delete file
        String path = exchange.getRequestURI().getPath();
        String filePath = path.substring("/api/local/files/".length());
        filePath = URLDecoder.decode(filePath, StandardCharsets.UTF_8);

        fileService.delete(filePath);

        String response = JsonUtil.toJson(Map.of("success", true, "path", filePath));
        sendJsonResponse(exchange, 200, response);
    }

    private String parseQueryParam(String query, String param, String defaultValue) {
        if (query == null) return defaultValue;
        
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            String[] keyValue = pair.split("=", 2);
            if (keyValue.length == 2 && keyValue[0].equals(param)) {
                return URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8);
            }
        }
        return defaultValue;
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
