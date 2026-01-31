# FileSystem Service 规格

## 概述

FileSystemService 提供文件系统操作能力：
1. 文件读写（JAR 模式：真实文件系统，WASM 模式：虚拟文件系统）
2. 目录遍历
3. 文件监视（仅 JAR 模式）
4. 文件搜索

## 接口定义

### TypeScript 接口（前端）

```typescript
interface FileSystemService {
  // 读取
  readFile(path: string): Promise<Uint8Array>;
  readText(path: string, encoding?: string): Promise<string>;
  readJson<T>(path: string): Promise<T>;
  
  // 写入
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeText(path: string, content: string, encoding?: string): Promise<void>;
  writeJson(path: string, data: any): Promise<void>;
  
  // 目录操作
  listDir(path: string, options?: ListOptions): Promise<FileInfo[]>;
  mkdir(path: string, recursive?: boolean): Promise<void>;
  
  // 文件操作
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileInfo>;
  delete(path: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  
  // 监视（仅 JAR 模式）
  watch(paths: string[], callback: WatchCallback): Promise<WatchHandle>;
  
  // 搜索
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // 导入导出（跨模式）
  importFile(file: File): Promise<string>;
  exportFile(path: string): Promise<Blob>;
  
  // 状态
  getMode(): 'jar' | 'virtual';
  getStats(): Promise<FileSystemStats>;
}

interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  createdAt: number;
  modifiedAt: number;
  mimeType?: string;
}

interface ListOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: (file: FileInfo) => boolean;
}

interface WatchCallback {
  (event: WatchEvent): void;
}

interface WatchEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}

interface WatchHandle {
  stop(): void;
}

interface SearchOptions {
  paths?: string[];
  extensions?: string[];
  maxResults?: number;
  includeContent?: boolean;
}

interface SearchResult {
  path: string;
  name: string;
  matchType: 'name' | 'content';
  snippet?: string;
  score: number;
}

interface FileSystemStats {
  mode: 'jar' | 'virtual';
  totalFiles: number;
  totalSize: number;
  watchedPaths: string[];
}
```

### Java 接口（后端）

```java
public interface FileSystemService {
    // 读取
    byte[] readFile(String path) throws IOException;
    String readText(String path, Charset charset) throws IOException;
    
    // 写入
    void writeFile(String path, byte[] data) throws IOException;
    void writeText(String path, String content, Charset charset) throws IOException;
    
    // 目录操作
    List<FileInfo> listDir(String path, ListOptions options) throws IOException;
    void mkdir(String path, boolean recursive) throws IOException;
    
    // 文件操作
    boolean exists(String path);
    FileInfo stat(String path) throws IOException;
    void delete(String path) throws IOException;
    void move(String src, String dest) throws IOException;
    void copy(String src, String dest) throws IOException;
    
    // 监视
    WatchHandle watch(List<String> paths, WatchCallback callback) throws IOException;
    
    // 搜索
    List<SearchResult> search(String query, SearchOptions options) throws IOException;
    
    // 状态
    FileSystemStats getStats();
}
```

## JAR 模式实现

