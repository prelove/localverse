package core.server.handlers;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import core.process.ProcessInstance;
import core.services.ProcessService;
import core.utils.JsonUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * HTTP handler for process engine endpoints
 */
public class ProcessHandler implements HttpHandler {
    private final ProcessService processService;
    
    public ProcessHandler(ProcessService processService) {
        this.processService = processService;
    }
    
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Enable CORS
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
        
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(200, -1);
            return;
        }
        
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        
        try {
            if (path.endsWith("/start") && "POST".equals(method)) {
                handleStartProcess(exchange);
            } else if (path.matches(".*/process/[^/]+/status") && "GET".equals(method)) {
                handleGetStatus(exchange);
            } else if (path.matches(".*/process/[^/]+/cancel") && "POST".equals(method)) {
                handleCancelProcess(exchange);
            } else if (path.endsWith("/list") && "GET".equals(method)) {
                handleListProcesses(exchange);
            } else {
                sendError(exchange, 404, "Not found");
            }
        } catch (Exception e) {
            sendError(exchange, 500, "Internal server error: " + e.getMessage());
        }
    }
    
    private void handleStartProcess(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, Object> request = JsonUtil.fromJson(body);
        
        String definitionId = (String) request.get("definitionId");
        @SuppressWarnings("unchecked")
        Map<String, Object> variables = (Map<String, Object>) request.getOrDefault("variables", Map.of());
        
        if (definitionId == null) {
            sendError(exchange, 400, "Missing definitionId");
            return;
        }
        
        String instanceId = processService.startProcess(definitionId, variables);
        
        Map<String, Object> response = Map.of(
            "success", true,
            "instanceId", instanceId
        );
        
        sendJson(exchange, 200, response);
    }
    
    private void handleGetStatus(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String[] parts = path.split("/");
        String instanceId = parts[parts.length - 2];
        
        ProcessInstance instance = processService.getProcessInstance(instanceId);
        if (instance == null) {
            sendError(exchange, 404, "Process instance not found");
            return;
        }
        
        Map<String, Object> response = Map.of(
            "success", true,
            "process", processService.toMap(instance)
        );
        
        sendJson(exchange, 200, response);
    }
    
    private void handleCancelProcess(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String[] parts = path.split("/");
        String instanceId = parts[parts.length - 2];
        
        boolean cancelled = processService.cancelProcess(instanceId);
        
        Map<String, Object> response = Map.of(
            "success", cancelled,
            "message", cancelled ? "Process cancelled" : "Process not found or not running"
        );
        
        sendJson(exchange, 200, response);
    }
    
    private void handleListProcesses(HttpExchange exchange) throws IOException {
        var processes = processService.listProcesses().stream()
            .map(processService::toMap)
            .toList();
        
        Map<String, Object> response = Map.of(
            "success", true,
            "processes", processes
        );
        
        sendJson(exchange, 200, response);
    }
    
    private void sendJson(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String json = JsonUtil.toJson(data);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
    
    private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        Map<String, Object> error = Map.of(
            "success", false,
            "error", message
        );
        sendJson(exchange, statusCode, error);
    }
}
