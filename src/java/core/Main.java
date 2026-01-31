import config.Config;
import config.ConfigLoader;
import server.LocalHttpServer;
import server.LocalWebSocketServer;
import services.DatabaseService;
import services.FileSystemService;
import services.ProxyService;
import utils.Version;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Localverse 主入口
 */
public class Main {
    private static LocalHttpServer httpServer;
    private static LocalWebSocketServer wsServer;
    private static DatabaseService databaseService;

    public static void main(String[] args) {
        System.out.println("=== " + Version.NAME + " ===");
        System.out.println("Version: " + Version.VERSION);
        System.out.println("Java Version: " + System.getProperty("java.version"));
        System.out.println();

        try {
            // 解析命令行参数
            if (args.length > 0) {
                String command = args[0];
                switch (command) {
                    case "--version" -> {
                        printVersion();
                        return;
                    }
                    case "--help" -> {
                        printHelp();
                        return;
                    }
                    case "--create-config" -> {
                        createDefaultConfig(args);
                        return;
                    }
                }
            }

            // 加载配置
            Config config = ConfigLoader.loadFromArgs(args);
            System.out.println("Mode: " + config.mode());
            System.out.println();

            // 初始化服务
            initializeServices(config);

            // 启动服务器
            startServers(config);

            // 添加关闭钩子
            addShutdownHook();

            System.out.println();
            System.out.println("=== Localverse is running ===");
            System.out.println("Press Ctrl+C to stop");

        } catch (Exception e) {
            System.err.println("Failed to start Localverse: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    /**
     * 初始化服务
     */
    private static void initializeServices(Config config) throws Exception {
        System.out.println("Initializing services...");

        // 创建必要的目录
        ensureDirectories(config);

        // 初始化数据库服务
        databaseService = new DatabaseService(config);
        databaseService.initialize();
        
        System.out.println("Services initialized");
    }

    /**
     * 启动服务器
     */
    private static void startServers(Config config) throws Exception {
        System.out.println("Starting servers...");

        // 创建服务实例
        FileSystemService fileSystemService = new FileSystemService(config);
        ProxyService proxyService = new ProxyService(config);

        // 启动 HTTP 服务器
        httpServer = new LocalHttpServer(config, fileSystemService, 
                                        databaseService, proxyService);
        httpServer.start();

        // 启动 WebSocket 服务器
        wsServer = new LocalWebSocketServer(config);
        wsServer.start();

        System.out.println("Servers started");
    }

    /**
     * 确保必要的目录存在
     */
    private static void ensureDirectories(Config config) throws IOException {
        // 数据目录
        Path dataDir = Paths.get(config.database().path()).getParent();
        if (dataDir != null && !Files.exists(dataDir)) {
            Files.createDirectories(dataDir);
            System.out.println("Created data directory: " + dataDir);
        }

        // 日志目录
        Path logDir = Paths.get(config.logging().file()).getParent();
        if (logDir != null && !Files.exists(logDir)) {
            Files.createDirectories(logDir);
            System.out.println("Created logs directory: " + logDir);
        }
    }

    /**
     * 添加关闭钩子
     */
    private static void addShutdownHook() {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println();
            System.out.println("=== Shutting down Localverse ===");

            // 停止服务器
            if (httpServer != null) {
                httpServer.stop();
            }

            if (wsServer != null) {
                wsServer.shutdown();
            }

            // 关闭数据库
            if (databaseService != null) {
                databaseService.close();
            }

            System.out.println("=== Localverse stopped ===");
        }));
    }

    /**
     * 打印版本信息
     */
    private static void printVersion() {
        System.out.println(Version.getFullVersion());
        System.out.println("Java version: " + System.getProperty("java.version"));
    }

    /**
     * 打印帮助信息
     */
    private static void printHelp() {
        System.out.println("Usage: java -jar localverse.jar [options]");
        System.out.println();
        System.out.println("Options:");
        System.out.println("  (no args)              Start Localverse with default config");
        System.out.println("  --config <path>        Specify config file path");
        System.out.println("  --create-config        Create default config file");
        System.out.println("  --version              Show version information");
        System.out.println("  --help                 Show this help message");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("  java -jar localverse.jar");
        System.out.println("  java -jar localverse.jar --config=/path/to/config.json");
        System.out.println("  java -jar localverse.jar --create-config");
    }

    /**
     * 创建默认配置文件
     */
    private static void createDefaultConfig(String[] args) {
        String configPath = "./config.json";
        
        // 检查是否指定了路径
        for (int i = 1; i < args.length; i++) {
            if (args[i].startsWith("--path=")) {
                configPath = args[i].substring("--path=".length());
            } else if (args[i].equals("--path") && i + 1 < args.length) {
                configPath = args[i + 1];
            }
        }

        try {
            ConfigLoader.createDefaultConfig(configPath);
            System.out.println("Default configuration created successfully");
        } catch (IOException e) {
            System.err.println("Failed to create config: " + e.getMessage());
            System.exit(1);
        }
    }
}
