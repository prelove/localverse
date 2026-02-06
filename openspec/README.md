# Localverse OpenSpec

这是 Localverse 项目的完整规格文档集。AI 开发工具和人类开发者都可以通过这些文档理解和实现系统。

## 📊 项目当前状态

**Phase 0 基础设施**: 100% 完成 (6/6 任务) 🟢

| 任务 | 状态 | 文档 |
|------|------|------|
| 001: Launcher | ✅ 完成 | [task-001](./tasks/phase-0/task-001-launcher.md) |
| 002: Local JAR | ✅ 完成 | [task-002](./tasks/phase-0/task-002-local-jar.md) |
| 003: 通信层 | ✅ 完成 | [task-003](./tasks/phase-0/task-003-communication.md) |
| 004: 数据库 | ✅ 完成 | [task-004](./tasks/phase-0/task-004-database.md) |
| 005: 认证 | ✅ 完成 | [task-005](./tasks/phase-0/task-005-authentication.md) |
| 006: 插件系统 | ✅ 完成 | [task-006](./tasks/phase-0/task-006-plugin-system.md) |

**下一步**: 启动 Phase 1 插件开发（Finder/Wiki）

## 快速导航

### 📊 项目状态评估

**🎯 最新评估**: [PROJECT-READINESS-ASSESSMENT.md](./PROJECT-READINESS-ASSESSMENT.md) - 详细的项目可运行状态分析

**📋 快速总结**: [../READINESS-SUMMARY.md](../READINESS-SUMMARY.md) - 一页纸项目状态摘要

### 我是新手，从哪里开始？

**🚀 快速入门**: 阅读 [QUICK-START-GUIDE.md](./QUICK-START-GUIDE.md) (5分钟了解开发流程)

**📚 深入学习**:
1. 阅读 [project.md](./project.md) 了解项目背景
2. 阅读 [specs/00-architecture.md](./specs/00-architecture.md) 了解整体架构
3. 查看 [DOCUMENT-MAP.md](./DOCUMENT-MAP.md) 了解文档关系

### 我要开始开发

📘 **先阅读**: [DEVELOPMENT-ROADMAP.md](./DEVELOPMENT-ROADMAP.md) - 完整的开发路线图，包含任务依赖、并行策略和时间规划

按阶段顺序开发：

```
Phase 0: 基础设施（必须先完成）
├── task-001-launcher      启动器
├── task-002-local-jar     本地 JAR 服务
├── task-003-communication 通信层
├── task-004-database      数据库服务
├── task-005-authentication 认证系统
└── task-006-plugin-system 插件系统

Phase 1: 核心应用
├── task-001-frontend-core 前端框架
└── (插件按需开发)

Phase 2: 服务端与同步
├── task-001-sync-server   同步服务器
└── task-002-sync-engine   同步引擎
```

### 我要开发某个功能

| 功能 | 状态 | 规格文档 | 任务文档 |
|------|------|----------|----------|
| 启动器 | ✅ 完成 | [specs/01-launcher.md](specs/01-launcher.md) | [tasks/phase-0/task-001-launcher.md](tasks/phase-0/task-001-launcher.md) |
| 本地 JAR | ✅ 完成 | [specs/02-local-jar.md](specs/02-local-jar.md) | [tasks/phase-0/task-002-local-jar.md](tasks/phase-0/task-002-local-jar.md) |
| 通信层 | ✅ 完成 | [specs/04-communication.md](specs/04-communication.md) | [tasks/phase-0/task-003-communication.md](tasks/phase-0/task-003-communication.md) |
| 数据库 | ✅ 完成 | [specs/05-database.md](specs/05-database.md) | [tasks/phase-0/task-004-database.md](tasks/phase-0/task-004-database.md) |
| 认证 | ✅ 完成 | [specs/06-authentication.md](specs/06-authentication.md) | [tasks/phase-0/task-005-authentication.md](tasks/phase-0/task-005-authentication.md) |
| 插件系统 | ✅ 完成 | [specs/08-plugin-system.md](specs/08-plugin-system.md) | [tasks/phase-0/task-006-plugin-system.md](tasks/phase-0/task-006-plugin-system.md) |
| 前端核心 | ✅ 完成 | [specs/09-frontend-core.md](specs/09-frontend-core.md) | [tasks/phase-1/task-001-frontend-core.md](tasks/phase-1/task-001-frontend-core.md) |
| 同步服务器 | ⏳ 待开发 | [specs/03-sync-server.md](specs/03-sync-server.md) | [tasks/phase-2/task-001-sync-server.md](tasks/phase-2/task-001-sync-server.md) |
| 同步引擎 | ⏳ 待开发 | [specs/07-sync-engine.md](specs/07-sync-engine.md) | [tasks/phase-2/task-002-sync-engine.md](tasks/phase-2/task-002-sync-engine.md) |

