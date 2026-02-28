# Task 003: Chat 聊天插件开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase2-task-003-chat-plugin |
| 阶段 | Phase 2 - 服务端与同步 |
| 优先级 | P1 (高) |
| 预估工时 | 16 小时 |
| 依赖 | Phase 2 Task 002 (Sync Engine) |
| 产出 | 聊天插件 |
| 状态 | ✅ 已完成 |

## 目标

开发 Chat 即时通讯插件，实现：
1. 群组聊天（房间管理）
2. 消息发送与展示
3. 表情反应
4. @提及功能
5. 消息回复
6. 消息轮询（离线优先）
7. 桌面通知

## 实现位置

`src/frontend/desktop/plugins/chat/`

## 文件结构

```
plugins/chat/
├── manifest.json         # 插件清单
├── index.js             # 主插件类
├── style.css            # 样式
├── locales/
│   ├── zh.json          # 中文
│   ├── en.json          # 英文
│   └── ja.json          # 日文
└── services/
    └── chat-service.js  # 数据库服务层
```

## 数据库表结构

```sql
-- 聊天房间表
CREATE TABLE chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  room_type TEXT DEFAULT 'custom',
  avatar TEXT,
  pinned INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_at INTEGER,
  unread_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 聊天消息表
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  message_type TEXT DEFAULT 'text',
  content TEXT,
  attachments TEXT,
  reply_to_id TEXT,
  reply_to_sender TEXT,
  reply_to_content TEXT,
  reactions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'sent',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);

-- 房间成员表
CREATE TABLE chat_room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);
```

## 主要功能

### 房间管理
- 创建/删除聊天房间
- 房间列表显示
- 搜索房间

### 消息功能
- 发送文本消息
- 消息轮询（可配置间隔，默认 3 秒）
- 消息回复（引用上文）
- 表情反应（👍 ❤️ 😄 😮 😢 🔥）
- @提及支持
- 消息状态（发送中/已发送/失败）
- 消息重试

### UI 功能
- 消息列表（日期分隔线、连续消息合并）
- 输入框（自动调整高度，Enter 发送可配置）
- 打字指示器（占位实现）
- 未读消息徽标
- 桌面通知

## 验收标准

- [x] 插件目录结构完整
- [x] manifest.json 配置正确
- [x] 可以创建和列出聊天房间
- [x] 可以在房间内发送和接收消息
- [x] 消息列表正常显示（带日期分隔线）
- [x] 表情反应功能正常
- [x] 消息回复功能正常
- [x] 离线优先设计（无需实时同步）
- [x] 多语言支持（中/英/日）
- [x] 样式完整美观

## 相关文档

- [Chat 插件规格](../../specs/plugins/chat.md)
- [Phase 2 Task 002: Sync Engine](./task-002-sync-engine.md)

## 更新记录

- 2026-02-28: 完成 Chat 插件完整实现（房间管理、消息发送、表情反应、消息回复、轮询刷新）
