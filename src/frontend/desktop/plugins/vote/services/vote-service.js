/**
 * VoteService - Database service for Vote plugin
 * Handles all data operations for votes and responses
 */
class VoteService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  async initSchema() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'single',
        options TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_by_name TEXT,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS vote_responses (
        id TEXT PRIMARY KEY,
        vote_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        selected_options TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vote_responses_vote ON vote_responses(vote_id);
      CREATE INDEX IF NOT EXISTS idx_vote_responses_user ON vote_responses(vote_id, user_id);
    `);
  }

  // ==================== Vote CRUD ====================

  async getVotes(includeExpired = false) {
    const now = Date.now();
    const rows = await this.db.query(
      `SELECT * FROM votes WHERE deleted = 0 ORDER BY created_at DESC`
    );
    const votes = rows.map(r => this.deserializeVote(r));
    if (includeExpired) return votes;
    return votes.filter(v => !v.expires_at || v.expires_at > now);
  }

  async getVote(id) {
    const rows = await this.db.query(
      'SELECT * FROM votes WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeVote(rows[0]) : null;
  }

  async createVote(data) {
    const id = this.generateId('vote');
    const now = Date.now();
    await this.db.exec(
      `INSERT INTO votes (id, title, description, type, options, created_by, created_by_name, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description || '',
        data.type || 'single',
        JSON.stringify(data.options || []),
        data.createdBy || 'anonymous',
        data.createdByName || '',
        data.expiresAt || null,
        now,
        now
      ]
    );
    return this.getVote(id);
  }

  async deleteVote(id) {
    await this.db.exec(
      'UPDATE votes SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Responses ====================

  async submitResponse(voteId, userId, userName, selectedOptions) {
    // Check for existing response
    const existing = await this.getUserResponse(voteId, userId);
    if (existing) {
      // Update existing response
      await this.db.exec(
        'UPDATE vote_responses SET selected_options = ? WHERE id = ?',
        [JSON.stringify(selectedOptions), existing.id]
      );
      return { ...existing, selected_options: JSON.stringify(selectedOptions), selectedOptions };
    }
    // Create new response
    const id = this.generateId('vr');
    const now = Date.now();
    await this.db.exec(
      `INSERT INTO vote_responses (id, vote_id, user_id, user_name, selected_options, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, voteId, userId, userName || '', JSON.stringify(selectedOptions), now]
    );
    return { id, vote_id: voteId, user_id: userId, user_name: userName, selectedOptions, created_at: now };
  }

  async getResponses(voteId) {
    const rows = await this.db.query(
      'SELECT * FROM vote_responses WHERE vote_id = ?',
      [voteId]
    );
    return rows.map(r => ({
      ...r,
      selectedOptions: r.selected_options ? JSON.parse(r.selected_options) : []
    }));
  }

  async getUserResponse(voteId, userId) {
    const rows = await this.db.query(
      'SELECT * FROM vote_responses WHERE vote_id = ? AND user_id = ?',
      [voteId, userId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, selectedOptions: r.selected_options ? JSON.parse(r.selected_options) : [] };
  }

  /**
   * Compute result tallies for a vote
   * Returns array of { index, label, count, percent }
   */
  async getResults(vote) {
    const responses = await this.getResponses(vote.id);
    const counts = new Array(vote.options.length).fill(0);
    for (const resp of responses) {
      for (const idx of resp.selectedOptions) {
        if (idx >= 0 && idx < counts.length) counts[idx]++;
      }
    }
    const total = responses.length;
    return vote.options.map((label, i) => ({
      index: i,
      label,
      count: counts[i],
      percent: total > 0 ? Math.round((counts[i] / total) * 100) : 0
    }));
  }

  // ==================== Helpers ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  deserializeVote(row) {
    return {
      ...row,
      options: row.options ? JSON.parse(row.options) : [],
      isExpired: row.expires_at ? row.expires_at <= Date.now() : false
    };
  }
}

export default VoteService;
