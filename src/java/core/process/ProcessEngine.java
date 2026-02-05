package core.process;

import java.util.*;
import java.util.concurrent.*;
import java.time.Instant;

/**
 * Mock Process Engine for workflow execution
 * Supports sequential, parallel, and conditional task execution
 */
public class ProcessEngine {
    private final Map<String, ProcessDefinition> definitions;
    private final Map<String, ProcessInstance> instances;
    private final Map<String, TaskExecutor> executors;
    private final ExecutorService threadPool;
    
    public ProcessEngine() {
        this.definitions = new ConcurrentHashMap<>();
        this.instances = new ConcurrentHashMap<>();
        this.executors = new ConcurrentHashMap<>();
        // Use cached thread pool for Java 17 compatibility
        this.threadPool = Executors.newCachedThreadPool();
        
        // Register built-in task executors
        registerExecutor("mock", new MockTaskExecutor());
        registerExecutor("delay", new DelayTaskExecutor());
        registerExecutor("log", new LogTaskExecutor());
        registerExecutor("script", new ScriptTaskExecutor());
    }
    
    /**
     * Register a process definition
     */
    public void registerDefinition(ProcessDefinition definition) {
        definitions.put(definition.id(), definition);
    }
    
    /**
     * Register a custom task executor
     */
    public void registerExecutor(String type, TaskExecutor executor) {
        executors.put(type, executor);
    }
    
    /**
     * Start a process instance
     */
    public String startProcess(String definitionId, Map<String, Object> initialVariables) {
        ProcessDefinition definition = definitions.get(definitionId);
        if (definition == null) {
            throw new IllegalArgumentException("Process definition not found: " + definitionId);
        }
        
        String instanceId = UUID.randomUUID().toString();
        ProcessInstance instance = new ProcessInstance(instanceId, definition);
        
        // Merge initial variables
        if (initialVariables != null) {
            initialVariables.forEach(instance::setVariable);
        }
        
        instances.put(instanceId, instance);
        
        // Execute asynchronously
        threadPool.submit(() -> executeProcess(instance, definition));
        
        return instanceId;
    }
    
    /**
     * Cancel a running process
     */
    public boolean cancelProcess(String instanceId) {
        ProcessInstance instance = instances.get(instanceId);
        if (instance == null) {
            return false;
        }
        
        if (instance.getStatus() == ProcessStatus.RUNNING) {
            instance.setStatus(ProcessStatus.CANCELLED);
            instance.setEndTime(Instant.now());
            return true;
        }
        
        return false;
    }
    
    /**
     * Get process instance status
     */
    public ProcessInstance getProcessInstance(String instanceId) {
        return instances.get(instanceId);
    }
    
    /**
     * List all process instances
     */
    public List<ProcessInstance> listProcesses() {
        return new ArrayList<>(instances.values());
    }
    
    /**
     * Execute a process instance
     */
    private void executeProcess(ProcessInstance instance, ProcessDefinition definition) {
        try {
            instance.setStatus(ProcessStatus.RUNNING);
            
            // Execute tasks based on dependencies
            Set<String> completed = new HashSet<>();
            List<TaskDefinition> tasks = definition.tasks();
            
            while (completed.size() < tasks.size() && instance.getStatus() == ProcessStatus.RUNNING) {
                List<CompletableFuture<Void>> futures = new ArrayList<>();
                
                for (TaskDefinition taskDef : tasks) {
                    if (completed.contains(taskDef.id())) {
                        continue;
                    }
                    
                    // Check if all dependencies are met
                    boolean dependenciesMet = true;
                    if (taskDef.dependsOn() != null) {
                        for (String dep : taskDef.dependsOn()) {
                            if (!completed.contains(dep)) {
                                dependenciesMet = false;
                                break;
                            }
                        }
                    }
                    
                    if (!dependenciesMet) {
                        continue;
                    }
                    
                    // Check condition
                    if (taskDef.condition() != null && !evaluateCondition(taskDef.condition(), instance)) {
                        TaskInstance taskInstance = instance.getTask(taskDef.id());
                        taskInstance.setStatus(TaskStatus.SKIPPED);
                        completed.add(taskDef.id());
                        continue;
                    }
                    
                    // Execute task asynchronously
                    CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                        executeTask(instance, taskDef);
                        completed.add(taskDef.id());
                    }, threadPool);
                    
                    futures.add(future);
                }
                
                // Wait for all parallel tasks to complete
                if (!futures.isEmpty()) {
                    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
                } else {
                    // No tasks can be executed, might be stuck
                    break;
                }
            }
            
            // Check final status
            if (instance.getStatus() == ProcessStatus.RUNNING) {
                boolean anyFailed = instance.getTasks().values().stream()
                    .anyMatch(t -> t.getStatus() == TaskStatus.FAILED);
                
                if (anyFailed) {
                    instance.setStatus(ProcessStatus.FAILED);
                } else {
                    instance.setStatus(ProcessStatus.COMPLETED);
                }
            }
            
            instance.setEndTime(Instant.now());
            
        } catch (Exception e) {
            instance.setStatus(ProcessStatus.FAILED);
            instance.setError(e.getMessage());
            instance.setEndTime(Instant.now());
        }
    }
    
    /**
     * Execute a single task
     */
    private void executeTask(ProcessInstance process, TaskDefinition taskDef) {
        TaskInstance task = process.getTask(taskDef.id());
        
        try {
            task.setStatus(TaskStatus.RUNNING);
            task.setStartTime(Instant.now());
            
            TaskExecutor executor = executors.get(taskDef.type());
            if (executor == null) {
                throw new IllegalStateException(
                    "No executor found for task type: " + taskDef.type() + 
                    ". Available types: " + executors.keySet()
                );
            }
            
            Object result = executor.execute(task, process);
            task.setResult(result);
            task.setStatus(TaskStatus.COMPLETED);
            
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setError(e.getMessage());
        } finally {
            task.setEndTime(Instant.now());
        }
    }
    
    /**
     * Simple condition evaluation (supports basic variable checks)
     */
    private boolean evaluateCondition(String condition, ProcessInstance instance) {
        // Simple implementation: check if variable exists and is true
        // Format: "${variableName}" or "${variableName} == value"
        if (condition.startsWith("${") && condition.endsWith("}")) {
            String varName = condition.substring(2, condition.length() - 1);
            Object value = instance.getVariable(varName);
            if (value instanceof Boolean) {
                return (Boolean) value;
            }
            return value != null;
        }
        return true;
    }
    
    /**
     * Shutdown the engine
     */
    public void shutdown() {
        threadPool.shutdown();
    }
}
