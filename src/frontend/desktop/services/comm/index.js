/**
 * Communication Layer Module
 * Entry point for the communication service
 */

export { CommunicationLayer, ConnectionState } from './communication-layer.js';
export { WebSocketTransport } from './transports/websocket.js';
export { SSETransport } from './transports/sse.js';
export { LongPollingTransport } from './transports/long-polling.js';
export { ShortPollingTransport } from './transports/short-polling.js';
export { MessageQueue } from './queue/message-queue.js';
export { QueueStorage } from './queue/queue-storage.js';
export { 
  generateMessageId, 
  createMessage, 
  validateMessage, 
  isMessageExpired,
  serializeMessage,
  deserializeMessage
} from './utils/message.js';
export { 
  calculateBackoff, 
  calculateNextAttempt, 
  shouldRetry,
  createRetryConfig,
  RetryStrategy
} from './utils/retry.js';
