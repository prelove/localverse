/**
 * Message utility functions for the communication layer
 * Handles message ID generation, validation, and formatting
 */

/**
 * Generate a unique message ID using UUID v7-like format
 * Format: msg_<timestamp>_<random>
 * @returns {string} Unique message ID
 */
export function generateMessageId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `msg_${timestamp}_${random}`;
}

/**
 * Create a message object with default values
 * @param {Object} partial - Partial message data
 * @param {string} partial.type - Message type (command|event|data|ack)
 * @param {string} partial.action - Message action
 * @param {any} partial.payload - Message payload
 * @param {string} [partial.from] - Sender ID
 * @param {string} [partial.to] - Receiver ID
 * @param {string} [partial.replyTo] - Reply target message ID
 * @param {string} [partial.priority='normal'] - Message priority
 * @param {number} [partial.ttl] - Time to live in seconds
 * @returns {Object} Complete message object
 */
export function createMessage(partial) {
  const message = {
    id: partial.id || generateMessageId(),
    type: partial.type || 'data',
    action: partial.action,
    payload: partial.payload,
    timestamp: Date.now(),
    priority: partial.priority || 'normal',
    ...partial
  };

  // Add optional fields if provided
  if (partial.from) message.from = partial.from;
  if (partial.to) message.to = partial.to;
  if (partial.replyTo) message.replyTo = partial.replyTo;
  if (partial.ttl) message.ttl = partial.ttl;

  return message;
}

/**
 * Validate message structure
 * @param {Object} message - Message to validate
 * @returns {boolean} True if valid
 * @throws {Error} If message is invalid
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    throw new Error('Message must be an object');
  }

  if (!message.id || typeof message.id !== 'string') {
    throw new Error('Message must have a valid id');
  }

  const validTypes = ['command', 'event', 'data', 'ack'];
  if (!validTypes.includes(message.type)) {
    throw new Error(`Message type must be one of: ${validTypes.join(', ')}`);
  }

  if (!message.action || typeof message.action !== 'string') {
    throw new Error('Message must have a valid action');
  }

  if (!message.timestamp || typeof message.timestamp !== 'number') {
    throw new Error('Message must have a valid timestamp');
  }

  const validPriorities = ['normal', 'high', 'urgent'];
  if (message.priority && !validPriorities.includes(message.priority)) {
    throw new Error(`Message priority must be one of: ${validPriorities.join(', ')}`);
  }

  return true;
}

/**
 * Check if a message has expired based on TTL
 * @param {Object} message - Message to check
 * @returns {boolean} True if expired
 */
export function isMessageExpired(message) {
  if (!message.ttl) return false;
  const expiresAt = message.timestamp + (message.ttl * 1000);
  return Date.now() > expiresAt;
}

/**
 * Serialize message to JSON string
 * @param {Object} message - Message to serialize
 * @returns {string} JSON string
 */
export function serializeMessage(message) {
  return JSON.stringify(message);
}

/**
 * Deserialize JSON string to message
 * @param {string} data - JSON string
 * @returns {Object} Message object
 * @throws {Error} If parsing fails
 */
export function deserializeMessage(data) {
  try {
    const message = JSON.parse(data);
    validateMessage(message);
    return message;
  } catch (error) {
    throw new Error(`Failed to deserialize message: ${error.message}`);
  }
}
