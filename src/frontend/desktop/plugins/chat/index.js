/**
 * Chat Plugin - Team instant messaging
 * Supports group chat, reactions, @mentions, replies, and file sharing
 */
import ChatService from './services/chat-service.js';
import AttachmentService from '../../services/attachments/attachment-service.js';

class ChatPlugin {
  static id = 'chat';

  constructor(context) {
    this.context = context;
    this.container = null;

    // State
    this.state = {
      rooms: [],
      currentRoom: null,
      messages: [],
      typingUsers: [],
      replyingTo: null,
      searchQuery: '',
      showCreateModal: false,
      hasMoreMessages: false
    };

    // Services
    this.chatService = null;
    this.attachmentService = null;

    // Input buffer (preserved across renders)
    this.messageInput = '';

    // Scroll lock: true when user has scrolled up
    this.scrollLocked = false;

    // Typing indicator debounce timer
    this.typingTimer = null;

    // Polling timer
    this.pollTimer = null;
    this.lastPollAt = 0;

    // Localization
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('[Chat] Installing...');
    this.chatService = new ChatService(this.context.services.DatabaseService);
    await this.chatService.initSchema();
    this.attachmentService = new AttachmentService(this.context.services.DatabaseService);
    await this.attachmentService.initSchema();
    console.log('[Chat] Installed');
  }

  async onActivate() {
    console.log('[Chat] Activating...');
    this.chatService = new ChatService(this.context.services.DatabaseService);
    this.attachmentService = new AttachmentService(this.context.services.DatabaseService);
    await this.loadRooms();
    this.subscribeSyncEvents();
    console.log('[Chat] Activated');
  }

  async onDeactivate() {
    console.log('[Chat] Deactivating...');
    this.stopPolling();
    this.unsubscribeSyncEvents();
    console.log('[Chat] Deactivated');
  }

  async mount(container) {
    this.container = container;
    await this.render();
    this.bindEvents();
  }

