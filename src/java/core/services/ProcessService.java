package core.services;

import core.process.*;
import core.utils.JsonUtil;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Process Service for managing workflow executions
 */
public class ProcessService {
    private final ProcessEngine engine;
    
    public ProcessService() {
        this.engine = new ProcessEngine();
        loadBuiltInProcesses();
    }
    
    /**
     * Load built-in process definitions
     */
    private void loadBuiltInProcesses() {
        // Simple sequential process
        ProcessDefinition sequential = new ProcessDefinition(
            "simple-sequential",
            "Simple Sequential Process",
            "A simple process that executes tasks sequentially",
            "1.0.0",
            List.of(
                new TaskDefinition("task1", "First Task", "log", Map.of("message", "First task executed"), null, null),
                new TaskDefinition("task2", "Second Task", "delay", Map.of("duration", 500), List.of("task1"), null),
                new TaskDefinition("task3", "Third Task", "log", Map.of("message", "All tasks completed"), List.of("task2"), null)
            ),
            Map.of()
        );
        engine.registerDefinition(sequential);
        
        // Parallel process
        ProcessDefinition parallel = new ProcessDefinition(
            "parallel-tasks",
            "Parallel Tasks Process",
            "A process that executes multiple tasks in parallel",
            "1.0.0",
            List.of(
                new TaskDefinition("init", "Initialize", "log", Map.of("message", "Starting parallel tasks"), null, null),
                new TaskDefinition("taskA", "Task A", "mock", Map.of("duration", 300, "result", "Result A"), List.of("init"), null),
                new TaskDefinition("taskB", "Task B", "mock", Map.of("duration", 400, "result", "Result B"), List.of("init"), null),
                new TaskDefinition("taskC", "Task C", "mock", Map.of("duration", 200, "result", "Result C"), List.of("init"), null),
                new TaskDefinition("finish", "Finish", "log", Map.of("message", "All parallel tasks completed"), List.of("taskA", "taskB", "taskC"), null)
            ),
            Map.of()
        );
        engine.registerDefinition(parallel);
        
        // Conditional process
        ProcessDefinition conditional = new ProcessDefinition(
            "conditional-flow",
            "Conditional Flow Process",
            "A process with conditional task execution",
            "1.0.0",
            List.of(
                new TaskDefinition("check", "Check Condition", "script", Map.of("script", "Checking condition", "outputVariable", "shouldExecute"), null, null),
                new TaskDefinition("conditionalTask", "Conditional Task", "log", Map.of("message", "Condition was true"), List.of("check"), "${shouldExecute}"),
                new TaskDefinition("always", "Always Execute", "log", Map.of("message", "This always runs"), List.of("check"), null)
            ),
            Map.of("shouldExecute", true)
        );
        engine.registerDefinition(conditional);
    }
    
    /**
     * Start a process
     */
    public String startProcess(String definitionId, Map<String, Object> variables) {
        return engine.startProcess(definitionId, variables);
    }
    
    /**
     * Cancel a process
     */
    public boolean cancelProcess(String instanceId) {
        return engine.cancelProcess(instanceId);
    }
    
    /**
     * Get process instance
     */
    public ProcessInstance getProcessInstance(String instanceId) {
        return engine.getProcessInstance(instanceId);
    }
    
    /**
     * List all processes
     */
    public List<ProcessInstance> listProcesses() {
        return engine.listProcesses();
    }
    
    /**
     * Convert process instance to JSON-friendly map
     */
    public Map<String, Object> toMap(ProcessInstance instance) {
        return Map.of(
            "instanceId", instance.getInstanceId(),
            "definitionId", instance.getDefinitionId(),
            "name", instance.getName(),
            "status", instance.getStatus().toString(),
            "startTime", instance.getStartTime().toString(),
            "endTime", instance.getEndTime() != null ? instance.getEndTime().toString() : null,
            "variables", instance.getVariables(),
            "error", instance.getError() != null ? instance.getError() : "",
            "tasks", instance.getTasks().values().stream()
                .map(this::taskToMap)
                .collect(Collectors.toList())
        );
    }
    
    /**
     * Convert task instance to JSON-friendly map
     */
    private Map<String, Object> taskToMap(TaskInstance task) {
        return Map.of(
            "id", task.getId(),
            "name", task.getName(),
            "type", task.getType(),
            "status", task.getStatus().toString(),
            "startTime", task.getStartTime() != null ? task.getStartTime().toString() : "",
            "endTime", task.getEndTime() != null ? task.getEndTime().toString() : "",
            "result", task.getResult() != null ? task.getResult() : "",
            "error", task.getError() != null ? task.getError() : ""
        );
    }
    
    /**
     * Shutdown the service
     */
    public void shutdown() {
        engine.shutdown();
    }
}
