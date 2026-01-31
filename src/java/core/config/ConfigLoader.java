package config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Configuration loader
 * Loads configuration from config.json or creates default
 */
public class ConfigLoader {
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private static final String DEFAULT_CONFIG_FILE = "config.json";

    /**
     * Load configuration from file or create default
     */
    public static Config load(String configPath) {
        Path path = Paths.get(configPath != null ? configPath : DEFAULT_CONFIG_FILE);

        if (Files.exists(path)) {
            try {
                String json = Files.readString(path);
                Config config = gson.fromJson(json, Config.class);
                System.out.println("✓ Configuration loaded from: " + path.toAbsolutePath());
                return config;
            } catch (IOException e) {
                System.err.println("⚠ Failed to load config: " + e.getMessage());
                System.err.println("  Using default configuration");
                return new Config();
            }
        } else {
            System.out.println("ℹ Config file not found, using defaults");
            // Optionally create a default config file
            Config defaultConfig = new Config();
            try {
                save(defaultConfig, path);
                System.out.println("✓ Created default config file: " + path.toAbsolutePath());
            } catch (IOException e) {
                System.err.println("⚠ Could not create config file: " + e.getMessage());
            }
            return defaultConfig;
        }
    }

    /**
     * Save configuration to file
     */
    public static void save(Config config, Path path) throws IOException {
        String json = gson.toJson(config);
        // Ensure parent directory exists (handle case where parent is null)
        Path parentDir = path.getParent();
        if (parentDir != null) {
            Files.createDirectories(parentDir);
        }
        Files.writeString(path, json);
    }

    /**
     * Merge command line arguments with configuration
     */
    public static Config merge(Config config, String[] args) {
        // Parse command line arguments and override config values
        for (int i = 0; i < args.length; i++) {
            String arg = args[i];
            if (arg.startsWith("--")) {
                String[] parts = arg.substring(2).split("=", 2);
                if (parts.length == 2) {
                    String key = parts[0];
                    String value = parts[1];
                    
                    // Override specific config values
                    config = switch (key) {
                        case "mode" -> new Config(value, config.client(), config.server(),
                            config.database(), config.filesystem(), config.security(),
                            config.user(), config.logging(), config.syncServer());
                        case "http-port" -> {
                            if ("client".equals(config.mode())) {
                                yield new Config(config.mode(),
                                    new Config.ClientConfig(Integer.parseInt(value),
                                        config.client().wsPort(), config.client().bindAddress()),
                                    config.server(), config.database(), config.filesystem(),
                                    config.security(), config.user(), config.logging(),
                                    config.syncServer());
                            } else {
                                yield new Config(config.mode(), config.client(),
                                    new Config.ServerConfig(Integer.parseInt(value),
                                        config.server().wsPort(), config.server().bindAddress(),
                                        config.server().maxConnections(),
                                        config.server().sessionTimeout()),
                                    config.database(), config.filesystem(), config.security(),
                                    config.user(), config.logging(), config.syncServer());
                            }
                        }
                        case "ws-port" -> {
                            if ("client".equals(config.mode())) {
                                yield new Config(config.mode(),
                                    new Config.ClientConfig(config.client().httpPort(),
                                        Integer.parseInt(value), config.client().bindAddress()),
                                    config.server(), config.database(), config.filesystem(),
                                    config.security(), config.user(), config.logging(),
                                    config.syncServer());
                            } else {
                                yield new Config(config.mode(), config.client(),
                                    new Config.ServerConfig(config.server().httpPort(),
                                        Integer.parseInt(value), config.server().bindAddress(),
                                        config.server().maxConnections(),
                                        config.server().sessionTimeout()),
                                    config.database(), config.filesystem(), config.security(),
                                    config.user(), config.logging(), config.syncServer());
                            }
                        }
                        default -> config;
                    };
                }
            }
        }
        return config;
    }
}