```java
// services/LocalFileSystemService.java

package com.localverse.services;

import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.*;

public class LocalFileSystemService implements FileSystemService {
    private WatchService watchService;
    private ExecutorService watchExecutor;
    private Map<WatchKey, Path> watchKeyMap = new ConcurrentHashMap<>();
    private List<WatchCallback> callbacks = new CopyOnWriteArrayList<>();
    
    public LocalFileSystemService() {
        try {
            this.watchService = FileSystems.getDefault().newWatchService();
            this.watchExecutor = Executors.newSingleThreadExecutor();
            startWatchLoop();
        } catch (IOException e) {
            throw new RuntimeException("Failed to create watch service", e);
        }
    }
    
    @Override
    public byte[] readFile(String path) throws IOException {
        return Files.readAllBytes(Path.of(path));
    }
    
    @Override
    public String readText(String path, Charset charset) throws IOException {
        return Files.readString(Path.of(path), charset);
    }
    
    @Override
    public void writeFile(String path, byte[] data) throws IOException {
        Path p = Path.of(path);
        Files.createDirectories(p.getParent());
        Files.write(p, data);
    }
    
    @Override
    public void writeText(String path, String content, Charset charset) throws IOException {
        Path p = Path.of(path);
        Files.createDirectories(p.getParent());
        Files.writeString(p, content, charset);
    }
    
    @Override
    public List<FileInfo> listDir(String path, ListOptions options) throws IOException {
        Path dir = Path.of(path);
        
        if (options.recursive()) {
            return Files.walk(dir)
                .filter(p -> !p.equals(dir))
                .filter(p -> options.includeHidden() || !isHidden(p))
                .map(this::toFileInfo)
                .filter(f -> options.filter() == null || options.filter().test(f))
                .collect(Collectors.toList());
        } else {
            return Files.list(dir)
                .filter(p -> options.includeHidden() || !isHidden(p))
                .map(this::toFileInfo)
                .filter(f -> options.filter() == null || options.filter().test(f))
                .collect(Collectors.toList());
        }
    }
    
    @Override
    public void mkdir(String path, boolean recursive) throws IOException {
        Path p = Path.of(path);
        if (recursive) {
            Files.createDirectories(p);
        } else {
            Files.createDirectory(p);
        }
    }
    
    @Override
    public boolean exists(String path) {
        return Files.exists(Path.of(path));
    }
    
    @Override
    public FileInfo stat(String path) throws IOException {
        return toFileInfo(Path.of(path));
    }
    
    @Override
    public void delete(String path) throws IOException {
        Path p = Path.of(path);
        if (Files.isDirectory(p)) {
            // 递归删除
            Files.walk(p)
                .sorted(Comparator.reverseOrder())
                .forEach(path1 -> {
                    try {
                        Files.delete(path1);
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                });
        } else {
            Files.delete(p);
        }
    }
    
    @Override
    public void move(String src, String dest) throws IOException {
        Files.move(Path.of(src), Path.of(dest), StandardCopyOption.REPLACE_EXISTING);
    }
    
    @Override
    public void copy(String src, String dest) throws IOException {
        Path srcPath = Path.of(src);
        Path destPath = Path.of(dest);
        
        if (Files.isDirectory(srcPath)) {
            // 递归复制
            Files.walk(srcPath).forEach(source -> {
                try {
                    Path target = destPath.resolve(srcPath.relativize(source));
                    if (Files.isDirectory(source)) {
                        Files.createDirectories(target);
                    } else {
                        Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
                    }
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } else {
            Files.copy(srcPath, destPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }
    
    @Override
    public WatchHandle watch(List<String> paths, WatchCallback callback) throws IOException {
        callbacks.add(callback);
        
        for (String path : paths) {
            registerWatchRecursive(Path.of(path));
        }
        
        return () -> {
            callbacks.remove(callback);
        };
    }
    
    private void registerWatchRecursive(Path path) throws IOException {
        if (Files.isDirectory(path)) {
            WatchKey key = path.register(watchService,
                StandardWatchEventKinds.ENTRY_CREATE,
                StandardWatchEventKinds.ENTRY_DELETE,
                StandardWatchEventKinds.ENTRY_MODIFY);
            watchKeyMap.put(key, path);
            
            // 递归注册子目录
            Files.list(path)
                .filter(Files::isDirectory)
                .forEach(p -> {
                    try {
                        registerWatchRecursive(p);
                    } catch (IOException e) {
                        // 忽略无法监视的目录
                    }
                });
        }
    }
    
    private void startWatchLoop() {
        watchExecutor.submit(() -> {
            while (true) {
                try {
                    WatchKey key = watchService.take();
                    Path dir = watchKeyMap.get(key);
                    
                    for (WatchEvent<?> event : key.pollEvents()) {
                        WatchEvent.Kind<?> kind = event.kind();
                        
                        if (kind == StandardWatchEventKinds.OVERFLOW) {
                            continue;
                        }
                        
                        @SuppressWarnings("unchecked")
                        WatchEvent<Path> ev = (WatchEvent<Path>) event;
                        Path filename = ev.context();
                        Path fullPath = dir.resolve(filename);
                        
                        String eventType;
                        if (kind == StandardWatchEventKinds.ENTRY_CREATE) {
                            eventType = "created";
                            // 如果是新目录，递归注册监视
                            if (Files.isDirectory(fullPath)) {
                                registerWatchRecursive(fullPath);
                            }
                        } else if (kind == StandardWatchEventKinds.ENTRY_DELETE) {
                            eventType = "deleted";
                        } else {
                            eventType = "modified";
                        }
                        
                        WatchEvent watchEvent = new WatchEvent(
                            eventType,
                            fullPath.toString(),
                            System.currentTimeMillis()
                        );
                        
                        for (WatchCallback callback : callbacks) {
                            try {
                                callback.onEvent(watchEvent);
                            } catch (Exception e) {
                                // 忽略回调错误
                            }
                        }
                    }
                    
                    key.reset();
                } catch (InterruptedException e) {
                    break;
                } catch (IOException e) {
                    // 继续
                }
            }
        });
    }
    
    @Override
    public List<SearchResult> search(String query, SearchOptions options) throws IOException {
        List<SearchResult> results = new ArrayList<>();
        List<Path> searchPaths = options.paths() != null 
            ? options.paths().stream().map(Path::of).toList()
            : List.of(Path.of(System.getProperty("user.home")));
        
        String lowerQuery = query.toLowerCase();
        
        for (Path searchPath : searchPaths) {
            Files.walk(searchPath)
                .filter(Files::isRegularFile)
                .filter(p -> options.extensions() == null || 
                    options.extensions().stream().anyMatch(ext -> 
                        p.toString().toLowerCase().endsWith("." + ext)))
                .forEach(p -> {
                    String name = p.getFileName().toString();
                    
                    // 文件名匹配
                    if (name.toLowerCase().contains(lowerQuery)) {
                        results.add(new SearchResult(
                            p.toString(),
                            name,
                            "name",
                            null,
                            calculateScore(name, query)
                        ));
                    }
                    
                    // 内容匹配
                    if (options.includeContent() && isTextFile(p)) {
                        try {
                            String content = Files.readString(p);
                            if (content.toLowerCase().contains(lowerQuery)) {
                                String snippet = extractSnippet(content, query);
                                results.add(new SearchResult(
                                    p.toString(),
                                    name,
                                    "content",
                                    snippet,
                                    calculateScore(content, query) * 0.8
                                ));
                            }
                        } catch (IOException e) {
                            // 忽略无法读取的文件
                        }
                    }
                });
        }
        
        // 排序并限制结果数
        return results.stream()
            .sorted((a, b) -> Double.compare(b.score(), a.score()))
            .limit(options.maxResults() != null ? options.maxResults() : 100)
            .toList();
    }
    
    private FileInfo toFileInfo(Path path) {
        try {
            BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
            String name = path.getFileName().toString();
            String ext = "";
            int dotIndex = name.lastIndexOf('.');
            if (dotIndex > 0) {
                ext = name.substring(dotIndex + 1);
            }
            
            return new FileInfo(
                path.toString(),
                name,
                ext,
                attrs.size(),
                attrs.isDirectory(),
                attrs.creationTime().toMillis(),
                attrs.lastModifiedTime().toMillis(),
                getMimeType(path)
            );
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
    
    private boolean isHidden(Path path) {
        try {
            return Files.isHidden(path) || path.getFileName().toString().startsWith(".");
        } catch (IOException e) {
            return false;
        }
    }
    
    private String getMimeType(Path path) {
        try {
            return Files.probeContentType(path);
        } catch (IOException e) {
            return null;
        }
    }
    
    private boolean isTextFile(Path path) {
        String name = path.toString().toLowerCase();
        return name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json") ||
               name.endsWith(".xml") || name.endsWith(".html") || name.endsWith(".css") ||
               name.endsWith(".js") || name.endsWith(".java") || name.endsWith(".py");
    }
    
    private double calculateScore(String text, String query) {
        // 简单评分算法
        String lower = text.toLowerCase();
        String lowerQuery = query.toLowerCase();
        
        if (lower.equals(lowerQuery)) return 1.0;
        if (lower.startsWith(lowerQuery)) return 0.9;
        if (lower.contains(lowerQuery)) return 0.5;
        return 0.1;
    }
    
    private String extractSnippet(String content, String query) {
        int index = content.toLowerCase().indexOf(query.toLowerCase());
        if (index < 0) return null;
        
        int start = Math.max(0, index - 50);
        int end = Math.min(content.length(), index + query.length() + 50);
        
        String snippet = content.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < content.length()) snippet = snippet + "...";
        
        return snippet;
    }
    
    @Override
    public FileSystemStats getStats() {
        return new FileSystemStats(
            "jar",
            -1,  // 需要额外计算
            -1,
            watchKeyMap.values().stream().map(Path::toString).toList()
        );
    }
}
```

