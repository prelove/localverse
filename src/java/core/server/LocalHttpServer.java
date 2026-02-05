package server;

import com.sun.net.httpserver.HttpServer;
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
        int port = config.client().httpPort();
        String bindAddress = config.client().bindAddress();

        server = HttpServer.create(new InetSocketAddress(bindAddress, port), 0);

        // 注册处理器
        registerHandlers();

        // 设置线程池
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        // 启动服务器
        server.start();

        System.out.println("✓ HTTP Server started on http://" + bindAddress + ":" + port);
        System.out.println("  → Open http://" + bindAddress + ":" + port + " in your browser");
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
     * 注册所有处理器
     */
    private void registerHandlers() {
        // Initialize process service
        this.processService = new ProcessService();
        
        // ========== 静态文件服务 (必须放在最前面，根路径) ==========
        server.createContext("/", new StaticHandler(config));
        System.out.println("✓ Static file server enabled");

        // ========== API 接口 ==========
        
        // 健康检查
        server.createContext("/api/local/health", 
            new HealthHandler(config));

        // 配置管理
        server.createContext("/api/local/config", 
            new ConfigHandler(config));

        // 文件操作
        server.createContext("/api/local/files", 
            new FileHandler(config, fileSystemService));

        // 数据库操作
        server.createContext("/api/local/db", 
            new DatabaseHandler(config, databaseService));

        // 搜索操作 (if database is available)
        if (searchService != null) {
            server.createContext("/api/local/search", 
                new SearchHandler(searchService));
            System.out.println("✓ Search service enabled");
        }
        
        // 流程引擎
        server.createContext("/api/local/process", 
            new ProcessHandler(processService));
        System.out.println("✓ Process engine enabled");

        // 备份与恢复 (if database is available)
        if (backupService != null) {
            server.createContext("/api/local/backup", 
                new BackupHandler(backupService));
            System.out.println("✓ Backup service enabled");
        }

        // 代理转发
        server.createContext("/api/sync", 
            new ProxyHandler(config, proxyService));

        System.out.println("✓ All HTTP handlers registered");
    }
    
    /**
     * Get the process service
     */
    public ProcessService getProcessService() {
        return processService;
    }
}
