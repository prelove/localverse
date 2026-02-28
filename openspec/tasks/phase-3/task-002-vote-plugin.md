# Task 002: Vote 投票插件开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase3-task-002-vote-plugin |
| 阶段 | Phase 3 - 扩展功能 |
| 优先级 | P2 (中) |
| 预估工时 | 8 小时 |
| 依赖 | Phase 0 全部, Phase 1 Task 001 (Frontend Core) |
| 产出 | 投票插件 |
| 状态 | ✅ 已完成 |

## 目标

开发投票插件，支持快速创建和参与内网投票：
1. 创建投票（单选/多选/匿名）
2. 参与投票
3. 实时查看投票结果
4. 投票截止时间
5. 投票结果导出

## 详细需求

### 1. 投票类型

- **单选投票**: 每人只能选一个选项
- **多选投票**: 每人可选多个选项
- **匿名投票**: 只显示统计结果，不显示谁投了什么
- **实名投票**: 显示每个人的投票情况

### 2. 用户界面

```
┌─────────────────────────────────────────────┐
│ 📊 投票                              + 新建  │
├─────────────────────────────────────────────┤
│ ✅ 今天吃什么？          截止: 2026-03-01    │
│    🍜 面条  ████████  8票 (40%)              │
│    🍣 寿司  ██████    6票 (30%)              │
│    🍕 披萨  ██████    6票 (30%)              │
│    [已参与]                                  │
├─────────────────────────────────────────────┤
│ ⏳ 下次团建地点？        截止: 2026-03-05    │
│    [参与投票]                                │
└─────────────────────────────────────────────┘
```

### 3. 数据库设计

```sql
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'single', -- single | multi | anonymous
  options TEXT NOT NULL,               -- JSON array of option strings
  created_by TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT DEFAULT 'local',
  deleted INTEGER DEFAULT 0
);

CREATE TABLE vote_responses (
  id TEXT PRIMARY KEY,
  vote_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  selected_options TEXT NOT NULL,     -- JSON array of selected option indices
  created_at INTEGER NOT NULL,
  FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
);
```

### 4. 核心功能

#### VoteService
- `createVote(data)` - 创建投票
- `getVotes()` - 获取所有投票
- `getVote(id)` - 获取单个投票
- `deleteVote(id)` - 软删除投票
- `submitResponse(voteId, userId, selectedOptions)` - 提交投票
- `getResponses(voteId)` - 获取投票结果
- `getUserResponse(voteId, userId)` - 获取用户投票记录

## 实现步骤

### Step 1: 目录结构 (30min)

```
src/frontend/desktop/plugins/vote/
├── manifest.json
├── index.js
├── style.css
├── locales/
│   ├── zh.json
│   ├── en.json
│   └── ja.json
└── services/
    └── vote-service.js
```

### Step 2: 服务层实现 (2h)
- 实现 VoteService
- 数据库 schema 初始化
- CRUD 操作

### Step 3: 插件 UI (3h)
- 投票列表视图
- 创建投票表单
- 投票参与界面（选项 + 提交）
- 结果展示（进度条 + 百分比）

### Step 4: 测试 (1.5h)
- VoteService 单元测试
- 投票流程集成测试

### Step 5: 文档 (1h)
- manifest.json 配置
- locales 多语言

## 验收标准

- [x] 可以创建单选/多选/匿名投票
- [x] 可以参与投票
- [x] 实时显示投票结果（进度条）
- [x] 投票截止时间功能正常
- [x] 不能重复投票
- [x] 匿名模式下不显示投票人
- [x] 所有测试通过（9/9）

## 下一步

完成后可继续：
- `task-003-calendar-plugin.md` - 日历插件
- `task-004-announcement.md` - 公告系统

## 更新记录

- 2026-02-28: 创建任务文档，规划投票插件开发需求与实现步骤。
- 2026-02-28: 完成开发 — VoteService + index.js + style.css + 三语言 locales + 9/9 单元测试通过。
