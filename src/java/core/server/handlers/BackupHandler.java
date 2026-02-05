package server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import services.BackupService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 备份与恢复 API 处理器
 * 
 * API 端点：
 * - POST /api/local/backup        创建备份
 * - POST /api/local/backup/restore 恢复备份
 * - GET  /api/local/backup/list   列出备份
 * - GET  /api/local/backup/validate 验证备份
 * - DELETE /api/local/backup      删除备份
 */
public class BackupHandler implements HttpHandler {
    private final BackupService backupService;

    public BackupHandler(BackupService backupService) {
        this.backupService = backupService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        
        try {
            // CORS headers
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if (method.equals("OPTIONS")) {
                sendResponse(exchange, 200, "{}");
                return;
            }

            Map<String, Object> response;

            if (path.endsWith("/backup/list")) {
                response = handleList(exchange);
            } else if (path.endsWith("/backup/restore")) {
                response = handleRestore(exchange);
            } else if (path.endsWith("/backup/validate")) {
                response = handleValidate(exchange);
            } else if (path.endsWith("/backup")) {
                if (method.equals("POST")) {
                    response = handleCreate(exchange);
                } else if (method.equals("DELETE")) {
                    response = handleDelete(exchange);
                } else {
                    response = errorResponse("Method not allowed");
                    sendResponse(exchange, 405, JsonUtil.toJson(response));
                    return;
                }
            } else {
                response = errorResponse("Not found");
                sendResponse(exchange, 404, JsonUtil.toJson(response));
                return;
            }

            sendResponse(exchange, 200, JsonUtil.toJson(response));

        } catch (Exception e) {
            System.err.println("Backup handler error: " + e.getMessage());
            e.printStackTrace();
            
            Map<String, Object> error = errorResponse(e.getMessage());
            sendResponse(exchange, 500, JsonUtil.toJson(error));
        }
    }

    /**
     * 创建备份
     */
    private Map<String, Object> handleCreate(HttpExchange exchange) throws Exception {
        String body = new String(exchange.getRequestBody().readAllBytes(), "UTF-8");
        @SuppressWarnings("unchecked")
        Map<String, Object> request = JsonUtil.fromJson(body, Map.class);
        
        String description = (String) request.getOrDefault("description", "");
        
        return backupService.createBackup(description);
    }

    /**
     * 恢复备份
     */
    private Map<String, Object> handleRestore(HttpExchange exchange) throws Exception {
        String body = new String(exchange.getRequestBody().readAllBytes(), "UTF-8");
        @SuppressWarnings("unchecked")
        Map<String, Object> request = JsonUtil.fromJson(body, Map.class);
        
        String fileName = (String) request.get("file_name");
        if (fileName == null || fileName.isEmpty()) {
            throw new IllegalArgumentException("file_name is required");
        }
        
        return backupService.restoreBackup(fileName);
    }

    /**
     * 列出所有备份
     */
    private Map<String, Object> handleList(HttpExchange exchange) throws Exception {
        List<Map<String, Object>> backups = backupService.listBackups();
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("backups", backups);
        response.put("count", backups.size());
        
        return response;
    }

    /**
     * 验证备份文件
     */
    private Map<String, Object> handleValidate(HttpExchange exchange) throws Exception {
        String query = exchange.getRequestURI().getQuery();
        if (query == null || !query.startsWith("file_name=")) {
            throw new IllegalArgumentException("file_name query parameter is required");
        }
        
        String fileName = query.substring("file_name=".length());
        return backupService.validateBackup(fileName);
    }

    /**
     * 删除备份
     */
    private Map<String, Object> handleDelete(HttpExchange exchange) throws Exception {
        String query = exchange.getRequestURI().getQuery();
        if (query == null || !query.startsWith("file_name=")) {
            throw new IllegalArgumentException("file_name query parameter is required");
        }
        
        String fileName = query.substring("file_name=".length());
        boolean deleted = backupService.deleteBackup(fileName);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", deleted);
        response.put("file_name", fileName);
        
        return response;
    }

    /**
     * 发送 HTTP 响应
     */
    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        byte[] bytes = response.getBytes("UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    /**
     * 创建错误响应
     */
    private Map<String, Object> errorResponse(String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("success", false);
        error.put("error", message);
        return error;
    }
}
