# Localverse 文档关系总览

> 📘 **开发路线规划**：查看 [DEVELOPMENT-ROADMAP.md](./DEVELOPMENT-ROADMAP.md) 了解完整的任务依赖、并行策略和时间规划

## 核心基础设施（必须完整）

```
┌─────────────────────────────────────────────────────────────┐
│                     规格文档 (specs/)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  00-architecture.md ←──────────────────────────────────────┐│
│       ↓                                                    ││
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   ││
│  │01-launcher │  │02-local-jar│  │  03-sync-server    │   ││
│  │  启动器    │  │  本地JAR   │  │    同步服务器      │   ││
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘   ││
│        │               │                   │               ││
│        └───────────────┼───────────────────┘               ││
│                        ↓                                   ││
│  ┌─────────────────────────────────────────────────────┐  ││
│  │               04-communication.md                    │  ││
│  │                   通信协议                           │  ││
│  └─────────────────────────┬───────────────────────────┘  ││
│                            ↓                               ││
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   ││
│  │05-database │  │06-auth     │  │  07-sync-engine    │   ││
│  │  数据库    │  │  认证      │  │    同步引擎        │   ││
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘   ││
│        │               │                   │               ││
│        └───────────────┼───────────────────┘               ││
│                        ↓                                   ││
│  ┌─────────────────────────────────────────────────────┐  ││
│  │               08-plugin-system.md                    │  ││
│  │                   插件系统                           │  ││
│  └─────────────────────────┬───────────────────────────┘  ││
│                            ↓                               ││
│  ┌────────────────┐  ┌────────────────────────────────┐   ││
│  │09-frontend-core│  │      10-mobile.md              │   ││
│  │   前端核心     │  │        移动端                  │   ││
│  └────────────────┘  └────────────────────────────────┘   ││
│                                                            ││
└────────────────────────────────────────────────────────────┘│
                                                              │
┌─────────────────────────────────────────────────────────────┐
│                     任务文档 (tasks/)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 0: 基础设施                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ task-001-launcher      → specs/01-launcher.md        │  │
│  │ task-002-local-jar     → specs/02-local-jar.md       │  │
│  │ task-003-communication → specs/04-communication.md   │  │
│  │ task-004-database      → specs/05-database.md        │  │
│  │ task-005-authentication→ specs/06-authentication.md  │  │
│  │ task-006-plugin-system → specs/08-plugin-system.md   │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  Phase 1: 核心应用                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ task-001-frontend-core → specs/09-frontend-core.md   │  │
│  │ task-002-search-service→ specs/services/search.md    │  │
│  │ task-003-finder-plugin → specs/plugins/finder.md     │  │
│  │ task-004-wiki-plugin   → specs/plugins/wiki.md       │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  Phase 2: 服务端与同步 ★ 核心基础设施                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ task-001-sync-server   → specs/03-sync-server.md  ★  │  │
│  │ task-002-sync-engine   → specs/07-sync-engine.md  ★  │  │
│  │ task-003-chat-plugin   → specs/plugins/chat.md       │  │
│  │ task-004-task-plugin   → specs/plugins/task.md       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 服务接口文档

```
specs/services/
├── database-service.md     ← 被所有插件依赖
├── filesystem-service.md   ← 被 finder 等依赖
└── search-service.md       ← 被多个插件依赖
```

## 插件文档（可延后）

```
specs/plugins/
├── finder.md    ← 文件搜索
├── wiki.md      ← 知识库（核心插件）
├── chat.md      ← 聊天
├── task.md      ← 任务管理
├── vote.md      ← 投票（未输出，可随时实现）
├── calendar.md  ← 日历（未输出，可随时实现）
└── ...
```

## 开发顺序建议

```
1. Phase 0 (全部) ──→ 基础设施完整
       ↓
2. Phase 1 (前端核心 + 至少1个插件) ──→ 可以演示
       ↓
3. Phase 2 (Sync Server + Sync Engine) ──→ 多设备协作
       ↓
4. 其他插件 ──→ 按需开发
```

## 核心 vs 可延后

### 🔴 核心基础设施（必须有完整文档）

| 文档 | 状态 | 说明 |
|------|------|------|
| 00-architecture.md | ✅ | 整体架构 |
| 01-launcher.md | ✅ | 启动器 |
| 02-local-jar.md | ✅ | 本地 JAR |
| 03-sync-server.md | ✅ | 同步服务器 |
| 04-communication.md | ✅ | 通信协议 |
| 05-database.md | ✅ | 数据库 |
| 06-authentication.md | ✅ | 认证 |
| 07-sync-engine.md | ✅ | 同步引擎 |
| 08-plugin-system.md | ✅ | 插件系统 |
| 09-frontend-core.md | ✅ | 前端核心 |
| Phase 0 所有任务 | ✅ | 基础实现 |
| Phase 2 核心任务 | ✅ | 同步实现 |

### 🟢 可延后（有接口标准，随时可实现）

| 文档 | 状态 | 说明 |
|------|------|------|
| 10-mobile.md | ✅ | 有规格，可延后 |
| plugins/*.md | 部分 | 有规格，按需开发 |
| Phase 1 插件任务 | 未输出 | 参照 specs 即可 |

## 快速导航

- **我要开发启动器** → `specs/01-launcher.md` + `tasks/phase-0/task-001-launcher.md`
- **我要开发本地 JAR** → `specs/02-local-jar.md` + `tasks/phase-0/task-002-local-jar.md`
- **我要开发同步服务器** → `specs/03-sync-server.md` + `tasks/phase-2/task-001-sync-server.md`
- **我要开发同步引擎** → `specs/07-sync-engine.md` + `tasks/phase-2/task-002-sync-engine.md`
- **我要开发插件** → `specs/08-plugin-system.md` + `specs/plugins/<插件名>.md`
- **我要理解通信协议** → `specs/04-communication.md`
- **我要理解数据库结构** → `specs/05-database.md`