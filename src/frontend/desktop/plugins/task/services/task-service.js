/**
 * TaskService - Database service for Task plugin
 * Handles all data operations for projects and tasks
 */
class TaskService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Initialize database schema
   */
  async initSchema() {
    await this.db.exec(`
      -- Projects table
      CREATE TABLE IF NOT EXISTS task_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT '#3b82f6',
        members TEXT DEFAULT '[]',
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        priority INTEGER NOT NULL DEFAULT 3,
        tags TEXT DEFAULT '[]',
        assignee TEXT,
        assignee_name TEXT,
        due_date INTEGER,
        reminder_at INTEGER,
        project_id TEXT,
        parent_id TEXT,
        estimated_hours REAL,
        actual_hours REAL,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES task_projects(id),
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted);
      CREATE INDEX IF NOT EXISTS idx_task_projects_created ON task_projects(created_at);
    `);
  }

  // ==================== Project Operations ====================

  async getProjects() {
    const rows = await this.db.query(
      'SELECT * FROM task_projects WHERE deleted = 0 ORDER BY created_at'
    );
    return rows.map(r => this.deserializeProject(r));
  }

  async getProject(id) {
    const rows = await this.db.query(
      'SELECT * FROM task_projects WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeProject(rows[0]) : null;
  }

  async createProject(data) {
    const id = this.generateId('proj');
    const now = Date.now();

    await this.db.exec(
      `INSERT INTO task_projects (id, name, description, color, members, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || '',
        data.color || '#3b82f6',
        JSON.stringify(data.members || []),
        data.createdBy || null,
        now,
        now
      ]
    );

    return await this.getProject(id);
  }

  async updateProject(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
    if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color); }
    if (data.members !== undefined) { updates.push('members = ?'); params.push(JSON.stringify(data.members)); }

    updates.push('updated_at = ?');
    params.push(now, id);

    await this.db.exec(
      `UPDATE task_projects SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getProject(id);
  }

  async deleteProject(id) {
    await this.db.exec(
      'UPDATE task_projects SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Task Operations ====================

  async getTasks(filters = {}) {
    let sql = 'SELECT * FROM tasks WHERE deleted = 0';
    const params = [];

    if (filters.projectId) {
      sql += ' AND project_id = ?';
      params.push(filters.projectId);
    }

    if (filters.status && filters.status.length > 0) {
      sql += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    }

    if (filters.priority && filters.priority.length > 0) {
      sql += ` AND priority IN (${filters.priority.map(() => '?').join(',')})`;
      params.push(...filters.priority);
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        sql += ' AND parent_id IS NULL';
      } else {
        sql += ' AND parent_id = ?';
        params.push(filters.parentId);
      }
    }

    sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';

    const rows = await this.db.query(sql, params);
    return rows.map(r => this.deserializeTask(r));
  }

  async getTask(id) {
    const rows = await this.db.query(
      'SELECT * FROM tasks WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeTask(rows[0]) : null;
  }

  async getSubtasks(parentId) {
    const rows = await this.db.query(
      'SELECT * FROM tasks WHERE parent_id = ? AND deleted = 0 ORDER BY created_at',
      [parentId]
    );
    return rows.map(r => this.deserializeTask(r));
  }

  async createTask(data) {
    const id = this.generateId('task');
    const now = Date.now();
    const completedAt = data.status === 'done' ? now : null;

    await this.db.exec(
      `INSERT INTO tasks
        (id, title, content, status, priority, tags, assignee, assignee_name, due_date, reminder_at,
         project_id, parent_id, estimated_hours, actual_hours, created_by, created_at, updated_at,
         completed_at, version, sync_status, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', 0)`,
      [
        id,
        data.title,
        data.content || '',
        data.status || 'todo',
        data.priority || 3,
        JSON.stringify(data.tags || []),
        data.assignee || null,
        data.assignee_name || null,
        data.due_date || null,
        data.reminder_at || null,
        data.project_id || null,
        data.parent_id || null,
        data.estimated_hours || null,
        data.actual_hours || null,
        data.created_by || null,
        now,
        now,
        completedAt
      ]
    );

    return await this.getTask(id);
  }

  async updateTask(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];

    if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title); }
    if (data.content !== undefined) { updates.push('content = ?'); params.push(data.content); }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      if (data.status === 'done') {
        updates.push('completed_at = ?');
        params.push(data.completed_at || now);
      } else {
        updates.push('completed_at = ?');
        params.push(null);
      }
    }
    if (data.priority !== undefined) { updates.push('priority = ?'); params.push(data.priority); }
    if (data.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(data.tags)); }
    if (data.assignee !== undefined) { updates.push('assignee = ?'); params.push(data.assignee); }
    if (data.assignee_name !== undefined) { updates.push('assignee_name = ?'); params.push(data.assignee_name); }
    if (data.due_date !== undefined) { updates.push('due_date = ?'); params.push(data.due_date); }
    if (data.reminder_at !== undefined) { updates.push('reminder_at = ?'); params.push(data.reminder_at); }
    if (data.project_id !== undefined) { updates.push('project_id = ?'); params.push(data.project_id); }
    if (data.parent_id !== undefined) { updates.push('parent_id = ?'); params.push(data.parent_id); }
    if (data.estimated_hours !== undefined) { updates.push('estimated_hours = ?'); params.push(data.estimated_hours); }
    if (data.actual_hours !== undefined) { updates.push('actual_hours = ?'); params.push(data.actual_hours); }

    updates.push('updated_at = ?', 'version = version + 1', "sync_status = 'modified'");
    params.push(now, id);

    await this.db.exec(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getTask(id);
  }

  async deleteTask(id) {
    await this.db.exec(
      'UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  // ==================== Helper Methods ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  deserializeTask(row) {
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      deleted: row.deleted === 1
    };
  }

  deserializeProject(row) {
    return {
      ...row,
      members: row.members ? JSON.parse(row.members) : [],
      deleted: row.deleted === 1
    };
  }
}

export default TaskService;
