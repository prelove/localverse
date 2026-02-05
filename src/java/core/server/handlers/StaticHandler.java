package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import config.Config;

import java.io.*;
import java.net.URLDecoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Static file handler for serving frontend files
 */
public class StaticHandler implements HttpHandler {
    private final Path webRoot;
    private final Config config;
    
    // MIME types mapping
    private static final java.util.Map<String, String> MIME_TYPES = new java.util.HashMap<>();
    static {
        MIME_TYPES.put(".html", "text/html");
        MIME_TYPES.put(".js", "application/javascript");
        MIME_TYPES.put(".mjs", "application/javascript");
        MIME_TYPES.put(".css", "text/css");
        MIME_TYPES.put(".json", "application/json");
        MIME_TYPES.put(".png", "image/png");
        MIME_TYPES.put(".jpg", "image/jpeg");
        MIME_TYPES.put(".jpeg", "image/jpeg");
        MIME_TYPES.put(".gif", "image/gif");
        MIME_TYPES.put(".svg", "image/svg+xml");
        MIME_TYPES.put(".ico", "image/x-icon");
        MIME_TYPES.put(".woff", "font/woff");
        MIME_TYPES.put(".woff2", "font/woff2");
        MIME_TYPES.put(".ttf", "font/ttf");
        MIME_TYPES.put(".otf", "font/otf");
        MIME_TYPES.put(".eot", "application/vnd.ms-fontobject");
        MIME_TYPES.put(".map", "application/json");
    }

    public StaticHandler(Config config) {
        this.config = config;
        // 从前端目录加载，支持多种路径
        this.webRoot = resolveWebRoot();
        System.out.println("Static file root: " + webRoot.toAbsolutePath());
    }
    
    private Path resolveWebRoot() {
        // 尝试多种路径
        String[] possiblePaths = {
            // 相对于 JAR 的路径
            "src/frontend/desktop",
            "../src/frontend/desktop",
            "../../src/frontend/desktop",
            // 相对于工作目录
            "./src/frontend/desktop",
            // 绝对路径环境变量
            System.getenv("LOCALVERSE_WEB_ROOT")
        };
        
        for (String path : possiblePaths) {
            if (path == null) continue;
            Path p = Paths.get(path).toAbsolutePath().normalize();
            if (Files.exists(p) && Files.exists(p.resolve("index.html"))) {
                System.out.println("✓ Found web root at: " + p);
                return p;
            }
        }
        
        // 默认路径
        Path defaultPath = Paths.get("src/frontend/desktop").toAbsolutePath();
        System.out.println("⚠ Web root not found, using default: " + defaultPath);
        return defaultPath;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Add CORS headers for all responses
        addCorsHeaders(exchange);
        
        // Handle OPTIONS
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }
        
        // Only handle GET
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method not allowed");
            return;
        }

        try {
            String path = exchange.getRequestURI().getPath();
            
            // Decode URL
            path = URLDecoder.decode(path, "UTF-8");
            
            // Default to index.html
            if (path.equals("/") || path.isEmpty()) {
                path = "/index.html";
            }
            
            // Security: prevent directory traversal
            if (path.contains("..") || path.contains("~")) {
                sendError(exchange, 403, "Forbidden");
                return;
            }
            
            // Remove leading slash
            if (path.startsWith("/")) {
                path = path.substring(1);
            }
            
            Path filePath = webRoot.resolve(path).normalize();
            
            // Security check: ensure file is within web root
            if (!filePath.startsWith(webRoot)) {
                sendError(exchange, 403, "Forbidden");
                return;
            }
            
            // Check if file exists and is readable
            if (!Files.exists(filePath) || !Files.isReadable(filePath) || Files.isDirectory(filePath)) {
                // Try to serve index.html for SPA routing
                Path indexPath = webRoot.resolve("index.html");
                if (Files.exists(indexPath)) {
                    serveFile(exchange, indexPath);
                    return;
                }
                sendError(exchange, 404, "File not found: " + path);
                return;
            }
            
            serveFile(exchange, filePath);
            
        } catch (Exception e) {
            System.err.println("Error serving static file: " + e.getMessage());
            sendError(exchange, 500, "Internal server error");
        }
    }
    
    private void serveFile(HttpExchange exchange, Path filePath) throws IOException {
        String fileName = filePath.getFileName().toString();
        String ext = fileName.substring(fileName.lastIndexOf('.'));
        String contentType = MIME_TYPES.getOrDefault(ext.toLowerCase(), "application/octet-stream");
        
        byte[] content = Files.readAllBytes(filePath);
        
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "no-cache"); // Disable caching for development
        
        // Special handling for ES6 modules
        if (fileName.endsWith(".js") || fileName.endsWith(".mjs")) {
            exchange.getResponseHeaders().set("Content-Type", "application/javascript; charset=utf-8");
        }
        
        exchange.sendResponseHeaders(200, content.length);
        
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(content);
        }
    }
    
    private void addCorsHeaders(HttpExchange exchange) {
        if (config.security() != null && config.security().enableCORS()) {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
        }
    }
    
    private void sendError(HttpExchange exchange, int code, String message) throws IOException {
        String html = "<html><body><h1>" + code + " " + message + "</h1></body></html>";
        byte[] bytes = html.getBytes();
        exchange.getResponseHeaders().set("Content-Type", "text/html");
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
