/**
 * 数据库迁移管理器
 * 所有的迁移按版本号顺序执行
 */

export const migrations = [
  {
    version: 1,
    name: 'initial',
    sql: `
      -- 系统配置表
      CREATE TABLE system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- 模块表
      CREATE TABLE modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        deleted_by TEXT
      );
      
      -- 列表表
      CREATE TABLE columns (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (module_id) REFERENCES modules(id)
      );
      
      -- 卡片表
      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'markdown',
        tags TEXT,
        attachments TEXT,
        metadata TEXT,
        sort_order INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (column_id) REFERENCES columns(id)
      );
      
      -- 卡片全文搜索
      CREATE VIRTUAL TABLE cards_fts USING fts5(
        title, content, tags,
        content='cards',
        content_rowid='rowid',
        tokenize='unicode61'
      );
      
      -- 卡片链接表
      CREATE TABLE card_links (
        id TEXT PRIMARY KEY,
        source_card_id TEXT NOT NULL,
        target_card_id TEXT NOT NULL,
        link_type TEXT DEFAULT 'reference',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_card_id) REFERENCES cards(id),
        FOREIGN KEY (target_card_id) REFERENCES cards(id)
      );
      
      -- 文件表
      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT,
        size INTEGER NOT NULL,
        mime_type TEXT,
        hash TEXT,
        parent_id TEXT,
        parent_type TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );
      
      -- 同步队列表
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        priority INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        last_attempt INTEGER,
        next_attempt INTEGER,
        error_message TEXT
      );
      
      -- 版本历史表
      CREATE TABLE version_history (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        change_type TEXT NOT NULL,
        changed_by TEXT,
        created_at INTEGER NOT NULL
      );
      
      -- 索引
      CREATE INDEX idx_modules_sort ON modules(sort_order);
      CREATE INDEX idx_columns_module ON columns(module_id);
      CREATE INDEX idx_cards_column ON cards(column_id);
      CREATE INDEX idx_cards_sync ON cards(sync_status);
      CREATE INDEX idx_files_parent ON files(parent_id, parent_type);
      CREATE INDEX idx_sync_queue_status ON sync_queue(status, next_attempt);
      CREATE INDEX idx_version_history_entity ON version_history(entity_type, entity_id);
    `
  },
  {
    version: 2,
    name: 'add_tasks',
    sql: `
      -- 任务项目表
      CREATE TABLE task_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        members TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      );
      
      -- 任务表
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'todo',
        priority INTEGER DEFAULT 3,
        tags TEXT,
        assignee TEXT,
        assignee_name TEXT,
        due_date INTEGER,
        reminder_at INTEGER,
        project_id TEXT,
        parent_id TEXT,
        estimated_hours REAL,
        actual_hours REAL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES task_projects(id),
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );
      
      -- 任务全文搜索
      CREATE VIRTUAL TABLE tasks_fts USING fts5(
        title, content, tags,
        content='tasks',
        content_rowid='rowid',
        tokenize='unicode61'
      );
      
      -- 索引
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_assignee ON tasks(assignee);
      CREATE INDEX idx_tasks_due ON tasks(due_date);
      CREATE INDEX idx_tasks_project ON tasks(project_id);
    `
  },
  {
    version: 3,
    name: 'add_chat',
    sql: `
      -- 聊天室表
      CREATE TABLE chat_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        room_type TEXT DEFAULT 'group',
        description TEXT,
        avatar TEXT,
        members TEXT,
        admins TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message_at INTEGER,
        last_message TEXT,
        last_read_at INTEGER DEFAULT 0,
        muted INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0
      );
      
      -- 聊天消息表
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        sender_avatar TEXT,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        attachments TEXT,
        reply_to TEXT,
        mentions TEXT,
        reactions TEXT,
        created_at INTEGER NOT NULL,
        edited_at INTEGER,
        status TEXT DEFAULT 'sent',
        deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
      );
      
      -- 索引
      CREATE INDEX idx_chat_rooms_type ON chat_rooms(room_type);
      CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
      CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
    `
  },
  {
    version: 4,
    name: 'add_search_history',
    sql: `
      -- 搜索历史表
      CREATE TABLE search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        search_type TEXT DEFAULT 'global',
        result_count INTEGER,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX idx_search_history_time ON search_history(created_at DESC);
    `
  },
  {
    version: 5,
    name: 'add_plugin_installs',
    sql: `
      -- Plugin installation records table
    name: 'add_plugin_system',
    sql: `
      -- 插件安装记录表
      CREATE TABLE plugin_installs (
        plugin_id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        installed_at INTEGER NOT NULL,
        updated_at INTEGER
      );
      
      -- 插件配置表（可选，供未来扩展）
      CREATE TABLE plugin_config (
        plugin_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (plugin_id, key)
      );
      
      CREATE INDEX idx_plugin_installs_time ON plugin_installs(installed_at);
    `
  }
];
