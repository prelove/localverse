# Localverse 快速开发指南

> 🚀 **5 分钟快速了解如何开始 Localverse 开发**

## 一句话总结

**Phase 0 必须线性完成（3周），Phase 1-2 可部分并行（5-7周），总计单人 4 个月或双人 3 个月完成。**

---

## 🎯 我该从哪里开始？

### 第一步：了解项目

```bash
# 1. 阅读项目背景（5分钟）
cat openspec/project.md

# 2. 阅读架构文档（15分钟）
cat openspec/specs/00-architecture.md

# 3. 阅读开发路线图（20分钟）
cat openspec/DEVELOPMENT-ROADMAP.md
```

### 第二步：开始第一个任务

```bash
# 阅读 Phase 0 第一个任务
cat openspec/tasks/phase-0/task-001-launcher.md

# 开始编码！
cd src/java/launcher/
```

---

## 📋 开发顺序速查

### Phase 0 - 基础设施 (68h, 必须线性)

```
☐ Task 001: Launcher 开发           [8h]  ← 从这里开始！
   ↓
☐ Task 002: Local JAR 服务          [16h]
   ↓
☐ Task 003: 通信层                  [12h]
   ↓
☐ Task 004: 数据库服务              [12h]
   ↓
☐ Task 005: 认证系统                [8h]
   ↓
☐ Task 006: 插件系统                [12h]
   ↓
✅ Phase 0 完成！
```

**⚠️ 重要**：Phase 0 任务不能跳过或并行，必须严格按顺序！

### Phase 1 - 核心应用 (52h, 部分并行)

```
Phase 0 完成后：

☐ Task 001: 前端核心框架            [16h]  ← 必须先做
   ↓
   ├─ ☐ Task 002: 搜索服务          [8h]   ← 可并行
   │     ↓
   │  ☐ Task 003: Finder 插件       [12h]
   │
   └─ ☐ Task 004: Wiki 插件         [16h]  ← 可并行（MVP核心）
```

**💡 提示**：单人按顺序，双人可并行搜索+Wiki

### Phase 2 - 同步服务 (72h, 部分并行)

```
☐ Task 001: Sync Server             [24h]  ← 必须先做
   ↓
☐ Task 002: Sync Engine              [20h]
   ↓
   ├─ ☐ Task 003: Chat 插件         [16h]  ← 可并行
   └─ ☐ Task 004: Task 插件         [12h]  ← 可并行
```

---

## 🎨 里程碑目标

### 🏁 里程碑 M0: 基础就绪 (3周)

**完成条件**：Phase 0 全部完成

**验收标准**：
- ✅ Launcher 可以启动 localverse.jar
- ✅ HTTP 服务器响应正常
- ✅ 数据库读写正常
- ✅ 用户可以登录
- ✅ 可以加载插件

**成果**：基础设施完整，可以开始开发应用

---

### 🏁 里程碑 M1: MVP 可用 (6周)

**完成条件**：Phase 0 + Phase 1 前端框架 + Wiki 插件

**验收标准**：
- ✅ M0 的所有标准
- ✅ 前端界面可以访问
- ✅ Wiki 插件可以创建、编辑、查看文档
- ✅ 支持 Markdown
- ✅ 数据本地存储

**成果**：单机版知识库系统可用

---

### 🏁 里程碑 M2: 协作版本 (12周)

**完成条件**：Phase 0 + Phase 1 + Phase 2

**验收标准**：
- ✅ M1 的所有标准
- ✅ 多设备可以同步数据
- ✅ 实时聊天可用
- ✅ 任务协作可用

**成果**：完整的协作系统

---

## ⏱️ 时间估算

### 单人全职开发

| 里程碑 | 累计时间 | 日历时间 |
|--------|----------|----------|
| M0: 基础 | 68h | 3周 |
| M1: MVP | 100h | 6周 |
| M2: 协作版 | 192h | 4个月 |

### 双人团队

| 里程碑 | 累计时间 | 日历时间 |
|--------|----------|----------|
| M0: 基础 | 68h | 3周 (单人) |
| M1: MVP | 100h | 4周 |
| M2: 协作版 | 192h | 3个月 |

