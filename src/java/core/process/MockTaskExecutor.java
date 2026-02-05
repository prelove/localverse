package core.process;

/**
 * Mock task executor that simulates work
 */
public class MockTaskExecutor implements TaskExecutor {
    @Override
    public Object execute(TaskInstance task, ProcessInstance process) throws Exception {
        // Get duration from config (default 100ms)
        int duration = (int) task.getConfig().getOrDefault("duration", 100);
        
        // Simulate work
        Thread.sleep(duration);
        
        // Get success rate from config (default 100%)
        double successRate = (double) task.getConfig().getOrDefault("successRate", 1.0);
        if (Math.random() > successRate) {
            throw new Exception("Mock task failed randomly");
        }
        
        // Return mock result
        return task.getConfig().getOrDefault("result", "Mock task completed");
    }
}
