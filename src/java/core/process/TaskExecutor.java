package core.process;

/**
 * Interface for task execution
 */
public interface TaskExecutor {
    /**
     * Execute a task and return the result
     * 
     * @param task The task instance to execute
     * @param process The parent process instance
     * @return The execution result
     * @throws Exception if execution fails
     */
    Object execute(TaskInstance task, ProcessInstance process) throws Exception;
}
