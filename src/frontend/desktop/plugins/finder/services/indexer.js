/**
 * Finder Indexer Service
 * Handles file indexing and local search.
 */

import { buildFtsQuery } from '../utils/formatters.js';

export class FinderIndexer {
  constructor({ db, fs, settings }) {
    this.db = db;
    this.fs = fs;
    this.settings = settings || {};
  }

  async ensureSchema() {
    if (!this.db) return;

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS finder_index (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        extension TEXT,
        size INTEGER,
        mime_type TEXT,
        content_hash TEXT,
        content_indexed INTEGER DEFAULT 0,
        created_at INTEGER,
        modified_at INTEGER,
        indexed_at INTEGER NOT NULL
      )
    `);

    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_name ON finder_index(name)`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_ext ON finder_index(extension)`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_finder_path ON finder_index(path)`);

    await this.db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS finder_fts USING fts5(
        name,
        path,
        content,
        content='finder_index',
        content_rowid='rowid',
        tokenize='unicode61'
      )
    `);
  }

  async clearSchema() {
    if (!this.db) return;
    await this.db.execute('DROP TABLE IF EXISTS finder_fts');
    await this.db.execute('DROP TABLE IF EXISTS finder_index');
  }

  async buildIndex(paths = []) {
    if (!this.fs || !this.fs.listDir) return;

    for (const path of paths) {
      await this.indexDirectory(path);
    }
  }

  async indexDirectory(dirPath) {
    if (!this.fs || !this.fs.listDir) return;

    const files = await this.fs.listDir(dirPath, {
      recursive: true,
      includeHidden: this.settings.includeHidden || false
    });

    for (const file of files) {
      await this.indexFile(file);
    }
  }

  async indexFile(file) {
    if (!this.db) return;

    const shouldIndexContent = Boolean(
      this.settings.enableContentSearch &&
      this.settings.indexExtensions?.includes?.(file.extension)
    );

    let content = null;
    if (shouldIndexContent && this.fs?.readFile) {
      try {
        content = await this.fs.readFile(file.path, 'text');
      } catch {
        content = null;
      }
    }

    await this.db.execute(`
      INSERT OR REPLACE INTO finder_index
      (id, path, name, extension, size, mime_type, content_hash, content_indexed, created_at, modified_at, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      file.id || file.path,
      file.path,
      file.name,
      file.extension,
      file.size,
      file.mimeType,
      file.contentHash || null,
      content ? 1 : 0,
      file.createdAt || Date.now(),
      file.modifiedAt || Date.now(),
      Date.now()
    ]);

    if (content) {
      await this.db.execute(`
        INSERT INTO finder_fts(rowid, name, path, content)
        VALUES (last_insert_rowid(), ?, ?, ?)
      `, [file.name, file.path, content]);
    }
  }

  async searchIndex(query, maxResults = 100) {
    if (!this.db) return [];

    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    const results = await this.db.query(`
      SELECT
        f.id,
        f.path,
        f.name,
        f.extension,
        f.size,
        f.mime_type,
        f.modified_at,
        bm25(finder_fts) as score
      FROM finder_index f
      JOIN finder_fts ON f.rowid = finder_fts.rowid
      WHERE finder_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `, [ftsQuery, maxResults]);

    return results.map(r => ({
      id: r.id,
      path: r.path,
      name: r.name,
      extension: r.extension,
      size: r.size,
      mimeType: r.mime_type,
      modifiedAt: r.modified_at,
      score: r.score
    }));
  }
}
