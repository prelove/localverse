import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;

/**
 * 版本管理类 - 处理版本信息、更新和回滚
 */
public class VersionManager {
    
    private final Path versionFile;
    private final Path mainJar;
    private final Path backupJar;
    private final Path tempDir;
    private final Path updateFlag;
    
    private VersionInfo versionInfo;
    
    public VersionManager(Path versionFile, Path mainJar, Path backupJar, Path tempDir) {
        this.versionFile = versionFile;
        this.mainJar = mainJar;
        this.backupJar = backupJar;
        this.tempDir = tempDir;
        this.updateFlag = mainJar.getParent().resolve("update_pending.flag");
    }
    
    /**
     * 加载版本信息
     */
    public VersionInfo loadVersion() {
        if (versionInfo != null) {
            return versionInfo;
        }
        
        try {
            if (Files.exists(versionFile)) {
                String content = Files.readString(versionFile);
                versionInfo = parseVersionJson(content);
                LogUtil.info("Loaded version: " + versionInfo.current().jar());
            } else {
                // 创建默认版本信息
                versionInfo = createDefaultVersion();
                saveVersion(versionInfo);
                LogUtil.info("Created default version file");
            }
        } catch (IOException e) {
            LogUtil.error("Failed to load version: " + e.getMessage());
            versionInfo = createDefaultVersion();
        }
        
        return versionInfo;
    }
    
    /**
     * 保存版本信息
     */
    public void saveVersion(VersionInfo info) {
        this.versionInfo = info;
        try {
            String json = toJson(info);
            Files.writeString(versionFile, json);
            LogUtil.info("Version saved");
        } catch (IOException e) {
            LogUtil.error("Failed to save version: " + e.getMessage());
        }
    }
    
    /**
     * 检查是否有待更新
     */
    public boolean hasUpdate() {
        return Files.exists(updateFlag);
    }
    
