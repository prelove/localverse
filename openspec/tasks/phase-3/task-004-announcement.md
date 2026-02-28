# Task 004: Announcement 公告系统开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase3-task-004-announcement |
| 阶段 | Phase 3 - 扩展功能 |
| 优先级 | P2 (中) |
| 预估工时 | 8 小时 |
| 依赖 | Phase 0 全部, Phase 1 Task 001 (Frontend Core) |
| 产出 | 公告系统 |
| 状态 | 待开发 |

## 目标

开发公告系统插件，支持团队通知广播：
1. 发布公告（带富文本内容）
2. 公告置顶和优先级
3. 已读/未读状态追踪
4. 公告分类（普通/重要/紧急）
5. 支持同步至其他设备

## 详细需求

### 1. 用户界面

```
┌──────────────────────────────────────────────┐
│ 📢 公告                              + 发布   │
├──────────────────────────────────────────────┤
│ 🔴 [紧急] 系统维护通知               未读     │
│    明天 10:00-12:00 系统将进行维护...          │
│    管理员  ·  2026-02-28  ·  3小时前          │
├──────────────────────────────────────────────┤
│ 🟡 [重要] 季度总结会议通知                     │
│    请各部门准备Q1工作总结...                   │
│    HR部门  ·  2026-02-27                      │
├──────────────────────────────────────────────┤
│ ⚪ 新员工入职欢迎                    已读      │
│    欢迎新同事加入团队...                       │
└──────────────────────────────────────────────┘
```

### 2. 数据库设计

```sql
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- normal | important | urgent
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

CREATE TABLE announcement_reads (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);
```

### 3. 核心功能

#### AnnouncementService
- `createAnnouncement(data)` - 发布公告
- `getAnnouncements(userId)` - 获取公告列表（带已读状态）
- `getAnnouncement(id)` - 获取单条公告
- `updateAnnouncement(id, data)` - 更新公告
- `deleteAnnouncement(id)` - 软删除公告
- `markRead(announcementId, userId)` - 标记已读
- `getUnreadCount(userId)` - 获取未读数量

## 实现步骤

### Step 1: 目录结构 (30min)

```
src/frontend/desktop/plugins/announcement/
├── manifest.json
├── index.js
├── style.css
├── locales/
│   ├── zh.json
│   ├── en.json
│   └── ja.json
└── services/
    └── announcement-service.js
```

### Step 2: AnnouncementService 实现 (2h)
- 数据库 schema
- CRUD 操作
- 已读状态追踪
- 未读数量统计

### Step 3: 插件 UI (3h)
- 公告列表（带优先级标记、已读状态）
- 公告详情
- 发布公告表单（标题、内容、优先级、置顶）
- 侧边栏徽标（未读数量）

### Step 4: 测试 (1.5h)
- AnnouncementService 单元测试
- 已读状态管理测试

### Step 5: 文档 (1h)

## 验收标准

- [ ] 可以发布公告（普通/重要/紧急）
- [ ] 公告列表按优先级和时间排序
- [ ] 支持置顶公告
- [ ] 已读/未读状态正确显示
- [ ] 侧边栏显示未读数量徽标
- [ ] 过期公告自动隐藏
- [ ] 所有测试通过

## 下一步

完成 Phase 3 所有任务后，可考虑：
- 移动端适配 (task-001-mobile)
- 各插件之间的深度集成
- 性能优化和安全加固

## 更新记录

- 2026-02-28: 创建任务文档，规划公告系统开发需求与实现步骤。
