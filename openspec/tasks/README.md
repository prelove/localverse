# 开发任务索引

## 📊 当前进度概览

**最后更新**: 2026-02-17 (10:05 UTC)

### Phase 0: 基础设施 - 100% 完成 (6/6) 🎉
- ✅ 已完成: Launcher, Local JAR, Communication, Database, Authentication, Plugin System
- 🎊 **重大里程碑**: Phase 0 所有任务已完成！

### Phase 1: 核心应用 - 50% 完成 (2/4)
- ✅ 已完成: Frontend Core, Search Service
- 🧪 测试中: Finder Plugin, Wiki Plugin

### Phase 2: 服务端与同步 - 进行中
- ✅ 已完成: Sync Server（持久化 + 冲突检测 + 状态接口 + 双前缀路由 + 冒烟并发验证）
- 🔵 开发中: Sync Engine（冲突处理 + 重连自动同步 + 状态UI基线）
- 待创建: Chat Plugin, Task Plugin

---
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

**Phase 0 总计：约 68 小时** ✅ **100% 已完成** (2026-01-31)

### Phase 1: 核心应用 🟡 优先完成

| 任务 | 描述 | 预估 | 依赖 | 状态 |
|------|------|------|------|------|
| [task-001-frontend-core](./phase-1/task-001-frontend-core.md) | 前端框架 | 16h | Phase 0 | ✅ 已完成 |
| [task-002-search-service](./phase-1/task-002-search-service.md) | 搜索服务 | 8h | 001 | ✅ 已完成 |
| [task-003-finder-plugin](./phase-1/task-003-finder-plugin.md) | 文件搜索插件 | 12h | 002 | 测试中（基础单测完成） |
| [task-004-wiki-plugin](./phase-1/task-004-wiki-plugin.md) | 知识库插件 | 16h | 001 | 测试中（服务层单测完成） |

**Phase 1 总计：约 52 小时**

### Phase 2: 服务端与同步 🔴 核心基础设施

| 任务 | 描述 | 预估 | 依赖 | 状态 |
|------|------|------|------|------|
| [task-001-sync-server](./phase-2/task-001-sync-server.md) | 同步服务器 | 24h | Phase 0 | ✅ 已完成（持久化 + 冲突检测 + 状态接口 + 路由兼容 + 冒烟并发验证） |
| [task-002-sync-engine](./phase-2/task-002-sync-engine.md) | 同步引擎 | 20h | 001 | 🔵 开发中（冲突处理 + 重连自动同步 + 状态UI基线） |
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
| 🔵 开发中 | 正在开发 |
| 🟡 部分完成 | 部分功能已实现 |
| 🟡 待合并 | 代码完成但PR未合并 |
| 测试中 | 开发完成，测试中 |
| ✅ 已完成 | 全部完成 |

## 更新任务状态

完成任务后，请：
1. 更新任务文档中的状态
2. 更新本索引中的状态
3. 在 `changes/current/` 记录变更

---

## 📝 实现说明

### Phase 0 已完成任务

**Task 001: Launcher** (PR #1)
- 位置: `src/java/launcher/`
- 包含: Launcher.java, VersionManager.java, ProcessManager.java 等
- 功能: 版本管理、进程管理、崩溃检测

**Task 002: Local JAR** (PR #4)
- 位置: `src/java/core/`
- 服务: HTTP Server (8765), WebSocket Server (8766)
- 处理器: Config, Database, File, Health, Proxy handlers

**Task 003: Communication** (PR #5)
- 位置: `src/frontend/desktop/services/comm/`
- 传输: WebSocket, SSE, Long/Short Polling
- 功能: 消息队列、离线存储、自动降级

**Task 004: Database** (PR #6)
- 位置: `src/frontend/desktop/services/database/`
- 实现: WASM Database, JAR Database, Mock Database
- 功能: Schema管理、迁移系统

**Task 005: Authentication** (PR #7 - ✅ 已合并)
- 位置: `src/frontend/desktop/services/auth/`
- 状态: ✅ 已完成并合并 (2026-01-31 13:17:02Z)
- 包含: device-fingerprint, token-manager, auth-service, permission, setup-ui
- 合并SHA: 2bfbdeb5ceb3edec5926066e36075c47039c8a3c

**Task 006: Plugin System** (PR #13)
- 位置: `src/frontend/desktop/core/plugin/`
- 模块: plugin-manager, plugin-loader, plugin-base, event-bus, permission-manager, plugin-storage
- 示例: `examples/plugins/demo-plugin/`

### Phase 1 进行中任务

**Task 001: Frontend Core** (PR #10 - 部分完成)
- 位置: `src/frontend/desktop/`
- 已实现: Router, State, Theme, i18n, Components
- 待完善: 服务集成、插件加载、错误处理

**Task 002: Search Service** (PR #12 - 开发中)
- 预期位置: `src/frontend/desktop/services/search/`
- 状态: 正在开发

---

## 🔗 相关文档

- [详细审查报告](../../RECOVERY_CHECKLIST.md) - 完整的任务完成度分析
- [修复行动计划](../../IMMEDIATE_ACTIONS.md) - 优先级和执行步骤
- [最终报告](../../FINAL_REPORT.md) - 综合总结和后续建议
- [Plugin System 文档](../../src/frontend/desktop/core/plugin/README.md) - 插件系统使用指南
## 📖 延伸阅读

- **[完整开发路线图](../DEVELOPMENT-ROADMAP.md)** - 详细的任务依赖分析、并行策略、时间线规划、风险管理和最佳实践
- **[项目架构](../specs/00-architecture.md)** - 系统整体架构设计
- **[技术规格](../specs/)** - 所有技术规格文档
