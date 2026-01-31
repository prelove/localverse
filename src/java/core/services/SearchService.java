package services;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.sql.*;
import java.util.*;

/**
 * Search service implementation using SQLite FTS5
 * Provides full-text search capabilities for cards, tasks, files, and chat messages
 */
public class SearchService {
    private final Connection connection;
    private final Gson gson;

    public SearchService(Connection connection) {
        this.connection = connection;
        this.gson = new Gson();
    }

    /**
     * Global search across all entity types
     */
    public SearchResults search(String query, SearchOptions options) throws SQLException {
        long startTime = System.currentTimeMillis();
        
        if (options == null) {
            options = new SearchOptions();
        }
        
        List<String> types = options.types != null ? options.types : 
            Arrays.asList("card", "task", "file", "chat");
        int limit = options.limit != null ? options.limit : 50;
        int offset = options.offset != null ? options.offset : 0;
        
        List<SearchResultItem> allResults = new ArrayList<>();
        
        // Search each type
        for (String type : types) {
            List<SearchResultItem> typeResults = switch (type) {
                case "card" -> searchCards(query, options);
                case "task" -> searchTasks(query, options);
                case "file" -> searchFiles(query, options);
                case "chat" -> searchChat(query, options);
                default -> new ArrayList<>();
            };
            allResults.addAll(typeResults);
        }
        
        // Sort results
        String sortBy = options.sortBy != null ? options.sortBy : "relevance";
        String sortOrder = options.sortOrder != null ? options.sortOrder : "desc";
        sortResults(allResults, sortBy, sortOrder);
        
        // Paginate
        int total = allResults.size();
        int toIndex = Math.min(offset + limit, total);
        List<SearchResultItem> items = offset < total ? 
            allResults.subList(offset, toIndex) : new ArrayList<>();
        
        // Calculate facets
        SearchFacets facets = calculateFacets(allResults);
        
        // Record search history
        recordHistory(query, total);
        
        long took = System.currentTimeMillis() - startTime;
        
        return new SearchResults(total, items, facets, took);
    }

