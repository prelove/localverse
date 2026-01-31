package utils;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.IOException;

/**
 * Path utilities for validation and security
 */
public class PathUtil {
    
    /**
     * Normalize and validate path
     */
    public static Path normalize(String path) throws IOException {
        if (path == null || path.isEmpty()) {
            throw new IOException("Path cannot be null or empty");
        }
        
        // Normalize the path
        Path normalized = Paths.get(path).normalize().toAbsolutePath();
        
        return normalized;
    }

    /**
     * Check if path is within allowed directories
     */
    public static boolean isAllowed(Path path, String[] allowedPaths) {
        if (allowedPaths == null || allowedPaths.length == 0) {
            return false;
        }
        
        Path absolutePath = path.toAbsolutePath().normalize();
        
        for (String allowedPath : allowedPaths) {
            Path allowed = Paths.get(allowedPath).toAbsolutePath().normalize();
            if (absolutePath.startsWith(allowed)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if path matches exclusion patterns
     */
    public static boolean isExcluded(Path path, String[] excludePatterns) {
        if (excludePatterns == null || excludePatterns.length == 0) {
            return false;
        }
        
        String pathStr = path.toString();
        for (String pattern : excludePatterns) {
            // Convert glob pattern to regex
            // Replace * first (but not **), then replace **
            String regex = pattern
                .replace("**", "\0DOUBLESTAR\0")  // Temporary placeholder
                .replace("*", "[^/\\\\]*")        // Single star
                .replace("\0DOUBLESTAR\0", ".*"); // Double star
            if (pathStr.matches(regex)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get file extension
     */
    public static String getExtension(Path path) {
        String fileName = path.getFileName().toString();
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0 && lastDot < fileName.length() - 1) {
            return fileName.substring(lastDot + 1);
        }
        return "";
    }

    /**
     * Validate file size
     */
    public static boolean isValidSize(long size, long maxSize) {
        return size <= maxSize;
    }
}
