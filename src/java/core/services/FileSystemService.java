package services;

import config.Config;
import models.FileInfo;
import utils.PathUtil;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

/**
 * File system service
 * Handles file operations with security checks
 */
public class FileSystemService {
    private final Config.FilesystemConfig config;

    public FileSystemService(Config.FilesystemConfig config) {
        this.config = config;
    }

    /**
     * List files in directory
     */
    public List<FileInfo> listDirectory(String pathStr, boolean recursive) throws IOException {
        Path path = PathUtil.normalize(pathStr);
        
        // Security check
        if (!PathUtil.isAllowed(path, config.allowedPaths())) {
            throw new IOException("Access denied: " + pathStr);
        }

        if (!Files.exists(path)) {
            throw new IOException("Path does not exist: " + pathStr);
        }

        if (!Files.isDirectory(path)) {
            throw new IOException("Path is not a directory: " + pathStr);
        }

        List<FileInfo> files = new ArrayList<>();
        
        if (recursive) {
            Files.walkFileTree(path, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (!PathUtil.isExcluded(file, config.excludePatterns())) {
                        files.add(FileInfo.from(file, attrs));
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (!dir.equals(path) && PathUtil.isExcluded(dir, config.excludePatterns())) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    if (!dir.equals(path)) {
                        files.add(FileInfo.from(dir, attrs));
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        } else {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(path)) {
                for (Path entry : stream) {
                    if (!PathUtil.isExcluded(entry, config.excludePatterns())) {
                        BasicFileAttributes attrs = Files.readAttributes(entry, BasicFileAttributes.class);
                        files.add(FileInfo.from(entry, attrs));
                    }
                }
            }
        }

        return files;
    }

    /**
     * Read file content as bytes
     */
    public byte[] readFile(String pathStr) throws IOException {
        Path path = PathUtil.normalize(pathStr);
        
        // Security check
        if (!PathUtil.isAllowed(path, config.allowedPaths())) {
            throw new IOException("Access denied: " + pathStr);
        }

        if (!Files.exists(path)) {
            throw new IOException("File does not exist: " + pathStr);
        }

        if (Files.isDirectory(path)) {
            throw new IOException("Path is a directory: " + pathStr);
        }

        // Size check
        long size = Files.size(path);
        if (!PathUtil.isValidSize(size, config.maxFileSize())) {
            throw new IOException("File too large: " + size + " bytes (max: " + config.maxFileSize() + ")");
        }

        return Files.readAllBytes(path);
    }

    /**
     * Write file content
     */
    public void writeFile(String pathStr, byte[] content) throws IOException {
        Path path = PathUtil.normalize(pathStr);
        
        // Security check
        if (!PathUtil.isAllowed(path, config.allowedPaths())) {
            throw new IOException("Access denied: " + pathStr);
        }

        // Size check
        if (!PathUtil.isValidSize(content.length, config.maxFileSize())) {
            throw new IOException("Content too large: " + content.length + " bytes (max: " + config.maxFileSize() + ")");
        }

        // Create parent directories if needed
        Path parent = path.getParent();
        if (parent != null && !Files.exists(parent)) {
            Files.createDirectories(parent);
        }

        Files.write(path, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    /**
     * Delete file or directory
     */
    public void delete(String pathStr) throws IOException {
        Path path = PathUtil.normalize(pathStr);
        
        // Security check
        if (!PathUtil.isAllowed(path, config.allowedPaths())) {
            throw new IOException("Access denied: " + pathStr);
        }

        if (!Files.exists(path)) {
            throw new IOException("Path does not exist: " + pathStr);
        }

        if (Files.isDirectory(path)) {
            // Delete directory recursively
            Files.walkFileTree(path, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } else {
            Files.delete(path);
        }
    }

    /**
     * Get file info
     */
    public FileInfo getFileInfo(String pathStr) throws IOException {
        Path path = PathUtil.normalize(pathStr);
        
        // Security check
        if (!PathUtil.isAllowed(path, config.allowedPaths())) {
            throw new IOException("Access denied: " + pathStr);
        }

        if (!Files.exists(path)) {
            throw new IOException("Path does not exist: " + pathStr);
        }

        BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
        return FileInfo.from(path, attrs);
    }
}
