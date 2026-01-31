import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Launcher - Localverse 启动器
 * 
 * 职责：
 * 1. 检查和执行 JAR 更新
 * 2. 启动和监控主程序
 * 3. 崩溃检测和自动回滚
 */
public class Launcher {
    
    // 退出码常量
    private static final int EXIT_NORMAL = 0;
    private static final int EXIT_RESTART = 100;
    private static final int EXIT_ROLLBACK = 101;
    
    // 配置
    private final Path mainJar;
    private final Path backupJar;
    private final Path versionFile;
    private final Path logFile;
    private final Path tempDir;
    
    private final VersionManager versionManager;
    private final ProcessManager processManager;
    
    private boolean silent = false;
    
    public Launcher() {
        // 获取当前目录
        Path currentDir = Paths.get("").toAbsolutePath();
        
        // 初始化路径
        this.mainJar = currentDir.resolve("localverse.jar");
        this.backupJar = currentDir.resolve("localverse.jar.bak");
        this.versionFile = currentDir.resolve("version.json");
        this.tempDir = currentDir.resolve("temp");
        this.logFile = currentDir.resolve("logs").resolve("launcher.log");
        
        // 初始化管理器
        this.versionManager = new VersionManager(versionFile, mainJar, backupJar, tempDir);
        this.processManager = new ProcessManager(mainJar);
    }
    
    public static void main(String[] args) {
        Launcher launcher = new Launcher();
        
        // 处理命令行参数
        if (args.length > 0) {
            String command = args[0];
            switch (command) {
                case "--version" -> {
                    launcher.printVersion();
                    return;
                }
                case "--check-update" -> {
                    launcher.checkUpdate();
                    return;
                }
                case "--rollback" -> {
                    launcher.forceRollback();
                    return;
                }
                case "--silent" -> {
                    launcher.silent = true;
                }
                case "--help" -> {
                    launcher.printHelp();
                    return;
                }
            }
        }
        
        // 启动主程序
        launcher.run();
    }
    
    /**
     * 主运行循环
     */
    private void run() {
        // 初始化日志
        LogUtil.init(logFile);
        LogUtil.setSilent(silent);
        LogUtil.info("=== Launcher started ===");
        
        try {
            // 加载版本信息
            VersionInfo version = versionManager.loadVersion();
            LogUtil.info("Current version: " + version.current().jar());
            
            // 检查更新
            if (versionManager.hasUpdate()) {
                LogUtil.info("Update pending, applying...");
                if (versionManager.applyUpdate()) {
                    LogUtil.info("Update applied successfully");
                } else {
                    LogUtil.error("Update failed, continuing with current version");
                }
            }
            
            // 检查主 JAR 是否存在
            if (!Files.exists(mainJar)) {
                LogUtil.error("Main JAR not found: " + mainJar);
                LogUtil.error("Please place localverse.jar in the same directory as launcher.jar");
                System.exit(1);
            }
            
            // 主循环 - 启动和监控
            while (true) {
                int exitCode = startAndWait();
                
                if (exitCode == EXIT_NORMAL) {
                    // 正常退出
                    LogUtil.info("Process exited normally");
                    break;
                    
                } else if (exitCode == EXIT_RESTART) {
                    // 请求重启
                    LogUtil.info("Restart requested, restarting...");
                    versionManager.resetCrashCount();
                    continue;
                    
                } else if (exitCode == EXIT_ROLLBACK) {
                    // 请求回滚
                    LogUtil.info("Rollback requested");
                    if (versionManager.rollback()) {
                        LogUtil.info("Rollback successful, restarting...");
                        continue;
                    } else {
                        LogUtil.error("Rollback failed, exiting...");
                        break;
                    }
                    
                } else {
                    // 异常退出（崩溃）
                    LogUtil.warn("Process crashed with exit code: " + exitCode);
                    versionManager.incrementCrashCount();
                    
                    // 检查是否需要回滚
                    if (versionManager.shouldRollback()) {
                        LogUtil.error("Crash threshold reached, rolling back...");
                        if (versionManager.rollback()) {
                            LogUtil.info("Rollback successful, restarting...");
                            continue;
                        } else {
                            LogUtil.error("Rollback failed, exiting...");
                            break;
                        }
                    } else {
                        // 等待后重试
                        LogUtil.info("Waiting 5 seconds before restart...");
                        Thread.sleep(5000);
                        continue;
                    }
                }
            }
            
        } catch (Exception e) {
            LogUtil.error("Launcher error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
        
        LogUtil.info("=== Launcher stopped ===");
    }
    
    /**
     * 启动主程序并等待退出
     */
    private int startAndWait() {
        try {
            Process process = processManager.startMainJar();
            return processManager.waitForExit(process);
        } catch (Exception e) {
            LogUtil.error("Failed to start process: " + e.getMessage());
            return -1;
        }
    }
    
    /**
     * 打印版本信息
     */
    private void printVersion() {
        LogUtil.init(logFile);
        VersionInfo version = versionManager.loadVersion();
        System.out.println("Launcher version: 1.0.0");
        System.out.println("Current JAR version: " + version.current().jar());
        System.out.println("Last good version: " + version.lastGood().jar());
        System.out.println("Crash count: " + version.crash().count() + "/" + version.crash().maxBeforeRollback());
    }
    
    /**
     * 检查更新
     */
    private void checkUpdate() {
        LogUtil.init(logFile);
        if (versionManager.hasUpdate()) {
            System.out.println("Update is pending");
            System.out.println("Run launcher normally to apply the update");
        } else {
            System.out.println("No update pending");
        }
    }
    
    /**
     * 强制回滚
     */
    private void forceRollback() {
        LogUtil.init(logFile);
        LogUtil.info("Force rollback requested");
        if (versionManager.rollback()) {
            System.out.println("Rollback successful");
            LogUtil.info("Rollback completed");
        } else {
            System.out.println("Rollback failed");
            LogUtil.error("Rollback failed");
        }
    }
    
    /**
     * 打印帮助信息
     */
    private void printHelp() {
        System.out.println("Localverse Launcher");
        System.out.println();
        System.out.println("Usage: java -jar launcher.jar [options]");
        System.out.println();
        System.out.println("Options:");
        System.out.println("  (no args)        Start the launcher normally");
        System.out.println("  --version        Show version information");
        System.out.println("  --check-update   Check if update is pending");
        System.out.println("  --rollback       Force rollback to last good version");
        System.out.println("  --silent         Run in silent mode (no console output)");
        System.out.println("  --help           Show this help message");
    }
}
