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

        try {
            return load(configPath);
        } catch (IOException e) {
            System.err.println("Failed to load config: " + e.getMessage());
            return Config.defaults();
        }
    }

    /**
     * 保存配置到文件
     */
    public static void save(Config config, String configPath) throws IOException {
        Path path = Paths.get(configPath);
        
        // 确保目录存在
        Path parent = path.getParent();
        if (parent != null && !Files.exists(parent)) {
            Files.createDirectories(parent);
        }

        String json = gson.toJson(config);
        Files.writeString(path, json);
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
