/**
 * WebSocket transport implementation
 * Level 1: Fastest, bi-directional real-time communication
 */

import { serializeMessage, deserializeMessage } from '../utils/message.js';

export class WebSocketTransport {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      connectionTimeout: options.connectionTimeout || 3000,
      reconnectOnClose: options.reconnectOnClose !== false,
      ...options
    };
    
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    
    // Event handlers (set by CommunicationLayer)
    this.onMessage = null;
    this.onDisconnect = null;
    this.onError = null;
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected || this.connecting) {
      return;
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      try {
        // Convert HTTP URL to WebSocket URL
        const wsUrl = this.url.replace(/^http/, 'ws') + '/ws';
        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
          this.connecting = false;
          reject(new Error('WebSocket connection timeout'));
        }, this.options.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.connecting = false;
          resolve();
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          this.connecting = false;
          const error = new Error('WebSocket connection error');
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          this.connecting = false;
          
          if (this.onDisconnect) {
            this.onDisconnect({
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            });
          }
        };
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = deserializeMessage(data);
      if (this.onMessage) {
        this.onMessage(message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * Send message through WebSocket
   * @param {Object} message - Message to send
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this.connected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not ready');
    }

    try {
      const data = serializeMessage(message);
      this.ws.send(data);
    } catch (error) {
      throw new Error(`Failed to send WebSocket message: ${error.message}`);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      // Set flag to prevent reconnect
      this.options.reconnectOnClose = false;
      
      try {
        this.ws.close(1000, 'Normal closure');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      
      this.ws = null;
    }
    
    this.connected = false;
    this.connecting = false;
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get transport name
   * @returns {string}
   */
  getName() {
    return 'websocket';
  }
}
