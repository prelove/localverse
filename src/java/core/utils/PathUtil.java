package utils;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * 路径工具类 - 提供路径安全验证
 */
public class PathUtil {
    
    /**
     * 规范化路径
     */
    public static Path normalize(String path) {
        Path p = Paths.get(path).normalize();
        return p.toAbsolutePath();
    }

    /**
     * 检查路径是否安全（不包含 .. 等危险字符）
     */
    public static boolean isSafe(String path) {
        if (path == null || path.isEmpty()) {
            return false;
        }

        // 检查危险字符
        if (path.contains("..") || path.contains("~")) {
            return false;
        }

        try {
            Path p = Paths.get(path).normalize();
            String normalized = p.toString();
            
            // 检查规范化后是否仍包含 ..
            return !normalized.contains("..");
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 检查路径是否在允许的目录内
     */
    public static boolean isAllowed(String path, List<String> allowedPaths) {
        if (allowedPaths == null || allowedPaths.isEmpty()) {
            return true; // 如果没有限制，则允许所有
        }

        try {
            Path target = normalize(path);
            
            for (String allowed : allowedPaths) {
                Path allowedPath = normalize(allowed);
                if (target.startsWith(allowedPath)) {
                    return true;
                }
            }
            
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 检查是否为系统目录
     */
    public static boolean isSystemPath(String path) {
        String lower = path.toLowerCase();
        
        // Windows 系统目录
        if (lower.startsWith("c:\\windows") || 
            lower.startsWith("c:\\program files") ||
            lower.startsWith("c:\\programdata")) {
            return true;
        }

        // Unix/Linux 系统目录
        if (lower.startsWith("/etc") || 
            lower.startsWith("/sys") || 
            lower.startsWith("/proc") ||
            lower.startsWith("/dev")) {
            return true;
        }

        return false;
    }

    /**
     * 组合路径
     */
    public static String join(String... parts) {
        Path path = Paths.get(parts[0]);
        for (int i = 1; i < parts.length; i++) {
            path = path.resolve(parts[i]);
        }
        return path.toString();
    }

    /**
     * 获取文件扩展名
     */
    public static String getExtension(String filename) {
        if (filename == null || filename.isEmpty()) {
            return "";
        }

        int lastDot = filename.lastIndexOf('.');
        if (lastDot == -1 || lastDot == filename.length() - 1) {
            return "";
        }

        return filename.substring(lastDot + 1).toLowerCase();
    }

    /**
     * 获取文件名（不含扩展名）
     */
    public static String getNameWithoutExtension(String filename) {
        if (filename == null || filename.isEmpty()) {
            return "";
        }

        int lastDot = filename.lastIndexOf('.');
        if (lastDot == -1) {
            return filename;
        }

        return filename.substring(0, lastDot);
    }
}
