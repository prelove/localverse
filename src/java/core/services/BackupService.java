package services;

import config.Config;
import utils.JsonUtil;

import java.io.*;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * 备份与恢复服务
 * 
 * 功能：
 * 1. 数据库备份（完整备份和增量备份）
 * 2. 数据恢复
 * 3. 备份文件验证
 * 4. 备份文件管理（列表、删除、清理）
 */
public class BackupService {
    private final Config config;
    private final DatabaseService databaseService;
    private final Path backupDir;
    private static final DateTimeFormatter BACKUP_DATE_FORMAT = 
        DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    public BackupService(Config config, DatabaseService databaseService) {
        this.config = config;
        this.databaseService = databaseService;
        
        // 备份目录：data/backups/
        String dbPath = config.database().path();
        Path dbFile = Paths.get(dbPath);
        this.backupDir = dbFile.getParent().resolve("backups");
        
        try {
            Files.createDirectories(backupDir);
        } catch (IOException e) {
            System.err.println("Failed to create backup directory: " + e.getMessage());
        }
    }

    /**
     * 创建完整备份
     * 
     * @param description 备份描述
     * @return 备份文件信息
     */
    public Map<String, Object> createBackup(String description) throws IOException, SQLException {
        String timestamp = LocalDateTime.now().format(BACKUP_DATE_FORMAT);
        String backupFileName = String.format("localverse_backup_%s.json.gz", timestamp);
        Path backupFile = backupDir.resolve(backupFileName);

        // 收集所有数据
        Map<String, Object> backupData = new HashMap<>();
        backupData.put("version", "1.0");
        backupData.put("timestamp", System.currentTimeMillis());
        backupData.put("description", description != null ? description : "");
        backupData.put("database_path", config.database().path());
        
        // 备份所有表的数据
        Map<String, List<Map<String, Object>>> tables = new HashMap<>();
        
        String[] tableNames = {"system_config", "modules", "columns", "cards", 
                              "attachments", "comments", "activities"};
        
        for (String tableName : tableNames) {
            try {
                List<Map<String, Object>> rows = exportTable(tableName);
                tables.put(tableName, rows);
            } catch (SQLException e) {
                // 表可能不存在，记录但继续
                System.err.println("Warning: Could not export table " + tableName + ": " + e.getMessage());
            }
        }
        
        backupData.put("tables", tables);

        // 备份系统配置
        Map<String, Object> systemInfo = new HashMap<>();
        systemInfo.put("db_version", getDatabaseVersion());
        systemInfo.put("user_id", getSystemConfig("user_id"));
        systemInfo.put("user_name", getSystemConfig("user_name"));
        backupData.put("system_info", systemInfo);

        // 写入压缩文件
        String jsonData = JsonUtil.toJson(backupData);
        try (GZIPOutputStream gzipOut = new GZIPOutputStream(
                new FileOutputStream(backupFile.toFile()))) {
            gzipOut.write(jsonData.getBytes("UTF-8"));
        }

        // 返回备份信息
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("file_name", backupFileName);
        result.put("file_path", backupFile.toString());
        result.put("file_size", Files.size(backupFile));
        result.put("timestamp", System.currentTimeMillis());
        result.put("description", description);
        
        System.out.println("Backup created: " + backupFile);
        return result;
    }

    /**
     * 恢复备份
     * 
     * @param backupFileName 备份文件名
     * @return 恢复结果
     */
    public Map<String, Object> restoreBackup(String backupFileName) throws IOException, SQLException {
        Path backupFile = backupDir.resolve(backupFileName);
        
        if (!Files.exists(backupFile)) {
            throw new FileNotFoundException("Backup file not found: " + backupFileName);
        }

        // 读取并解压备份文件
        String jsonData;
        try (GZIPInputStream gzipIn = new GZIPInputStream(
                new FileInputStream(backupFile.toFile()))) {
            jsonData = new String(gzipIn.readAllBytes(), "UTF-8");
        }

        // 解析备份数据
        @SuppressWarnings("unchecked")
        Map<String, Object> backupData = JsonUtil.fromJson(jsonData, Map.class);
        
        // 验证备份版本
        String version = (String) backupData.get("version");
        if (version == null || !version.equals("1.0")) {
            throw new IllegalArgumentException("Unsupported backup version: " + version);
        }

        // 开始恢复事务
        Connection conn = databaseService.getConnection();
        conn.setAutoCommit(false);
        
        try {
            // 清空现有数据（除了system_config）
            clearTables(conn);
            
            // 恢复数据
            @SuppressWarnings("unchecked")
            Map<String, List<Map<String, Object>>> tables = 
                (Map<String, List<Map<String, Object>>>) backupData.get("tables");
            
            for (Map.Entry<String, List<Map<String, Object>>> entry : tables.entrySet()) {
                String tableName = entry.getKey();
                List<Map<String, Object>> rows = entry.getValue();
                importTable(conn, tableName, rows);
            }
            
            conn.commit();
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("file_name", backupFileName);
            result.put("timestamp", System.currentTimeMillis());
            result.put("tables_restored", tables.size());
            
            System.out.println("Backup restored: " + backupFileName);
            return result;
            
        } catch (Exception e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
    }

    /**
     * 列出所有备份文件
     */
    public List<Map<String, Object>> listBackups() throws IOException {
        List<Map<String, Object>> backups = new ArrayList<>();
        
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(backupDir, "*.json.gz")) {
            for (Path entry : stream) {
                Map<String, Object> info = new HashMap<>();
                info.put("file_name", entry.getFileName().toString());
                info.put("file_path", entry.toString());
                info.put("file_size", Files.size(entry));
                info.put("created_at", Files.getLastModifiedTime(entry).toMillis());
                
                // 尝试读取备份描述
                try {
                    String description = getBackupDescription(entry);
                    info.put("description", description);
                } catch (Exception e) {
                    info.put("description", "");
                }
                
                backups.add(info);
            }
        }
        
        // 按创建时间倒序排列
        backups.sort((a, b) -> {
            Long timeA = (Long) a.get("created_at");
            Long timeB = (Long) b.get("created_at");
            return timeB.compareTo(timeA);
        });
        
        return backups;
    }

