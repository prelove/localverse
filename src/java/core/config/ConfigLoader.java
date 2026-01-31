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
                return Config.defaults();
            }
        } else {
            System.out.println("ℹ Config file not found, using defaults");
            Config defaultConfig = Config.defaults();
            // Try to create default config file
            try {
                String json = gson.toJson(defaultConfig);
                Files.writeString(path, json);
                System.out.println("✓ Created default config file: " + path.toAbsolutePath());
            } catch (IOException e) {
                System.err.println("⚠ Could not create config file: " + e.getMessage());
            }
            return defaultConfig;
        }
    }

    /**
     * Merge command line arguments into configuration
     */
    public static Config merge(Config config, String[] args) {
        // Command line arguments can override config file settings
        // For now, just return the config as-is
        // Future: Parse --mode, --port, etc.
        return config;
    }

    /**
     * Save configuration to file
     */
    public static void save(Config config, Path path) throws IOException {
        String json = gson.toJson(config);
        // Ensure parent directory exists
        Path parentDir = path.getParent();
        if (parentDir != null) {
            Files.createDirectories(parentDir);
        }
        Files.writeString(path, json);
    }
}
