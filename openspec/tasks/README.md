# 开发任务索引

> 🚀 **新手入门**：先阅读 [QUICK-START-GUIDE.md](../QUICK-START-GUIDE.md) 快速了解开发流程（5分钟）
> 
> 📘 **完整路线图**：参阅 [DEVELOPMENT-ROADMAP.md](../DEVELOPMENT-ROADMAP.md) 了解详细的任务依赖、并行策略、时间线规划和风险管理

## 开发阶段

### Phase 0: 基础设施 🔴 必须先完成

这些是系统运行的基础，必须按顺序完成。

| 任务 | 描述 | 预估 | 依赖 | 状态 |
|------|------|------|------|------|
| [task-001-launcher](./phase-0/task-001-launcher.md) | 启动器开发 | 8h | 无 | ✅ 已完成 |
| [task-002-local-jar](./phase-0/task-002-local-jar.md) | 本地 JAR 服务 | 16h | 001 | ✅ 已完成 |
| [task-003-communication](./phase-0/task-003-communication.md) | 通信层 | 12h | 002 | ✅ 已完成 |
| [task-004-database](./phase-0/task-004-database.md) | 数据库服务 | 12h | 003 | ✅ 已完成 |
| [task-005-authentication](./phase-0/task-005-authentication.md) | 认证系统 | 8h | 004 | ✅ 已完成 |
| [task-006-plugin-system](./phase-0/task-006-plugin-system.md) | 插件系统 | 12h | 005 | ✅ 已完成 |

**Phase 0 总计：约 68 小时** ✅ **全部完成**

### Phase 1: 核心应用 🟡 优先完成

| 任务 | 描述 | 预估 | 依赖 | 状态 |
|------|------|------|------|------|
| [task-001-frontend-core](./phase-1/task-001-frontend-core.md) | 前端框架 | 16h | Phase 0 | ✅ 已完成 |
| task-002-search-service | 搜索服务 | 8h | 001 | ⏭️ 下一步 |
| task-003-finder-plugin | 文件搜索插件 | 12h | 002 | 待创建 |
| task-004-wiki-plugin | 知识库插件 | 16h | 001 | 待创建 |

**Phase 1 总计：约 52 小时**

### Phase 2: 服务端与同步 🔴 核心基础设施

| 任务 | 描述 | 预估 | 依赖 | 状态 |
|------|------|------|------|------|
| [task-001-sync-server](./phase-2/task-001-sync-server.md) | 同步服务器 | 24h | Phase 0 | 待开发 |
| [task-002-sync-engine](./phase-2/task-002-sync-engine.md) | 同步引擎 | 20h | 001 | 待开发 |
| task-003-chat-plugin | 聊天插件 | 16h | 002 | 待创建 |
| task-004-task-plugin | 任务插件 | 12h | 002 | 待创建 |

**Phase 2 总计：约 72 小时**

### Phase 3: 扩展功能 🟢 可选

| 任务 | 描述 | 预估 | 依赖 | 状态 |
|------|------|------|------|------|
| task-001-mobile | 移动端 | 16h | Phase 2 | 待创建 |
| task-002-vote-plugin | 投票插件 | 8h | Phase 1 | 待创建 |
| task-003-calendar-plugin | 日历插件 | 12h | Phase 1 | 待创建 |
| task-004-announcement | 公告系统 | 8h | Phase 1 | 待创建 |

**Phase 3 总计：约 44 小时**

## 依赖关系图

```
Phase 0 (基础设施)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
task-001-launcher
    ↓
task-002-local-jar
    ↓
task-003-communication
    ↓
task-004-database
    ↓
task-005-authentication
    ↓
task-006-plugin-system
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1 (核心应用)          Phase 2 (同步)
                            
task-001-frontend-core      task-001-sync-server
    ↓                           ↓
task-002-search-service     task-002-sync-engine
    ↓                           ↓
task-003-finder-plugin      task-003-chat-plugin
task-004-wiki-plugin        task-004-task-plugin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 开发优先级

### 最小可用版本 (MVP)

1. Phase 0 全部
2. Phase 1: frontend-core + wiki-plugin
3. (可选) Phase 2: sync-server + sync-engine

### 完整协作版本

1. Phase 0 全部
2. Phase 1 全部
3. Phase 2 全部

## 任务状态说明

| 状态 | 说明 |
|------|------|
| 待创建 | 任务文档待编写 |
| 待开发 | 文档完成，待实现 |
| 开发中 | 正在开发 |
| 测试中 | 开发完成，测试中 |
| 已完成 | 全部完成 |

## 更新任务状态

完成任务后，请：
1. 更新任务文档中的状态
2. 更新本索引中的状态
3. 在 `changes/current/` 记录变更

---

## 📖 延伸阅读

- **[完整开发路线图](../DEVELOPMENT-ROADMAP.md)** - 详细的任务依赖分析、并行策略、时间线规划、风险管理和最佳实践
- **[项目架构](../specs/00-architecture.md)** - 系统整体架构设计
- **[技术规格](../specs/)** - 所有技术规格文档