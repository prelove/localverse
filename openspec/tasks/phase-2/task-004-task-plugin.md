# Task 004: Task 任务插件开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase2-task-004-task-plugin |
| 阶段 | Phase 2 - 服务端与同步 |
| 优先级 | P1 (高) |
| 预估工时 | 12 小时 |
| 依赖 | Phase 2 Task 002 (Sync Engine) |
| 产出 | 任务管理插件 |
| 状态 | ✅ 已完成 |

## 目标

开发 Task 任务管理插件，实现：
1. 项目管理
2. 看板视图（Todo / Doing / Done）
3. 列表视图
4. 任务属性（优先级、截止日期、负责人、标签）
5. 子任务支持
6. 任务过滤与搜索
7. 截止日期提醒

## 实现位置

`src/frontend/desktop/plugins/task/`

## 文件结构

```
plugins/task/
├── manifest.json         # 插件清单
├── index.js             # 主插件类
├── style.css            # 样式
├── locales/
│   ├── zh.json          # 中文
│   ├── en.json          # 英文
│   └── ja.json          # 日文
└── services/
    └── task-service.js  # 数据库服务层
```

## 数据库表结构

```sql
-- 项目表
CREATE TABLE task_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4a90e2',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER DEFAULT 0
);

-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  parent_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'todo',
  priority INTEGER DEFAULT 3,
  tags TEXT DEFAULT '[]',
  assignee TEXT,
  assignee_name TEXT,
  due_date INTEGER,
  reminder_at INTEGER,
  estimated_hours REAL,
  actual_hours REAL,
  completed_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'local',
  deleted INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES task_projects(id),
  FOREIGN KEY (parent_id) REFERENCES tasks(id)
);

-- 索引
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_due ON tasks(due_date);
```

## 主要功能

### 项目管理
- 创建/删除项目
- 项目列表（侧边栏）
- 按项目筛选任务

### 任务 CRUD
- 创建任务（含标题、描述、状态、优先级、截止日期、负责人、标签）
- 编辑任务（模态框）
- 删除任务（软删除）
- 任务详情面板

### 看板视图
- Todo / Doing / Done 三列
- 拖拽改变任务状态
- 快速添加任务按钮
- 超期任务高亮

### 列表视图
- 表格展示
- 内联状态切换
- 排序

### 子任务
- 创建子任务
- 在任务详情中展示
- 子任务完成状态切换

### 过滤与搜索
- 按状态/优先级/标签过滤
- 全文搜索（标题/内容/标签/负责人）

### 提醒
- 到期提醒（Notification API）
- 每分钟检查，避免重复提醒

## 验收标准

- [x] 插件目录结构完整
- [x] manifest.json 配置正确
- [x] 可以创建和管理项目
- [x] 可以创建/编辑/删除任务
- [x] 看板视图正常工作（含拖拽）
- [x] 列表视图正常工作
- [x] 子任务支持正常
- [x] 任务过滤与搜索正常
- [x] 截止日期提醒正常
- [x] 离线优先设计
- [x] 多语言支持（中/英/日）
- [x] 样式完整美观

## 相关文档

- [Task 插件规格](../../specs/plugins/task.md)
- [Phase 2 Task 002: Sync Engine](./task-002-sync-engine.md)

## 更新记录

- 2026-02-28: 完成 Task 插件完整实现（项目管理、看板/列表视图、任务 CRUD、子任务、过滤搜索、到期提醒）