## 虚拟文件系统实现（WASM 模式）

```javascript
// services/virtual-filesystem.js

class VirtualFileSystemService {
  constructor(db) {
    this.db = db;
    this.mode = 'virtual';
  }
  
  async readFile(path) {
    const file = await this.db.queryOne(
      'SELECT data FROM virtual_files WHERE path = ? AND deleted = 0',
      [path]
    );
    
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    
    return new Uint8Array(file.data);
  }
  
  async readText(path, encoding = 'utf-8') {
    const data = await this.readFile(path);
    return new TextDecoder(encoding).decode(data);
  }
  
  async readJson(path) {
    const text = await this.readText(path);
    return JSON.parse(text);
  }
  
  async writeFile(path, data) {
    const now = Date.now();
    const name = path.split('/').pop();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    
    await this.db.run(`
      INSERT OR REPLACE INTO virtual_files 
      (path, name, extension, data, size, created_at, updated_at, deleted)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM virtual_files WHERE path = ?), ?), ?, 0)
    `, [path, name, ext, data, data.byteLength, path, now, now]);
  }
  
  async writeText(path, content, encoding = 'utf-8') {
    const data = new TextEncoder().encode(content);
    await this.writeFile(path, data);
  }
  
  async writeJson(path, obj) {
    await this.writeText(path, JSON.stringify(obj, null, 2));
  }
  
  async listDir(path, options = {}) {
    const pattern = path.endsWith('/') ? path : path + '/';
    
    let sql = `
      SELECT path, name, extension, size, is_directory, created_at, updated_at
      FROM virtual_files
      WHERE path LIKE ? AND deleted = 0
    `;
    
    const params = [pattern + '%'];
    
    if (!options.recursive) {
      sql += ` AND path NOT LIKE ?`;
      params.push(pattern + '%/%');
    }
    
    const files = await this.db.query(sql, params);
    
    return files.map(f => ({
      path: f.path,
      name: f.name,
      extension: f.extension,
      size: f.size,
      isDirectory: f.is_directory === 1,
      createdAt: f.created_at,
      modifiedAt: f.updated_at
    })).filter(f => !options.filter || options.filter(f));
  }
  
  async mkdir(path, recursive = true) {
    const now = Date.now();
    const name = path.split('/').pop();
    
    if (recursive) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath += '/' + part;
        await this.db.run(`
          INSERT OR IGNORE INTO virtual_files 
          (path, name, extension, size, is_directory, created_at, updated_at, deleted)
          VALUES (?, ?, '', 0, 1, ?, ?, 0)
        `, [currentPath, part, now, now]);
      }
    } else {
      await this.db.run(`
        INSERT INTO virtual_files 
        (path, name, extension, size, is_directory, created_at, updated_at, deleted)
        VALUES (?, ?, '', 0, 1, ?, ?, 0)
      `, [path, name, now, now]);
    }
  }
  
  async exists(path) {
    const result = await this.db.queryOne(
      'SELECT 1 FROM virtual_files WHERE path = ? AND deleted = 0',
      [path]
    );
    return !!result;
  }
  
  async stat(path) {
    const file = await this.db.queryOne(
      'SELECT * FROM virtual_files WHERE path = ? AND deleted = 0',
      [path]
    );
    
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    
    return {
      path: file.path,
      name: file.name,
      extension: file.extension,
      size: file.size,
      isDirectory: file.is_directory === 1,
      createdAt: file.created_at,
      modifiedAt: file.updated_at
    };
  }
  
  async delete(path) {
    await this.db.run(
      'UPDATE virtual_files SET deleted = 1, updated_at = ? WHERE path = ? OR path LIKE ?',
      [Date.now(), path, path + '/%']
    );
  }
  
  async move(src, dest) {
    const file = await this.stat(src);
    const data = file.isDirectory ? null : await this.readFile(src);
    
    if (data) {
      await this.writeFile(dest, data);
    } else {
      await this.mkdir(dest);
    }
    
    await this.delete(src);
  }
  
  async copy(src, dest) {
    const file = await this.stat(src);
    
    if (file.isDirectory) {
      await this.mkdir(dest);
      const children = await this.listDir(src);
      for (const child of children) {
        const childDest = dest + '/' + child.name;
        await this.copy(child.path, childDest);
      }
    } else {
      const data = await this.readFile(src);
      await this.writeFile(dest, data);
    }
  }
  
  // 虚拟模式不支持真正的文件监视
  async watch(paths, callback) {
    console.warn('File watching not supported in virtual mode');
    return { stop: () => {} };
  }
  
  async search(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const results = [];
    
    const files = await this.db.query(
      'SELECT * FROM virtual_files WHERE deleted = 0'
    );
    
    for (const file of files) {
      // 文件名匹配
      if (file.name.toLowerCase().includes(lowerQuery)) {
        results.push({
          path: file.path,
          name: file.name,
          matchType: 'name',
          score: file.name.toLowerCase() === lowerQuery ? 1.0 : 0.5
        });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults || 100);
  }
  
  // 从外部导入文件
  async importFile(file) {
    const data = await file.arrayBuffer();
    const path = '/imports/' + file.name;
    
    await this.mkdir('/imports');
    await this.writeFile(path, new Uint8Array(data));
    
    return path;
  }
  
  // 导出文件
  async exportFile(path) {
    const data = await this.readFile(path);
    const file = await this.stat(path);
    
    return new Blob([data], { type: file.mimeType || 'application/octet-stream' });
  }
  
  getMode() {
    return 'virtual';
  }
  
  async getStats() {
    const stats = await this.db.queryOne(`
      SELECT 
        COUNT(*) as totalFiles,
        SUM(size) as totalSize
      FROM virtual_files WHERE deleted = 0
    `);
    
    return {
      mode: 'virtual',
      totalFiles: stats?.totalFiles || 0,
      totalSize: stats?.totalSize || 0,
      watchedPaths: []
    };
  }
}

export default VirtualFileSystemService;
```