    /**
     * 执行更新
     * 
     * @return 是否成功
     */
    public boolean applyUpdate() {
        try {
            LogUtil.info("Starting update process...");
            
            // 查找 temp 目录中的新版本 JAR
            Path newJar = findNewVersionJar();
            if (newJar == null) {
                LogUtil.error("No new version JAR found in temp directory");
                Files.deleteIfExists(updateFlag);
                return false;
            }
            
            // 计算新 JAR 的哈希
            String newHash = HashUtil.calculateSHA256(newJar);
            LogUtil.info("New JAR hash: " + newHash);
            
            // 备份当前版本
            if (Files.exists(mainJar)) {
                LogUtil.info("Backing up current version...");
                Files.copy(mainJar, backupJar, StandardCopyOption.REPLACE_EXISTING);
            }
            
            // 替换为新版本
            LogUtil.info("Replacing with new version...");
            Files.copy(newJar, mainJar, StandardCopyOption.REPLACE_EXISTING);
            
            // 更新版本信息
            VersionInfo current = loadVersion();
            VersionDetail newCurrent = new VersionDetail(
                extractVersion(newJar.getFileName().toString()),
                newHash
            );
            VersionInfo updated = new VersionInfo(
                newCurrent,
                current.current(), // 当前版本成为 lastGood
                new CrashInfo(0, current.crash().maxBeforeRollback(), null)
            );
            saveVersion(updated);
            
            // 清理
            Files.delete(newJar);
            Files.deleteIfExists(updateFlag);
            
            LogUtil.info("Update completed successfully");
            return true;
            
        } catch (IOException e) {
            LogUtil.error("Update failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 回滚到上一个版本
     */
    public boolean rollback() {
        try {
            LogUtil.info("Starting rollback...");
            
            if (!Files.exists(backupJar)) {
                LogUtil.error("Backup JAR not found");
                return false;
            }
            
            // 恢复备份
            Files.copy(backupJar, mainJar, StandardCopyOption.REPLACE_EXISTING);
            
            // 更新版本信息
            VersionInfo current = loadVersion();
            VersionInfo rolledBack = new VersionInfo(
                current.lastGood(),
                current.lastGood(),
                new CrashInfo(0, current.crash().maxBeforeRollback(), null)
            );
            saveVersion(rolledBack);
            
            LogUtil.info("Rollback completed successfully");
            return true;
            
        } catch (IOException e) {
            LogUtil.error("Rollback failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * 增加崩溃计数
     */
    public void incrementCrashCount() {
        VersionInfo current = loadVersion();
        CrashInfo crash = current.crash();
        CrashInfo updated = new CrashInfo(
            crash.count() + 1,
            crash.maxBeforeRollback(),
            Instant.now()
        );
        VersionInfo newInfo = new VersionInfo(
            current.current(),
            current.lastGood(),
            updated
        );
        saveVersion(newInfo);
        LogUtil.warn("Crash count increased to " + updated.count() + "/" + updated.maxBeforeRollback());
    }
    
    /**
     * 重置崩溃计数
     */
    public void resetCrashCount() {
        VersionInfo current = loadVersion();
        VersionInfo reset = new VersionInfo(
            current.current(),
            current.lastGood(),
            new CrashInfo(0, current.crash().maxBeforeRollback(), null)
        );
        saveVersion(reset);
    }
    
    /**
     * 获取当前崩溃计数
     */
    public int getCrashCount() {
        return loadVersion().crash().count();
    }
    
    /**
     * 检查是否需要回滚
     */
    public boolean shouldRollback() {
        CrashInfo crash = loadVersion().crash();
        return crash.count() >= crash.maxBeforeRollback();
    }
    
    // ========== 辅助方法 ==========
    
    private Path findNewVersionJar() throws IOException {
        if (!Files.exists(tempDir)) {
            return null;
        }
        
        return Files.list(tempDir)
            .filter(p -> p.getFileName().toString().endsWith(".jar"))
            .findFirst()
            .orElse(null);
    }
    
    private String extractVersion(String fileName) {
        // 从 localverse-x.x.x.jar 提取版本号
        String name = fileName.replace(".jar", "");
        int lastDash = name.lastIndexOf('-');
        if (lastDash > 0) {
            return name.substring(lastDash + 1);
        }
        return "unknown";
    }
    
    private VersionInfo createDefaultVersion() {
        VersionDetail defaultDetail = new VersionDetail("1.0.0", "");
        CrashInfo defaultCrash = new CrashInfo(0, 3, null);
        return new VersionInfo(defaultDetail, defaultDetail, defaultCrash);
    }
    
    // ========== JSON 解析（简单实现）==========
    
    private VersionInfo parseVersionJson(String json) {
        try {
            // 简单的 JSON 解析（不使用外部库）
            String currentJar = extractJsonValue(json, "\"current\".*?\"jar\"\\s*:\\s*\"([^\"]+)\"");
            String currentHash = extractJsonValue(json, "\"current\".*?\"jarHash\"\\s*:\\s*\"([^\"]+)\"");
            String lastGoodJar = extractJsonValue(json, "\"lastGood\".*?\"jar\"\\s*:\\s*\"([^\"]+)\"");
            String lastGoodHash = extractJsonValue(json, "\"lastGood\".*?\"jarHash\"\\s*:\\s*\"([^\"]+)\"");
            int crashCount = Integer.parseInt(extractJsonValue(json, "\"crash\".*?\"count\"\\s*:\\s*(\\d+)"));
            int maxCrash = Integer.parseInt(extractJsonValue(json, "\"crash\".*?\"maxBeforeRollback\"\\s*:\\s*(\\d+)"));
            
            VersionDetail current = new VersionDetail(currentJar, currentHash);
            VersionDetail lastGood = new VersionDetail(lastGoodJar, lastGoodHash);
            CrashInfo crash = new CrashInfo(crashCount, maxCrash, null);
            
            return new VersionInfo(current, lastGood, crash);
        } catch (Exception e) {
            LogUtil.error("Failed to parse version JSON: " + e.getMessage());
            return createDefaultVersion();
        }
    }
    
    private String extractJsonValue(String json, String pattern) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern, java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return "";
    }
    
    private String toJson(VersionInfo info) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"current\": {\n");
        sb.append("    \"jar\": \"").append(info.current().jar()).append("\",\n");
        sb.append("    \"jarHash\": \"").append(info.current().jarHash()).append("\"\n");
        sb.append("  },\n");
        sb.append("  \"lastGood\": {\n");
        sb.append("    \"jar\": \"").append(info.lastGood().jar()).append("\",\n");
        sb.append("    \"jarHash\": \"").append(info.lastGood().jarHash()).append("\"\n");
        sb.append("  },\n");
        sb.append("  \"crash\": {\n");
        sb.append("    \"count\": ").append(info.crash().count()).append(",\n");
        sb.append("    \"maxBeforeRollback\": ").append(info.crash().maxBeforeRollback()).append(",\n");
        sb.append("    \"lastCrashTime\": ");
        if (info.crash().lastCrashTime() != null) {
            sb.append("\"").append(info.crash().lastCrashTime().toString()).append("\"");
        } else {
            sb.append("null");
        }
        sb.append("\n");
        sb.append("  }\n");
        sb.append("}\n");
        return sb.toString();
    }
}

/**
 * 版本信息记录
 */
record VersionInfo(VersionDetail current, VersionDetail lastGood, CrashInfo crash) {}

/**
 * 版本详情记录
 */
record VersionDetail(String jar, String jarHash) {}

/**
 * 崩溃信息记录
 */
record CrashInfo(int count, int maxBeforeRollback, Instant lastCrashTime) {}
