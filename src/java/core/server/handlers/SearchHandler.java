package server.handlers;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import services.SearchService;
import utils.JsonUtil;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * HTTP handler for search operations
 * Endpoints:
 * - POST /api/local/search - Global search
 * - POST /api/local/search/cards - Search cards
 * - POST /api/local/search/tasks - Search tasks
 * - POST /api/local/search/files - Search files
 * - POST /api/local/search/chat - Search chat messages
 * - POST /api/local/search/reindex - Reindex FTS tables
 * - GET /api/local/search/stats - Get index statistics
 * - GET /api/local/search/suggestions?prefix=xxx - Get search suggestions
 * - GET /api/local/search/history - Get search history
 * - DELETE /api/local/search/history - Clear search history
 */
public class SearchHandler implements HttpHandler {
    private final SearchService searchService;
    private final Gson gson;

    public SearchHandler(SearchService searchService) {
        this.searchService = searchService;
        this.gson = new Gson();
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        
        try {
            if ("OPTIONS".equals(method)) {
                handleOptions(exchange);
                return;
            }

            // Route to specific handler based on path
            if (path.endsWith("/search/cards") && "POST".equals(method)) {
                handleSearchCards(exchange);
            } else if (path.endsWith("/search/tasks") && "POST".equals(method)) {
                handleSearchTasks(exchange);
            } else if (path.endsWith("/search/files") && "POST".equals(method)) {
                handleSearchFiles(exchange);
            } else if (path.endsWith("/search/chat") && "POST".equals(method)) {
                handleSearchChat(exchange);
            } else if (path.endsWith("/search/reindex") && "POST".equals(method)) {
                handleReindex(exchange);
            } else if (path.endsWith("/search/stats") && "GET".equals(method)) {
                handleGetStats(exchange);
            } else if (path.endsWith("/search/suggestions") && "GET".equals(method)) {
                handleGetSuggestions(exchange);
            } else if (path.endsWith("/search/history") && "GET".equals(method)) {
                handleGetHistory(exchange);
            } else if (path.endsWith("/search/history") && "DELETE".equals(method)) {
                handleClearHistory(exchange);
            } else if (path.endsWith("/search") && "POST".equals(method)) {
                handleGlobalSearch(exchange);
            } else {
                sendError(exchange, 404, "Endpoint not found");
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendError(exchange, 500, "Internal server error: " + e.getMessage());
        }
    }

    private void handleGlobalSearch(HttpExchange exchange) throws IOException, SQLException {
        SearchRequest request = parseSearchRequest(exchange);
        
        SearchService.SearchOptions options = new SearchService.SearchOptions();
        options.types = request.types;
        options.limit = request.limit;
        options.offset = request.offset;
        options.sortBy = request.sortBy;
        options.sortOrder = request.sortOrder;
        options.dateRange = request.dateRange;
        options.tags = request.tags;
        
        SearchService.SearchResults results = searchService.search(request.query, options);
        sendJsonResponse(exchange, 200, results);
    }

    private void handleSearchCards(HttpExchange exchange) throws IOException, SQLException {
        SearchRequest request = parseSearchRequest(exchange);
        
        SearchService.SearchOptions options = new SearchService.SearchOptions();
        options.dateRange = request.dateRange;
        options.tags = request.tags;
        
        List<SearchService.SearchResultItem> results = searchService.searchCards(request.query, options);
        sendJsonResponse(exchange, 200, Map.of("results", results));
    }

    private void handleSearchTasks(HttpExchange exchange) throws IOException, SQLException {
        SearchRequest request = parseSearchRequest(exchange);
        
        SearchService.SearchOptions options = new SearchService.SearchOptions();
        
        List<SearchService.SearchResultItem> results = searchService.searchTasks(request.query, options);
        sendJsonResponse(exchange, 200, Map.of("results", results));
    }

    private void handleSearchFiles(HttpExchange exchange) throws IOException, SQLException {
        SearchRequest request = parseSearchRequest(exchange);
        
        List<SearchService.SearchResultItem> results = searchService.searchFiles(request.query, null);
        sendJsonResponse(exchange, 200, Map.of("results", results));
    }

    private void handleSearchChat(HttpExchange exchange) throws IOException, SQLException {
        SearchRequest request = parseSearchRequest(exchange);
        
        List<SearchService.SearchResultItem> results = searchService.searchChat(request.query, null);
        sendJsonResponse(exchange, 200, Map.of("results", results));
    }

    private void handleReindex(HttpExchange exchange) throws IOException, SQLException {
        String body = readRequestBody(exchange);
        String entityType = null;
        
        if (!body.isEmpty()) {
            JsonObject json = JsonParser.parseString(body).getAsJsonObject();
            if (json.has("entityType")) {
                entityType = json.get("entityType").getAsString();
            }
        }
        
        searchService.reindex(entityType);
        sendJsonResponse(exchange, 200, Map.of("success", true, "message", "Reindex completed"));
    }

    private void handleGetStats(HttpExchange exchange) throws IOException, SQLException {
        SearchService.IndexStats stats = searchService.getIndexStats();
        sendJsonResponse(exchange, 200, stats);
    }

    private void handleGetSuggestions(HttpExchange exchange) throws IOException, SQLException {
        String query = exchange.getRequestURI().getQuery();
        String prefix = "";
        int limit = 10;
        
        if (query != null) {
            String[] params = query.split("&");
            for (String param : params) {
                String[] kv = param.split("=", 2);
                if (kv.length == 2) {
                    if ("prefix".equals(kv[0])) {
                        prefix = java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
                    } else if ("limit".equals(kv[0])) {
                        try {
                            limit = Integer.parseInt(kv[1]);
                        } catch (NumberFormatException e) {
                            // Use default
                        }
                    }
                }
            }
        }
        
        List<String> suggestions = searchService.getSuggestions(prefix, limit);
        sendJsonResponse(exchange, 200, Map.of("suggestions", suggestions));
    }

    private void handleGetHistory(HttpExchange exchange) throws IOException, SQLException {
        String query = exchange.getRequestURI().getQuery();
        int limit = 20;
        
        if (query != null) {
            String[] params = query.split("&");
            for (String param : params) {
                String[] kv = param.split("=", 2);
                if (kv.length == 2 && "limit".equals(kv[0])) {
                    try {
                        limit = Integer.parseInt(kv[1]);
                    } catch (NumberFormatException e) {
                        // Use default
                    }
                }
            }
        }
        
        List<SearchService.SearchHistoryItem> history = searchService.getHistory(limit);
        sendJsonResponse(exchange, 200, Map.of("history", history));
    }

    private void handleClearHistory(HttpExchange exchange) throws IOException, SQLException {
        searchService.clearHistory();
        sendJsonResponse(exchange, 200, Map.of("success", true, "message", "History cleared"));
    }

    private void handleOptions(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);
        exchange.sendResponseHeaders(204, -1);
    }

    private SearchRequest parseSearchRequest(HttpExchange exchange) throws IOException {
        String body = readRequestBody(exchange);
        return gson.fromJson(body, SearchRequest.class);
    }

    private String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String jsonResponse = JsonUtil.toJson(data);
        byte[] bytes = jsonResponse.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set("Content-Type", "application/json");
        addCorsHeaders(exchange);
        exchange.sendResponseHeaders(statusCode, bytes.length);

        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        Map<String, String> error = Map.of("error", message);
        sendJsonResponse(exchange, statusCode, error);
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    // Request model
    private static class SearchRequest {
        String query;
        List<String> types;
        Integer limit;
        Integer offset;
        String sortBy;
        String sortOrder;
        SearchService.DateRange dateRange;
        List<String> tags;
    }
}
