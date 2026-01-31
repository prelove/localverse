package services;

import config.Config;
import utils.PathUtil;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 文件系统服务
 */
public class FileSystemService {
    private final Config config;
    private final List<String> allowedPaths;

    public FileSystemService(Config config) {
        this.config = config;
        this.allowedPaths = config.filesystem().watchPaths();
    }

    /**
     * 文件信息记录
     */
    public record FileInfo(
        String path,
        String name,
        String extension,
        long size,
        Instant createdAt,
        Instant modifiedAt,
        boolean isDirectory,
        Map<String, Object> metadata
    ) {}

    /**
     * 读取文件内容（字节）
     */
    public byte[] readFile(String path) throws IOException {
        validatePath(path);
        Path p = Paths.get(path);
        
        if (!Files.exists(p)) {
            throw new IOException("File not found: " + path);
        }

        if (Files.isDirectory(p)) {
            throw new IOException("Path is a directory: " + path);
        }

        // 检查文件大小
        long size = Files.size(p);
        if (size > config.filesystem().maxFileSize()) {
            throw new IOException("File too large: " + size + " bytes");
        }

        return Files.readAllBytes(p);
    }

    /**
     * 读取文本文件
     */
    public String readText(String path, Charset charset) throws IOException {
        byte[] bytes = readFile(path);
        return new String(bytes, charset);
    }

    /**
     * 读取文本文件（UTF-8）
     */
    public String readText(String path) throws IOException {
        return readText(path, StandardCharsets.UTF_8);
    }

    /**
     * 写入文件
     */
    public void writeFile(String path, byte[] content) throws IOException {
        validatePath(path);
        
        if (content.length > config.filesystem().maxFileSize()) {
            throw new IOException("Content too large: " + content.length + " bytes");
        }

        Path p = Paths.get(path);
        
        // 确保父目录存在
        Path parent = p.getParent();
        if (parent != null && !Files.exists(parent)) {
            Files.createDirectories(parent);
        }

        Files.write(p, content);
    }

    /**
     * 写入文本文件
     */
    public void writeText(String path, String content, Charset charset) throws IOException {
        writeFile(path, content.getBytes(charset));
    }

    /**
     * 写入文本文件（UTF-8）
     */
    public void writeText(String path, String content) throws IOException {
        writeText(path, content, StandardCharsets.UTF_8);
    }

    /**
     * 追加文本
     */
    public void appendText(String path, String content) throws IOException {
        validatePath(path);
        Path p = Paths.get(path);
        Files.writeString(p, content, StandardCharsets.UTF_8, 
                         StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    /**
     * 列出目录内容
     */
    public List<FileInfo> listDirectory(String path) throws IOException {
        return listDirectory(path, false);
    }

    /**
     * 列出目录内容（支持递归）
     */
    public List<FileInfo> listDirectory(String path, boolean recursive) throws IOException {
        validatePath(path);
        Path p = Paths.get(path);

        if (!Files.exists(p)) {
            throw new IOException("Directory not found: " + path);
        }

        if (!Files.isDirectory(p)) {
            throw new IOException("Path is not a directory: " + path);
        }

        List<FileInfo> files = new ArrayList<>();

        if (recursive) {
            try (Stream<Path> stream = Files.walk(p)) {
                stream.filter(f -> !f.equals(p))
                      .forEach(f -> {
                          try {
                              files.add(getFileInfo(f.toString()));
                          } catch (IOException e) {
                              System.err.println("Warning: Cannot access file: " + f + " - " + e.getMessage());
                          }
                      });
            }
        } else {
            try (Stream<Path> stream = Files.list(p)) {
                stream.forEach(f -> {
                    try {
                        files.add(getFileInfo(f.toString()));
                    } catch (IOException e) {
                        System.err.println("Warning: Cannot access file: " + f + " - " + e.getMessage());
                    }
                });
            }
        }

        return files;
    }

    /**
     * 获取文件信息
     */
    public FileInfo getFileInfo(String path) throws IOException {
        Path p = Paths.get(path);

        if (!Files.exists(p)) {
            throw new IOException("File not found: " + path);
        }

        BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
        
        return new FileInfo(
            p.toAbsolutePath().toString(),
            p.getFileName().toString(),
            PathUtil.getExtension(p.getFileName().toString()),
            attrs.size(),
            attrs.creationTime().toInstant(),
            attrs.lastModifiedTime().toInstant(),
            attrs.isDirectory(),
            Map.of()
        );
    }

    /**
     * 创建目录
     */
    public void createDirectory(String path) throws IOException {
        validatePath(path);
        Path p = Paths.get(path);
        Files.createDirectories(p);
    }

    /**
     * 删除文件或目录
     */
    public void delete(String path) throws IOException {
        validatePath(path);
        Path p = Paths.get(path);

        if (!Files.exists(p)) {
            throw new IOException("File not found: " + path);
        }

        if (Files.isDirectory(p)) {
            // 递归删除目录
            try (Stream<Path> stream = Files.walk(p)) {
                stream.sorted(Comparator.reverseOrder())
                      .forEach(f -> {
                          try {
                              Files.delete(f);
                          } catch (IOException e) {
                              System.err.println("Warning: Cannot delete file: " + f + " - " + e.getMessage());
                          }
                      });
            }
        } else {
            Files.delete(p);
        }
    }

    /**
     * 移动文件或目录
     */
    public void move(String src, String dest) throws IOException {
        validatePath(src);
        validatePath(dest);
        
        Path srcPath = Paths.get(src);
        Path destPath = Paths.get(dest);

        if (!Files.exists(srcPath)) {
            throw new IOException("Source not found: " + src);
        }

        Files.move(srcPath, destPath, StandardCopyOption.REPLACE_EXISTING);
    }

    /**
     * 复制文件或目录
     */
    public void copy(String src, String dest) throws IOException {
        validatePath(src);
        validatePath(dest);
        
        Path srcPath = Paths.get(src);
        Path destPath = Paths.get(dest);

        if (!Files.exists(srcPath)) {
            throw new IOException("Source not found: " + src);
        }

        if (Files.isDirectory(srcPath)) {
            copyDirectory(srcPath, destPath);
        } else {
            Files.copy(srcPath, destPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    /**
     * 递归复制目录
     */
    private void copyDirectory(Path src, Path dest) throws IOException {
        try (Stream<Path> stream = Files.walk(src)) {
            stream.forEach(source -> {
                try {
                    Path target = dest.resolve(src.relativize(source));
                    if (Files.isDirectory(source)) {
                        Files.createDirectories(target);
                    } else {
                        Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
                    }
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            });
        }
    }

    /**
     * 验证路径安全性
     */
    private void validatePath(String path) throws IOException {
        if (!PathUtil.isSafe(path)) {
            throw new IOException("Unsafe path: " + path);
        }

        if (PathUtil.isSystemPath(path)) {
            throw new IOException("System path access denied: " + path);
        }

        if (!allowedPaths.isEmpty() && !PathUtil.isAllowed(path, allowedPaths)) {
            throw new IOException("Path not in allowed list: " + path);
        }
    }
}
