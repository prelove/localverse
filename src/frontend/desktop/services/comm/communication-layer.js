/**
 * Communication Layer - Main abstraction for network communication
 * Implements 5-level auto-degradation, offline queue, and reconnection
 */

import { WebSocketTransport } from './transports/websocket.js';
import { SSETransport } from './transports/sse.js';
import { LongPollingTransport } from './transports/long-polling.js';
import { ShortPollingTransport } from './transports/short-polling.js';
import { MessageQueue } from './queue/message-queue.js';
import { createMessage } from './utils/message.js';

/**
 * Connection states
 */
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline'
};

/**
 * Communication Layer class
 * Extends EventTarget for native event handling
 */
export class CommunicationLayer extends EventTarget {
  constructor(options = {}) {
    super();
    
    this.options = {
      serverUrl: options.serverUrl || 'http://127.0.0.1:8765',
      autoReconnect: options.autoReconnect !== false,
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      heartbeatInterval: options.heartbeatInterval || 30000,
      messageTimeout: options.messageTimeout || 30000,
      ...options
    };

    // Connection state
    this.state = {
      status: ConnectionState.DISCONNECTED,
      transport: null,
      latency: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      reconnectAttempts: 0
    };

    // Transport and queue
    this.currentTransport = null;
    this.queue = new MessageQueue();
    
    // Event handlers and pending responses
    this.eventHandlers = new Map();
    this.pendingResponses = new Map();
    
    // Timers
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
  }

  /**
   * Initialize and connect to server
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.state.status === ConnectionState.CONNECTING || 
        this.state.status === ConnectionState.CONNECTED) {
      return;
    }

    this.state.status = ConnectionState.CONNECTING;
    this.emit('connection_state', this.state);

    // Initialize queue
    await this.queue.init();

    // Try transports in order
    const transports = [
      { name: 'websocket', factory: () => new WebSocketTransport(this.options.serverUrl) },
      { name: 'sse', factory: () => new SSETransport(this.options.serverUrl) },
      { name: 'long-polling', factory: () => new LongPollingTransport(this.options.serverUrl) },
      { name: 'short-polling', factory: () => new ShortPollingTransport(this.options.serverUrl) }
    ];

    for (const { name, factory } of transports) {
      try {
        const transport = factory();
        
        // Set up transport handlers
        transport.onMessage = (msg) => this.handleIncomingMessage(msg);
        transport.onDisconnect = () => this.handleDisconnect();
        transport.onError = (error) => this.handleTransportError(error);

        // Attempt connection
        await transport.connect();

        // Success!
        this.currentTransport = transport;
        this.state.status = ConnectionState.CONNECTED;
        this.state.transport = name;
        this.state.lastConnectedAt = Date.now();
        this.state.reconnectAttempts = 0;

        this.emit('connected', { transport: name });
        this.emit('connection_state', this.state);

        // Start heartbeat
        this.startHeartbeat();

        // Start processing offline queue
        this.queue.startAutoProcess((msg) => this.sendDirect(msg));

        return;
      } catch (error) {
        console.warn(`${name} connection failed:`, error.message);
      }
    }

    // All transports failed - go offline
    this.goOffline();
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.currentTransport) {
      this.currentTransport.disconnect();
      this.currentTransport = null;
    }

    this.queue.stopAutoProcess();

    this.state.status = ConnectionState.DISCONNECTED;
    this.state.transport = null;
    this.state.lastDisconnectedAt = Date.now();
    
    this.emit('disconnected');
    this.emit('connection_state', this.state);
  }

  /**
   * Manually trigger reconnection
   * @returns {Promise<void>}
   */
  async reconnect() {
    this.disconnect();
    await this.connect();
  }

  /**
   * Send a message
   * @param {Object} partial - Partial message data
   * @returns {Promise<void>}
   */
  async send(partial) {
    const message = createMessage(partial);

    if (this.isOnline()) {
      try {
        await this.sendDirect(message);
      } catch (error) {
        // Send failed, queue for retry
        console.warn('Direct send failed, queueing:', error.message);
        await this.queue.enqueue(message);
      }
    } else {
      // Offline, queue immediately
      await this.queue.enqueue(message);
    }
  }

  /**
   * Send message and wait for response
   * @param {Object} partial - Partial message data
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Response message
   */
  async sendAndWait(partial, timeout = this.options.messageTimeout) {
    const message = createMessage(partial);

    return new Promise((resolve, reject) => {
      // Set up response handler
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new Error('Response timeout'));
      }, timeout);

