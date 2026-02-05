/**
 * Process Service for frontend
 * Communicates with the backend process engine
 */
class ProcessService {
  constructor(baseUrl = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl;
    this.eventListeners = new Map();
  }

  /**
   * Start a new process
   * @param {string} definitionId - The process definition ID
   * @param {Object} variables - Initial variables
   * @returns {Promise<string>} The process instance ID
   */
  async startProcess(definitionId, variables = {}) {
    const response = await fetch(`${this.baseUrl}/api/local/process/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        definitionId,
        variables,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start process');
    }

    const data = await response.json();
    return data.instanceId;
  }

  /**
   * Get process status
   * @param {string} instanceId - The process instance ID
   * @returns {Promise<Object>} The process instance data
   */
  async getStatus(instanceId) {
    const response = await fetch(
      `${this.baseUrl}/api/local/process/${instanceId}/status`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get process status');
    }

    const data = await response.json();
    return data.process;
  }

  /**
   * Cancel a running process
   * @param {string} instanceId - The process instance ID
   * @returns {Promise<boolean>} Whether the cancellation was successful
   */
  async cancelProcess(instanceId) {
    const response = await fetch(
      `${this.baseUrl}/api/local/process/${instanceId}/cancel`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel process');
    }

    const data = await response.json();
    return data.success;
  }

  /**
   * List all processes
   * @returns {Promise<Array>} Array of process instances
   */
  async listProcesses() {
    const response = await fetch(`${this.baseUrl}/api/local/process/list`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list processes');
    }

    const data = await response.json();
    return data.processes;
  }

  /**
   * Poll process status until completion
   * @param {string} instanceId - The process instance ID
   * @param {number} interval - Polling interval in ms (default 500ms)
   * @param {Function} onUpdate - Callback for status updates
   * @returns {Promise<Object>} Final process state
   */
  async pollUntilComplete(instanceId, interval = 500, onUpdate = null) {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const process = await this.getStatus(instanceId);

          if (onUpdate) {
            onUpdate(process);
          }

          // Check if process is finished
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(process.status)) {
            resolve(process);
            return;
          }

          // Continue polling
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Start and wait for process completion
   * @param {string} definitionId - The process definition ID
   * @param {Object} variables - Initial variables
   * @param {Function} onUpdate - Callback for status updates
   * @returns {Promise<Object>} Final process state
   */
  async startAndWait(definitionId, variables = {}, onUpdate = null) {
    const instanceId = await this.startProcess(definitionId, variables);
    return this.pollUntilComplete(instanceId, 500, onUpdate);
  }

  /**
   * Subscribe to process events (client-side simulation)
   * @param {string} event - Event name ('start', 'update', 'complete', 'error')
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from process events
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(event, callback) {
    if (!this.eventListeners.has(event)) {
      return;
    }
    const listeners = this.eventListeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event
   * @private
   */
  _emit(event, data) {
    if (!this.eventListeners.has(event)) {
      return;
    }
    const listeners = this.eventListeners.get(event);
    listeners.forEach(callback => callback(data));
  }

  /**
   * Format task status for display
   * @param {Object} task - Task instance
   * @returns {string} Formatted status
   */
  static formatTaskStatus(task) {
    const icon = {
      PENDING: '⏳',
      RUNNING: '▶️',
      COMPLETED: '✅',
      FAILED: '❌',
      SKIPPED: '⏭️'
    }[task.status] || '❓';

    return `${icon} ${task.name} - ${task.status}`;
  }

  /**
   * Calculate process progress
   * @param {Object} process - Process instance
   * @returns {number} Progress percentage (0-100)
   */
  static calculateProgress(process) {
    const tasks = process.tasks || [];
    if (tasks.length === 0) {
      return 0;
    }

    const completed = tasks.filter(t =>
      ['COMPLETED', 'FAILED', 'SKIPPED'].includes(t.status)
    ).length;

    return Math.round((completed / tasks.length) * 100);
  }
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.ProcessService = ProcessService;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProcessService;
}
