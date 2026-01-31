package services;

import config.Config;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 数据库服务 - SQLite
 */
public class DatabaseService {
    private final Config config;
    private Connection connection;

    public DatabaseService(Config config) {
        this.config = config;
    }

    /**
     * 初始化数据库连接
     */
    public void initialize() throws SQLException {
        String dbPath = config.database().path();
        String url = "jdbc:sqlite:" + dbPath;
        
        connection = DriverManager.getConnection(url);
        connection.setAutoCommit(true);
        
        System.out.println("Database connected: " + dbPath);
    }

    /**
     * 关闭数据库连接
     */
    public void close() {
        if (connection != null) {
            try {
                connection.close();
                System.out.println("Database connection closed");
            } catch (SQLException e) {
                System.err.println("Error closing database: " + e.getMessage());
            }
        }
    }

    /**
     * 执行查询
     */
    public List<List<Object>> query(String sql, Object[] params) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(sql)) {
            setParameters(stmt, params);
            
            try (ResultSet rs = stmt.executeQuery()) {
                return resultSetToList(rs);
            }
        }
    }

    /**
     * 执行单行查询
     */
    public Optional<List<Object>> queryOne(String sql, Object[] params) throws SQLException {
        List<List<Object>> results = query(sql, params);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    /**
     * 执行更新语句
     */
    public int execute(String sql, Object[] params) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(sql)) {
            setParameters(stmt, params);
            return stmt.executeUpdate();
        }
    }

    /**
     * 执行插入语句并返回生成的 ID
     */
    public long insert(String sql, Object[] params) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(sql, 
                                     Statement.RETURN_GENERATED_KEYS)) {
            setParameters(stmt, params);
            stmt.executeUpdate();
            
            try (ResultSet rs = stmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
                return -1;
            }
        }
    }

    /**
     * 批量执行
     */
    public int[] batchExecute(String sql, List<Object[]> paramsList) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(sql)) {
            for (Object[] params : paramsList) {
                setParameters(stmt, params);
                stmt.addBatch();
            }
            return stmt.executeBatch();
        }
    }

    /**
     * 执行事务
     */
    public <T> T transaction(TransactionCallback<T> callback) throws SQLException {
        boolean autoCommit = connection.getAutoCommit();
        try {
            connection.setAutoCommit(false);
            T result = callback.execute(connection);
            connection.commit();
            return result;
        } catch (Exception e) {
            connection.rollback();
            throw new SQLException("Transaction failed: " + e.getMessage(), e);
        } finally {
            connection.setAutoCommit(autoCommit);
        }
    }

    /**
     * 设置预处理语句参数
     */
    private void setParameters(PreparedStatement stmt, Object[] params) throws SQLException {
        if (params == null) {
            return;
        }

        for (int i = 0; i < params.length; i++) {
            Object param = params[i];
            if (param == null) {
                stmt.setNull(i + 1, Types.NULL);
            } else if (param instanceof String) {
                stmt.setString(i + 1, (String) param);
            } else if (param instanceof Integer) {
                stmt.setInt(i + 1, (Integer) param);
            } else if (param instanceof Long) {
                stmt.setLong(i + 1, (Long) param);
            } else if (param instanceof Double) {
                stmt.setDouble(i + 1, (Double) param);
            } else if (param instanceof Boolean) {
                stmt.setBoolean(i + 1, (Boolean) param);
            } else {
                stmt.setObject(i + 1, param);
            }
        }
    }

    /**
     * 将 ResultSet 转换为 List
     */
    private List<List<Object>> resultSetToList(ResultSet rs) throws SQLException {
        List<List<Object>> results = new ArrayList<>();
        ResultSetMetaData metaData = rs.getMetaData();
        int columnCount = metaData.getColumnCount();

        while (rs.next()) {
            List<Object> row = new ArrayList<>(columnCount);
            for (int i = 1; i <= columnCount; i++) {
                row.add(rs.getObject(i));
            }
            results.add(row);
        }

        return results;
    }

    /**
     * 事务回调接口
     */
    @FunctionalInterface
    public interface TransactionCallback<T> {
        T execute(Connection conn) throws Exception;
    }
}
