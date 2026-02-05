# Localverse 快速开发指南

> 🚀 **5 分钟快速了解 Localverse 开发现状和如何参与**

## 📊 项目当前状态 (2026-01-31)

**Phase 0 基础设施**: 83% 完成 🟢

- ✅ Task 001: Launcher (启动器) - 已完成
- ✅ Task 002: Local JAR (核心服务) - 已完成
- ✅ Task 003: 通信层 (5级降级) - 已完成
- ✅ Task 004: 数据库 (三模式) - 已完成
- ✅ Task 005: 认证系统 - 已完成 (2026-01-31)
- ⏳ Task 006: 插件系统 - 开发中

**预计完成**: Phase 0 将于 2026-02-05 完成 (剩余 12h 工作量)

---

## 🎯 如果你想参与开发

### 当前可以做的事

1. **完成 Phase 0 Task 006** (插件系统) - 最优先
   - 阅读: [tasks/phase-0/task-006-plugin-system.md](tasks/phase-0/task-006-plugin-system.md)
   - 阅读: [specs/08-plugin-system.md](specs/08-plugin-system.md)
   - 预计时间: 12小时

2. **准备 Phase 1 开发** - Phase 0 完成后立即启动
   - 阅读: [tasks/phase-1/task-001-frontend-core.md](tasks/phase-1/task-001-frontend-core.md)
   - 阅读: [specs/09-frontend-core.md](specs/09-frontend-core.md)

3. **代码审查和测试** - 随时可以做
   - 查看已完成任务的实现: `src/java/`, `src/frontend/`
   - 运行单元测试: 浏览器打开 `tests/unit/*/test-runner.html`
   - 提出改进建议

### 快速上手步骤

```bash
# 1. 克隆项目
git clone https://github.com/prelove/localverse.git
cd localverse

# 2. 阅读核心文档 (30分钟)
cat README.md                           # 项目概览
cat AGENTS.md                           # AI开发指南
cat openspec/DEVELOPMENT-ROADMAP.md     # 开发路线图

# 3. 了解已完成的实现 (15分钟)
cat docs/IMPLEMENTATION_SUMMARY.md      # 实现总结
cat docs/local-jar.md                   # API文档

# 4. 开始下一个任务
cat openspec/tasks/phase-0/task-006-plugin-system.md

# 5. 构建和运行
mvn clean package
java -jar dist/localverse.jar
```

---

## 📋 开发顺序速查

### Phase 0 - 基础设施 (68h, 83% 完成)

```
✅ Task 001: Launcher 开发           [8h]  已完成 ✓
   ↓
✅ Task 002: Local JAR 服务          [16h] 已完成 ✓
   ↓
✅ Task 003: 通信层                  [12h] 已完成 ✓
   ↓
✅ Task 004: 数据库服务              [12h] 已完成 ✓
   ↓
✅ Task 005: 认证系统                [8h]  已完成 ✓
   ↓
⏳ Task 006: 插件系统                [12h] 开发中 ← 当前任务
   ↓
🎯 Phase 0 完成！解锁 Phase 1 & 2
```

**⚠️ 重要**：Phase 0 任务必须严格按顺序，不能跳过或并行。

**✅ 已完成功能**:
- 启动器 (崩溃恢复、热更新)
- HTTP/WebSocket 服务 (端口 8765/8766)
- 5级通信降级 (WebSocket → HTTP)
- 三模式数据库 (JDBC/WASM/IndexedDB)
- 认证系统 (设备指纹 + Token)

### Phase 1 - 核心应用 (52h, 部分并行) - 待开发

```
⏳ Phase 0 完成后启动：

☐ Task 001: 前端核心框架            [16h]  ← 必须先做
   ↓
   ├─ ☐ Task 002: 搜索服务          [8h]   ← 可并行
   │     ↓
   │  ☐ Task 003: Finder 插件       [12h]
   │
   └─ ☐ Task 004: Wiki 插件         [16h]  ← 可并行（MVP核心）

🎯 完成前端框架 + Wiki = MVP 版本可用
```

