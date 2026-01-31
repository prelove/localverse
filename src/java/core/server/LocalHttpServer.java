package server;

import com.sun.net.httpserver.HttpServer;
import config.Config;
import server.handlers.*;
import services.DatabaseService;
import services.FileSystemService;
import services.ProxyService;
import services.SearchService;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/**
 * HTTP 服务器
 */
public class LocalHttpServer {
    private final Config config;
    private final FileSystemService fileSystemService;
    private final DatabaseService databaseService;
    private final ProxyService proxyService;
    private final SearchService searchService;
    private HttpServer server;

    public LocalHttpServer(Config config, 
                          FileSystemService fileSystemService,
                          DatabaseService databaseService,
                          ProxyService proxyService) {
        this.config = config;
        this.fileSystemService = fileSystemService;
        this.databaseService = databaseService;
        this.proxyService = proxyService;
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

        System.out.println("HTTP Server started on " + bindAddress + ":" + port);
    }

    /**
     * 停止服务器
     */
    public void stop() {
        if (server != null) {
            server.stop(0);
            System.out.println("HTTP Server stopped");
        }
    }

    /**
     * 注册所有处理器
     */
    private void registerHandlers() {
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

        
        // Initialize search service if database is available
        if (databaseService != null && databaseService.getConnection() != null) {
            this.searchService = new SearchService(databaseService.getConnection());
        } else {
            this.searchService = null;
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

        System.out.println("HTTP Server started on " + bindAddress + ":" + port);
    }

    /**
     * 停止服务器
     */
    public void stop() {
        if (server != null) {
            server.stop(0);
            System.out.println("HTTP Server stopped");
        }
    }

    /**
     * 注册所有处理器
     */
    private void registerHandlers() {
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

        // 代理转发
        server.createContext("/api/sync", 
            new ProxyHandler(config, proxyService));

        System.out.println("Registered HTTP handlers");
    }
}
