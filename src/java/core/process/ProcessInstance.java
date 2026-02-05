package core.process;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runtime instance of a process execution
 */
public class ProcessInstance {
    private final String instanceId;
    private final String definitionId;
    private final String name;
    private ProcessStatus status;
    private final Instant startTime;
    private Instant endTime;
    private final Map<String, TaskInstance> tasks;
    private final Map<String, Object> variables;
    private String error;
    
    public ProcessInstance(String instanceId, ProcessDefinition definition) {
        this.instanceId = instanceId;
        this.definitionId = definition.id();
        this.name = definition.name();
        this.status = ProcessStatus.PENDING;
        this.startTime = Instant.now();
        this.tasks = new ConcurrentHashMap<>();
        this.variables = new ConcurrentHashMap<>(definition.variables() != null ? definition.variables() : Map.of());
        
        // Initialize task instances
        for (TaskDefinition taskDef : definition.tasks()) {
            tasks.put(taskDef.id(), new TaskInstance(taskDef));
        }
    }
    
    public String getInstanceId() { return instanceId; }
    public String getDefinitionId() { return definitionId; }
    public String getName() { return name; }
    public ProcessStatus getStatus() { return status; }
    public void setStatus(ProcessStatus status) { this.status = status; }
    public Instant getStartTime() { return startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public Map<String, TaskInstance> getTasks() { return tasks; }
    public Map<String, Object> getVariables() { return variables; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    
    public TaskInstance getTask(String taskId) {
        return tasks.get(taskId);
    }
    
    public void setVariable(String key, Object value) {
        variables.put(key, value);
    }
    
    public Object getVariable(String key) {
        return variables.get(key);
    }
}
