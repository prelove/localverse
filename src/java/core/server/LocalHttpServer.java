package server;

import com.sun.net.httpserver.HttpServer;
import models.Message;
import config.Config;
import server.handlers.*;
import services.BackupService;
import services.DatabaseService;
import services.FileSystemService;
import services.ProxyService;
import services.SearchService;
import services.ProcessService;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * HTTP 服务器
 * 提供前端静态文件服务和 API 接口
 */
public class LocalHttpServer {
    private final Config config;
    private final FileSystemService fileSystemService;
    private final DatabaseService databaseService;
    private final ProxyService proxyService;
    private SearchService searchService;
    private BackupService backupService;
    private ProcessService processService;
    private SyncServerHandler syncServerHandler;
    private HttpServer server;

    public LocalHttpServer(Config config, 
                          FileSystemService fileSystemService,
                          DatabaseService databaseService,
                          ProxyService proxyService) {
        this.config = config;
        this.fileSystemService = fileSystemService;
        this.databaseService = databaseService;
        this.proxyService = proxyService;
        
        // Initialize search and backup services if database is available
        if (databaseService != null && databaseService.getConnection() != null) {
            this.searchService = new SearchService(databaseService.getConnection());
            this.backupService = new BackupService(config, databaseService);
        }
    }

    /**
     * 启动服务器
     */
    public void start() throws IOException {
        int port = config.isServerMode() ? config.server().httpPort() : config.client().httpPort();
        String bindAddress = config.isServerMode() ? config.server().bindAddress() : config.client().bindAddress();

        server = HttpServer.create(new InetSocketAddress(bindAddress, port), 0);

        // 注册处理器
        registerHandlers();

        // 设置线程池
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        // 启动服务器
        server.start();

        System.out.println("✓ HTTP Server started on http://" + bindAddress + ":" + port);
        if (config.isClientMode()) {
            System.out.println("  → Open http://" + bindAddress + ":" + port + " in your browser");
        }
    }

    /**
     * 停止服务器
     */
    public void stop() {
        if (server != null) {
            server.stop(0);
            System.out.println("HTTP Server stopped");
        }
        
        // Shutdown process service
        if (processService != null) {
            processService.shutdown();
        }
    }

    /**
     * 为兼容旧客户端，统一注册本地 API 前缀和简化前缀。
     * 说明：server 模式下新接口优先使用 /api/*，client 模式保留 /api/local/*。
     */
    private void createApiContext(String suffix, com.sun.net.httpserver.HttpHandler handler) {
        // 旧前缀：保持现有前端与插件调用不受影响。
        server.createContext("/api/local" + suffix, handler);

        // 新前缀：为 Phase 2 服务端模式提供更简洁的 API 路径。
        server.createContext("/api" + suffix, handler);
    }

    /**
     * 注册所有处理器
     */
    private void registerHandlers() {
        // 初始化流程引擎，client/server 两种模式都复用同一套执行能力。
        this.processService = new ProcessService();

        // 静态资源入口：保留根路径用于桌面端页面与资源加载。
        server.createContext("/", new StaticHandler(config));
        System.out.println("✓ Static file server enabled");

        // 健康检查与基础管理接口。
        createApiContext("/health", new HealthHandler(config));
        createApiContext("/config", new ConfigHandler(config));
        createApiContext("/files", new FileHandler(config, fileSystemService));
        createApiContext("/db", new DatabaseHandler(config, databaseService));

        // 搜索接口依赖数据库连接，缺失时仅跳过该能力。
        if (searchService != null) {
            createApiContext("/search", new SearchHandler(searchService));
            System.out.println("✓ Search service enabled");
        }

        // 流程引擎接口。
        createApiContext("/process", new ProcessHandler(processService));
        System.out.println("✓ Process engine enabled");

        // 备份接口依赖数据库连接。
        if (backupService != null) {
            createApiContext("/backup", new BackupHandler(backupService));
            System.out.println("✓ Backup service enabled");
        }

        // sync 路由按模式分流：
        // - client 模式：转发到远端 Sync Server
        // - server 模式：直接提供本地同步 API（Phase 2 初始实现）
        if (config.isClientMode()) {
            server.createContext("/api/sync", new ProxyHandler(config, proxyService));
            System.out.println("✓ Sync proxy enabled");
        } else {
            // server 模式使用本地同步处理器，后续会绑定 WS 广播器。
            syncServerHandler = new SyncServerHandler(config, databaseService);
            server.createContext("/api/sync", syncServerHandler);
            System.out.println("✓ Sync server API enabled");
        }

        System.out.println("✓ All HTTP handlers registered");
    }

    /**
     * 绑定 WebSocket 广播能力给同步处理器。
     *
     * <p>说明：HTTP 与 WS 启动顺序不同，因此在 Main 启动 WS 后再进行注入。
     */
    public void bindWebSocketBroadcaster(LocalWebSocketServer webSocketServer) {
        if (syncServerHandler == null || webSocketServer == null) {
            return;
        }

        syncServerHandler.setBroadcaster((entity, accepted, conflicts) -> {
            Message message = Message.event("sync-updated", Map.of(
                "entity", entity,
                "accepted", accepted,
                "conflicts", conflicts,
                "timestamp", System.currentTimeMillis()
            ));

            webSocketServer.broadcast(message);
        });

        System.out.println("✓ Sync broadcast bridge enabled");
    }

    /**
     * Get the process service
     */
    public ProcessService getProcessService() {
        return processService;
    }
}
