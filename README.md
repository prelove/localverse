# Localverse OS 2.0

内网环境的轻量级协作平台 - 企业级浏览器操作系统。

## 项目状态

🚧 **开发中** | Phase 0 基础设施 83% 完成 (5/6 任务)

| 阶段 | 进度 | 状态 |
|------|------|------|
| Phase 0: 基础设施 | 83% | 🟢 进行中 |
| Phase 1: 核心应用 | 0% | ⏳ 等待中 |
| Phase 2: 协作功能 | 0% | ⏳ 等待中 |

详见 [开发路线图](./openspec/DEVELOPMENT-ROADMAP.md)

## 特性

- 🔌 **离线优先** - 核心功能无需网络
- 📦 **本地数据** - 数据存储在用户设备
- 🔄 **可选同步** - 通过内网服务器多设备同步
- 🧩 **插件化** - 功能模块化，按需加载
- 🔐 **安全认证** - 设备指纹 + Token 双重保护
- 💾 **三模式数据库** - JDBC/WASM/IndexedDB 自适应

## 快速开始

### 开发者

```bash
# 快速入门（5分钟了解开发流程）
cat openspec/QUICK-START-GUIDE.md

# 详细规划（完整开发路线图）
cat openspec/DEVELOPMENT-ROADMAP.md

# 查看所有规格文档
cd openspec && cat README.md

# 查看实现状态
cat docs/IMPLEMENTATION_SUMMARY.md
```

### 用户

> ⚠️ **注意**: 项目当前处于开发阶段，尚未发布稳定版本。

**系统要求**:
- Java 21 或更高版本
- 现代浏览器 (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)

**运行方式**:
```bash
# 下载 localverse.jar
java -jar localverse.jar

# 浏览器访问
open http://127.0.0.1:8765
```

## 构建

### 前置要求
- Java 21 (推荐使用 OpenJDK 21)
- Maven 3.8+
- Git

### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/prelove/localverse.git
cd localverse

# 使用 Maven 构建
mvn clean package

# 或使用构建脚本
./build/build-localverse.sh

