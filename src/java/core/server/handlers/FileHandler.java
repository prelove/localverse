package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;
import services.FileSystemService;
import services.FileSystemService.FileInfo;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 文件处理器
 */
public class FileHandler implements HttpHandler {
    private final Config config;
    private final FileSystemService fileSystemService;

    public FileHandler(Config config, FileSystemService fileSystemService) {
        this.config = config;
        this.fileSystemService = fileSystemService;
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
            switch (method) {
                case "GET" -> handleGet(exchange, path);
                case "POST" -> handlePost(exchange, path);
                case "PUT" -> handlePut(exchange, path);
                case "DELETE" -> handleDelete(exchange, path);
                default -> sendError(exchange, 405, "Method not allowed");
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendError(exchange, 500, "Internal error: " + e.getMessage());
        }
    }

    /**
     * GET - 列出目录或读取文件
     */
    private void handleGet(HttpExchange exchange, String path) throws IOException {
        // 解析查询参数
        String query = exchange.getRequestURI().getQuery();
        String targetPath = parsePathParameter(query);

        if (targetPath == null || targetPath.isEmpty()) {
            sendError(exchange, 400, "Missing 'path' parameter");
            return;
        }

        targetPath = URLDecoder.decode(targetPath, StandardCharsets.UTF_8);

        try {
            FileInfo fileInfo = fileSystemService.getFileInfo(targetPath);

            if (fileInfo.isDirectory()) {
                // 列出目录
                boolean recursive = query != null && query.contains("recursive=true");
                List<FileInfo> files = fileSystemService.listDirectory(targetPath, recursive);
                
                Map<String, Object> result = Map.of("files", files);
                String response = JsonUtil.success(result);
                sendResponse(exchange, 200, response);
            } else {
                // 读取文件内容
                byte[] content = fileSystemService.readFile(targetPath);
                
                // 根据文件类型设置 Content-Type
                String contentType = guessContentType(fileInfo.name());
                exchange.getResponseHeaders().set("Content-Type", contentType);
                
                exchange.sendResponseHeaders(200, content.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(content);
                }
            }
        } catch (IOException e) {
            sendError(exchange, 400, e.getMessage());
        }
    }

    /**
     * POST - 上传文件
     */
    private void handlePost(HttpExchange exchange, String path) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        String targetPath = parsePathParameter(query);

        if (targetPath == null || targetPath.isEmpty()) {
            sendError(exchange, 400, "Missing 'path' parameter");
            return;
        }

        targetPath = URLDecoder.decode(targetPath, StandardCharsets.UTF_8);

        try {
            byte[] content = exchange.getRequestBody().readAllBytes();
            fileSystemService.writeFile(targetPath, content);
            
            String response = JsonUtil.success(Map.of("message", "File uploaded successfully"));
            sendResponse(exchange, 200, response);
        } catch (IOException e) {
            sendError(exchange, 400, e.getMessage());
        }
    }

    /**
     * PUT - 更新文件
     */
    private void handlePut(HttpExchange exchange, String path) throws IOException {
        // PUT 与 POST 行为相同
        handlePost(exchange, path);
    }

    /**
     * DELETE - 删除文件
     */
    private void handleDelete(HttpExchange exchange, String path) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        String targetPath = parsePathParameter(query);

        if (targetPath == null || targetPath.isEmpty()) {
            sendError(exchange, 400, "Missing 'path' parameter");
            return;
        }

        targetPath = URLDecoder.decode(targetPath, StandardCharsets.UTF_8);

        try {
            fileSystemService.delete(targetPath);
            
            String response = JsonUtil.success(Map.of("message", "File deleted successfully"));
            sendResponse(exchange, 200, response);
        } catch (IOException e) {
            sendError(exchange, 400, e.getMessage());
        }
    }

    /**
     * 解析 path 参数
     */
    private String parsePathParameter(String query) {
        if (query == null) {
            return null;
        }

        String[] pairs = query.split("&");
        for (String pair : pairs) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && "path".equals(kv[0])) {
                return kv[1];
            }
        }

        return null;
    }

    /**
     * 猜测内容类型
     */
    private String guessContentType(String filename) {
        String lower = filename.toLowerCase();
        
        if (lower.endsWith(".html") || lower.endsWith(".htm")) {
            return "text/html; charset=UTF-8";
        } else if (lower.endsWith(".css")) {
            return "text/css; charset=UTF-8";
        } else if (lower.endsWith(".js")) {
            return "application/javascript; charset=UTF-8";
        } else if (lower.endsWith(".json")) {
            return "application/json; charset=UTF-8";
        } else if (lower.endsWith(".txt")) {
            return "text/plain; charset=UTF-8";
        } else if (lower.endsWith(".png")) {
            return "image/png";
        } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (lower.endsWith(".gif")) {
            return "image/gif";
        } else if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        } else {
            return "application/octet-stream";
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
