package core.process;

/**
 * Delay task executor that just waits
 */
public class DelayTaskExecutor implements TaskExecutor {
    @Override
    public Object execute(TaskInstance task, ProcessInstance process) throws Exception {
        int duration = (int) task.getConfig().getOrDefault("duration", 1000);
        Thread.sleep(duration);
        return "Delayed for " + duration + "ms";
    }
}
