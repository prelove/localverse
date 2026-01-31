package config;

/**
 * Configuration model for Localverse
 */
public record Config(
    String mode,
    ClientConfig client,
    ServerConfig server,
    DatabaseConfig database,
    FilesystemConfig filesystem,
    SecurityConfig security,
    UserConfig user,
    LoggingConfig logging,
    SyncServerConfig syncServer
) {
    public Config() {
        this("client", new ClientConfig(), new ServerConfig(), new DatabaseConfig(),
             new FilesystemConfig(), new SecurityConfig(), new UserConfig(),
             new LoggingConfig(), new SyncServerConfig());
    }

    public record ClientConfig(
        int httpPort,
        int wsPort,
        String bindAddress
    ) {
        public ClientConfig() {
            this(8765, 8766, "127.0.0.1");
        }
    }

    public record ServerConfig(
        int httpPort,
        int wsPort,
        String bindAddress,
        int maxConnections,
        int sessionTimeout
    ) {
        public ServerConfig() {
            this(8080, 8081, "0.0.0.0", 1000, 3600);
        }
    }

    public record DatabaseConfig(
        String path,
        int maxConnections
    ) {
        public DatabaseConfig() {
            this("./data/localverse.db", 10);
        }
    }

    public record FilesystemConfig(
        String[] allowedPaths,
        String[] excludePatterns,
        long maxFileSize
    ) {
        public FilesystemConfig() {
            this(new String[0], new String[]{"*.tmp", "node_modules/**"}, 104857600L);
        }
    }

    public record SecurityConfig(
        String jwtSecret,
        int tokenExpiry,
        boolean enableCORS,
        String[] allowedOrigins
    ) {
        public SecurityConfig() {
            this("change-me-in-production", 86400, true,
                 new String[]{"http://127.0.0.1:*", "file://"});
        }
    }

    public record UserConfig(
        String id,
        String name,
        String department
    ) {
        public UserConfig() {
            this("user_001", "User", "default");
        }
    }

    public record LoggingConfig(
        String level,
        String file,
        String maxSize,
        int maxFiles
    ) {
        public LoggingConfig() {
            this("INFO", "./logs/localverse.log", "10MB", 5);
        }
    }

    public record SyncServerConfig(
        String url,
        boolean enabled,
        int timeout,
        boolean autoConnect,
        int reconnectInterval
    ) {
        public SyncServerConfig() {
            this("http://192.168.1.100:8080", false, 30000, true, 5000);
        }
    }
}
