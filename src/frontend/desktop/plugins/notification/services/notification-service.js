/**
 * NotificationService - Database service for Notification plugin
 *
 * Provides a cross-plugin notification store. Other plugins can call
 * push() to inject notifications; the notification plugin reads them.
 */
class NotificationService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  async initSchema() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        source_plugin TEXT NOT NULL,
        source_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        read INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read, created_at DESC);
    `);
  }

  // ==================== Push ====================

  /**
   * Push a new notification.
   * @param {object} data
   * @param {string} data.sourcePlugin - originating plugin id
   * @param {string} [data.sourceId]   - originating record id (optional)
   * @param {string} data.type         - notification type
   * @param {string} data.title        - short title
   * @param {string} [data.body]       - optional longer body
   * @returns {Promise<object>} the created notification
   */
  async push(data) {
    const id = this.generateId('notif');
    const now = Date.now();
    await this.db.exec(
      `INSERT INTO notifications (id, source_plugin, source_id, type, title, body, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.sourcePlugin || 'system',
        data.sourceId || null,
        data.type || 'info',
        data.title || '',
        data.body || null,
        0,
        now
      ]
    );
    return this.getNotification(id);
  }

  // ==================== Read ====================

  async getNotification(id) {
    const rows = await this.db.query(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    );
    return rows[0] ? this.deserialize(rows[0]) : null;
  }

  /**
   * Get notifications ordered newest first.
   * @param {number} [limit=50]
   * @returns {Promise<object[]>}
   */
  async getNotifications(limit = 50) {
    const rows = await this.db.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(r => this.deserialize(r));
  }

  async getUnreadCount() {
    const rows = await this.db.query(
      'SELECT id FROM notifications WHERE read = 0'
    );
    return rows.length;
  }

  // ==================== Mark Read ====================

  async markRead(id) {
    await this.db.exec(
      'UPDATE notifications SET read = 1 WHERE id = ?',
      [id]
    );
  }

  async markAllRead() {
    await this.db.exec(
      'UPDATE notifications SET read = 1 WHERE read = 0',
      []
    );
  }

  // ==================== Delete ====================

  async deleteNotification(id) {
    await this.db.exec(
      'DELETE FROM notifications WHERE id = ?',
      [id]
    );
  }

  async pruneOld(maxCount = 50) {
    const rows = await this.db.query(
      'SELECT id FROM notifications ORDER BY created_at DESC LIMIT -1 OFFSET ?',
      [maxCount]
    );
    for (const row of rows) {
      await this.deleteNotification(row.id);
    }
  }

  // ==================== Helpers ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  deserialize(row) {
    return {
      ...row,
      read: row.read === 1 || row.read === '1' || row.read === true
    };
  }
}

export default NotificationService;
