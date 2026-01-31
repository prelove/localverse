# 规格文档索引

## 核心规格（按依赖顺序）

| 编号 | 文档 | 描述 | 依赖 |
|------|------|------|------|
| 00 | [architecture.md](./00-architecture.md) | 整体架构 | 无 |
| 01 | [launcher.md](./01-launcher.md) | 启动器 | 00 |
| 02 | [local-jar.md](./02-local-jar.md) | 本地 JAR 服务 | 00 |
| 03 | [sync-server.md](./03-sync-server.md) | 同步服务器 | 00, 04, 05 |
| 04 | [communication.md](./04-communication.md) | 通信协议 | 00 |
| 05 | [database.md](./05-database.md) | 数据库设计 | 00 |
| 06 | [authentication.md](./06-authentication.md) | 认证系统 | 05 |
| 07 | [sync-engine.md](./07-sync-engine.md) | 同步引擎 | 03, 04, 05 |
| 08 | [plugin-system.md](./08-plugin-system.md) | 插件系统 | 05, 09 |
| 09 | [frontend-core.md](./09-frontend-core.md) | 前端核心 | 04, 05, 06 |
| 10 | [mobile.md](./10-mobile.md) | 移动端 | 03, 09 |

## 服务接口规格

| 文档 | 描述 | 被依赖于 |
|------|------|----------|
| [services/database-service.md](./services/database-service.md) | 数据库服务接口 | 所有插件 |
| [services/filesystem-service.md](./services/filesystem-service.md) | 文件系统服务接口 | finder 等 |
| [services/search-service.md](./services/search-service.md) | 搜索服务接口 | finder, wiki 等 |

## 插件规格

| 文档 | 描述 | 核心服务 |
|------|------|----------|
| [plugins/finder.md](./plugins/finder.md) | 文件搜索 | FileSystem, Search |
| [plugins/wiki.md](./plugins/wiki.md) | 知识库 | Database, Search |
| [plugins/chat.md](./plugins/chat.md) | 即时聊天 | Database, Communication |
| [plugins/task.md](./plugins/task.md) | 任务管理 | Database, Sync |

## 依赖关系图

```
00-architecture
    │
    ├──→ 01-launcher
    │
    ├──→ 02-local-jar
    │
    ├──→ 04-communication ──→ 07-sync-engine
    │         │                    ↑
    │         ↓                    │
    ├──→ 05-database ────────────┬─┘
    │         │                  │
    │         ↓                  │
    │    06-authentication       │
    │         │                  │
    │         ↓                  │
    ├──→ 09-frontend-core        │
    │         │                  │
    │         ↓                  │
    ├──→ 08-plugin-system        │
    │         │                  │
    │         ↓                  │
    │    plugins/*               │
    │                            │
    └──→ 03-sync-server ─────────┘
              │
              ↓
         10-mobile
```

## 阅读建议

**首次阅读：**
1. 00-architecture.md（必读）
2. 04-communication.md
3. 05-database.md
4. 08-plugin-system.md

**开发客户端：**
- 01-launcher.md
- 02-local-jar.md
- 09-frontend-core.md

**开发服务端：**
- 03-sync-server.md
- 07-sync-engine.md

**开发插件：**
- 08-plugin-system.md
- plugins/*.md
- services/*.md