## 初始化 SQL

```sql
-- 虚拟文件系统表
CREATE TABLE IF NOT EXISTS virtual_files (
    path TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    extension TEXT,
    data BLOB,
    size INTEGER DEFAULT 0,
    is_directory INTEGER DEFAULT 0,
    mime_type TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_virtual_files_name ON virtual_files(name);
CREATE INDEX IF NOT EXISTS idx_virtual_files_ext ON virtual_files(extension);
```

## 测试用例

```javascript
describe('FileSystemService', () => {
  describe('Virtual Mode', () => {
    let fs;
    let db;
    
    beforeEach(async () => {
      db = new WasmDatabaseService();
      await db.init();
      fs = new VirtualFileSystemService(db);
    });
    
    test('写入和读取文件', async () => {
      await fs.writeText('/test.txt', 'Hello World');
      const content = await fs.readText('/test.txt');
      expect(content).toBe('Hello World');
    });
    
    test('创建目录', async () => {
      await fs.mkdir('/a/b/c', true);
      expect(await fs.exists('/a')).toBe(true);
      expect(await fs.exists('/a/b')).toBe(true);
      expect(await fs.exists('/a/b/c')).toBe(true);
    });
    
    test('列出目录', async () => {
      await fs.writeText('/dir/file1.txt', '1');
      await fs.writeText('/dir/file2.txt', '2');
      
      const files = await fs.listDir('/dir');
      expect(files).toHaveLength(2);
    });
    
    test('删除文件', async () => {
      await fs.writeText('/delete-me.txt', 'test');
      expect(await fs.exists('/delete-me.txt')).toBe(true);
      
      await fs.delete('/delete-me.txt');
      expect(await fs.exists('/delete-me.txt')).toBe(false);
    });
    
    test('搜索文件', async () => {
      await fs.writeText('/docs/readme.md', '# Readme');
      await fs.writeText('/docs/guide.md', '# Guide');
      
      const results = await fs.search('readme');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('readme.md');
    });
  });
});
```

## 相关规格

- `02-local-jar.md` - JAR 端实现
- `plugins/finder.md` - 文件搜索插件

## 相关任务

- `tasks/phase-0/task-007-filesystem-service.md`