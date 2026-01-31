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
import java.sql.SQLException;
import java.util.concurrent.Executors;

/**
 * Local HTTP Server
 * Provides REST API for local operations and proxy to sync server
 */
public class LocalHttpServer {
    private final Config config;
    private final HttpServer server;
    private final FileSystemService fileService;
    private final DatabaseService dbService;
    private final ProxyService proxyService;
    private final SearchService searchService;

    public LocalHttpServer(Config config) throws IOException {
        this.config = config;
        
        // Initialize services
        this.fileService = new FileSystemService(config.filesystem());
        this.dbService = new DatabaseService();
        this.proxyService = new ProxyService(config.syncServer());
        
        // Initialize database connection if path is provided
        if (config.database() != null && config.database().path() != null) {
            try {
                dbService.initialize(config.database().path());
            } catch (SQLException e) {
                System.err.println("⚠ Failed to initialize database: " + e.getMessage());
            }
        }
        
        // Initialize search service if database is available
        if (dbService.getConnection() != null) {
            this.searchService = new SearchService(dbService.getConnection());
        } else {
            this.searchService = null;
        }

        // Create HTTP server
        int port = "client".equals(config.mode()) ? 
            config.client().httpPort() : config.server().httpPort();
        String bindAddress = "client".equals(config.mode()) ? 
            config.client().bindAddress() : config.server().bindAddress();

        InetSocketAddress addr = new InetSocketAddress(bindAddress, port);
        this.server = HttpServer.create(addr, 0);

        // Setup routes
        setupRoutes();

        // Use virtual thread executor for better concurrency (Java 21)
        this.server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    }

    private void setupRoutes() {
        // Health check
        server.createContext("/api/local/health", 
            new HealthHandler("1.0.0", config.mode()));

        // Configuration
        server.createContext("/api/local/config", 
            new ConfigHandler(config, "config.json"));

        // File operations
        server.createContext("/api/local/files", 
            new FileHandler(fileService));

        // Database operations
        server.createContext("/api/local/db/query", 
            new DatabaseHandler(dbService));
        server.createContext("/api/local/db/exec", 
            new DatabaseHandler(dbService));

        // Search operations (if database is available)
        if (searchService != null) {
            server.createContext("/api/local/search", 
                new SearchHandler(searchService));
            System.out.println("✓ Search service enabled");
        }

        // Proxy to sync server
        server.createContext("/api/sync", 
            new ProxyHandler(proxyService));

        System.out.println("✓ HTTP routes registered");
    }

    public void start() {
        server.start();
        int port = "client".equals(config.mode()) ? 
            config.client().httpPort() : config.server().httpPort();
        String bindAddress = "client".equals(config.mode()) ? 
            config.client().bindAddress() : config.server().bindAddress();
        System.out.println("✓ HTTP Server started on " + bindAddress + ":" + port);
    }

    public void stop() {
        server.stop(0);
        if (dbService != null) {
            dbService.close();
        }
        System.out.println("✓ HTTP Server stopped");
    }

    public FileSystemService getFileService() {
        return fileService;
    }

    public DatabaseService getDbService() {
        return dbService;
    }

    public ProxyService getProxyService() {
        return proxyService;
    }
    
    public SearchService getSearchService() {
        return searchService;
    }
}