# 构建产物位于 dist/ 目录
ls -la dist/
```

### 构建产物
- `dist/localverse.jar` - 核心服务 (约 5MB)
- `dist/launcher.jar` - 启动器 (< 20KB)
- `dist/config/` - 配置模板

## 文档

- 📊 **[项目状态评估](./READINESS-SUMMARY.md)** - 当前可运行状态分析（详细版：[完整评估报告](./openspec/PROJECT-READINESS-ASSESSMENT.md)）
### 入门文档
- 🚀 [快速开发指南](./openspec/QUICK-START-GUIDE.md) - 5分钟快速入门
- 📘 [开发路线图](./openspec/DEVELOPMENT-ROADMAP.md) - 完整开发规划
- 🤖 [AI 开发指南](./AGENTS.md) - AI Agent 使用说明

### 技术文档
- 🏗️ [系统架构](./openspec/specs/00-architecture.md) - 三层架构设计
- 📖 [技术规格](./openspec/specs/) - 所有组件规格
- 📋 [开发任务](./openspec/tasks/) - 分阶段任务清单
- 📊 [实现状态](./docs/IMPLEMENTATION_SUMMARY.md) - 当前实现情况

### API 文档
- 🔌 [Local JAR API](./docs/local-jar.md) - HTTP/WebSocket 接口
- 🔐 [认证系统](./src/frontend/desktop/services/auth/README.md) - 认证 API
- 💬 [通信层](./src/frontend/desktop/services/comm/README.md) - 通信 API
## 技术栈

### 后端
- **语言**: Java 21 (虚拟线程、记录类、模式匹配)
- **服务器**: JDK HttpServer + Java-WebSocket
- **数据库**: SQLite JDBC 3.45+
- **构建**: Maven 3.8+ (Shade Plugin)

### 前端
- **语言**: ES2022 (原生，零依赖)
- **样式**: CSS3 (CSS 变量 + Grid + Flexbox)
- **数据库**: SQLite WASM / IndexedDB
- **通信**: WebSocket / SSE / HTTP (5级降级)

### 核心特性
- ✅ 无框架依赖 (Spring Boot ❌)
- ✅ 无构建工具 (npm/webpack ❌)
- ✅ 离线运行 (完全独立)
- ✅ 跨平台 (Windows/Mac/Linux)

## 项目结构

```
localverse/
├── README.md                      # 项目说明 (本文件)
├── AGENTS.md                      # AI 开发指南
├── LICENSE                        # MIT 许可证
├── pom.xml                        # Maven 构建配置
│
├── openspec/                      # 📋 规格文档 (设计驱动开发)
│   ├── README.md                  # 文档总览
│   ├── QUICK-START-GUIDE.md       # 5分钟快速入门
│   ├── DEVELOPMENT-ROADMAP.md     # 完整开发路线图
│   ├── DOCUMENT-MAP.md            # 文档地图
│   ├── specs/                     # 技术规格 (11个组件)
│   │   ├── 00-architecture.md     # 系统架构 ⭐
│   │   ├── 01-launcher.md         # 启动器 ✅
│   │   ├── 02-local-jar.md        # Local JAR ✅
│   │   ├── 03-sync-server.md      # Sync Server ⏳
│   │   ├── 04-communication.md    # 通信层 ✅
│   │   ├── 05-database.md         # 数据库 ✅
│   │   ├── 06-authentication.md   # 认证 ✅
│   │   ├── 07-sync-engine.md      # 同步引擎 ⏳
│   │   ├── 08-plugin-system.md    # 插件系统 ⏳
│   │   ├── 09-frontend-core.md    # 前端核心 ⏳
│   │   ├── 10-mobile.md           # 移动端 ⏳
│   │   ├── services/              # 服务规格
│   │   └── plugins/               # 插件规格
│   └── tasks/                     # 开发任务 (18个)
│       ├── README.md              # 任务总览
│       ├── phase-0/               # 基础设施 (6任务, 5完成)
│       ├── phase-1/               # 核心应用 (1任务)
│       └── phase-2/               # 协作功能 (2任务)
│
├── src/                           # 💻 源代码
│   ├── java/                      # Java 后端
│   │   ├── launcher/              # 启动器 ✅ (~600 行)
│   │   │   ├── Launcher.java
│   │   │   ├── ProcessManager.java
│   │   │   ├── VersionManager.java
│   │   │   └── utils/
│   │   └── core/                  # 核心服务 ✅ (~2500 行)
│   │       ├── Main.java
│   │       ├── config/            # 配置系统
│   │       ├── server/            # HTTP & WebSocket
│   │       ├── services/          # 业务服务
│   │       ├── models/            # 数据模型
│   │       └── utils/             # 工具类
│   │
│   ├── frontend/                  # 前端代码
│   │   └── desktop/               # 桌面端 ✅ (~3000 行)
│   │       ├── index.html         # 入口页面
│   │       ├── app.js             # 应用入口
│   │       ├── core/              # 核心框架 ✅
│   │       │   ├── app.js
│   │       │   ├── router.js
│   │       │   ├── state.js
│   │       │   ├── theme.js
│   │       │   └── i18n.js
│   │       ├── components/        # UI组件 ✅
│   │       │   ├── sidebar.js
│   │       │   ├── header.js
│   │       │   ├── modal.js
│   │       │   └── toast.js
│   │       ├── services/          # 服务层
│   │       │   ├── comm/          # 通信层 ✅
│   │       │   ├── database/      # 数据库 ✅
│   │       │   ├── auth/          # 认证 ✅
│   │       │   └── search/        # 搜索 ✅
│   │       └── assets/            # 静态资源
│   │
│   ├── wasm/                      # WASM 模块 (待实现)
│   ├── resources/                 # 资源文件
│   │   └── config/                # 配置模板
│   └── scripts/                   # 辅助脚本
│
├── build/                         # 🔧 构建脚本
│   ├── build-core.sh              # 构建核心
│   ├── build-launcher.sh          # 构建启动器
│   └── build-localverse.sh        # 完整构建
│
├── docs/                          # 📖 补充文档
│   ├── IMPLEMENTATION_SUMMARY.md  # 实现总结
│   ├── local-jar.md               # API 文档
│   └── phase-0-task-*-summary.md  # 任务总结
│
├── tests/                         # 🧪 测试
│   └── unit/                      # 单元测试
│       ├── auth/                  # 认证测试 ✅
│       └── database/              # 数据库测试 ✅
│
└── dist/                          # 📦 构建产物 (gitignored)
    ├── localverse.jar             # 核心服务 (~5MB)
    ├── launcher.jar               # 启动器 (<20KB)
    └── config/                    # 配置文件

