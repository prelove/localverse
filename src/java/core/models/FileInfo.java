package models;

import java.time.Instant;

/**
 * File information model
 */
public record FileInfo(
    String path,
    String name,
    String extension,
    long size,
    Instant createdAt,
    Instant modifiedAt,
    boolean isDirectory
) {
    public static FileInfo from(java.nio.file.Path filePath, java.nio.file.attribute.BasicFileAttributes attrs) {
        String name = filePath.getFileName().toString();
        String ext = "";
        if (!attrs.isDirectory()) {
            int lastDot = name.lastIndexOf('.');
            if (lastDot > 0 && lastDot < name.length() - 1) {
                ext = name.substring(lastDot + 1);
            }
        }
        
        return new FileInfo(
            filePath.toString(),
            name,
            ext,
            attrs.size(),
            attrs.creationTime().toInstant(),
            attrs.lastModifiedTime().toInstant(),
            attrs.isDirectory()
        );
    }
}