    /**
     * Search cards using FTS5
     */
    public List<SearchResultItem> searchCards(String query, SearchOptions options) throws SQLException {
        String ftsQuery = buildFtsQuery(query);
        
        StringBuilder sql = new StringBuilder("""
            SELECT 
                c.id,
                c.title,
                c.content,
                c.tags,
                c.created_at,
                c.updated_at,
                highlight(cards_fts, 0, '<mark>', '</mark>') as title_hl,
                highlight(cards_fts, 1, '<mark>', '</mark>') as content_hl,
                bm25(cards_fts) as score
            FROM cards c
            JOIN cards_fts ON c.rowid = cards_fts.rowid
            WHERE cards_fts MATCH ?
                AND c.deleted = 0
            """);
        
        List<Object> params = new ArrayList<>();
        params.add(ftsQuery);
        
        // Date range filter
        if (options != null && options.dateRange != null) {
            if (options.dateRange.start != null) {
                sql.append(" AND c.created_at >= ?");
                params.add(options.dateRange.start);
            }
            if (options.dateRange.end != null) {
                sql.append(" AND c.created_at <= ?");
                params.add(options.dateRange.end);
            }
        }
        
        // Tags filter
        if (options != null && options.tags != null && !options.tags.isEmpty()) {
            for (String tag : options.tags) {
                sql.append(" AND c.tags LIKE ?");
                params.add("%\"" + tag + "\"%");
            }
        }
        
        sql.append(" ORDER BY score LIMIT 100");
        
        List<SearchResultItem> results = new ArrayList<>();
        try (PreparedStatement stmt = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> metadata = new HashMap<>();
                    String tagsJson = rs.getString("tags");
                    if (tagsJson != null && !tagsJson.isEmpty()) {
                        List<String> tags = gson.fromJson(tagsJson, new TypeToken<List<String>>(){}.getType());
                        metadata.put("tags", tags);
                    }
                    
                    List<String> highlights = new ArrayList<>();
                    String titleHl = rs.getString("title_hl");
                    String contentHl = rs.getString("content_hl");
                    if (titleHl != null) highlights.add(titleHl);
                    if (contentHl != null) highlights.add(contentHl);
                    
                    SearchResultItem item = new SearchResultItem(
                        "card",
                        rs.getString("id"),
                        rs.getString("title"),
                        extractSnippet(rs.getString("content"), query, 150),
                        Math.abs(rs.getDouble("score")),
                        highlights,
                        metadata,
                        rs.getLong("created_at"),
                        rs.getLong("updated_at")
                    );
                    results.add(item);
                }
            }
        }
        
        return results;
    }

    /**
     * Search tasks using FTS5
     */
    public List<SearchResultItem> searchTasks(String query, SearchOptions options) throws SQLException {
        String ftsQuery = buildFtsQuery(query);
        
        StringBuilder sql = new StringBuilder("""
            SELECT 
                t.id,
                t.title,
                t.content,
                t.status,
                t.priority,
                t.tags,
                t.assignee,
                t.due_date,
                t.created_at,
                t.updated_at,
                highlight(tasks_fts, 0, '<mark>', '</mark>') as title_hl,
                bm25(tasks_fts) as score
            FROM tasks t
            JOIN tasks_fts ON t.rowid = tasks_fts.rowid
            WHERE tasks_fts MATCH ?
                AND t.deleted = 0
            """);
        
        List<Object> params = new ArrayList<>();
        params.add(ftsQuery);
        
        sql.append(" ORDER BY score LIMIT 100");
        
        List<SearchResultItem> results = new ArrayList<>();
        try (PreparedStatement stmt = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("status", rs.getString("status"));
                    metadata.put("priority", rs.getInt("priority"));
                    metadata.put("assignee", rs.getString("assignee"));
                    metadata.put("dueDate", rs.getLong("due_date"));
                    
                    String tagsJson = rs.getString("tags");
                    if (tagsJson != null && !tagsJson.isEmpty()) {
                        List<String> tags = gson.fromJson(tagsJson, new TypeToken<List<String>>(){}.getType());
                        metadata.put("tags", tags);
                    }
                    
                    List<String> highlights = new ArrayList<>();
                    String titleHl = rs.getString("title_hl");
                    if (titleHl != null) highlights.add(titleHl);
                    
                    SearchResultItem item = new SearchResultItem(
                        "task",
                        rs.getString("id"),
                        rs.getString("title"),
                        extractSnippet(rs.getString("content"), query, 150),
                        Math.abs(rs.getDouble("score")),
                        highlights,
                        metadata,
                        rs.getLong("created_at"),
                        rs.getLong("updated_at")
                    );
                    results.add(item);
                }
            }
        }
        
        return results;
    }

    /**
     * Search files by name and path
     */
    public List<SearchResultItem> searchFiles(String query, SearchOptions options) throws SQLException {
        String lowerQuery = query.toLowerCase();
        
        StringBuilder sql = new StringBuilder("""
            SELECT 
                id,
                name,
                path,
                size,
                mime_type,
                created_at,
                updated_at
            FROM files
            WHERE deleted = 0
                AND (LOWER(name) LIKE ? OR LOWER(path) LIKE ?)
            """);
        
        List<Object> params = new ArrayList<>();
        params.add("%" + lowerQuery + "%");
        params.add("%" + lowerQuery + "%");
        
        sql.append(" ORDER BY updated_at DESC LIMIT 100");
        
        List<SearchResultItem> results = new ArrayList<>();
        try (PreparedStatement stmt = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("path", rs.getString("path"));
                    metadata.put("size", rs.getLong("size"));
                    metadata.put("mimeType", rs.getString("mime_type"));
                    
                    String name = rs.getString("name");
                    double score = name.toLowerCase().contains(lowerQuery) ? 1.0 : 0.5;
                    
                    SearchResultItem item = new SearchResultItem(
                        "file",
                        rs.getString("id"),
                        name,
                        rs.getString("path"),
                        score,
                        new ArrayList<>(),
                        metadata,
                        rs.getLong("created_at"),
                        rs.getLong("updated_at")
                    );
                    results.add(item);
                }
            }
        }
        
        return results;
    }

    /**
     * Search chat messages
     */
    public List<SearchResultItem> searchChat(String query, SearchOptions options) throws SQLException {
        String lowerQuery = query.toLowerCase();
        
        StringBuilder sql = new StringBuilder("""
            SELECT 
                m.id,
                m.content,
                m.sender_id,
                m.sender_name,
                m.room_id,
                r.name as room_name,
                m.created_at
            FROM chat_messages m
            LEFT JOIN chat_rooms r ON m.room_id = r.id
            WHERE m.deleted = 0
                AND LOWER(m.content) LIKE ?
            """);
        
        List<Object> params = new ArrayList<>();
        params.add("%" + lowerQuery + "%");
        
        sql.append(" ORDER BY m.created_at DESC LIMIT 100");
        
        List<SearchResultItem> results = new ArrayList<>();
        try (PreparedStatement stmt = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> metadata = new HashMap<>();
                    metadata.put("senderId", rs.getString("sender_id"));
                    metadata.put("senderName", rs.getString("sender_name"));
                    metadata.put("roomId", rs.getString("room_id"));
                    metadata.put("roomName", rs.getString("room_name"));
                    
                    String senderName = rs.getString("sender_name");
                    String roomName = rs.getString("room_name");
                    String title = senderName + " in " + roomName;
                    
                    SearchResultItem item = new SearchResultItem(
                        "chat",
                        rs.getString("id"),
                        title,
                        extractSnippet(rs.getString("content"), query, 150),
                        0.5,
                        new ArrayList<>(),
                        metadata,
                        rs.getLong("created_at"),
                        rs.getLong("created_at")
                    );
                    results.add(item);
                }
            }
        }
        
        return results;
    }

    /**
     * Reindex FTS tables
     */
    public void reindex(String entityType) throws SQLException {
        if (entityType == null || "card".equals(entityType)) {
            try (Statement stmt = connection.createStatement()) {
                stmt.execute("DELETE FROM cards_fts");
                stmt.execute("""
                    INSERT INTO cards_fts(rowid, title, content, tags)
                    SELECT rowid, title, content, tags FROM cards WHERE deleted = 0
                    """);
            }
        }
        
        if (entityType == null || "task".equals(entityType)) {
            try (Statement stmt = connection.createStatement()) {
                stmt.execute("DELETE FROM tasks_fts");
                stmt.execute("""
                    INSERT INTO tasks_fts(rowid, title, content, tags)
                    SELECT rowid, title, content, tags FROM tasks WHERE deleted = 0
                    """);
            }
        }
    }

    /**
     * Get index statistics
     */
    public IndexStats getIndexStats() throws SQLException {
        long cardCount = 0;
        long taskCount = 0;
        
        try (Statement stmt = connection.createStatement()) {
            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) as c FROM cards_fts")) {
                if (rs.next()) {
                    cardCount = rs.getLong("c");
                }
            }
            
            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) as c FROM tasks_fts")) {
                if (rs.next()) {
                    taskCount = rs.getLong("c");
                }
            }
        }
        
        Map<String, Long> entityCounts = new HashMap<>();
        entityCounts.put("card", cardCount);
        entityCounts.put("task", taskCount);
        
        return new IndexStats(
            cardCount + taskCount,
            0L, // SQLite FTS doesn't expose index size directly
            System.currentTimeMillis(),
            entityCounts
        );
    }

    /**
     * Get search suggestions
     */
    public List<String> getSuggestions(String prefix, int limit) throws SQLException {
        if (prefix == null || prefix.length() < 2) {
            return new ArrayList<>();
        }
        
        String lowerPrefix = prefix.toLowerCase();
        Set<String> suggestions = new LinkedHashSet<>();
        
        // Get suggestions from search history
        String historySql = """
            SELECT DISTINCT query FROM search_history 
            WHERE LOWER(query) LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
            """;
        
        try (PreparedStatement stmt = connection.prepareStatement(historySql)) {
            stmt.setString(1, lowerPrefix + "%");
            stmt.setInt(2, limit);
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next() && suggestions.size() < limit) {
                    suggestions.add(rs.getString("query"));
                }
            }
        }
        
        // Get suggestions from card titles if we need more
        if (suggestions.size() < limit) {
            String cardSql = """
                SELECT DISTINCT title FROM cards 
                WHERE LOWER(title) LIKE ? AND deleted = 0
                LIMIT ?
                """;
            
            try (PreparedStatement stmt = connection.prepareStatement(cardSql)) {
                stmt.setString(1, lowerPrefix + "%");
                stmt.setInt(2, limit - suggestions.size());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next() && suggestions.size() < limit) {
                        suggestions.add(rs.getString("title"));
                    }
                }
            }
        }
        
        // Get suggestions from task titles if we need more
        if (suggestions.size() < limit) {
            String taskSql = """
                SELECT DISTINCT title FROM tasks 
                WHERE LOWER(title) LIKE ? AND deleted = 0
                LIMIT ?
                """;
            
            try (PreparedStatement stmt = connection.prepareStatement(taskSql)) {
                stmt.setString(1, lowerPrefix + "%");
                stmt.setInt(2, limit - suggestions.size());
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next() && suggestions.size() < limit) {
                        suggestions.add(rs.getString("title"));
                    }
                }
            }
        }
        
        return new ArrayList<>(suggestions);
    }

    /**
     * Get search history
     */
    public List<SearchHistoryItem> getHistory(int limit) throws SQLException {
        String sql = """
            SELECT query, result_count, created_at
            FROM search_history
            ORDER BY created_at DESC
            LIMIT ?
            """;
        
        List<SearchHistoryItem> history = new ArrayList<>();
        try (PreparedStatement stmt = connection.prepareStatement(sql)) {
            stmt.setInt(1, limit);
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    history.add(new SearchHistoryItem(
                        rs.getString("query"),
                        rs.getLong("created_at"),
                        rs.getInt("result_count")
                    ));
                }
            }
        }
        
        return history;
    }

    /**
     * Clear search history
     */
    public void clearHistory() throws SQLException {
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("DELETE FROM search_history");
        }
    }

    /**
     * Build FTS query from user input
     */
    private String buildFtsQuery(String query) {
        // Remove special characters, keep alphanumeric, CJK, and spaces
        String cleaned = query.replaceAll("[^\\w\\s\\u4e00-\\u9fa5\\u3040-\\u309f\\u30a0-\\u30ff]", " ").trim();
        
        // Split into words
        String[] words = cleaned.split("\\s+");
        
        if (words.length == 0) {
            return query;
        }
        
        // For single word, use prefix matching (asterisk must be outside quotes)
        if (words.length == 1 && words[0].length() > 1) {
            return words[0] + "* OR " + words[0];
        }
        
        // For multiple words, use AND to connect them
        return String.join(" AND ", words);
    }

    /**
     * Extract snippet from content around query match
     */
    private String extractSnippet(String content, String query, int maxLength) {
        if (content == null || content.isEmpty()) {
            return "";
        }
        
        String lowerContent = content.toLowerCase();
        String lowerQuery = query.toLowerCase();
        int index = lowerContent.indexOf(lowerQuery);
        
        if (index < 0) {
            // No match, return beginning
            if (content.length() <= maxLength) {
                return content;
            }
            return content.substring(0, maxLength) + "...";
        }
        
        // Extract around match
        int start = Math.max(0, index - 50);
        int end = Math.min(content.length(), index + query.length() + 100);
        
        String snippet = content.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < content.length()) snippet = snippet + "...";
        
        return snippet;
    }

    /**
     * Sort search results
     */
    private void sortResults(List<SearchResultItem> results, String sortBy, String sortOrder) {
        int multiplier = "asc".equals(sortOrder) ? 1 : -1;
        
        results.sort((a, b) -> {
            int result = switch (sortBy) {
                case "relevance" -> Double.compare(b.score, a.score);
                case "date" -> Long.compare(b.updatedAt, a.updatedAt);
                case "name" -> a.title.compareTo(b.title);
                default -> 0;
            };
            return result * multiplier;
        });
    }

    /**
     * Calculate facets from results
     */
    private SearchFacets calculateFacets(List<SearchResultItem> results) {
        Map<String, Integer> typeCounts = new HashMap<>();
        Map<String, Integer> tagCounts = new HashMap<>();
        
        for (SearchResultItem result : results) {
            // Count by type
            typeCounts.merge(result.type, 1, Integer::sum);
            
            // Count by tags
            if (result.metadata.containsKey("tags")) {
                @SuppressWarnings("unchecked")
                List<String> tags = (List<String>) result.metadata.get("tags");
                if (tags != null) {
                    for (String tag : tags) {
                        tagCounts.merge(tag, 1, Integer::sum);
                    }
                }
            }
        }
        
        List<TypeCount> types = typeCounts.entrySet().stream()
            .map(e -> new TypeCount(e.getKey(), e.getValue()))
            .toList();
        
        List<TagCount> tags = tagCounts.entrySet().stream()
            .map(e -> new TagCount(e.getKey(), e.getValue()))
            .sorted((a, b) -> Integer.compare(b.count, a.count))
            .limit(10)
            .toList();
        
        return new SearchFacets(types, tags);
    }

    /**
     * Record search in history
     */
    private void recordHistory(String query, int resultCount) {
        if (query == null || query.length() < 2) {
            return;
        }
        
        try {
            // Use UUID for better uniqueness
            String id = "search_" + java.util.UUID.randomUUID().toString();
            
            String sql = """
                INSERT INTO search_history (id, query, result_count, created_at)
                VALUES (?, ?, ?, ?)
                """;
            
            try (PreparedStatement stmt = connection.prepareStatement(sql)) {
                stmt.setString(1, id);
                stmt.setString(2, query);
                stmt.setInt(3, resultCount);
                stmt.setLong(4, System.currentTimeMillis());
                stmt.executeUpdate();
            }
            
            // Keep only last 1000 entries
            String cleanupSql = """
                DELETE FROM search_history 
                WHERE id NOT IN (
                    SELECT id FROM search_history ORDER BY created_at DESC LIMIT 1000
                )
                """;
            
            try (Statement stmt = connection.createStatement()) {
                stmt.execute(cleanupSql);
            }
        } catch (SQLException e) {
            // Log error but don't fail the search operation
            // In production, this should use a proper logging framework
            System.err.println("⚠ Failed to record search history: " + e.getMessage());
        }
    }

    // Inner classes for data models
    public record SearchResults(
        int total,
        List<SearchResultItem> items,
        SearchFacets facets,
        long took
    ) {}

    public record SearchResultItem(
        String type,
        String id,
        String title,
        String snippet,
        double score,
        List<String> highlights,
        Map<String, Object> metadata,
        long createdAt,
        long updatedAt
    ) {}

    public record SearchFacets(
        List<TypeCount> types,
        List<TagCount> tags
    ) {}

    public record TypeCount(String type, int count) {}
    public record TagCount(String tag, int count) {}

    public record IndexStats(
        long totalDocuments,
        long indexSize,
        long lastIndexTime,
        Map<String, Long> entityCounts
    ) {}

    public record SearchHistoryItem(
        String query,
        long timestamp,
        int resultCount
    ) {}

    public static class SearchOptions {
        public List<String> types;
        public Integer limit;
        public Integer offset;
        public String sortBy;
        public String sortOrder;
        public DateRange dateRange;
        public List<String> tags;
        public Boolean includeDeleted;
    }

    public static class DateRange {
        public Long start;
        public Long end;
    }
}
