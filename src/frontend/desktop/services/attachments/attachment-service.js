/**
 * AttachmentService - File/image attachment storage for plugins
 *
 * Supports two storage strategies:
 *  - "jar"  : Uploads via Local JAR HTTP API (full/jar mode)
 *  - "idb"  : Stores base64 in IndexedDB via DatabaseService (light/pure mode, ≤2 MB)
 */

const MAX_IDB_SIZE = 2 * 1024 * 1024; // 2 MB

class AttachmentService {
  /**
   * @param {object} databaseService - DatabaseService instance
   * @param {object} [options]
   * @param {string} [options.mode='idb']   - 'jar' | 'idb'
   * @param {string} [options.jarBaseUrl='http://localhost:8765'] - JAR HTTP base URL
   * @param {number} [options.maxSize=10485760] - max file size in bytes (default 10 MB)
   */
  constructor(databaseService, options = {}) {
    this.db = databaseService;
    this.mode = options.mode || 'idb';
    this.jarBaseUrl = options.jarBaseUrl || 'http://localhost:8765';
    this.maxSize = options.maxSize || 10 * 1024 * 1024;
  }

  // ==================== Schema ====================

  async initSchema() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER,
        storage_path TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_att_ref ON attachments(plugin_id, ref_id);
    `);
  }

  // ==================== Upload ====================

  /**
   * Upload a file and associate it with a plugin record.
   * @param {File|{name:string, type:string, size:number, arrayBuffer:Function}} file
   * @param {string} pluginId  - source plugin (e.g. 'chat', 'wiki')
   * @param {string} refId     - source record ID
   * @returns {Promise<object>} attachment record
   */
  async upload(file, pluginId, refId) {
    if (file.size > this.maxSize) {
      throw new Error(`File too large: ${file.size} bytes (max ${this.maxSize})`);
    }

    const id = this._generateId('att');
    let storagePath;

    if (this.mode === 'jar') {
      storagePath = await this._uploadToJar(file, id);
    } else {
      storagePath = await this._storeAsBase64(file, id);
    }

    const now = Date.now();
    await this.db.exec(
      `INSERT INTO attachments (id, plugin_id, ref_id, filename, mime_type, size, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pluginId, refId, file.name, file.type || null, file.size, storagePath, now]
    );

    return this._getById(id);
  }

  async _uploadToJar(file, id) {
    const buffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop() || 'bin';
    const path = `/attachments/${id}.${ext}`;

    const resp = await fetch(`${this.jarBaseUrl}/api/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Path': path },
      body: buffer
    });

    if (!resp.ok) throw new Error(`JAR upload failed: ${resp.status}`);
    return path;
  }

  async _storeAsBase64(file, id) {
    if (file.size > MAX_IDB_SIZE) {
      throw new Error(`File too large for IDB mode: ${file.size} bytes (max ${MAX_IDB_SIZE})`);
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
    return `data:${file.type || 'application/octet-stream'};base64,${b64}`;
  }

  // ==================== Read ====================

  /**
   * Get all attachments for a plugin record.
   * @param {string} pluginId
   * @param {string} refId
   * @returns {Promise<object[]>}
   */
  async getAttachments(pluginId, refId) {
    const rows = await this.db.query(
      'SELECT * FROM attachments WHERE plugin_id = ? AND ref_id = ? ORDER BY created_at ASC',
      [pluginId, refId]
    );
    return rows;
  }

  /**
   * Get the URL to access an attachment.
   * For IDB mode, the storage_path IS the data URL.
   * For JAR mode, prepend the JAR base URL.
   * @param {string} id
   * @returns {Promise<string|null>}
   */
  async getUrl(id) {
    const att = await this._getById(id);
    if (!att) return null;
    if (att.storage_path.startsWith('data:')) return att.storage_path;
    return `${this.jarBaseUrl}${att.storage_path}`;
  }

  // ==================== Delete ====================

  /**
   * Delete an attachment record (and file in JAR mode).
   * @param {string} id
   */
  async deleteAttachment(id) {
    if (this.mode === 'jar') {
      const att = await this._getById(id);
      if (att && !att.storage_path.startsWith('data:')) {
        try {
          await fetch(`${this.jarBaseUrl}/api/files/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: att.storage_path })
          });
        } catch { /* best-effort */ }
      }
    }
    await this.db.exec('DELETE FROM attachments WHERE id = ?', [id]);
  }

  // ==================== Helpers ====================

  async _getById(id) {
    const rows = await this.db.query('SELECT * FROM attachments WHERE id = ?', [id]);
    return rows[0] || null;
  }

  _generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export default AttachmentService;
