import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 日志工具类 - 简单的文件日志记录
 */
public class LogUtil {
    
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static Path logFile;
    private static boolean silent = false;
    
    /**
     * 初始化日志
     * 
     * @param logPath 日志文件路径
     */
    public static void init(Path logPath) {
        logFile = logPath;
        try {
            // 确保日志目录存在
            if (logFile.getParent() != null) {
                Files.createDirectories(logFile.getParent());
            }
            // 创建或追加日志文件
            if (!Files.exists(logFile)) {
                Files.createFile(logFile);
            }
        } catch (IOException e) {
            System.err.println("Failed to initialize log file: " + e.getMessage());
        }
    }
    
    /**
     * 设置静默模式
     */
    public static void setSilent(boolean silentMode) {
        silent = silentMode;
    }
    
    /**
     * 记录 INFO 级别日志
     */
    public static void info(String message) {
        log("INFO", message);
    }
    
    /**
     * 记录 WARN 级别日志
     */
    public static void warn(String message) {
        log("WARN", message);
    }
    
    /**
     * 记录 ERROR 级别日志
     */
    public static void error(String message) {
        log("ERROR", message);
    }
    
    /**
     * 记录日志
     */
    private static void log(String level, String message) {
        String timestamp = LocalDateTime.now().format(FORMATTER);
        String logLine = String.format("[%s] [%s] %s%n", timestamp, level, message);
        
        // 输出到控制台（除非静默模式）
        if (!silent) {
            System.out.print(logLine);
        }
        
        // 写入文件
        if (logFile != null) {
            try {
                Files.writeString(logFile, logLine, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            } catch (IOException e) {
                System.err.println("Failed to write log: " + e.getMessage());
            }
        }
    }
}
