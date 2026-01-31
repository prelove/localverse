# Localverse OpenSpec

这是 Localverse 项目的完整规格文档集。AI 开发工具和人类开发者都可以通过这些文档理解和实现系统。

## 快速导航

### 我是新手，从哪里开始？

1. 阅读 [project.md](./project.md) 了解项目背景
2. 阅读 [specs/00-architecture.md](./specs/00-architecture.md) 了解整体架构
3. 查看 [DOCUMENT-MAP.md](./DOCUMENT-MAP.md) 了解文档关系

### 我要开始开发

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

| 功能 | 规格文档 | 任务文档 |
|------|----------|----------|
| 启动器 | specs/01-launcher.md | tasks/phase-0/task-001-launcher.md |
| 本地 JAR | specs/02-local-jar.md | tasks/phase-0/task-002-local-jar.md |
| 通信层 | specs/04-communication.md | tasks/phase-0/task-003-communication.md |
| 数据库 | specs/05-database.md | tasks/phase-0/task-004-database.md |
| 认证 | specs/06-authentication.md | tasks/phase-0/task-005-authentication.md |
| 插件系统 | specs/08-plugin-system.md | tasks/phase-0/task-006-plugin-system.md |
| 前端核心 | specs/09-frontend-core.md | tasks/phase-1/task-001-frontend-core.md |
| 同步服务器 | specs/03-sync-server.md | tasks/phase-2/task-001-sync-server.md |
| 同步引擎 | specs/07-sync-engine.md | tasks/phase-2/task-002-sync-engine.md |

### 我要开发插件

1. 阅读 [specs/08-plugin-system.md](./specs/08-plugin-system.md) 了解插件规范
2. 参考现有插件规格：
   - [specs/plugins/finder.md](./specs/plugins/finder.md) - 文件搜索
   - [specs/plugins/wiki.md](./specs/plugins/wiki.md) - 知识库
   - [specs/plugins/chat.md](./specs/plugins/chat.md) - 聊天
   - [specs/plugins/task.md](./specs/plugins/task.md) - 任务管理

## 目录结构

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