# Chat 插件规格

## 概述

Chat 是 Localverse 的即时通讯插件，提供团队内部实时聊天能力：
1. 群组聊天
2. 实时消息推送
3. 表情反应
4. 文件/图片分享
5. @提及
6. 消息搜索

## manifest.json

```json
{
  "id": "chat",
  "name": {
    "zh": "聊天",
    "ja": "チャット",
    "en": "Chat"
  },
  "version": "1.0.0",
  "description": {
    "zh": "团队即时通讯，支持群聊和文件分享",
    "ja": "チーム向けインスタントメッセージング",
    "en": "Team instant messaging with file sharing"
  },
  "icon": "💬",
  "category": "collaboration",
  
  "entry": "./index.js",
  "style": "./style.css",
  
  "location": {
    "sidebar": {
      "enabled": true,
      "order": 3
    }
  },
  
  "permissions": [
    "database:read",
    "database:write",
    "network:sync",
    "notification"
  ],
  
  "settings": {
    "notifications": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "桌面通知", "en": "Desktop notifications" }
    },
    "enterToSend": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "Enter 发送消息", "en": "Enter to send" }
    }
  }
}
```

## 插件实现（续）

```javascript
// plugins/chat/index.js (continued)

  handleIncomingMessage(payload) {
    const { roomId, message } = payload;
    
    // 跳过自己发的消息
    if (message.senderId === this.getCurrentUserId()) return;
    
    // 保存到本地
    this.saveMessage(message);
    
    // 如果是当前房间，添加到消息列表
    if (this.state.currentRoom?.id === roomId) {
      this.setState({
        messages: [...this.state.messages, message]
      });
      
      // 如果用户在底部，自动滚动
      if (!this.scrollLocked) {
        this.scrollToBottom();
      }
    } else {
      // 更新未读数
      this.setState({
        rooms: this.state.rooms.map(r => 
          r.id === roomId ? { ...r, unreadCount: (r.unreadCount || 0) + 1 } : r
        )
      });
    }
    
    // 发送通知
    if (this.getSetting('notifications')) {
      this.showNotification(message);
    }
  }
  
  handleTypingIndicator(payload) {
    const { roomId, userId, userName } = payload;
    
    if (this.state.currentRoom?.id !== roomId) return;
    if (userId === this.getCurrentUserId()) return;
    
    // 添加正在输入用户
    const typingUsers = this.state.typingUsers.filter(u => u.id !== userId);
    typingUsers.push({ id: userId, name: userName, timestamp: Date.now() });
    
    this.setState({ typingUsers });
    
    // 3秒后移除
    setTimeout(() => {
      this.setState({
        typingUsers: this.state.typingUsers.filter(u => 
          u.id !== userId || Date.now() - u.timestamp < 3000
        )
      });
    }, 3000);
  }
  
  handleReactionUpdate(payload) {
    const { messageId, emoji, userId, action } = payload;
    
    const message = this.state.messages.find(m => m.id === messageId);
    if (!message) return;
    
    const reactions = [...message.reactions];
    const existing = reactions.find(r => r.emoji === emoji);
    
    if (action === 'add') {
      if (existing) {
        if (!existing.users.includes(userId)) {
          existing.users.push(userId);
          existing.count++;
        }
      } else {
        reactions.push({ emoji, users: [userId], count: 1 });
      }
    } else if (action === 'remove' && existing) {
      existing.users = existing.users.filter(u => u !== userId);
      existing.count--;
      if (existing.count === 0) {
        reactions.splice(reactions.indexOf(existing), 1);
      }
    }
    
    this.setState({
      messages: this.state.messages.map(m => 
        m.id === messageId ? { ...m, reactions } : m
      )
    });
  }
  
  sendTypingIndicator() {
    if (!this.state.currentRoom) return;
    
    // 防抖：3秒内只发一次
    if (this.typingTimer) return;
    
    this.services.CommunicationLayer.send({
      type: 'event',
      action: 'chat_typing',
      payload: {
        roomId: this.state.currentRoom.id,
        userId: this.getCurrentUserId(),
        userName: this.getCurrentUserName()
      }
    });
    
    this.typingTimer = setTimeout(() => {
      this.typingTimer = null;
    }, 3000);
  }
  
  clearTypingIndicator() {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }
  
  showNotification(message) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;
    
    const room = this.state.rooms.find(r => r.id === message.roomId);
    
    new Notification(message.senderName, {
      body: message.content.slice(0, 100),
      icon: message.senderAvatar || '/icons/default-avatar.png',
      tag: `chat-${message.roomId}`,
      data: { roomId: message.roomId }
    }).onclick = () => {
      window.focus();
      this.selectRoom(message.roomId);
    };
  }
  
  // ============ 渲染 ============
  
  render() {
    const { rooms, currentRoom, messages, typingUsers, replyingTo } = this.state;
    
    return `
      <div class="chat">
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
    `;
  }
  
  renderRoomList(rooms, currentRoom) {
    return `
      <div class="room-list">
        <div class="room-list-header">
          <h3>${this.t('chats')}</h3>
          <button class="btn-icon" data-action="create-room">+</button>
        </div>
        
        <div class="room-search">
          <input type="text" placeholder="${this.t('searchRooms')}" class="search-input">
        </div>
        
        <ul class="room-items">
          ${rooms.map(room => `
            <li class="room-item ${room.id === currentRoom?.id ? 'active' : ''} ${room.pinned ? 'pinned' : ''}"
                data-room-id="${room.id}">
              <div class="room-avatar">
                ${room.avatar || this.getRoomIcon(room.roomType)}
              </div>
              <div class="room-info">
                <div class="room-name">${this.escapeHtml(room.name)}</div>
                <div class="room-last-message">${this.escapeHtml(room.lastMessage || '')}</div>
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
      </div>
    `;
  }
  
  renderChatArea(room, messages, typingUsers, replyingTo) {
    return `
      <div class="chat-header">
        <div class="chat-room-info">
          <span class="room-icon">${room.avatar || this.getRoomIcon(room.roomType)}</span>
          <div class="room-details">
            <h2 class="room-title">${this.escapeHtml(room.name)}</h2>
            <span class="room-members">${room.members.length} ${this.t('members')}</span>
          </div>
        </div>
        <div class="chat-actions">
          <button class="btn-icon" data-action="search-messages" title="${this.t('search')}">🔍</button>
          <button class="btn-icon" data-action="room-settings" title="${this.t('settings')}">⚙️</button>
        </div>
      </div>
      
      <div class="chat-messages" id="messageContainer">
        ${this.renderMessages(messages)}
        
        ${typingUsers.length > 0 ? `
          <div class="typing-indicator">
            ${typingUsers.map(u => u.name).join(', ')} ${this.t('isTyping')}...
          </div>
        ` : ''}
      </div>
      
      ${replyingTo ? `
        <div class="reply-preview">
          <span class="reply-label">${this.t('replyingTo')} ${replyingTo.senderName}</span>
          <span class="reply-content">${this.escapeHtml(this.truncate(replyingTo.content, 50))}</span>
          <button class="btn-icon" data-action="cancel-reply">×</button>
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
                    rows="1"></textarea>
          <button class="btn-send" data-action="send-message">
            ${this.t('send')}
          </button>
        </div>
      </div>
    `;
  }
  
  renderMessages(messages) {
    if (messages.length === 0) {
      return `
        <div class="no-messages">
          <p>${this.t('noMessages')}</p>
        </div>
      `;
    }
    
    let html = '';
    let lastDate = null;
    let lastSender = null;
    
    for (const message of messages) {
      const messageDate = new Date(message.createdAt).toDateString();
      
      // 日期分隔线
      if (messageDate !== lastDate) {
        html += `
          <div class="date-separator">
            <span>${this.formatDateSeparator(message.createdAt)}</span>
          </div>
        `;
        lastDate = messageDate;
        lastSender = null;
      }
      
      // 是否合并显示（同一用户连续消息）
      const isContinuous = lastSender === message.senderId && 
        (message.createdAt - messages[messages.indexOf(message) - 1]?.createdAt < 60000);
      
      html += this.renderMessage(message, isContinuous);
      lastSender = message.senderId;
    }
    
    return html;
  }
  
  renderMessage(message, isContinuous) {
    const isOwn = message.senderId === this.getCurrentUserId();
    
    return `
      <div class="message ${isOwn ? 'own' : ''} ${isContinuous ? 'continuous' : ''} ${message.status}"
           data-message-id="${message.id}">
        ${!isContinuous ? `
          <div class="message-avatar">
            ${message.senderAvatar 
              ? `<img src="${message.senderAvatar}" alt="">` 
              : `<span class="avatar-placeholder">${message.senderName.charAt(0)}</span>`
            }
          </div>
        ` : ''}
        
        <div class="message-content">
          ${!isContinuous ? `
            <div class="message-header">
              <span class="sender-name">${this.escapeHtml(message.senderName)}</span>
              <span class="message-time">${this.formatTime(message.createdAt)}</span>
            </div>
          ` : ''}
          
          ${message.replyTo ? this.renderReplyPreview(message.replyTo) : ''}
          
          ${message.messageType === 'text' ? `
            <div class="message-text">${this.formatMessageContent(message.content)}</div>
          ` : ''}
          
          ${message.messageType === 'image' ? `
            <div class="message-images">
              ${message.attachments.map(att => `
                <img src="${att.url}" 
                     alt="${att.name}"
                     style="max-width: ${Math.min(att.width || 300, 300)}px"
                     data-action="preview-image"
                     data-url="${att.url}">
              `).join('')}
            </div>
          ` : ''}
          
          ${message.messageType === 'file' ? `
            <div class="message-files">
              ${message.attachments.map(att => `
                <a class="file-attachment" href="${att.url}" download="${att.name}">
                  <span class="file-icon">📄</span>
                  <span class="file-name">${this.escapeHtml(att.name)}</span>
                  <span class="file-size">${this.formatSize(att.size)}</span>
                </a>
              `).join('')}
            </div>
          ` : ''}
          
          ${message.reactions.length > 0 ? `
            <div class="message-reactions">
              ${message.reactions.map(r => `
                <span class="reaction ${r.users.includes(this.getCurrentUserId()) ? 'own' : ''}"
                      data-action="toggle-reaction"
                      data-emoji="${r.emoji}"
                      data-message-id="${message.id}">
                  ${r.emoji} ${r.count}
                </span>
              `).join('')}
            </div>
          ` : ''}
          
          ${message.status === 'failed' ? `
            <div class="message-error">
              <span>${this.t('sendFailed')}</span>
              <button data-action="retry-send" data-message-id="${message.id}">${this.t('retry')}</button>
            </div>
          ` : ''}
        </div>
        
        <div class="message-actions">
          <button class="btn-icon" data-action="react" data-message-id="${message.id}">😊</button>
          <button class="btn-icon" data-action="reply" data-message-id="${message.id}">↩️</button>
          ${isOwn ? `
            <button class="btn-icon" data-action="delete-message" data-message-id="${message.id}">🗑️</button>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  renderReplyPreview(replyToId) {
    const originalMessage = this.state.messages.find(m => m.id === replyToId);
    if (!originalMessage) return '';
    
    return `
      <div class="reply-preview-inline" data-action="scroll-to" data-message-id="${replyToId}">
        <span class="reply-sender">${originalMessage.senderName}</span>
        <span class="reply-text">${this.truncate(originalMessage.content, 50)}</span>
      </div>
    `;
  }
  
  renderEmptyState() {
    return `
      <div class="empty-state">
        <span class="empty-icon">💬</span>
        <h3>${this.t('selectRoom')}</h3>
        <p>${this.t('selectRoomHint')}</p>
      </div>
    `;
  }
  
  // ============ 事件绑定 ============
  
  bindEvents() {
    // 房间选择
    this.$$('.room-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectRoom(item.dataset.roomId);
      });
    });
    
    // 发送消息
    this.$('[data-action="send-message"]')?.addEventListener('click', () => {
      this.sendCurrentMessage();
    });
    
    // 消息输入
    const messageInput = this.$('.message-input');
    messageInput?.addEventListener('input', (e) => {
      this.messageInput = e.target.value;
      this.autoResizeTextarea(e.target);
      this.sendTypingIndicator();
    });
    
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && this.getSetting('enterToSend')) {
        e.preventDefault();
        this.sendCurrentMessage();
      }
    });
    
    // 表情反应
    this.$$('[data-action="toggle-reaction"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addReaction(btn.dataset.messageId, btn.dataset.emoji);
      });
    });
    
    // 回复
    this.$$('[data-action="reply"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const message = this.state.messages.find(m => m.id === btn.dataset.messageId);
        this.setState({ replyingTo: message });
        this.$('.message-input')?.focus();
      });
    });
    
    // 取消回复
    this.$('[data-action="cancel-reply"]')?.addEventListener('click', () => {
      this.setState({ replyingTo: null });
    });
    
    // 删除消息
    this.$$('[data-action="delete-message"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteMessage(btn.dataset.messageId);
      });
    });
    
    // 附件上传
    this.$('[data-action="attach-file"]')?.addEventListener('click', () => {
      this.selectAndUploadFile('*/*');
    });
    
    this.$('[data-action="attach-image"]')?.addEventListener('click', () => {
      this.selectAndUploadFile('image/*');
    });
    
    // 滚动加载更多
    const container = this.$('#messageContainer');
    container?.addEventListener('scroll', () => {
      this.handleScroll(container);
    });
  }
  
  sendCurrentMessage() {
    const input = this.$('.message-input');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) return;
    
    this.sendMessage(content);
    input.value = '';
    this.messageInput = '';
    this.autoResizeTextarea(input);
  }
  
  handleScroll(container) {
    // 检测是否滚动到顶部（加载更多）
    if (container.scrollTop < 100 && this.state.messages.length > 0) {
      const oldestMessage = this.state.messages[0];
      this.loadMessages(this.state.currentRoom.id, oldestMessage.createdAt);
    }
    
    // 检测是否在底部（用于自动滚动）
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    this.scrollLocked = !isAtBottom;
  }
  
  scrollToBottom() {
    const container = this.$('#messageContainer');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }
  
  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }
  
  async selectAndUploadFile(accept) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await this.uploadAndSendFile(file);
      }
    };
    
    input.click();
  }
  
  async uploadAndSendFile(file) {
    // 创建附件对象
    const attachment = {
      id: this.generateId(),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url: URL.createObjectURL(file)  // 临时 URL
    };
    
    // 如果是图片，获取尺寸
    if (file.type.startsWith('image/')) {
      const dimensions = await this.getImageDimensions(file);
      attachment.width = dimensions.width;
      attachment.height = dimensions.height;
    }
    
    // 发送消息
    await this.sendMessage('', [attachment]);
    
    // TODO: 上传文件到服务器，更新真实 URL
  }
  
  getImageDimensions(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }
  
  // ============ 辅助方法 ============
  
  formatMessageContent(content) {
    if (!content) return '';
    
    // 转义 HTML
    let html = this.escapeHtml(content);
    
    // @提及
    html = html.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    
    // 链接
    html = html.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    
    // 换行
    html = html.replace(/\n/g, '<br>');
    
    return html;
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
  
  getMessageType(attachment) {
    if (attachment.mimeType.startsWith('image/')) return 'image';
    return 'file';
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
  
  formatTime(timestamp) {
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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  generateId() {
    return 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  
  getCurrentUserId() {
    return window.app?.user?.id || 'unknown';
  }
  
  getCurrentUserName() {
    return window.app?.user?.name || 'Unknown';
  }
}

export default ChatPlugin;
```

## 多语言

```json
// plugins/chat/locales/zh.json
{
  "chats": "聊天",
  "searchRooms": "搜索聊天...",
  "members": "成员",
  "search": "搜索",
  "settings": "设置",
  "typeMessage": "输入消息...",
  "send": "发送",
  "noMessages": "暂无消息",
  "isTyping": "正在输入",
  "replyingTo": "回复",
  "attachFile": "附件",
  "attachImage": "图片",
  "emoji": "表情",
  "selectRoom": "选择一个聊天",
  "selectRoomHint": "从左侧列表选择一个聊天开始对话",
  "today": "今天",
  "yesterday": "昨天",
  "justNow": "刚刚",
  "minutesAgo": "分钟前",
  "sendFailed": "发送失败",
  "retry": "重试",
  "confirmDelete": "确定删除这条消息吗？"
}
```

## 相关任务

- `tasks/phase-2/task-003-chat-plugin.md`