**💡 提示**：单人按顺序，双人可并行搜索+Wiki

### Phase 2 - 同步服务 (72h, 部分并行) - 待开发

```
☐ Task 001: Sync Server             [24h]  ← 必须先做
   ↓
☐ Task 002: Sync Engine              [20h]
   ↓
   ├─ ☐ Task 003: Chat 插件         [16h]  ← 可并行
   └─ ☐ Task 004: Task 插件         [12h]  ← 可并行

🎯 完成 Phase 2 = 多设备协作版本
```
☐ Task 002: Sync Engine              [20h]
   ↓
   ├─ ☐ Task 003: Chat 插件         [16h]  ← 可并行
   └─ ☐ Task 004: Task 插件         [12h]  ← 可并行
```

---

## 🎨 里程碑目标

### 🏁 里程碑 M0: 基础就绪

**状态**: ⏳ 进行中 (83% 完成)  
**预计完成**: 2026-02-05

**完成条件**：Phase 0 全部完成

**验收标准**：
- [x] Launcher 可以启动 localverse.jar
- [x] HTTP 服务器响应正常
- [x] WebSocket 连接稳定
- [x] 数据库读写正常 (三模式)
- [x] 用户可以登录和认证
- [ ] 可以加载和管理插件 (开发中)

**成果**：基础设施完整，可以开始开发应用

---

### 🏁 里程碑 M1: MVP 可用

**状态**: ⏳ 待开始  
**预计完成**: 2026-02-20

**完成条件**：Phase 0 + Phase 1 前端框架 + Wiki 插件

**验收标准**：
- [ ] M0 的所有标准
- [ ] 前端界面可以访问
- [ ] Wiki 插件可以创建、编辑、查看文档
- [ ] 支持 Markdown
- [ ] 数据本地存储

**成果**：单机版知识库系统可用

---

### 🏁 里程碑 M2: 协作版本

**状态**: ⏳ 待开始  
**预计完成**: 2026-04-01

**完成条件**：Phase 0 + Phase 1 + Phase 2

**验收标准**：
- [ ] M1 的所有标准
- [ ] 多设备可以同步数据
- [ ] 实时聊天可用
- [ ] 任务协作可用

**成果**：完整的企业协作系统

---

## ⏱️ 时间估算

### 实际进度 vs 预期

| 里程碑 | 预期时间 | 实际进度 | 状态 |
|--------|----------|----------|------|
| M0: 基础 | 68h (3周) | 56h/68h (82%) | ⏳ 超预期 |
| M1: MVP | 100h (6周) | - | ⏳ 待开始 |
| M2: 协作版 | 192h (4个月) | - | ⏳ 待开始 |

**🎉 好消息**: Phase 0 实际开发速度超预期 100%+，质量优秀！

### 单人全职开发

| 里程碑 | 累计时间 | 预计完成日期 |
|--------|----------|--------------|
| M0: 基础 | 68h | 2026-02-05 |
| M1: MVP | 100h | 2026-02-20 |
| M2: 协作版 | 192h | 2026-04-01 |

### 双人团队 (Phase 1+ 可并行)

| 里程碑 | 累计时间 | 预计完成日期 |
|--------|----------|--------------|
| M0: 基础 | 68h (单人) | 2026-02-05 |
| M1: MVP | ~80h | 2026-02-15 |
| M2: 协作版 | ~150h | 2026-03-20 |

**💡 关键洞察**：Phase 0 无法并行加速，但 Phase 1-2 可以通过增加人手显著加速 (节约 30-40% 时间)。

---

## 🔥 最常见问题

### Q: 项目现在可以运行吗？
A: 可以！已经完成 5/6 的 Phase 0 任务。你可以：
- ✅ 启动 HTTP/WebSocket 服务
- ✅ 测试通信层 (5级降级)
- ✅ 使用数据库服务 (三模式)
- ✅ 测试认证系统
- ⏳ 插件系统开发中

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
