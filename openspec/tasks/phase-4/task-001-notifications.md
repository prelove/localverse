# Task 001: Notifications 通知系统

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase4-task-001-notifications |
| 阶段 | Phase 4 - 质量与集成 |
| 优先级 | P1 (高) |
| 预估工时 | 10 小时 |
| 依赖 | Phase 0-3 全部 |
| 产出 | 通知中心插件 |
| 状态 | ✅ 已完成 |

## 目标

开发跨插件通知聚合系统，让用户感知来自各插件的重要事件：
1. 接收来自 Chat、Task、Calendar、Announcement 等插件的通知
2. 侧边栏通知铃铛徽标显示未读数量
3. 通知中心面板（历史列表 + 已读管理）
4. 点击通知跳转到对应插件

## 详细需求

### 1. 用户界面

```
侧边栏图标:
  🔔 (3)   ← 数字角标显示未读数

通知面板:
┌──────────────────────────────────────────┐
│ 🔔 通知中心                    全部已读  │
├──────────────────────────────────────────┤
│ 🔵 [任务] "完成API设计" 即将到期          │
│    任务管理  ·  5分钟前                   │
├──────────────────────────────────────────┤
│ 🔵 [公告] 系统维护通知（紧急）            │
│    公告系统  ·  1小时前                   │
├──────────────────────────────────────────┤
│    [聊天] Alice 在 #dev 发了新消息        │
│    聊天  ·  2小时前                       │
└──────────────────────────────────────────┘
```

### 2. 数据库设计

```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  source_plugin TEXT NOT NULL,  -- 来源插件 ID
  source_id TEXT,               -- 来源条目 ID（可选）
  type TEXT NOT NULL,           -- task_due | announcement | chat_mention | calendar_event
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### 3. NotificationService 接口

- `push(notification)` - 推送通知（供其他插件调用）
- `getNotifications(limit)` - 获取通知列表
- `markRead(id)` - 标记单条已读
- `markAllRead()` - 全部已读
- `getUnreadCount()` - 获取未读数量
- `generateId()` - 生成唯一 ID

## 实现步骤

### Step 1: 目录结构

```
src/frontend/desktop/plugins/notification/
├── manifest.json
├── index.js
├── style.css
├── locales/
│   ├── zh.json
│   ├── en.json
│   └── ja.json
└── services/
    └── notification-service.js
```

### Step 2: NotificationService 实现
### Step 3: 插件 UI
### Step 4: 单元测试
### Step 5: 集成到 plugins.json

## 验收标准

- [x] NotificationService CRUD 全部通过
- [x] push/getNotifications/markRead/markAllRead/getUnreadCount 正常工作
- [x] 侧边栏通知铃铛角标显示未读数
- [x] 通知面板展示历史，可标记已读
- [x] 三语言 locales 完整
- [x] 10/10 单元测试通过

## 下一步

完成 Task 001 后：
- Phase 4 Task 002: Dashboard 主页（聚合各插件最近活动）
- Phase 4 Task 003: 设置中心（全局用户偏好配置）

## 更新记录

- 2026-02-28: 创建任务文档，规划通知系统开发需求与实现步骤。
- 2026-02-28: 完成开发 — NotificationService + index.js + style.css + 三语言 locales + 10/10 单元测试通过。
