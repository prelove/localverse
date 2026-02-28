/**
 * AnnouncementService - Database service for Announcement plugin
 */
class AnnouncementService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  async initSchema() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        is_pinned INTEGER DEFAULT 0,
        author_id TEXT NOT NULL,
        author_name TEXT,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS announcement_reads (
        id TEXT PRIMARY KEY,
        announcement_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        read_at INTEGER NOT NULL,
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ann_created ON announcements(is_pinned DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ann_reads ON announcement_reads(announcement_id, user_id);
    `);
  }

  // ==================== Announcement CRUD ====================

  async getAnnouncements(userId, includeExpired = false) {
    const now = Date.now();
    const rows = await this.db.query(
      `SELECT * FROM announcements WHERE deleted = 0 ORDER BY is_pinned DESC, created_at DESC`
    );
    let items = rows.map(r => this.deserialize(r));
    if (!includeExpired) {
      items = items.filter(a => !a.expires_at || a.expires_at > now);
    }
    // Attach read status per user
    if (userId) {
      for (const item of items) {
        const reads = await this.db.query(
          'SELECT * FROM announcement_reads WHERE announcement_id = ? AND user_id = ?',
          [item.id, userId]
        );
        item.isRead = reads.length > 0;
      }
    }
    return items;
  }

  async getAnnouncement(id) {
    const rows = await this.db.query(
      'SELECT * FROM announcements WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  async createAnnouncement(data) {
    const id = this.generateId('ann');
    const now = Date.now();
    await this.db.exec(
      `INSERT INTO announcements (id, title, content, priority, is_pinned, author_id, author_name, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.content || '',
        data.priority || 'normal',
        data.isPinned ? 1 : 0,
        data.authorId || 'local_user',
        data.authorName || '',
        data.expiresAt || null,
        now,
        now
      ]
    );
    return this.getAnnouncement(id);
  }

  async updateAnnouncement(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];

    if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title); }
    if (data.content !== undefined) { updates.push('content = ?'); params.push(data.content); }
    if (data.priority !== undefined) { updates.push('priority = ?'); params.push(data.priority); }
    if (data.isPinned !== undefined) { updates.push('is_pinned = ?'); params.push(data.isPinned ? 1 : 0); }
    if (data.expiresAt !== undefined) { updates.push('expires_at = ?'); params.push(data.expiresAt); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await this.db.exec(
      `UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return this.getAnnouncement(id);
  }

  async deleteAnnouncement(id) {
    await this.db.exec(
      'UPDATE announcements SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Read Tracking ====================

  async markRead(announcementId, userId) {
    const existing = await this.db.query(
      'SELECT * FROM announcement_reads WHERE announcement_id = ? AND user_id = ?',
      [announcementId, userId]
    );
    if (existing.length > 0) return; // Already marked read
    const id = this.generateId('ar');
    await this.db.exec(
      'INSERT INTO announcement_reads (id, announcement_id, user_id, read_at) VALUES (?, ?, ?, ?)',
      [id, announcementId, userId, Date.now()]
    );
  }

  async getUnreadCount(userId) {
    const announcements = await this.getAnnouncements(userId);
    return announcements.filter(a => !a.isRead).length;
  }

  // ==================== Helpers ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  deserialize(row) {
    return {
      ...row,
      isPinned: row.is_pinned === 1 || row.is_pinned === '1',
      isExpired: row.expires_at ? row.expires_at <= Date.now() : false,
      isRead: false
    };
  }
}

export default AnnouncementService;
