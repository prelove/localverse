package process;

/**
 * Task execution status
 */
public enum TaskStatus {
    PENDING,    // Not started yet
    RUNNING,    // Currently executing
    COMPLETED,  // Finished successfully
    FAILED,     // Failed with error
    SKIPPED     // Skipped due to condition
}