图例: ✅ 已实现 | ⏳ 待实现 | ⭐ 关键文档
```

## 已实现功能

### ✅ Phase 0: 基础设施 (83% 完成)

#### Task 001: Launcher (完成)
- 轻量级启动器 (<20KB)
- 崩溃检测与自动回滚
- 版本管理与备份
- 跨平台支持

#### Task 002: Local JAR Service (完成)
- HTTP 服务器 (端口 8765)
- WebSocket 服务器 (端口 8766)
- 数据库服务 (SQLite JDBC)
- 文件系统服务 (安全验证)
- 代理转发服务
- 搜索服务

#### Task 003: 通信层 (完成)
- 5级自动降级 (WS → SSE → 长轮询 → 短轮询 → HTTP)
- 自动重连 (指数退避)
- 离线消息队列
- 心跳机制

#### Task 004: 数据库服务 (完成)
- Full 模式 (SQLite JDBC via JAR)
- Light 模式 (SQLite WASM + IndexedDB)
- Pure 模式 (IndexedDB only)
- 自动检测与降级

#### Task 005: 认证系统 (完成)
- 设备指纹 (Canvas + WebGL)
- Token 管理 (HMAC-SHA256)
- 角色权限 (Admin/User/Guest)
- 首次配置界面

#### Task 006: 插件系统 (待开发)
- 插件加载器
- 生命周期管理
- 事件总线
- 权限管理

### ⏳ 待开发功能

- **Phase 1**: 前端核心框架、Wiki 插件、Finder 插件
- **Phase 2**: Sync Server、Sync Engine、Chat 插件、Task 插件
- **Phase 3**: 移动端支持、投票插件、日历插件、公告系统

## 开发指南

### 贡献代码
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -am 'feat: add xxx'`)
4. 推送分支 (`git push origin feature/xxx`)
5. 创建 Pull Request

### 提交规范
```
<type>: <description>

type: feat|fix|docs|refactor|test|chore
```

### 代码规范
- **Java**: 标准 Java 命名规范，4空格缩进
- **JavaScript**: ES2022+，无框架，2空格缩进
- **注释**: 关键逻辑必须有中文注释

## 常见问题

### Q: 为什么不使用 Spring Boot?
A: 为了保持轻量和离线优先，避免重型框架依赖。

### Q: 为什么不使用 React/Vue?
A: 为了减少构建复杂度，保持代码简单可读，降低 AI 理解成本。

### Q: 如何运行测试?
A: 在浏览器中打开 `tests/unit/*/test-runner.html`

### Q: 支持哪些浏览器?
A: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+

### Q: 如何参与开发?
A: 阅读 [AGENTS.md](./AGENTS.md) 和 [开发路线图](./openspec/DEVELOPMENT-ROADMAP.md)

## License

MIT © 2026 Localverse Team

## 联系方式

- 📧 Issues: [GitHub Issues](https://github.com/prelove/localverse/issues)
- 📖 文档: [openspec/](./openspec/)
- 💬 讨论: [GitHub Discussions](https://github.com/prelove/localverse/discussions)