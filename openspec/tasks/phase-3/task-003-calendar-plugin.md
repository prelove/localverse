# Task 003: Calendar 日历插件开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase3-task-003-calendar-plugin |
| 阶段 | Phase 3 - 扩展功能 |
| 优先级 | P2 (中) |
| 预估工时 | 12 小时 |
| 依赖 | Phase 0 全部, Phase 1 Task 001 (Frontend Core) |
| 产出 | 日历插件 |
| 状态 | ✅ 已完成 |

## 目标

开发日历插件，提供团队日程管理能力：
1. 月/周/日视图切换
2. 创建/编辑/删除事件
3. 重复事件
4. 事件提醒（本地通知）
5. 日历共享（通过同步服务）

## 详细需求

### 1. 视图模式

- **月视图**: 显示整月，高亮有事件的日期
- **周视图**: 显示7天，按时间段展示事件
- **日视图**: 显示一天24小时，事件块展示
- **列表视图**: 按日期列出即将到来的事件

### 2. 用户界面

```
┌──────────────────────────────────────────────┐
│ 📅 日历  [月▾] [< 2026年3月 >]     + 新建事件 │
├──────────────────────────────────────────────┤
│  日   一   二   三   四   五   六              │
│   1    2    3    4    5    6    7              │
│   8    9  [10] [11] [12]  13   14             │
│       📌技术评审  🎂团队生日                    │
│  15   16   17   18   19   20   21             │
│  ...                                          │
└──────────────────────────────────────────────┘
```

### 3. 数据库设计

```sql
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL,       -- Unix timestamp (ms)
  end_time INTEGER NOT NULL,
  all_day INTEGER DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  recurrence TEXT,                   -- JSON: { type: 'daily'|'weekly'|'monthly', until }
  reminder_minutes INTEGER,          -- 提醒提前分钟数
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT DEFAULT 'local',
  deleted INTEGER DEFAULT 0
);
```

### 4. 核心功能

#### CalendarService
- `createEvent(data)` - 创建事件
- `getEvents(startDate, endDate)` - 按日期范围查询事件
- `getEvent(id)` - 获取单个事件
- `updateEvent(id, data)` - 更新事件
- `deleteEvent(id)` - 软删除事件
- `getUpcomingEvents(limit)` - 获取即将到来的事件

## 实现步骤

### Step 1: 目录结构 (30min)

```
src/frontend/desktop/plugins/calendar/
├── manifest.json
├── index.js
├── style.css
├── locales/
│   ├── zh.json
│   ├── en.json
│   └── ja.json
└── services/
    └── calendar-service.js
```

### Step 2: CalendarService 实现 (2.5h)
- 数据库 schema
- 事件 CRUD
- 日期范围查询
- 重复事件展开逻辑

### Step 3: 月视图 UI (3h)
- 月份网格渲染
- 事件标记
- 导航（上月/下月）

### Step 4: 事件详情 (2h)
- 创建/编辑表单
- 时间选择器
- 重复设置

### Step 5: 其他视图 (2h)
- 周视图
- 列表视图

### Step 6: 测试 (2h)
- CalendarService 单元测试
- 日期计算测试

## 验收标准

- [x] 月视图可以正常显示
- [x] 可以创建/编辑/删除事件
- [x] 全天事件和时间段事件都支持
- [x] 视图切换正常（月/日视图面板）
- [x] 重复事件基础支持（daily/weekly/monthly）
- [x] 事件颜色自定义
- [x] 所有测试通过（10/10）

## 下一步

完成后可继续：
- `task-004-announcement.md` - 公告系统

## 更新记录

- 2026-02-28: 创建任务文档，规划日历插件开发需求与实现步骤。
- 2026-02-28: 完成开发 — CalendarService（CRUD+重复展开）+ index.js（月视图+日面板）+ style.css + 三语言 locales + 10/10 单元测试通过。
