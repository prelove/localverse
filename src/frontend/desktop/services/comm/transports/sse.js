/**
 * Server-Sent Events (SSE) transport implementation
 * Level 2: Downstream real-time, upstream HTTP POST
 */

import { serializeMessage, deserializeMessage } from '../utils/message.js';

export class SSETransport {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      connectionTimeout: options.connectionTimeout || 3000,
      sendTimeout: options.sendTimeout || 5000,
      ...options
    };
    
    this.eventSource = null;
    this.connected = false;
    this.connecting = false;
    
    // Event handlers (set by CommunicationLayer)
    this.onMessage = null;
    this.onDisconnect = null;
    this.onError = null;
  }

  /**
   * Connect to SSE endpoint
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected || this.connecting) {
      return;
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      try {
        const sseUrl = `${this.url}/api/events`;
        this.eventSource = new EventSource(sseUrl);

        const timeout = setTimeout(() => {
          if (this.eventSource) {
            this.eventSource.close();
          }
          this.connecting = false;
          reject(new Error('SSE connection timeout'));
        }, this.options.connectionTimeout);

        this.eventSource.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.connecting = false;
          resolve();
        };

        this.eventSource.onerror = (event) => {
          clearTimeout(timeout);
          this.connecting = false;
          
          if (this.connected) {
            // Connection was established but now lost
            this.connected = false;
            if (this.onDisconnect) {
              this.onDisconnect({ reason: 'SSE connection error' });
            }
          } else {
            // Initial connection failed
            const error = new Error('SSE connection error');
            if (this.onError) {
              this.onError(error);
            }
            reject(error);
          }
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming SSE message
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = deserializeMessage(data);
      if (this.onMessage) {
        this.onMessage(message);
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * Send message through HTTP POST (SSE is one-way)
   * @param {Object} message - Message to send
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this.connected) {
      throw new Error('SSE not connected');
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
   * Disconnect SSE
   */
  disconnect() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (error) {
        console.error('Error closing SSE:', error);
      }
      
      this.eventSource = null;
    }
    
    this.connected = false;
    this.connecting = false;
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && 
           this.eventSource && 
           this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Get transport name
   * @returns {string}
   */
  getName() {
    return 'sse';
  }
}
