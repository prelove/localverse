import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * 进程管理类 - 启动和监控 localverse.jar
 */
public class ProcessManager {
    
    private final Path mainJarPath;
    private final Path javaExecutable;
    
    public ProcessManager(Path mainJarPath) {
        this.mainJarPath = mainJarPath;
        this.javaExecutable = findJavaExecutable();
    }
    
    /**
     * 启动主程序 JAR
     * 
     * @return Process 对象
     * @throws IOException 启动失败
     */
    public Process startMainJar() throws IOException {
        LogUtil.info("Starting " + mainJarPath.getFileName() + "...");
        
        List<String> command = new ArrayList<>();
        command.add(javaExecutable.toString());
        command.add("-jar");
        command.add(mainJarPath.toAbsolutePath().toString());
        
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.inheritIO(); // 继承父进程的输入输出
        builder.directory(mainJarPath.getParent().toFile());
        
        Process process = builder.start();
        LogUtil.info("Process started, PID: " + process.pid());
        
        return process;
    }
    
    /**
     * 等待进程退出并返回退出码
     * 
     * @param process 进程对象
     * @return 退出码
     */
    public int waitForExit(Process process) {
        try {
            return process.waitFor();
        } catch (InterruptedException e) {
            LogUtil.error("Process wait interrupted: " + e.getMessage());
            Thread.currentThread().interrupt();
            return -1;
        }
    }
    
    /**
     * 强制终止进程
     * 
     * @param process 进程对象
     */
    public void killProcess(Process process) {
        if (process != null && process.isAlive()) {
            LogUtil.warn("Killing process " + process.pid());
            process.destroyForcibly();
        }
    }
    
    /**
     * 查找 Java 可执行文件
     */
    private Path findJavaExecutable() {
        String javaHome = System.getProperty("java.home");
        String os = System.getProperty("os.name").toLowerCase();
        
        if (os.contains("win")) {
            return Path.of(javaHome, "bin", "java.exe");
        } else {
            return Path.of(javaHome, "bin", "java");
        }
    }
}