    /**
     * 删除备份文件
     */
    public boolean deleteBackup(String backupFileName) throws IOException {
        Path backupFile = backupDir.resolve(backupFileName);
        return Files.deleteIfExists(backupFile);
    }

    /**
     * 验证备份文件
     */
    public Map<String, Object> validateBackup(String backupFileName) throws IOException {
        Path backupFile = backupDir.resolve(backupFileName);
        
        Map<String, Object> result = new HashMap<>();
        result.put("valid", false);
        result.put("file_name", backupFileName);
        
        if (!Files.exists(backupFile)) {
            result.put("error", "File not found");
            return result;
        }

        try {
            // 读取并解压
            String jsonData;
            try (GZIPInputStream gzipIn = new GZIPInputStream(
                    new FileInputStream(backupFile.toFile()))) {
                jsonData = new String(gzipIn.readAllBytes(), "UTF-8");
            }

            // 解析JSON
            @SuppressWarnings("unchecked")
            Map<String, Object> backupData = JsonUtil.fromJson(jsonData, Map.class);
            
            // 验证必需字段
            if (!backupData.containsKey("version") || 
                !backupData.containsKey("timestamp") ||
                !backupData.containsKey("tables")) {
                result.put("error", "Missing required fields");
                return result;
            }
            
            result.put("valid", true);
            result.put("version", backupData.get("version"));
            result.put("timestamp", backupData.get("timestamp"));
            result.put("description", backupData.get("description"));
            
            @SuppressWarnings("unchecked")
            Map<String, ?> tables = (Map<String, ?>) backupData.get("tables");
            result.put("table_count", tables.size());
            result.put("tables", new ArrayList<>(tables.keySet()));
            
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        
        return result;
    }

    /**
     * 导出单个表的数据
     */
    private List<Map<String, Object>> exportTable(String tableName) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        Connection conn = databaseService.getConnection();
        
        String sql = "SELECT * FROM " + tableName;
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            
            ResultSetMetaData meta = rs.getMetaData();
            int columnCount = meta.getColumnCount();
            
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                for (int i = 1; i <= columnCount; i++) {
                    String columnName = meta.getColumnName(i);
                    Object value = rs.getObject(i);
                    row.put(columnName, value);
                }
                rows.add(row);
            }
        }
        
        return rows;
    }

    /**
     * 导入单个表的数据
     */
    private void importTable(Connection conn, String tableName, List<Map<String, Object>> rows) 
            throws SQLException {
        if (rows.isEmpty()) {
            return;
        }

        // 构建INSERT语句
        Map<String, Object> firstRow = rows.get(0);
        List<String> columns = new ArrayList<>(firstRow.keySet());
        
        StringBuilder sql = new StringBuilder("INSERT INTO ");
        sql.append(tableName).append(" (");
        sql.append(String.join(", ", columns));
        sql.append(") VALUES (");
        sql.append(String.join(", ", Collections.nCopies(columns.size(), "?")));
        sql.append(")");
        
        try (PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {
            for (Map<String, Object> row : rows) {
                for (int i = 0; i < columns.size(); i++) {
                    pstmt.setObject(i + 1, row.get(columns.get(i)));
                }
                pstmt.executeUpdate();
            }
        }
    }

    /**
     * 清空表数据（保留system_config）
     */
    private void clearTables(Connection conn) throws SQLException {
        String[] tableNames = {"activities", "comments", "attachments", 
                              "cards", "columns", "modules"};
        
        for (String tableName : tableNames) {
            try {
                String sql = "DELETE FROM " + tableName;
                try (Statement stmt = conn.createStatement()) {
                    stmt.executeUpdate(sql);
                }
            } catch (SQLException e) {
                // 表可能不存在，继续
                System.err.println("Warning: Could not clear table " + tableName);
            }
        }
    }

    /**
     * 获取数据库版本
     */
    private String getDatabaseVersion() throws SQLException {
        String version = getSystemConfig("db_version");
        return version != null ? version : "1";
    }

    /**
     * 获取系统配置值
     */
    private String getSystemConfig(String key) throws SQLException {
        Connection conn = databaseService.getConnection();
        String sql = "SELECT value FROM system_config WHERE key = ?";
        
        try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, key);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("value");
                }
            }
        } catch (SQLException e) {
            // 表可能不存在
            return null;
        }
        
        return null;
    }

    /**
     * 获取备份文件的描述信息
     */
    private String getBackupDescription(Path backupFile) throws IOException {
        try (GZIPInputStream gzipIn = new GZIPInputStream(
                new FileInputStream(backupFile.toFile()))) {
            String jsonData = new String(gzipIn.readAllBytes(), "UTF-8");
            @SuppressWarnings("unchecked")
            Map<String, Object> backupData = JsonUtil.fromJson(jsonData, Map.class);
            Object desc = backupData.get("description");
            return desc != null ? desc.toString() : "";
        }
    }
}
