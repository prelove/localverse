/**
 * ChatService - Database service for Chat plugin
 * Handles all data operations for rooms, messages, and members
 */
class ChatService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Initialize database schema
   */
  async initSchema() {
    await this.db.exec(`
      -- Rooms table
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        avatar TEXT,
        room_type TEXT NOT NULL DEFAULT 'custom',
        created_by TEXT,
        last_message TEXT,
        last_message_at INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_avatar TEXT,
        content TEXT NOT NULL DEFAULT '',
        message_type TEXT NOT NULL DEFAULT 'text',
        attachments TEXT,
        reactions TEXT,
        reply_to TEXT,
        mentions TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
      );

      -- Room members table
      CREATE TABLE IF NOT EXISTS chat_room_members (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        last_read_at INTEGER,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_order ON chat_rooms(sort_order);
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_msg ON chat_rooms(last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_chat_members_room ON chat_room_members(room_id);
      CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_room_members(user_id);
    `);
  }

  // ==================== Room Operations ====================

  async getRooms() {
    const rows = await this.db.query(
      'SELECT * FROM chat_rooms WHERE deleted = 0 ORDER BY is_pinned DESC, last_message_at DESC, sort_order'
    );
    return rows.map(row => this.deserializeRoom(row));
  }

  async getRoom(id) {
    const rows = await this.db.query(
      'SELECT * FROM chat_rooms WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeRoom(rows[0]) : null;
  }

  async createRoom(data) {
    const id = this.generateId('room');
    const now = Date.now();

    await this.db.exec(
      `INSERT INTO chat_rooms (id, name, description, avatar, room_type, created_by, sort_order, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || '',
        data.avatar || null,
        data.roomType || 'custom',
        data.createdBy || null,
        data.sortOrder || 0,
        data.isPinned ? 1 : 0,
        now,
        now
      ]
    );

    return await this.getRoom(id);
  }

  async updateRoom(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(data.avatar);
    }
    if (data.lastMessage !== undefined) {
      updates.push('last_message = ?');
      params.push(data.lastMessage);
    }
    if (data.lastMessageAt !== undefined) {
      updates.push('last_message_at = ?');
      params.push(data.lastMessageAt);
    }
    if (data.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(data.isPinned ? 1 : 0);
    }

    if (updates.length === 0) return await this.getRoom(id);

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await this.db.exec(
      `UPDATE chat_rooms SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getRoom(id);
  }

  async deleteRoom(id) {
    await this.db.exec(
      'UPDATE chat_rooms SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Message Operations ====================

  async getMessages(roomId, options = {}) {
    let sql = 'SELECT * FROM chat_messages WHERE room_id = ? AND deleted = 0';
    const params = [roomId];

    if (options.before) {
      sql += ' AND created_at < ?';
      params.push(options.before);
    }

    if (options.after) {
      sql += ' AND created_at > ?';
      params.push(options.after);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(options.limit || 50);

    const rows = await this.db.query(sql, params);
    // Return in ascending order for display
    return rows.reverse().map(row => this.deserializeMessage(row));
  }

  async getMessage(id) {
    const rows = await this.db.query(
      'SELECT * FROM chat_messages WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeMessage(rows[0]) : null;
  }

  async createMessage(data) {
    const id = data.id || this.generateId('msg');
    const now = data.createdAt || Date.now();

    await this.db.exec(
      `INSERT INTO chat_messages
         (id, room_id, sender_id, sender_name, sender_avatar, content, message_type,
          attachments, reactions, reply_to, mentions, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.roomId,
        data.senderId,
        data.senderName,
        data.senderAvatar || null,
        data.content || '',
        data.messageType || 'text',
        JSON.stringify(data.attachments || []),
        JSON.stringify(data.reactions || []),
        data.replyTo || null,
        JSON.stringify(data.mentions || []),
        data.status || 'sent',
        now,
        now
      ]
    );

    // Update room's last message
    await this.updateRoom(data.roomId, {
      lastMessage: data.content || (data.attachments?.length ? '[attachment]' : ''),
      lastMessageAt: now
    });

    return await this.getMessage(id);
  }

  async updateMessage(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];

    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.reactions !== undefined) {
      updates.push('reactions = ?');
      params.push(JSON.stringify(data.reactions));
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) return await this.getMessage(id);

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await this.db.exec(
      `UPDATE chat_messages SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getMessage(id);
  }

  async deleteMessage(id) {
    await this.db.exec(
      'UPDATE chat_messages SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  async getUnreadCount(roomId, lastReadAt) {
    if (!lastReadAt) return 0;
    const rows = await this.db.query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE room_id = ? AND created_at > ? AND deleted = 0',
      [roomId, lastReadAt]
    );
    return rows[0]?.count || 0;
  }

  // ==================== Member Operations ====================

  async getRoomMembers(roomId) {
    const rows = await this.db.query(
      'SELECT * FROM chat_room_members WHERE room_id = ? ORDER BY joined_at',
      [roomId]
    );
    return rows;
  }

  async addRoomMember(data) {
    const id = this.generateId('mbr');
    const now = Date.now();

    // Check if already member
    const existing = await this.db.query(
      'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?',
      [data.roomId, data.userId]
    );

    if (existing.length > 0) return;

    await this.db.exec(
      `INSERT INTO chat_room_members (id, room_id, user_id, user_name, role, joined_at, last_read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.roomId, data.userId, data.userName, data.role || 'member', now, now]
    );
  }

  async removeRoomMember(roomId, userId) {
    await this.db.exec(
      'DELETE FROM chat_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
  }

  async updateLastRead(roomId, userId, timestamp) {
    await this.db.exec(
      'UPDATE chat_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?',
      [timestamp || Date.now(), roomId, userId]
    );
  }

  async getMember(roomId, userId) {
    const rows = await this.db.query(
      'SELECT * FROM chat_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    return rows[0] || null;
  }

  // ==================== Helper Methods ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  deserializeRoom(row) {
    return {
      ...row,
      isPinned: row.is_pinned === 1,
      roomType: row.room_type,
      lastMessage: row.last_message || '',
      lastMessageAt: row.last_message_at || null,
      createdBy: row.created_by,
      members: []
    };
  }

  deserializeMessage(row) {
    return {
      ...row,
      roomId: row.room_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderAvatar: row.sender_avatar,
      messageType: row.message_type,
      replyTo: row.reply_to || null,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      reactions: row.reactions ? JSON.parse(row.reactions) : [],
      mentions: row.mentions ? JSON.parse(row.mentions) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default ChatService;