      this.pendingResponses.set(message.id, { resolve, reject, timeoutId });

      // Send message
      this.sendDirect(message).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingResponses.delete(message.id);
        reject(error);
      });
    });
  }

  /**
   * Send message directly through transport
   * @param {Object} message - Message to send
   * @returns {Promise<void>}
   */
  async sendDirect(message) {
    if (!this.currentTransport || !this.currentTransport.isConnected()) {
      throw new Error('Not connected');
    }

    await this.currentTransport.send(message);
  }

  /**
   * Handle incoming message from transport
   * @param {Object} message - Received message
   */
  handleIncomingMessage(message) {
    // Check if this is a response to a pending request
    if (message.replyTo && this.pendingResponses.has(message.replyTo)) {
      const pending = this.pendingResponses.get(message.replyTo);
      clearTimeout(pending.timeoutId);
      this.pendingResponses.delete(message.replyTo);
      pending.resolve(message);
      return;
    }

    // Dispatch to event handlers
    this.dispatchMessage(message);
  }

  /**
   * Dispatch message to registered handlers
   * @param {Object} message - Message to dispatch
   */
  dispatchMessage(message) {
    // Emit general message event
    this.emit('message', message);

    // Emit specific action event
    if (message.action) {
      this.emit(message.action, message);
    }

    // Emit type-specific event
    this.emit(message.type, message);
  }

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    this.addEventListener(event, handler);
  }

  /**
   * Unregister event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    this.removeEventListener(event, handler);
  }

  /**
   * Register one-time event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  once(event, handler) {
    const onceHandler = (e) => {
      handler(e);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  /**
   * Emit custom event
   * @param {string} event - Event name
   * @param {*} detail - Event detail
   */
  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }

  /**
   * Handle transport disconnect
   */
  handleDisconnect() {
    this.state.status = ConnectionState.DISCONNECTED;
    this.state.lastDisconnectedAt = Date.now();
    
    this.emit('disconnected');
    this.emit('connection_state', this.state);

    // Attempt reconnection if enabled
    if (this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle transport error
   * @param {Error} error - Transport error
   */
  handleTransportError(error) {
    this.emit('error', error);
  }

  /**
   * Schedule automatic reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.state.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.warn('Max reconnect attempts reached');
      this.goOffline();
      return;
    }

    this.state.status = ConnectionState.RECONNECTING;
    this.state.reconnectAttempts++;
    this.emit('connection_state', this.state);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, this.options.reconnectInterval);
  }

  /**
   * Stop reconnection attempts
   */
  stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Enter offline mode
   */
  goOffline() {
    this.state.status = ConnectionState.OFFLINE;
    this.state.transport = 'offline';
    
    this.emit('offline');
    this.emit('connection_state', this.state);
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        const startTime = Date.now();
        
        await this.sendAndWait({
          type: 'event',
          action: 'heartbeat',
          payload: { clientTime: startTime }
        }, 10000);

        const endTime = Date.now();
        this.state.latency = Math.floor((endTime - startTime) / 2);
        
        this.emit('heartbeat', { latency: this.state.latency });
      } catch (error) {
        console.warn('Heartbeat failed:', error.message);
      }

      // Schedule next heartbeat
      this.heartbeatTimer = setTimeout(sendHeartbeat, this.options.heartbeatInterval);
    };

    // Start first heartbeat
    this.heartbeatTimer = setTimeout(sendHeartbeat, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Get current connection state
   * @returns {Object} Connection state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get current transport name
   * @returns {string|null}
   */
  getTransport() {
    return this.state.transport;
  }

  /**
   * Get current latency
   * @returns {number}
   */
  getLatency() {
    return this.state.latency;
  }

  /**
   * Check if currently online
   * @returns {boolean}
   */
  isOnline() {
    return this.state.status === ConnectionState.CONNECTED;
  }

  /**
   * Get count of pending messages in queue
   * @returns {Promise<number>}
   */
  async getPendingCount() {
    return await this.queue.getPendingCount();
  }

  /**
   * Get all pending messages
   * @returns {Promise<Array>}
   */
  async getPendingMessages() {
    return await this.queue.getPendingMessages();
  }

  /**
   * Retry all pending messages
   * @returns {Promise<void>}
   */
  async retryPending() {
    if (this.isOnline()) {
      await this.queue.process((msg) => this.sendDirect(msg));
    }
  }

  /**
   * Clear pending message queue
   * @returns {Promise<void>}
   */
  async clearPending() {
    await this.queue.clear();
  }
}

// Export connection state enum
export { ConnectionState };
