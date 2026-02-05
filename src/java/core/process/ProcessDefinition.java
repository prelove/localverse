package process;

import java.util.List;
import java.util.Map;

/**
 * Process definition model representing a workflow template
 */
public record ProcessDefinition(
    String id,
    String name,
    String description,
    String version,
    List<TaskDefinition> tasks,
    Map<String, Object> variables
) {
    public ProcessDefinition {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("Process ID cannot be null or blank");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Process name cannot be null or blank");
        }
        if (tasks == null || tasks.isEmpty()) {
            throw new IllegalArgumentException("Process must have at least one task");
        }
    }
}
