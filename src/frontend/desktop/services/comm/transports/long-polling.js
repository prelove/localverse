/**
 * Long Polling transport implementation
 * Level 3: HTTP long-polling with 30s timeout
 */

import { serializeMessage, deserializeMessage } from '../utils/message.js';

export class LongPollingTransport {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      pollTimeout: options.pollTimeout || 30000,
      sendTimeout: options.sendTimeout || 5000,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    this.connected = false;
    this.polling = false;
    this.abortController = null;
    
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
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        throw new Error('Server not available');
      }
    } catch (error) {
      throw new Error(`Cannot connect to server: ${error.message}`);
    }

    this.connected = true;
    this.polling = true;
    
    // Start polling loop (don't await)
    this.startPolling();
  }

  /**
   * Start the polling loop
   */
  async startPolling() {
    while (this.polling) {
      try {
        await this.poll();
      } catch (error) {
        // Log error but continue polling
        if (this.onError) {
          this.onError(error);
        }
        
        // Wait before retrying
        await this.sleep(this.options.retryDelay);
      }
    }
  }

  /**
   * Perform a single poll request
   */
  async poll() {
    if (!this.polling) return;

    this.abortController = new AbortController();
    
    try {
      const response = await fetch(`${this.url}/api/poll`, {
        method: 'GET',
        signal: this.abortController.signal,
        headers: {
          'X-Poll-Timeout': this.options.pollTimeout.toString()
        }
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
      // Only throw if not aborted intentionally
      if (error.name !== 'AbortError') {
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Send message through HTTP POST
   * @param {Object} message - Message to send
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this.connected) {
      throw new Error('Long polling not connected');
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
    
    // Abort any ongoing poll
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
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
    return 'long-polling';
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
