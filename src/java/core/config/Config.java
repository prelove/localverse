package config;

import java.util.List;
import java.util.Map;

/**
 * 配置类 - 使用 Java Record 定义配置结构
 */
public record Config(
    String mode,
    ClientConfig client,
    ServerConfig server,
    DatabaseConfig database,
    FilesystemConfig filesystem,
    SecurityConfig security,
    UserConfig user,
    LoggingConfig logging
) {
    public record ClientConfig(
        int httpPort,
        int wsPort,
        String bindAddress,
        String syncServer,
        boolean syncEnabled,
        boolean autoConnect,
        int reconnectInterval
    ) {
        public static ClientConfig defaults() {
            return new ClientConfig(
                8765,
                8766,
                "127.0.0.1",
                "http://192.168.1.100:8080",
                true,
                true,
                5000
            );
        }
    }

    public record ServerConfig(
        int httpPort,
        int wsPort,
        String bindAddress,
        int maxConnections,
        int sessionTimeout
    ) {
        public static ServerConfig defaults() {
            return new ServerConfig(
                8080,
                8081,
                "0.0.0.0",
                1000,
                3600
            );
        }
    }

    public record DatabaseConfig(
        String path,
        int maxConnections
    ) {
        public static DatabaseConfig defaults() {
            return new DatabaseConfig(
                "./data/localverse.db",
                10
            );
        }
    }

    public record FilesystemConfig(
        List<String> watchPaths,
        List<String> excludePatterns,
        long maxFileSize
    ) {
        public static FilesystemConfig defaults() {
            return new FilesystemConfig(
                List.of(),
                List.of("*.tmp", "node_modules/**", ".git/**"),
                104857600L // 100MB
            );
        }
    }

    public record SecurityConfig(
        String jwtSecret,
        int tokenExpiry,
        boolean enableCORS,
        List<String> allowedOrigins
    ) {
        public static SecurityConfig defaults() {
            return new SecurityConfig(
                "change-this-secret-in-production",
                86400,
                true,
                List.of("http://127.0.0.1:*", "file://")
            );
        }
    }

    public record UserConfig(
        String id,
        String name,
        String department
    ) {
        public static UserConfig defaults() {
            return new UserConfig(
                "user_001",
                "Default User",
                "default"
            );
        }
    }

    public record LoggingConfig(
        String level,
        String file,
        String maxSize,
        int maxFiles
    ) {
        public static LoggingConfig defaults() {
            return new LoggingConfig(
                "INFO",
                "./logs/localverse.log",
                "10MB",
                5
            );
        }
    }

    /**
     * 创建默认配置
     */
    public static Config defaults() {
        return new Config(
            "client",
            ClientConfig.defaults(),
            ServerConfig.defaults(),
            DatabaseConfig.defaults(),
            FilesystemConfig.defaults(),
            SecurityConfig.defaults(),
            UserConfig.defaults(),
            LoggingConfig.defaults()
        );
    }

    /**
     * 获取当前模式的配置
     */
    public Object getModeConfig() {
        return switch (mode) {
            case "client" -> client;
            case "server" -> server;
            default -> client;
        };
    }

    /**
     * 是否为客户端模式
     */
    public boolean isClientMode() {
        return "client".equals(mode);
    }

    /**
     * 是否为服务器模式
     */
    public boolean isServerMode() {
        return "server".equals(mode);
    }
}
