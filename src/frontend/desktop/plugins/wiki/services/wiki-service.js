/**
 * WikiService - Database service for Wiki plugin
 * Handles all data operations for modules, columns, cards, and links
 */
class WikiService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Initialize database schema
   */
  async initSchema() {
    await this.db.exec(`
      -- Modules table
      CREATE TABLE IF NOT EXISTS wiki_modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );
      
      -- Columns table
      CREATE TABLE IF NOT EXISTS wiki_columns (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (module_id) REFERENCES wiki_modules(id) ON DELETE CASCADE
      );
      
      -- Cards table
      CREATE TABLE IF NOT EXISTS wiki_cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'markdown',
        tags TEXT,
        attachments TEXT,
        metadata TEXT,
        sort_order INTEGER NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (column_id) REFERENCES wiki_columns(id) ON DELETE CASCADE
      );
      
      -- Card links table (bidirectional links)
      CREATE TABLE IF NOT EXISTS wiki_card_links (
        id TEXT PRIMARY KEY,
        source_card_id TEXT NOT NULL,
        target_card_id TEXT NOT NULL,
        link_type TEXT DEFAULT 'reference',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (target_card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE
      );
      
      -- Card history table
      CREATE TABLE IF NOT EXISTS wiki_card_history (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT,
        FOREIGN KEY (card_id) REFERENCES wiki_cards(id) ON DELETE CASCADE
      );
      
      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_wiki_modules_order ON wiki_modules(sort_order);
      CREATE INDEX IF NOT EXISTS idx_wiki_columns_module ON wiki_columns(module_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_wiki_cards_column ON wiki_cards(column_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_wiki_cards_tags ON wiki_cards(tags);
      CREATE INDEX IF NOT EXISTS idx_wiki_card_links_source ON wiki_card_links(source_card_id);
      CREATE INDEX IF NOT EXISTS idx_wiki_card_links_target ON wiki_card_links(target_card_id);
      
      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
        title,
        content,
        tags,
        content='wiki_cards',
        content_rowid='rowid',
        tokenize='unicode61'
      );
    `);
  }

  // ==================== Module Operations ====================

  async getModules() {
    const rows = await this.db.query(
      'SELECT * FROM wiki_modules WHERE deleted = 0 ORDER BY sort_order'
    );
    return rows;
  }

  async getModule(id) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_modules WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] || null;
  }

  async createModule(data) {
    const id = this.generateId('mod');
    const now = Date.now();
    const maxOrder = await this.getMaxSortOrder('wiki_modules');
    
    await this.db.exec(
      `INSERT INTO wiki_modules (id, name, description, icon, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || '',
        data.icon || '📚',
        data.color || '#3b82f6',
        maxOrder + 1,
        now,
        now
      ]
    );
    
    return await this.getModule(id);
  }

  async updateModule(id, data) {
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
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      params.push(data.icon);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);
    
    await this.db.exec(
      `UPDATE wiki_modules SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return await this.getModule(id);
  }

  async deleteModule(id) {
    await this.db.exec(
      'UPDATE wiki_modules SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Column Operations ====================

  async getColumns(moduleId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_columns WHERE module_id = ? AND deleted = 0 ORDER BY sort_order',
      [moduleId]
    );
    return rows;
  }

  async getColumn(id) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_columns WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] || null;
  }

  async createColumn(data) {
    const id = this.generateId('col');
    const now = Date.now();
    const maxOrder = await this.getMaxSortOrder('wiki_columns', 'module_id', data.moduleId);
    
    await this.db.exec(
      `INSERT INTO wiki_columns (id, module_id, name, description, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.moduleId,
        data.name,
        data.description || '',
        data.color || '#6b7280',
        maxOrder + 1,
        now,
        now
      ]
    );
    
    return await this.getColumn(id);
  }

  async updateColumn(id, data) {
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
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);
    
    await this.db.exec(
      `UPDATE wiki_columns SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return await this.getColumn(id);
  }

  async deleteColumn(id) {
    await this.db.exec(
      'UPDATE wiki_columns SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Card Operations ====================

  async getCards(columnId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_cards WHERE column_id = ? AND deleted = 0 ORDER BY is_pinned DESC, sort_order',
      [columnId]
    );
    return rows.map(row => this.deserializeCard(row));
  }

  async getAllCards(moduleId) {
    const rows = await this.db.query(
      `SELECT c.* FROM wiki_cards c
       INNER JOIN wiki_columns col ON c.column_id = col.id
       WHERE col.module_id = ? AND c.deleted = 0
       ORDER BY c.is_pinned DESC, c.sort_order`,
      [moduleId]
    );
    return rows.map(row => this.deserializeCard(row));
  }

  async getCard(id) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_cards WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeCard(rows[0]) : null;
  }

  async createCard(data) {
    const id = this.generateId('card');
    const now = Date.now();
    const maxOrder = await this.getMaxSortOrder('wiki_cards', 'column_id', data.columnId);
    
    await this.db.exec(
      `INSERT INTO wiki_cards (id, column_id, title, content, content_type, tags, attachments, metadata, sort_order, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.columnId,
        data.title,
        data.content || '',
        data.contentType || 'markdown',
        JSON.stringify(data.tags || []),
        JSON.stringify(data.attachments || []),
        JSON.stringify(data.metadata || {}),
        maxOrder + 1,
        data.isPinned ? 1 : 0,
        now,
        now
      ]
    );
    
    // Save to version history
    await this.saveVersion(id, data.title, data.content || '', 1, data.createdBy);
    
    return await this.getCard(id);
  }

  async updateCard(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];
    
    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.attachments !== undefined) {
      updates.push('attachments = ?');
      params.push(JSON.stringify(data.attachments));
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }
    if (data.columnId !== undefined) {
      updates.push('column_id = ?');
      params.push(data.columnId);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    if (data.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(data.isPinned ? 1 : 0);
    }
    
    updates.push('updated_at = ?', 'version = version + 1');
    params.push(now);
    params.push(id);
    
    await this.db.exec(
      `UPDATE wiki_cards SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Save version if content changed
    if (data.title !== undefined || data.content !== undefined) {
      const card = await this.getCard(id);
      await this.saveVersion(id, card.title, card.content, card.version, data.updatedBy);
    }
    
    return await this.getCard(id);
  }

  async deleteCard(id) {
    await this.db.exec(
      'UPDATE wiki_cards SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  async moveCard(cardId, toColumnId, newOrder) {
    await this.updateCard(cardId, {
      columnId: toColumnId,
      sortOrder: newOrder !== undefined ? newOrder : 0
    });
  }

  // ==================== Search ====================

  async search(query, filters = {}) {
    if (!query || query.trim() === '') {
      return [];
    }

    let sql = `
      SELECT c.* FROM wiki_cards c
      INNER JOIN wiki_fts f ON c.rowid = f.rowid
      WHERE f MATCH ? AND c.deleted = 0
    `;
    
    const params = [query];
    
    if (filters.columnId) {
      sql += ' AND c.column_id = ?';
      params.push(filters.columnId);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      sql += ' AND c.tags LIKE ?';
      params.push(`%${filters.tags[0]}%`);
    }
    
    sql += ' ORDER BY rank LIMIT ?';
    params.push(filters.limit || 50);
    
    const rows = await this.db.query(sql, params);
    return rows.map(row => this.deserializeCard(row));
  }

  // ==================== Links ====================

  async createLink(sourceCardId, targetCardId, linkType = 'reference') {
    const id = this.generateId('link');
    await this.db.exec(
      'INSERT INTO wiki_card_links (id, source_card_id, target_card_id, link_type, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, sourceCardId, targetCardId, linkType, Date.now()]
    );
  }

  async deleteLink(sourceCardId, targetCardId) {
    await this.db.exec(
      'DELETE FROM wiki_card_links WHERE source_card_id = ? AND target_card_id = ?',
      [sourceCardId, targetCardId]
    );
  }

  async getLinks(cardId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_card_links WHERE source_card_id = ? OR target_card_id = ?',
      [cardId, cardId]
    );
    return rows;
  }

  async getBacklinks(cardId) {
    const rows = await this.db.query(
      `SELECT c.* FROM wiki_cards c
       INNER JOIN wiki_card_links l ON c.id = l.source_card_id
       WHERE l.target_card_id = ? AND c.deleted = 0`,
      [cardId]
    );
    return rows.map(row => this.deserializeCard(row));
  }

  // ==================== Version History ====================

  async saveVersion(cardId, title, content, version, createdBy) {
    const id = this.generateId('ver');
    await this.db.exec(
      'INSERT INTO wiki_card_history (id, card_id, title, content, version, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, cardId, title, content, version, Date.now(), createdBy || null]
    );
  }

  async getVersions(cardId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_card_history WHERE card_id = ? ORDER BY version DESC',
      [cardId]
    );
    return rows;
  }

  async getVersion(versionId) {
    const rows = await this.db.query(
      'SELECT * FROM wiki_card_history WHERE id = ?',
      [versionId]
    );
    return rows[0] || null;
  }

  // ==================== Helper Methods ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getMaxSortOrder(table, filterColumn, filterValue) {
    let sql = `SELECT COALESCE(MAX(sort_order), 0) as max_order FROM ${table} WHERE deleted = 0`;
    const params = [];
    
    if (filterColumn && filterValue !== undefined) {
      sql += ` AND ${filterColumn} = ?`;
      params.push(filterValue);
    }
    
    const rows = await this.db.query(sql, params);
    return rows[0]?.max_order || 0;
  }

  deserializeCard(row) {
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      isPinned: row.is_pinned === 1
    };
  }
}

export default WikiService;
