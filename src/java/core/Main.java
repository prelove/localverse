import config.Config;
import config.ConfigLoader;
import server.LocalHttpServer;
import server.LocalWebSocketServer;
import services.DatabaseService;
import services.FileSystemService;
import services.ProxyService;

import java.io.IOException;

/**
 * Main entry point for Localverse
 * Starts HTTP and WebSocket servers
 */
public class Main {
    private static LocalHttpServer httpServer;
    private static LocalWebSocketServer wsServer;
    private static DatabaseService databaseService;

    public static void main(String[] args) {
        System.out.println("=== Localverse Starting ===");
        
        // Handle command line arguments
        if (args.length > 0) {
            String command = args[0];
            if ("--help".equals(command) || "-h".equals(command)) {
                printHelp();
                return;
            } else if ("--version".equals(command) || "-v".equals(command)) {
                printVersion();
                return;
            }
        }

        try {
            // Load configuration
            String configPath = getConfigPath(args);
            Config config = ConfigLoader.load(configPath);
            config = ConfigLoader.merge(config, args);

            System.out.println("ℹ Mode: " + config.mode());
            
            // Initialize services
            FileSystemService fileSystemService = new FileSystemService(config.filesystem());
            databaseService = new DatabaseService(config);
            ProxyService proxyService = new ProxyService(config.syncServer());
            
            // Initialize database if path is provided
            if (config.database() != null && config.database().path() != null) {
                System.out.println("ℹ Database path: " + config.database().path());
                try {
                    databaseService.initialize();
                    System.out.println("✓ Database initialized");
                } catch (Exception e) {
                    System.err.println("⚠ Database initialization failed: " + e.getMessage());
                }
            }

            // Start HTTP server
            httpServer = new LocalHttpServer(config, fileSystemService, databaseService, proxyService);
            httpServer.start();

            // Start WebSocket server
            wsServer = new LocalWebSocketServer(config);
            wsServer.start();

            // Setup shutdown hook
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                System.out.println("\n=== Localverse Shutting Down ===");
                shutdown();
            }));

            System.out.println("=== Localverse Started Successfully ===");
            System.out.println();
            
            int httpPort = "client".equals(config.mode()) ? 
                config.client().httpPort() : config.server().httpPort();
            String bindAddress = "client".equals(config.mode()) ? 
                config.client().bindAddress() : config.server().bindAddress();
            
            System.out.println("🌐 Access the application at:");
            System.out.println("   HTTP:      http://" + bindAddress + ":" + httpPort);
            System.out.println("   WebSocket: ws://" + bindAddress + ":" + 
                ("client".equals(config.mode()) ? config.client().wsPort() : config.server().wsPort()));
            System.out.println();
            System.out.println("Press Ctrl+C to stop");

            // Keep the main thread alive
            Thread.currentThread().join();

        } catch (IOException e) {
            System.err.println("❌ Failed to start server: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.out.println("Server interrupted");
        } catch (Exception e) {
            System.err.println("❌ Unexpected error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String getConfigPath(String[] args) {
        for (int i = 0; i < args.length - 1; i++) {
            if ("--config".equals(args[i])) {
                return args[i + 1];
            }
        }
        return null;
    }

    private static void shutdown() {
        try {
            if (wsServer != null) {
                wsServer.stop(1000);
            }
            if (httpServer != null) {
                httpServer.stop();
            }
            if (databaseService != null) {
                databaseService.close();
            }
            System.out.println("✓ Shutdown complete");
        } catch (Exception e) {
            System.err.println("⚠ Error during shutdown: " + e.getMessage());
        }
    }

    private static void printHelp() {
        System.out.println("Localverse - Browser-based enterprise intranet OS");
        System.out.println();
        System.out.println("Usage: java -jar localverse.jar [options]");
        System.out.println();
        System.out.println("Options:");
        System.out.println("  --help, -h           Show this help message");
        System.out.println("  --version, -v        Show version information");
        System.out.println("  --config <path>      Path to configuration file");
        System.out.println("  --mode=<mode>        Operating mode: client|server|hybrid");
        System.out.println("  --http-port=<port>   HTTP server port");
        System.out.println("  --ws-port=<port>     WebSocket server port");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("  java -jar localverse.jar");
        System.out.println("  java -jar localverse.jar --mode=server --http-port=8080");
        System.out.println("  java -jar localverse.jar --config=/path/to/config.json");
    }

    private static void printVersion() {
        System.out.println("Localverse v1.0.0");
        System.out.println("Java version: " + System.getProperty("java.version"));
        System.out.println("OS: " + System.getProperty("os.name") + " " + System.getProperty("os.version"));
    }
}
