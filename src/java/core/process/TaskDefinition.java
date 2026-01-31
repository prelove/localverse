package core.process;

import java.util.List;
import java.util.Map;

/**
 * Task definition within a process
 */
public record TaskDefinition(
    String id,
    String name,
    String type,
    Map<String, Object> config,
    List<String> dependsOn,
    String condition
) {
    public TaskDefinition {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("Task ID cannot be null or blank");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Task name cannot be null or blank");
        }
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("Task type cannot be null or blank");
        }
    }
}
