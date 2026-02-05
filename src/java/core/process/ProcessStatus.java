package process;

/**
 * Process execution status
 */
public enum ProcessStatus {
    PENDING,    // Not started yet
    RUNNING,    // Currently executing
    COMPLETED,  // Finished successfully
    FAILED,     // Failed with error
    CANCELLED   // Cancelled by user
}