### 三人团队

| 里程碑 | 累计时间 | 日历时间 |
|--------|----------|----------|
| M0: 基础 | 68h | 3周 (单人) |
| M1: MVP | 100h | 3周 |
| M2: 协作版 | 192h | 2.5个月 |

**💡 关键洞察**：Phase 0 无法并行加速，但 Phase 1-2 可以通过增加人手显著加速。

---

## 🔥 最常见问题

### Q: 我可以跳过 Phase 0 的某些任务吗？

**A**: ❌ 不可以！Phase 0 每个任务都依赖前一个，跳过会导致后续无法开发。

### Q: 我有 3 个开发者，如何安排？

**A**: 
- Week 1-3: 1人做 Phase 0，其他人做设计和规格审查
- Week 4+: 全员投入 Phase 1-2，按照路线图并行开发

### Q: 最快多久能看到可用产品？

**A**: 
- **内部预览**: Phase 0 完成后 (3周)
- **MVP 可用**: 再加 3周 (共 6周)
- **完整版**: 再加 6周 (共 3个月)

### Q: 我是 Java 新手，能做这个项目吗？

**A**: 
- ✅ 如果有其他语言经验：可以，预留 2-3周学习 Java 21
- ❌ 如果是编程新手：建议先学习基础，再参与开发

### Q: 我只想做前端，可以吗？

**A**: 
- ⚠️ Phase 0 需要 Java 后端技能
- ✅ Phase 1 开始后可以专注前端
- 建议：找一个后端开发者合作

### Q: 我想先做最有价值的功能？

**A**: 
1. **必须先做**: Phase 0 (无法跳过)
2. **最有价值**: Phase 1 前端框架 + Wiki 插件 (MVP)
3. **锦上添花**: Phase 2 同步功能 (协作)

---

## 🛠️ 开发环境要求

### 必需

- ✅ Java 21 JDK
- ✅ Maven 或 Gradle
- ✅ 现代浏览器 (Chrome/Firefox/Safari)
- ✅ Git

### 可选

- 🟡 SQLite 命令行工具 (调试数据库)
- 🟡 WebAssembly 工具链 (如果做 Light 模式)
- 🟡 VS Code + Java 插件

---

## 📚 学习资源

### Java 21 新特性

```java
// 虚拟线程
Thread.startVirtualThread(() -> {
    // 轻量级并发
});

// 记录类
record User(String id, String name) {}

// 模式匹配
if (obj instanceof String s) {
    System.out.println(s.length());
}
```

**学习资料**：
- [Java 21 Features](https://openjdk.org/projects/jdk/21/)
- [Virtual Threads Guide](https://openjdk.org/jeps/444)

### SQLite WASM

**学习资料**：
- [SQLite WASM 文档](https://sqlite.org/wasm/)
- 项目已包含完整集成示例

---

## 📞 需要帮助？

### 文档资源

- 📖 [完整开发路线图](./DEVELOPMENT-ROADMAP.md) - 详细规划
- 📖 [任务索引](./tasks/README.md) - 所有任务列表
- 📖 [架构设计](./specs/00-architecture.md) - 系统架构
- 📖 [文档地图](./DOCUMENT-MAP.md) - 文档导航

### 问题反馈

如果遇到问题或发现文档不清晰：

1. 在 `openspec/changes/current/` 创建问题记录
2. 提交 GitHub Issue
3. 联系项目维护者

---

## 🎯 今天就开始！

```bash
# 1. 克隆项目
git clone https://github.com/prelove/localverse.git
cd localverse

# 2. 阅读第一个任务
cat openspec/tasks/phase-0/task-001-launcher.md

# 3. 创建源代码目录
mkdir -p src/java/launcher

# 4. 开始编码！
# 参考任务文档中的实现步骤
```

---

**祝你开发顺利！** 🚀

如有疑问，随时参考完整的 [DEVELOPMENT-ROADMAP.md](./DEVELOPMENT-ROADMAP.md)。