  async unmount() {
    this.stopPolling();
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  // ==================== Rendering ====================

  async render() {
    if (!this.container) return;

    const { rooms, currentRoom, messages, typingUsers, replyingTo, showCreateModal } = this.state;

    this.container.innerHTML = `
      <div class="chat-plugin">
        <div class="chat-sidebar">
          ${this.renderRoomList(rooms, currentRoom)}
        </div>

        <div class="chat-main">
          ${currentRoom
            ? this.renderChatArea(currentRoom, messages, typingUsers, replyingTo)
            : this.renderEmptyState()
          }
        </div>
      </div>

      ${showCreateModal ? this.renderCreateRoomModal() : ''}
    `;

    this.bindEvents();

    if (currentRoom) {
      this.scrollToBottom();
    }
  }

  renderRoomList(rooms, currentRoom) {
    const { searchQuery } = this.state;
    const filtered = searchQuery
      ? rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : rooms;

    return `
      <div class="room-list-header">
        <h3>💬 ${this.t('chats')}</h3>
        <button class="btn-icon" data-action="show-create-modal" title="${this.t('createRoom')}">+</button>
      </div>

      <div class="room-search">
        <input type="text"
               class="search-input"
               placeholder="${this.t('searchRooms')}"
               value="${this.escapeHtml(searchQuery)}"
               data-action="search-rooms">
      </div>

      <ul class="room-items">
        ${filtered.length === 0 ? `
          <div class="room-list-empty">
            <span class="empty-icon">💬</span>
            <p>${this.t('noRooms')}</p>
            <p>${this.t('noRoomsHint')}</p>
          </div>
        ` : filtered.map(room => `
          <li class="room-item ${room.id === currentRoom?.id ? 'active' : ''} ${room.isPinned ? 'pinned' : ''}"
              data-room-id="${room.id}"
              data-action="select-room">
            <div class="room-avatar">
              ${room.avatar || this.getRoomIcon(room.roomType)}
            </div>
            <div class="room-info">
              <div class="room-name">${this.escapeHtml(room.name)}</div>
              <div class="room-last-message">${this.escapeHtml(this.truncate(room.lastMessage || '', 30))}</div>
            </div>
            <div class="room-meta">
              ${room.lastMessageAt ? `
                <span class="room-time">${this.formatTime(room.lastMessageAt)}</span>
              ` : ''}
              ${room.unreadCount > 0 ? `
                <span class="unread-badge">${room.unreadCount > 99 ? '99+' : room.unreadCount}</span>
              ` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  renderChatArea(room, messages, typingUsers, replyingTo) {
    const memberCount = room.members?.length || 0;

    return `
      <div class="chat-header">
        <div class="chat-room-info">
          <span class="room-icon">${room.avatar || this.getRoomIcon(room.roomType)}</span>
          <div class="room-details">
            <h2 class="room-title">${this.escapeHtml(room.name)}</h2>
            ${memberCount > 0 ? `
              <span class="room-members">${memberCount} ${this.t('memberCount')}</span>
            ` : ''}
          </div>
        </div>
        <div class="chat-actions">
          <button class="btn-icon" data-action="delete-room" data-room-id="${room.id}" title="${this.t('deleteRoom')}">🗑️</button>
        </div>
      </div>

      <div class="chat-messages" id="messageContainer">
        ${this.state.hasMoreMessages ? `
          <button class="load-more-btn" data-action="load-more">${this.t('loadMore')}</button>
        ` : ''}
        ${this.renderMessages(messages)}
        ${typingUsers.length > 0 ? `
          <div class="typing-indicator">
            ${typingUsers.map(u => this.escapeHtml(u.name)).join(', ')} ${this.t('isTyping')}...
          </div>
        ` : ''}
      </div>

      ${replyingTo ? `
        <div class="reply-banner">
          <span class="reply-label">${this.t('replyingTo')} ${this.escapeHtml(replyingTo.senderName)}</span>
          <span class="reply-content">${this.escapeHtml(this.truncate(replyingTo.content, 60))}</span>
          <button class="btn-icon" data-action="cancel-reply" title="${this.t('close')}">✕</button>
        </div>
      ` : ''}

      <div class="chat-input-area">
        <div class="input-toolbar">
          <button class="btn-icon" data-action="attach-file" title="${this.t('attachFile')}">📎</button>
          <button class="btn-icon" data-action="attach-image" title="${this.t('attachImage')}">🖼️</button>
          <button class="btn-icon" data-action="emoji" title="${this.t('emoji')}">😊</button>
        </div>
        <div class="input-wrapper">
          <textarea class="message-input"
                    placeholder="${this.t('typeMessage')}"
                    rows="1"
                    data-action="message-input">${this.escapeHtml(this.messageInput)}</textarea>
          <button class="btn-send" data-action="send-message">${this.t('send')}</button>
        </div>
      </div>
    `;
  }

  renderMessages(messages) {
    if (messages.length === 0) {
      return `<div class="no-messages"><p>${this.t('noMessages')}</p></div>`;
    }

    let html = '';
    let lastDate = null;
    let lastSenderId = null;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const messageDate = new Date(message.createdAt).toDateString();

      // Date separator
      if (messageDate !== lastDate) {
        html += `
          <div class="date-separator">
            <span>${this.formatDateSeparator(message.createdAt)}</span>
          </div>
        `;
        lastDate = messageDate;
        lastSenderId = null;
      }

      // Merge consecutive messages from the same sender (within 1 minute)
      const prevMessage = i > 0 ? messages[i - 1] : null;
      const isContinuous = lastSenderId === message.senderId &&
        prevMessage &&
        (message.createdAt - prevMessage.createdAt < 60000);

      html += this.renderMessage(message, isContinuous);
      lastSenderId = message.senderId;
    }

    return html;
  }

  renderMessage(message, isContinuous) {
    const isOwn = message.senderId === this.getCurrentUserId();

    return `
      <div class="message ${isOwn ? 'own' : ''} ${isContinuous ? 'continuous' : ''} ${message.status || ''}"
           data-message-id="${message.id}">
        ${!isContinuous ? `
          <div class="message-avatar">
            ${message.senderAvatar
              ? `<img src="${message.senderAvatar}" alt="">`
              : `<span class="avatar-placeholder">${this.escapeHtml((message.senderName || '?').charAt(0))}</span>`
            }
          </div>
        ` : `<div class="message-avatar"></div>`}

        <div class="message-content">
          ${!isContinuous ? `
            <div class="message-header">
              <span class="sender-name">${this.escapeHtml(message.senderName)}</span>
              <span class="message-time">${this.formatTime(message.createdAt)}</span>
            </div>
          ` : ''}

          ${message.replyTo ? this.renderReplyPreview(message.replyTo) : ''}

          ${message.messageType === 'text' || !message.messageType ? `
            <div class="message-text">${this.formatMessageContent(message.content)}</div>
          ` : ''}

          ${message.messageType === 'image' ? `
            <div class="message-images">
              ${(message.attachments || []).map(att => `
                <img src="${att.url}"
                     alt="${this.escapeHtml(att.name || '')}"
                     style="max-width: ${Math.min(att.width || 300, 300)}px"
                     data-action="preview-image"
                     data-url="${att.url}">
              `).join('')}
            </div>
          ` : ''}

          ${message.messageType === 'file' ? `
            <div class="message-files">
              ${(message.attachments || []).map(att => `
                <a class="file-attachment" href="${att.url}" download="${this.escapeHtml(att.name || '')}">
                  <span class="file-icon">📄</span>
                  <span class="file-name">${this.escapeHtml(att.name || '')}</span>
                  <span class="file-size">${this.formatSize(att.size || 0)}</span>
                </a>
              `).join('')}
            </div>
          ` : ''}

          ${(message.reactions || []).length > 0 ? `
            <div class="message-reactions">
              ${message.reactions.map(r => `
                <span class="reaction ${(r.users || []).includes(this.getCurrentUserId()) ? 'own' : ''}"
                      data-action="toggle-reaction"
                      data-emoji="${this.escapeHtml(r.emoji)}"
                      data-message-id="${message.id}">
                  ${r.emoji} ${r.count || (r.users || []).length}
                </span>
              `).join('')}
            </div>
          ` : ''}

          ${message.status === 'failed' ? `
            <div class="message-error">
              <span>${this.t('sendFailed')}</span>
              <button class="btn-icon" data-action="retry-send" data-message-id="${message.id}">${this.t('retry')}</button>
            </div>
          ` : ''}
        </div>

        <div class="message-actions">
          <button class="btn-icon" data-action="react" data-message-id="${message.id}" title="${this.t('react')}">😊</button>
          <button class="btn-icon" data-action="reply" data-message-id="${message.id}" title="${this.t('reply')}">↩️</button>
          ${isOwn ? `
            <button class="btn-icon" data-action="delete-message" data-message-id="${message.id}" title="${this.t('delete')}">🗑️</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderReplyPreview(replyToId) {
    const originalMessage = this.state.messages.find(m => m.id === replyToId);
    if (!originalMessage) return '';

    return `
      <div class="reply-preview-inline" data-action="scroll-to-message" data-message-id="${replyToId}">
        <span class="reply-sender">${this.escapeHtml(originalMessage.senderName)}</span>
        <span class="reply-text">${this.escapeHtml(this.truncate(originalMessage.content, 60))}</span>
      </div>
    `;
  }

  renderEmptyState() {
    return `
      <div class="chat-empty-state">
        <span class="empty-icon">💬</span>
        <h3>${this.t('selectRoom')}</h3>
        <p>${this.t('selectRoomHint')}</p>
      </div>
    `;
  }

  renderCreateRoomModal() {
    return `
      <div class="chat-modal-overlay" data-action="close-modal">
        <div class="chat-modal" data-stop-propagation>
          <h3>${this.t('createRoom')}</h3>
          <div class="form-group">
            <label for="newRoomName">${this.t('roomName')}</label>
            <input type="text"
                   id="newRoomName"
                   class="form-input"
                   placeholder="${this.t('roomNamePlaceholder')}"
                   data-action="new-room-name"
                   autofocus>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" data-action="close-modal">${this.t('cancel')}</button>
            <button class="btn-primary" data-action="create-room">${this.t('createRoomBtn')}</button>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== Event Binding ====================

  bindEvents() {
    if (!this.container) return;

    // Delegate all click events
    this.container.addEventListener('click', async (e) => {
      // Prevent modal close when clicking inside it
      if (e.target.closest('[data-stop-propagation]')) return;

      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      await this.handleAction(action, actionEl, e);
    });

    // Input events
    this.container.addEventListener('input', (e) => {
      const target = e.target;

      if (target.matches('.message-input')) {
        this.messageInput = target.value;
        this.autoResizeTextarea(target);
        this.sendTypingIndicator();
        return;
      }

      if (target.matches('[data-action="search-rooms"]')) {
        this.state.searchQuery = target.value;
        this.renderRoomListOnly();
        return;
      }
    });

    // Keyboard events on message input
    this.container.addEventListener('keydown', (e) => {
      if (!e.target.matches('.message-input')) return;

      const enterToSend = this.getSetting('enterToSend') !== false;
      if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
        e.preventDefault();
        this.sendCurrentMessage();
      }
    });

    // Scroll event for loading more messages
    const msgContainer = this.container.querySelector('#messageContainer');
    if (msgContainer) {
      msgContainer.addEventListener('scroll', () => {
        this.handleScroll(msgContainer);
      });
    }

    // Restore input value and cursor after render
    const inputEl = this.container.querySelector('.message-input');
    if (inputEl && this.messageInput) {
      inputEl.value = this.messageInput;
      this.autoResizeTextarea(inputEl);
    }
  }

  async handleAction(action, element, event) {
    const handlers = {
      'select-room': () => this.selectRoom(element.dataset.roomId),
      'send-message': () => this.sendCurrentMessage(),
      'show-create-modal': () => this.showCreateModal(),
      'close-modal': () => this.hideCreateModal(),
      'create-room': () => this.createRoomFromModal(),
      'delete-room': () => this.deleteRoom(element.dataset.roomId),
      'reply': () => this.startReply(element.dataset.messageId),
      'cancel-reply': () => this.cancelReply(),
      'delete-message': () => this.deleteMessage(element.dataset.messageId),
      'toggle-reaction': () => this.toggleReaction(element.dataset.messageId, element.dataset.emoji),
      'react': () => this.pickReaction(element.dataset.messageId),
      'retry-send': () => this.retrySend(element.dataset.messageId),
      'scroll-to-message': () => this.scrollToMessage(element.dataset.messageId),
      'load-more': () => this.loadMoreMessages(),
      'attach-file': () => this.selectAndUploadFile('*/*'),
      'attach-image': () => this.selectAndUploadFile('image/*'),
      'preview-image': () => this.previewImage(element.dataset.url),
      'message-input': () => { /* handled by input event */ }
    };

    const handler = handlers[action];
    if (handler) {
      await handler();
    }
  }

  // ==================== Data Operations ====================

  async loadRooms() {
    if (!this.chatService) return;

    const rooms = await this.chatService.getRooms();

    // Load member counts and unread counts
    const currentUserId = this.getCurrentUserId();
    for (const room of rooms) {
      const members = await this.chatService.getRoomMembers(room.id);
      room.members = members;
      const member = members.find(m => m.user_id === currentUserId);
      if (member) {
        room.unreadCount = await this.chatService.getUnreadCount(room.id, member.last_read_at);
      } else {
        room.unreadCount = 0;
      }
    }

    this.state.rooms = rooms;
  }

  async selectRoom(roomId) {
    if (!this.chatService) return;

    // Mark as read
    const currentUserId = this.getCurrentUserId();
    await this.chatService.updateLastRead(roomId, currentUserId, Date.now());

    const room = await this.chatService.getRoom(roomId);
    if (!room) return;

    const members = await this.chatService.getRoomMembers(roomId);
    room.members = members;

    this.state.currentRoom = room;
    this.state.typingUsers = [];
    this.state.replyingTo = null;
    this.state.hasMoreMessages = false;
    this.messageInput = '';

    await this.loadMessages(roomId);

    // Clear unread count for this room in state
    this.state.rooms = this.state.rooms.map(r =>
      r.id === roomId ? { ...r, unreadCount: 0 } : r
    );

    // Start polling for new messages
    this.startPolling();

    await this.render();
  }

  async loadMessages(roomId, before) {
    if (!this.chatService) return;

    const options = { limit: 50 };
    if (before) options.before = before;

    const messages = await this.chatService.getMessages(roomId, options);

    if (before) {
      // Prepend older messages
      this.state.messages = [...messages, ...this.state.messages];
      this.state.hasMoreMessages = messages.length >= 50;
    } else {
      this.state.messages = messages;
      this.state.hasMoreMessages = messages.length >= 50;
      this.lastPollAt = messages.length > 0
        ? messages[messages.length - 1].createdAt
        : Date.now();
    }
  }

  async loadMoreMessages() {
    if (!this.state.currentRoom || this.state.messages.length === 0) return;
    if (this._loadingMore) return;

    this._loadingMore = true;
    try {
      const oldest = this.state.messages[0];
      await this.loadMessages(this.state.currentRoom.id, oldest.createdAt);

      // Re-render but preserve scroll position near top
      const container = this.container?.querySelector('#messageContainer');
      const prevHeight = container?.scrollHeight || 0;

      await this.render();

      if (container) {
        container.scrollTop = container.scrollHeight - prevHeight;
      }
    } finally {
      this._loadingMore = false;
    }
  }

  async sendMessage(content, attachments) {
    if (!this.state.currentRoom) return;

    const messageType = attachments?.length
      ? this.getMessageType(attachments[0])
      : 'text';

    const message = {
      id: this.generateId(),
      roomId: this.state.currentRoom.id,
      senderId: this.getCurrentUserId(),
      senderName: this.getCurrentUserName(),
      content: content || '',
      messageType,
      attachments: attachments || [],
      reactions: [],
      replyTo: this.state.replyingTo?.id || null,
      mentions: this.extractMentions(content || ''),
      status: 'sending',
      createdAt: Date.now()
    };

    // Optimistic update
    this.state.messages = [...this.state.messages, message];
    this.state.replyingTo = null;
    await this.render();

    try {
      const saved = await this.chatService.createMessage(message);

      // Replace optimistic with saved
      this.state.messages = this.state.messages.map(m =>
        m.id === message.id ? saved : m
      );

      // Update room list last message
      this.state.rooms = this.state.rooms.map(r =>
        r.id === this.state.currentRoom.id
          ? { ...r, lastMessage: saved.content, lastMessageAt: saved.createdAt }
          : r
      );

      this.lastPollAt = saved.createdAt;

      // Broadcast via sync layer if available
      this.broadcastMessage(saved);

    } catch (err) {
      console.error('[Chat] Failed to save message:', err);
      this.state.messages = this.state.messages.map(m =>
        m.id === message.id ? { ...m, status: 'failed' } : m
      );
    }

    await this.render();
  }

  async deleteMessage(messageId) {
    if (!confirm(this.t('confirmDelete'))) return;
    if (!this.chatService) return;

    await this.chatService.deleteMessage(messageId);
    this.state.messages = this.state.messages.filter(m => m.id !== messageId);
    await this.render();
  }

  async createRoom(name) {
    if (!name || !name.trim()) return null;
    if (!this.chatService) return null;

    const currentUserId = this.getCurrentUserId();
    const currentUserName = this.getCurrentUserName();

    const room = await this.chatService.createRoom({
      name: name.trim(),
      roomType: 'custom',
      createdBy: currentUserId
    });

    // Add creator as member
    await this.chatService.addRoomMember({
      roomId: room.id,
      userId: currentUserId,
      userName: currentUserName,
      role: 'owner'
    });

    await this.loadRooms();
    return room;
  }

  async deleteRoom(roomId) {
    if (!confirm(this.t('confirmDeleteRoom'))) return;
    if (!this.chatService) return;

    await this.chatService.deleteRoom(roomId);

    if (this.state.currentRoom?.id === roomId) {
      this.state.currentRoom = null;
      this.state.messages = [];
      this.stopPolling();
    }

    await this.loadRooms();
    await this.render();
  }

  async toggleReaction(messageId, emoji) {
    const message = this.state.messages.find(m => m.id === messageId);
    if (!message) return;

    const userId = this.getCurrentUserId();
    const reactions = JSON.parse(JSON.stringify(message.reactions || []));
    const existing = reactions.find(r => r.emoji === emoji);

    if (existing) {
      if (existing.users.includes(userId)) {
        // Remove reaction
        existing.users = existing.users.filter(u => u !== userId);
        existing.count = existing.users.length;
        if (existing.count === 0) {
          reactions.splice(reactions.indexOf(existing), 1);
        }
      } else {
        // Add to existing
        existing.users.push(userId);
        existing.count = existing.users.length;
      }
    } else {
      // New reaction
      reactions.push({ emoji, users: [userId], count: 1 });
    }

    // Update locally
    this.state.messages = this.state.messages.map(m =>
      m.id === messageId ? { ...m, reactions } : m
    );

    // Persist
    await this.chatService.updateMessage(messageId, { reactions });

    await this.render();
  }

  async pickReaction(messageId) {
    // Simple emoji picker with common reactions
    const commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🔥'];
    const emoji = window.prompt('Pick an emoji: ' + commonEmojis.join(' '), '👍');
    if (emoji) {
      await this.toggleReaction(messageId, emoji.trim());
    }
  }

  async retrySend(messageId) {
    const message = this.state.messages.find(m => m.id === messageId);
    if (!message) return;

    try {
      const saved = await this.chatService.createMessage({ ...message, status: 'sent' });
      this.state.messages = this.state.messages.map(m =>
        m.id === messageId ? saved : m
      );
      await this.render();
    } catch (err) {
      console.error('[Chat] Retry failed:', err);
    }
  }

  // ==================== Polling ====================

  startPolling() {
    this.stopPolling();

    const interval = this.getSetting('pollInterval') || 3000;
    this.pollTimer = setInterval(async () => {
      await this.pollNewMessages();
    }, interval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollNewMessages() {
    if (!this.state.currentRoom || !this.chatService) return;

    try {
      const newMessages = await this.chatService.getMessages(
        this.state.currentRoom.id,
        { after: this.lastPollAt, limit: 50 }
      );

      if (newMessages.length === 0) return;

      const currentUserId = this.getCurrentUserId();
      const existingIds = new Set(this.state.messages.map(m => m.id));

      let hasNew = false;
      for (const msg of newMessages) {
        if (!existingIds.has(msg.id)) {
          this.state.messages = [...this.state.messages, msg];
          this.lastPollAt = Math.max(this.lastPollAt, msg.createdAt);
          hasNew = true;

          // Show notification for messages from others
          if (msg.senderId !== currentUserId && this.getSetting('notifications') !== false) {
            this.showNotification(msg);
          }
        }
      }

      if (hasNew) {
        // Mark as read
        await this.chatService.updateLastRead(
          this.state.currentRoom.id,
          currentUserId,
          Date.now()
        );

        await this.render();

        if (!this.scrollLocked) {
          this.scrollToBottom();
        }
      }
    } catch (err) {
      // Polling errors are non-fatal
      console.warn('[Chat] Poll error:', err);
    }
  }

  // ==================== Sync / Communication Layer ====================

  subscribeSyncEvents() {
    const comm = this.context?.services?.CommunicationLayer;
    if (!comm) return;

    try {
      this._syncUnsub = comm.on?.('chat_message', (payload) => {
        this.handleIncomingMessage(payload);
      });
      this._typingUnsub = comm.on?.('chat_typing', (payload) => {
        this.handleTypingIndicator(payload);
      });
      this._reactionUnsub = comm.on?.('chat_reaction', (payload) => {
        this.handleReactionUpdate(payload);
      });
    } catch (err) {
      // Communication layer not available - graceful degradation
      console.debug('[Chat] Sync events not available, using polling only');
    }
  }

  unsubscribeSyncEvents() {
    this._syncUnsub?.();
    this._typingUnsub?.();
    this._reactionUnsub?.();
  }

  broadcastMessage(message) {
    const comm = this.context?.services?.CommunicationLayer;
    if (!comm) return;

    try {
      comm.send?.({
        type: 'event',
        action: 'chat_message',
        payload: {
          roomId: message.roomId,
          message
        }
      });
    } catch (err) {
      // Graceful degradation
    }
  }

  handleIncomingMessage(payload) {
    const { roomId, message } = payload;
    if (message.senderId === this.getCurrentUserId()) return;

    // Save to local DB
    this.chatService?.createMessage(message).catch(() => {});

    if (this.state.currentRoom?.id === roomId) {
      const exists = this.state.messages.some(m => m.id === message.id);
      if (!exists) {
        this.state.messages = [...this.state.messages, message];
        this.lastPollAt = Math.max(this.lastPollAt, message.createdAt);

        this.render().then(() => {
          if (!this.scrollLocked) this.scrollToBottom();
        });
      }
    } else {
      // Update unread count
      this.state.rooms = this.state.rooms.map(r =>
        r.id === roomId ? { ...r, unreadCount: (r.unreadCount || 0) + 1 } : r
      );
      this.renderRoomListOnly();
    }

    if (this.getSetting('notifications') !== false) {
      this.showNotification(message);
    }
  }

  handleTypingIndicator(payload) {
    const { roomId, userId, userName } = payload;
    if (this.state.currentRoom?.id !== roomId) return;
    if (userId === this.getCurrentUserId()) return;

    const typingUsers = this.state.typingUsers.filter(u => u.id !== userId);
    typingUsers.push({ id: userId, name: userName, timestamp: Date.now() });
    this.state.typingUsers = typingUsers;

    const msgContainer = this.container?.querySelector('#messageContainer');
    const typingEl = this.container?.querySelector('.typing-indicator');
    if (typingEl) {
      typingEl.textContent = typingUsers.map(u => u.name).join(', ') + ' ' + this.t('isTyping') + '...';
    }

    setTimeout(() => {
      this.state.typingUsers = this.state.typingUsers.filter(u =>
        u.id !== userId || Date.now() - u.timestamp < 3000
      );
      if (this.container?.querySelector('.typing-indicator')) {
        this.renderTypingIndicator();
      }
    }, 3000);
  }

  handleReactionUpdate(payload) {
    const { messageId, emoji, userId, action } = payload;
    const message = this.state.messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = JSON.parse(JSON.stringify(message.reactions || []));
    const existing = reactions.find(r => r.emoji === emoji);

    if (action === 'add') {
      if (existing) {
        if (!existing.users.includes(userId)) {
          existing.users.push(userId);
          existing.count = existing.users.length;
        }
      } else {
        reactions.push({ emoji, users: [userId], count: 1 });
      }
    } else if (action === 'remove' && existing) {
      existing.users = existing.users.filter(u => u !== userId);
      existing.count = existing.users.length;
      if (existing.count === 0) {
        reactions.splice(reactions.indexOf(existing), 1);
      }
    }

    this.state.messages = this.state.messages.map(m =>
      m.id === messageId ? { ...m, reactions } : m
    );
    this.render();
  }

  sendTypingIndicator() {
    if (!this.state.currentRoom) return;
    if (this.typingTimer) return;

    const comm = this.context?.services?.CommunicationLayer;
    try {
      comm?.send?.({
        type: 'event',
        action: 'chat_typing',
        payload: {
          roomId: this.state.currentRoom.id,
          userId: this.getCurrentUserId(),
          userName: this.getCurrentUserName()
        }
      });
    } catch (_) { /* graceful degradation */ }

    this.typingTimer = setTimeout(() => {
      this.typingTimer = null;
    }, 3000);
  }

  // ==================== UI Helpers ====================

  showCreateModal() {
    this.state.showCreateModal = true;
    this.render();
  }

  hideCreateModal() {
    this.state.showCreateModal = false;
    this.render();
  }

  async createRoomFromModal() {
    const input = this.container?.querySelector('#newRoomName');
    const name = input?.value?.trim();
    if (!name) return;

    const room = await this.createRoom(name);
    this.state.showCreateModal = false;

    if (room) {
      await this.selectRoom(room.id);
    } else {
      await this.render();
    }
  }

  sendCurrentMessage() {
    const input = this.container?.querySelector('.message-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    this.messageInput = '';
    input.value = '';
    this.autoResizeTextarea(input);
    this.sendMessage(content);
  }

  startReply(messageId) {
    const message = this.state.messages.find(m => m.id === messageId);
    if (!message) return;

    this.state.replyingTo = message;
    this.render().then(() => {
      this.container?.querySelector('.message-input')?.focus();
    });
  }

  cancelReply() {
    this.state.replyingTo = null;
    this.render();
  }

  handleScroll(container) {
    if (container.scrollTop < 100 && this.state.messages.length > 0 && this.state.hasMoreMessages) {
      this.loadMoreMessages();
    }

    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    this.scrollLocked = !isAtBottom;
  }

  scrollToBottom() {
    const container = this.container?.querySelector('#messageContainer');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 30);
    }
  }

  scrollToMessage(messageId) {
    const el = this.container?.querySelector(`[data-message-id="${messageId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }

  renderRoomListOnly() {
    const sidebarEl = this.container?.querySelector('.chat-sidebar');
    if (!sidebarEl) return;
    sidebarEl.innerHTML = this.renderRoomList(this.state.rooms, this.state.currentRoom);
  }

  renderTypingIndicator() {
    const el = this.container?.querySelector('.typing-indicator');
    if (!el) return;
    const { typingUsers } = this.state;
    if (typingUsers.length > 0) {
      el.style.display = '';
      el.textContent = typingUsers.map(u => u.name).join(', ') + ' ' + this.t('isTyping') + '...';
    } else {
      el.style.display = 'none';
    }
  }

  showNotification(message) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;

    try {
      const n = new Notification(message.senderName || '', {
        body: message.content.slice(0, 100),
        icon: message.senderAvatar || '/icons/default-avatar.png',
        tag: `chat-${message.roomId}`,
        data: { roomId: message.roomId }
      });

      n.onclick = () => {
        window.focus();
        this.selectRoom(message.roomId);
      };
    } catch (_) { /* Notification may be blocked */ }
  }

  async selectAndUploadFile(accept) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        await this.uploadAndSendFile(file);
      }
    };

    input.click();
  }

  async uploadAndSendFile(file) {
    const roomId = this.state.currentRoom?.id || 'unknown';

    // Use AttachmentService to persist the file when available
    let url = URL.createObjectURL(file);
    let persistedId = null;
    if (this.attachmentService) {
      try {
        const att = await this.attachmentService.upload(file, 'chat', roomId);
        persistedId = att.id;
        const persistedUrl = await this.attachmentService.getUrl(att.id);
        if (persistedUrl) url = persistedUrl;
      } catch (err) {
        console.warn('[Chat] AttachmentService upload failed, using blob URL:', err.message);
      }
    }

    const attachment = {
      id: persistedId || this.generateId(),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url
    };

    if (file.type.startsWith('image/')) {
      const dims = await this.getImageDimensions(file);
      attachment.width = dims.width;
      attachment.height = dims.height;
    }

    await this.sendMessage('', [attachment]);
  }

  getImageDimensions(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve({ width: 300, height: 200 });
      img.src = URL.createObjectURL(file);
    });
  }

  previewImage(url) {
    if (!url) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer;';
    overlay.innerHTML = `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:8px;">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  }

  // ==================== Format Helpers ====================

  formatMessageContent(content) {
    if (!content) return '';

    let html = this.escapeHtml(content);

    // @mentions
    html = html.replace(/@(\w+)/g, '<span class="mention">@$1</span>');

    // URLs
    html = html.replace(
      /(https?:\/\/[^\s<>]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Newlines
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return this.t('justNow');
    if (diff < 3600000) return `${Math.floor(diff / 60000)} ${this.t('minutesAgo')}`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  }

  formatDateSeparator(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) return this.t('today');

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return this.t('yesterday');

    return date.toLocaleDateString();
  }

  formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ==================== Misc Helpers ====================

  t(key) {
    return this.i18n?.t?.(key) || key;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  generateId() {
    return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  }

  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.slice(0, maxLength) + '...';
  }

  extractMentions(content) {
    const mentions = [];
    const regex = /@(\w+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  getRoomIcon(roomType) {
    const icons = {
      department: '🏢',
      project: '📁',
      custom: '👥',
      direct: '👤'
    };
    return icons[roomType] || '💬';
  }

  getMessageType(attachment) {
    if (!attachment?.mimeType) return 'file';
    if (attachment.mimeType.startsWith('image/')) return 'image';
    return 'file';
  }

  getCurrentUserId() {
    return window.app?.user?.id || 'local-user';
  }

  getCurrentUserName() {
    return window.app?.user?.name || 'Me';
  }

  getSetting(key) {
    return this.context?.settings?.get?.(key) ?? null;
  }
}

export default ChatPlugin;
