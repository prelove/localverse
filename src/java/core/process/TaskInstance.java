package process;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runtime instance of a task execution
 */
public class TaskInstance {
    private final String id;
    private final String name;
    private final String type;
    private final Map<String, Object> config;
    private TaskStatus status;
    private Instant startTime;
    private Instant endTime;
    private Object result;
    private String error;
    
    public TaskInstance(TaskDefinition definition) {
        this.id = definition.id();
        this.name = definition.name();
        this.type = definition.type();
        this.config = definition.config() != null ? new ConcurrentHashMap<>(definition.config()) : new ConcurrentHashMap<>();
        this.status = TaskStatus.PENDING;
    }
    
    public String getId() { return id; }
    public String getName() { return name; }
    public String getType() { return type; }
    public Map<String, Object> getConfig() { return config; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public Object getResult() { return result; }
    public void setResult(Object result) { this.result = result; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
