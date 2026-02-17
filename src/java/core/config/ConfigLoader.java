package config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 配置加载器
 */
public class ConfigLoader {
    private static final Gson gson = new GsonBuilder()
            .setPrettyPrinting()
            .create();

    /**
     * 从文件加载配置
     */
    public static Config load(String configPath) throws IOException {
        Path path = Paths.get(configPath);
        
        if (!Files.exists(path)) {
            System.err.println("Config file not found: " + configPath);
            System.err.println("Using default configuration");
            return Config.defaults();
        }

        try {
            String json = Files.readString(path);
            Config config = gson.fromJson(json, Config.class);
            
            // 验证配置
            validateConfig(config);
            
            return config;
        } catch (Exception e) {
            System.err.println("Error loading config: " + e.getMessage());
            System.err.println("Using default configuration");
            return Config.defaults();
        }
    }

    /**
     * 从命令行参数加载配置
     */
    public static Config loadFromArgs(String[] args) {
        String configPath = "./config.json";
        
        // 解析命令行参数
        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--config") && i + 1 < args.length) {
                configPath = args[i + 1];
                break;
            } else if (args[i].startsWith("--config=")) {
                configPath = args[i].substring("--config=".length());
                break;
            }
        }
        
        Path path = Paths.get(configPath);
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
                save(defaultConfig, configPath);
                System.out.println("✓ Created default config file: " + path.toAbsolutePath());
            } catch (IOException e) {
                System.err.println("⚠ Could not create config file: " + e.getMessage());
            }
            return defaultConfig;
        }
    }

    /**
     * 保存配置到文件
     */
    public static void save(Config config, String configPath) throws IOException {
        Path path = Paths.get(configPath);
        save(config, path);
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

    /**
     * Merge command line arguments into configuration
     */
    public static Config merge(Config config, String[] args) {
        String modeOverride = null;

        for (int i = 0; i < args.length; i++) {
            if ("--mode".equals(args[i]) && i + 1 < args.length) {
                modeOverride = args[i + 1];
                break;
            }

            if (args[i].startsWith("--mode=")) {
                modeOverride = args[i].substring("--mode=".length());
                break;
            }
        }

        if (modeOverride == null || modeOverride.isBlank()) {
            return config;
        }

        String normalizedMode = modeOverride.trim().toLowerCase();
        if (!"client".equals(normalizedMode) && !"server".equals(normalizedMode)) {
            System.err.println("⚠ Ignoring invalid mode override: " + modeOverride);
            return config;
        }

        if (normalizedMode.equals(config.mode())) {
            return config;
        }

        System.out.println("✓ Mode overridden by CLI: " + normalizedMode);
        return new Config(
            normalizedMode,
            config.client(),
            config.server(),
            config.database(),
            config.filesystem(),
            config.security(),
            config.user(),
            config.logging()
        );
    }

    /**
     * 创建默认配置文件
     */
    public static void createDefaultConfig(String configPath) throws IOException {
        Config defaultConfig = Config.defaults();
        save(defaultConfig, configPath);
        System.out.println("Created default config at: " + configPath);
    }

    /**
     * 验证配置有效性
     */
    private static void validateConfig(Config config) {
        if (config == null) {
            throw new IllegalArgumentException("Config cannot be null");
        }

        // 验证模式
        if (!"client".equals(config.mode()) && !"server".equals(config.mode())) {
            throw new IllegalArgumentException("Invalid mode: " + config.mode());
        }

        // 验证端口
        if (config.isClientMode()) {
            validatePort(config.client().httpPort(), "client.httpPort");
            validatePort(config.client().wsPort(), "client.wsPort");
        } else {
            validatePort(config.server().httpPort(), "server.httpPort");
            validatePort(config.server().wsPort(), "server.wsPort");
        }
    }

    /**
     * 验证端口号
     */
    private static void validatePort(int port, String name) {
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException("Invalid port " + name + ": " + port);
        }
    }
}
