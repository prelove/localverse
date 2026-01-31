/**
 * Retry strategy utilities for communication layer
 * Implements exponential backoff with configurable parameters
 */

/**
 * Calculate next retry delay using exponential backoff
 * Formula: baseDelay * (2 ^ retryCount)
 * @param {number} retryCount - Current retry count (0-based)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 32000)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(retryCount, baseDelay = 1000, maxDelay = 32000) {
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate next attempt timestamp
 * @param {number} retryCount - Current retry count
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Unix timestamp when next attempt should occur
 */
export function calculateNextAttempt(retryCount, baseDelay = 1000, maxDelay = 32000) {
  const delay = calculateBackoff(retryCount, baseDelay, maxDelay);
  return Date.now() + delay;
}

/**
 * Check if a retry should be attempted based on error type
 * @param {Error} error - Error object
 * @returns {boolean} True if retry should be attempted
 */
export function shouldRetry(error) {
  // Network errors - should retry
  if (error.name === 'NetworkError' || error.name === 'TypeError') {
    return true;
  }

  // Timeout errors - should retry
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return true;
  }

  // HTTP errors - check status code if available
  if (error.status) {
    // 5xx server errors - should retry
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    // 429 Too Many Requests - should retry
    if (error.status === 429) {
      return true;
    }
    // 408 Request Timeout - should retry
    if (error.status === 408) {
      return true;
    }
    // 4xx client errors (except above) - should not retry
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  // Default: retry
  return true;
}

/**
 * Create a retry configuration object
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=5] - Maximum number of retries
 * @param {number} [options.baseDelay=1000] - Base delay in milliseconds
 * @param {number} [options.maxDelay=32000] - Maximum delay in milliseconds
 * @returns {Object} Retry configuration
 */
export function createRetryConfig(options = {}) {
  return {
    maxRetries: options.maxRetries ?? 5,
    baseDelay: options.baseDelay ?? 1000,
    maxDelay: options.maxDelay ?? 32000
  };
}

/**
 * Retry strategy class for managing retry state
 */
export class RetryStrategy {
  constructor(config = {}) {
    this.config = createRetryConfig(config);
    this.retryCount = 0;
    this.lastError = null;
  }

  /**
   * Check if more retries are available
   * @returns {boolean} True if can retry
   */
  canRetry() {
    return this.retryCount < this.config.maxRetries;
  }

  /**
   * Get delay for next retry
   * @returns {number} Delay in milliseconds
   */
  getNextDelay() {
    return calculateBackoff(
      this.retryCount,
      this.config.baseDelay,
      this.config.maxDelay
    );
  }

  /**
   * Get timestamp for next retry attempt
   * @returns {number} Unix timestamp
   */
  getNextAttempt() {
    return Date.now() + this.getNextDelay();
  }

  /**
   * Record a failed attempt
   * @param {Error} error - Error from failed attempt
   */
  recordFailure(error) {
    this.retryCount++;
    this.lastError = error;
  }

  /**
   * Reset retry state
   */
  reset() {
    this.retryCount = 0;
    this.lastError = null;
  }

  /**
   * Get current retry state
   * @returns {Object} Current state
   */
  getState() {
    return {
      retryCount: this.retryCount,
      canRetry: this.canRetry(),
      nextDelay: this.canRetry() ? this.getNextDelay() : null,
      lastError: this.lastError
    };
  }
}
