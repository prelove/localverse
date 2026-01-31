/**
 * Message queue manager with retry logic
 * Handles queuing, retry with exponential backoff, and automatic synchronization
 */

import { QueueStorage } from './queue-storage.js';
import { calculateNextAttempt, shouldRetry } from '../utils/retry.js';
import { generateMessageId, isMessageExpired } from '../utils/message.js';

export class MessageQueue {
  constructor(options = {}) {
    this.storage = new QueueStorage();
    this.options = {
      maxRetries: options.maxRetries || 5,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 32000,
      processInterval: options.processInterval || 5000,
      ...options
    };
    
    this.processing = false;
    this.processTimer = null;
  }

  /**
   * Initialize the message queue
   * @returns {Promise<void>}
   */
  async init() {
    await this.storage.init();
    
    // Clean expired messages on startup
    await this.storage.cleanExpired();
  }

  /**
   * Enqueue a message for sending
   * @param {Object} message - Message to enqueue
   * @param {Object} options - Queue options
   * @returns {Promise<string>} Queue item ID
   */
  async enqueue(message, options = {}) {
    const item = {
      id: generateMessageId(),
      message,
      status: 'pending',
      retryCount: 0,
      maxRetries: options.maxRetries || this.options.maxRetries,
      createdAt: Date.now(),
      lastAttempt: null,
      nextAttempt: Date.now(),
      error: null
    };

    await this.storage.save(item);
    return item.id;
  }

  /**
   * Process pending messages in the queue
   * @param {Function} sendFn - Function to send messages
   * @returns {Promise<Object>} Processing results
   */
  async process(sendFn) {
    if (this.processing) {
      return { sent: 0, failed: 0, skipped: 0 };
    }

    this.processing = true;
    const results = { sent: 0, failed: 0, skipped: 0 };

    try {
      const items = await this.storage.getPending();

      for (const item of items) {
        // Check if message has expired (TTL)
        if (isMessageExpired(item.message)) {
          await this.storage.remove(item.id);
          results.skipped++;
          continue;
        }

        // Update status to sending
        item.status = 'sending';
        item.lastAttempt = Date.now();
        await this.storage.update(item);

        try {
          // Attempt to send the message
          await sendFn(item.message);
          
          // Success - remove from queue
          await this.storage.remove(item.id);
          results.sent++;
        } catch (error) {
          // Send failed - handle retry logic
          item.retryCount++;
          item.error = error.message;

          if (item.retryCount >= item.maxRetries || !shouldRetry(error)) {
            // Max retries reached or non-retryable error
            item.status = 'failed';
            results.failed++;
          } else {
            // Schedule retry with exponential backoff
            item.status = 'pending';
            item.nextAttempt = calculateNextAttempt(
              item.retryCount,
              this.options.baseDelay,
              this.options.maxDelay
            );
          }

          await this.storage.update(item);
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.processing = false;
    }

    return results;
  }

  /**
   * Start automatic queue processing
   * @param {Function} sendFn - Function to send messages
   */
  startAutoProcess(sendFn) {
    if (this.processTimer) {
      return;
    }

    const processLoop = async () => {
      await this.process(sendFn);
      
      // Schedule next processing
      this.processTimer = setTimeout(processLoop, this.options.processInterval);
    };

    // Start the loop
    processLoop();
  }

  /**
   * Stop automatic queue processing
   */
  stopAutoProcess() {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
  }

  /**
   * Get count of pending messages
   * @returns {Promise<number>}
   */
  async getPendingCount() {
    return await this.storage.getCount('pending');
  }

  /**
   * Get all pending messages
   * @returns {Promise<Array>}
   */
  async getPendingMessages() {
    return await this.storage.getByStatus('pending');
  }

  /**
   * Get count of failed messages
   * @returns {Promise<number>}
   */
  async getFailedCount() {
    return await this.storage.getCount('failed');
  }

  /**
   * Get all failed messages
   * @returns {Promise<Array>}
   */
  async getFailedMessages() {
    return await this.storage.getByStatus('failed');
  }

  /**
   * Retry all failed messages
   * @returns {Promise<number>} Number of messages marked for retry
   */
  async retryFailed() {
    const failed = await this.getFailedMessages();
    let count = 0;

    for (const item of failed) {
      item.status = 'pending';
      item.retryCount = 0;
      item.nextAttempt = Date.now();
      item.error = null;
      
      await this.storage.update(item);
      count++;
    }

    return count;
  }

  /**
   * Clear all messages from queue
   * @returns {Promise<void>}
   */
  async clear() {
    await this.storage.clear();
  }

  /**
   * Remove a specific message from queue
   * @param {string} id - Message ID to remove
   * @returns {Promise<void>}
   */
  async remove(id) {
    await this.storage.remove(id);
  }

  /**
   * Close the queue and cleanup resources
   */
  close() {
    this.stopAutoProcess();
    this.storage.close();
  }
}
