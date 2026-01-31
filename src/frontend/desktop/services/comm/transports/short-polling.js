/**
 * Short Polling transport implementation
 * Level 4: HTTP short polling with 5s interval
 */

import { serializeMessage, deserializeMessage } from '../utils/message.js';

export class ShortPollingTransport {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      pollInterval: options.pollInterval || 5000,
      sendTimeout: options.sendTimeout || 5000,
      connectionTimeout: options.connectionTimeout || 3000,
      ...options
    };
    
    this.connected = false;
    this.polling = false;
    this.pollTimer = null;
    
    // Event handlers (set by CommunicationLayer)
    this.onMessage = null;
    this.onDisconnect = null;
    this.onError = null;
  }

  /**
   * Connect and start polling
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected || this.polling) {
      return;
    }

    // Test server availability
    try {
      const response = await fetch(`${this.url}/api/local/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.options.connectionTimeout)
      });

      if (!response.ok) {
        throw new Error('Server not available');
      }
    } catch (error) {
      throw new Error(`Cannot connect to server: ${error.message}`);
    }

    this.connected = true;
    this.polling = true;
    
    // Start polling loop
    this.scheduleNextPoll();
  }

  /**
   * Schedule next poll
   */
  scheduleNextPoll() {
    if (!this.polling) return;

    this.pollTimer = setTimeout(() => {
      this.poll().then(() => {
        this.scheduleNextPoll();
      }).catch(error => {
        if (this.onError) {
          this.onError(error);
        }
        // Continue polling even on error
        this.scheduleNextPoll();
      });
    }, this.options.pollInterval);
  }

  /**
   * Perform a single poll request
   */
  async poll() {
    if (!this.polling) return;

    try {
      const response = await fetch(`${this.url}/api/poll`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.options.pollInterval - 500)
      });

      if (!response.ok) {
        throw new Error(`Poll failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Handle messages (can be array or single message)
      const messages = Array.isArray(data) ? data : [data];
      
      for (const messageData of messages) {
        if (messageData && this.onMessage) {
          try {
            // Validate and parse message
            const message = typeof messageData === 'string' 
              ? deserializeMessage(messageData)
              : messageData;
            
            this.onMessage(message);
          } catch (error) {
            console.error('Failed to process polled message:', error);
          }
        }
      }
    } catch (error) {
      // Log but don't throw - we'll keep polling
      if (error.name !== 'AbortError') {
        console.warn('Short poll error:', error.message);
      }
    }
  }

  /**
   * Send message through HTTP POST
   * @param {Object} message - Message to send
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this.connected) {
      throw new Error('Short polling not connected');
    }

    try {
      const data = serializeMessage(message);
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.options.sendTimeout
      );

      const response = await fetch(`${this.url}/api/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Send timeout');
      }
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Disconnect and stop polling
   */
  disconnect() {
    this.polling = false;
    this.connected = false;
    
    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.polling;
  }

  /**
   * Get transport name
   * @returns {string}
   */
  getName() {
    return 'short-polling';
  }
}