### 我要开发插件

1. 阅读 [specs/08-plugin-system.md](./specs/08-plugin-system.md) 了解插件规范
2. 参考现有插件规格：
   - [specs/plugins/finder.md](./specs/plugins/finder.md) - 文件搜索
   - [specs/plugins/wiki.md](./specs/plugins/wiki.md) - 知识库
   - [specs/plugins/chat.md](./specs/plugins/chat.md) - 聊天
   - [specs/plugins/task.md](./specs/plugins/task.md) - 任务管理

## 📝 文档类型说明

### specs/ - 技术规格
**作用**: 定义"是什么"和"为什么"
- 组件的架构设计
- API 接口定义
- 数据结构
- 交互协议
- 技术选型理由

**阅读对象**: 架构师、技术决策者、需要深入理解系统的开发者

### tasks/ - 开发任务
**作用**: 说明"怎么做"
- 具体实现步骤
- 代码示例
- 测试要点
- 验收标准
- 时间估算

**阅读对象**: 实现功能的开发者、AI Agent

### 两者关系
- **specs** 是蓝图，**tasks** 是施工指南
- 开发前先读 **specs** 理解设计，再读 **tasks** 开始实现
- **specs** 相对稳定，**tasks** 可根据实际调整

## 🎯 推荐阅读顺序

### 第一次接触项目
1. [../README.md](../README.md) - 项目概览 (3分钟)
2. [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md) - 快速入门 (5分钟)
3. [specs/00-architecture.md](specs/00-architecture.md) - 系统架构 (10分钟)
4. [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md) - 开发路线图 (15分钟)

### 准备开发 Phase 0
1. [tasks/README.md](tasks/README.md) - 任务总览
2. [tasks/phase-0/task-001-launcher.md](tasks/phase-0/task-001-launcher.md) - 第一个任务
3. [specs/01-launcher.md](specs/01-launcher.md) - 启动器规格
4. 开始编码

### 了解已完成功能
1. [../docs/IMPLEMENTATION_SUMMARY.md](../docs/IMPLEMENTATION_SUMMARY.md) - 实现总结
2. [../docs/local-jar.md](../docs/local-jar.md) - Local JAR API
3. [../src/frontend/desktop/services/](../src/frontend/desktop/services/) - 前端服务实现

## 📚 核心文档

```
openspec/
├── README.md              # 本文件
├── project.md             # 项目背景和目标
├── DOCUMENT-MAP.md        # 文档关系总览
├── AGENTS.md              # AI 开发指南
│
├── specs/                 # 规格文档
│   ├── 00-architecture.md # 整体架构
│   ├── 01-launcher.md     # 启动器
│   ├── 02-local-jar.md    # 本地 JAR
│   ├── 03-sync-server.md  # 同步服务器
│   ├── 04-communication.md# 通信协议
│   ├── 05-database.md     # 数据库
│   ├── 06-authentication.md# 认证
│   ├── 07-sync-engine.md  # 同步引擎
│   ├── 08-plugin-system.md# 插件系统
│   ├── 09-frontend-core.md# 前端核心
│   ├── 10-mobile.md       # 移动端
│   ├── plugins/           # 插件规格
│   └── services/          # 服务接口规格
│
├── tasks/                 # 开发任务
│   ├── phase-0/           # 基础设施
│   ├── phase-1/           # 核心应用
│   └── phase-2/           # 服务端与同步
│
├── changes/               # 变更记录
│   ├── current/           # 当前版本变更
│   └── archive/           # 历史变更
│
└── tests/                 # 测试规范
    ├── unit/              # 单元测试
    ├── integration/       # 集成测试
    └── e2e/               # 端到端测试
```

## 技术栈

- **后端**: Java 21 (无框架)
- **前端**: HTML5 + CSS3 + ES2022 (无框架)
- **数据库**: SQLite (WASM + JDBC)
- **通信**: WebSocket + SSE + HTTP

## 关键设计原则

1. **离线优先**: 核心功能不依赖网络
2. **渐进增强**: 根据环境自动降级
3. **本地数据所有权**: 数据存储在用户设备
4. **插件化架构**: 功能模块化，按需加载
5. **多端同步**: 可选的服务端同步

## 开发模式

系统支持三种运行模式：

| 模式 | JAR | WASM | 网络 | 功能 |
|------|-----|------|------|------|
| Full | ✅ | ✅ | ✅ | 完整功能 |
| Light | ❌ | ✅ | ✅ | 无本地文件访问 |
| Pure | ❌ | ❌ | ✅ | 仅云端数据 |

## 贡献指南

1. 修改规格前，先在 `changes/current/` 创建变更记录
2. 任务完成后，更新对应的任务文档状态
3. 保持文档间的引用关系正确
