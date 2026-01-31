# Localverse

内网环境的轻量级协作平台。

## 特性

- 🔌 **离线优先** - 核心功能无需网络
- 📦 **本地数据** - 数据存储在用户设备
- 🔄 **可选同步** - 通过内网服务器多设备同步
- 🧩 **插件化** - 功能模块化，按需加载

## 快速开始

### 开发者

```bash
# 快速入门（5分钟了解开发流程）
cat openspec/QUICK-START-GUIDE.md

# 详细规划（完整开发路线图）
cat openspec/DEVELOPMENT-ROADMAP.md

# 查看所有规格文档
cd openspec
cat README.md
```

### 用户

下载 localverse.jar，双击运行，浏览器访问 http://127.0.0.1:8765

## 文档

- 🚀 [快速开发指南](./openspec/QUICK-START-GUIDE.md) - 5分钟快速入门
- 📘 [开发路线图](./openspec/DEVELOPMENT-ROADMAP.md) - 完整开发规划
- 📖 [项目规格](./openspec/specs/) - 技术规格文档
- 📋 [开发任务](./openspec/tasks/) - 分阶段任务清单
- 🏗️ [架构设计](./openspec/specs/00-architecture.md) - 系统架构
## 技术栈

- **后端**: Java 21 (虚拟线程、记录类)
- **前端**: HTML5 + CSS3 + ES2022 (原生，无框架)
- **数据库**: SQLite (WASM + JDBC)
- **通信**: WebSocket / HTTP
- **构建**: Maven

## 项目结构

```
localverse/
├── openspec/       # 规格文档（AI 和人类都可读）
│   ├── QUICK-START-GUIDE.md      # 快速开发指南
│   ├── DEVELOPMENT-ROADMAP.md    # 完整开发路线图
│   ├── specs/      # 技术规格
│   └── tasks/      # 开发任务
├── src/            # 源代码
│   ├── java/       # Java 后端
│   ├── frontend/   # 前端代码
│   └── wasm/       # WASM 模块
├── dist/           # 构建产物
└── docs/           # 用户文档
```

## License

MIT

### 📄 根目录 AGENTS.md（AI 开发指南）

```markdown name=AGENTS.md
# AI 开发指南

本项目设计为 AI 可理解和实现的项目。

## 文档入口

1. **先读这个**: `openspec/README.md`
2. **了解架构**: `openspec/specs/00-architecture.md`
3. **查看任务**: `openspec/tasks/README.md`

## 开发顺序

Phase 0 (基础设施) → Phase 1 (核心应用) → Phase 2 (同步)

Code

**必须按顺序完成 Phase 0，后续可并行。**

## 任务执行

每个任务文档 (`tasks/phase-*/task-*.md`) 包含：
- 目标和范围
- 详细实现步骤
- 代码示例
- 测试要点
- 验收标准

## 代码规范

- Java: 标准 Java 命名规范
- JavaScript: ES2022，无框架
- 注释: 关键逻辑必须有注释

## 提交规范

<type>: <description>

type: feat|fix|docs|refactor|test

Code

## 问题反馈

如果规格文档有歧义或缺失，在 `openspec/changes/current/` 创建问题记录。
3. 完整性最终确认
✅ 核心基础设施文档：完整
类别	文件数	状态
核心规格	11	✅
服务接口	3	✅
插件规格	4	✅
Phase 0 任务	6	✅
Phase 1 任务	1	✅
Phase 2 任务	2	✅
索引/导航	5	✅