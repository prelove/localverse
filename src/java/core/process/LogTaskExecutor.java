package core.process;

/**
 * Log task executor that logs messages
 */
public class LogTaskExecutor implements TaskExecutor {
    @Override
    public Object execute(TaskInstance task, ProcessInstance process) {
        String message = (String) task.getConfig().getOrDefault("message", "Log task executed");
        String level = (String) task.getConfig().getOrDefault("level", "INFO");
        
        // In a real implementation, this would use a proper logger
        System.out.println("[" + level + "] " + task.getName() + ": " + message);
        
        return "Logged: " + message;
    }
}
