# Task: Mock Process Engine

**任务 ID**: phase-1-task-005  
**状态**: ✅ 已完成  
**预估工时**: 12h  
**实际工时**: ~8h  
**优先级**: P1 (核心功能)

## 概述

实现一个轻量级的 Mock 流程引擎，用于支持本地闭环开发、插件测试和工作流编排。该引擎提供了工作流定义、任务执行、状态管理和 API 接口等核心功能。

## 目标

- ✅ 提供可扩展的流程执行引擎
- ✅ 支持顺序、并行、条件执行
- ✅ 完整的 REST API
- ✅ 前端服务层集成
- ✅ 开发者友好的文档和示例

## 技术方案

### 后端架构

```
┌─────────────────────────────────────┐
│   ProcessEngine (核心引擎)          │
│   - 流程定义注册                    │
│   - 实例管理                        │
│   - 任务调度                        │
│   - 依赖解析                        │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐      ┌────▼─────┐
│ Task   │      │ Process  │
│Executor│      │ Instance │
└────────┘      └──────────┘
```

### 核心组件

#### 1. 数据模型

- **ProcessDefinition**: 流程定义（id, name, tasks, variables）
- **TaskDefinition**: 任务定义（id, name, type, config, dependsOn, condition）
- **ProcessInstance**: 流程实例（运行时状态）
- **TaskInstance**: 任务实例（运行时状态）
- **ProcessStatus**: 流程状态枚举（PENDING, RUNNING, COMPLETED, FAILED, CANCELLED）
- **TaskStatus**: 任务状态枚举（PENDING, RUNNING, COMPLETED, FAILED, SKIPPED）

#### 2. 执行器

- **MockTaskExecutor**: 模拟任务执行
- **DelayTaskExecutor**: 延迟任务
- **LogTaskExecutor**: 日志输出
- **ScriptTaskExecutor**: 简单脚本执行（变量替换）

#### 3. 服务层

- **ProcessService**: 业务逻辑封装
- **ProcessHandler**: HTTP 请求处理

### 前端架构

```javascript
ProcessService (JavaScript)
├── startProcess(definitionId, variables)
├── getStatus(instanceId)
├── cancelProcess(instanceId)
├── listProcesses()
├── pollUntilComplete(instanceId, interval, onUpdate)
└── startAndWait(definitionId, variables, onUpdate)
```

## API 端点

### POST /api/local/process/start
启动新流程实例

**请求**:
```json
{
  "definitionId": "simple-sequential",
  "variables": {}
}
```

**响应**:
```json
{
  "success": true,
  "instanceId": "uuid"
}
```

### GET /api/local/process/{id}/status
获取流程状态

### POST /api/local/process/{id}/cancel
取消流程

### GET /api/local/process/list
列出所有流程

## 实现细节

### 依赖解析算法

1. 获取所有任务
2. 识别无依赖任务（或依赖已完成）
3. 并行执行可执行任务
4. 等待当前批次完成
5. 重复直到所有任务完成

### 条件执行

支持基于变量的简单条件：
- `${variableName}` - 检查变量是否存在且为 true
- 未来可扩展支持更复杂的表达式

### 线程模型

- 使用 CachedThreadPool（Java 17 兼容）
- 流程异步执行，不阻塞 HTTP 请求
- 任务根据依赖关系并行执行

## 文件清单

### Java 后端

```
src/java/core/process/
├── ProcessDefinition.java        # 流程定义
├── TaskDefinition.java           # 任务定义
├── ProcessInstance.java          # 流程实例
├── TaskInstance.java             # 任务实例
├── ProcessStatus.java            # 流程状态枚举
├── TaskStatus.java               # 任务状态枚举
├── ProcessEngine.java            # 核心引擎
├── TaskExecutor.java             # 执行器接口
├── MockTaskExecutor.java         # Mock 执行器
├── DelayTaskExecutor.java        # 延迟执行器
├── LogTaskExecutor.java          # 日志执行器
├── ScriptTaskExecutor.java       # 脚本执行器
└── ProcessEngineTest.java        # 单元测试

src/java/core/services/
└── ProcessService.java           # 服务层

src/java/core/server/handlers/
└── ProcessHandler.java           # HTTP 处理器
```

### JavaScript 前端

```
src/frontend/desktop/services/process/
├── process-service.js            # 前端服务
├── demo.html                     # 演示页面
└── README.md                     # 使用文档
```

### 测试

```
tests/unit/
└── process-service.test.html     # 集成测试
```

### 示例和文档

```
src/resources/processes/
├── data-processing.json          # 数据处理示例
└── user-onboarding.json          # 用户入职示例

docs/
└── process-engine.md             # 完整文档
```

## 测试

### 单元测试

```bash
# Java 测试（需要 Java 21）
cd src/java/core
javac process/*.java
java core.process.ProcessEngineTest
```

### 集成测试

1. 启动 Localverse 服务器
2. 打开 `tests/unit/process-service.test.html`
3. 查看测试结果

### 演示页面

1. 启动 Localverse 服务器
2. 打开 `src/frontend/desktop/services/process/demo.html`
3. 测试各种流程执行场景

## 内置流程定义

### 1. simple-sequential
简单顺序流程，三个任务依次执行。

### 2. parallel-tasks
并行任务流程，初始化后三个任务并行执行，最后汇总。

### 3. conditional-flow
条件流程，根据变量 `shouldExecute` 决定是否执行特定任务。

## 验收标准

- [x] 流程引擎核心功能完整
- [x] 支持顺序、并行、条件执行
- [x] HTTP API 完全实现
- [x] 前端服务层可用
- [x] 演示页面可运行
- [x] 文档完整清晰
- [x] 代码符合规范

## 已知限制

1. ⚠️ **不持久化** - 流程状态仅存储在内存中，服务器重启后丢失
2. ⚠️ **简单条件** - 条件表达式仅支持简单变量检查
3. ⚠️ **无子流程** - 不支持嵌套流程和子流程
4. ⚠️ **无定时器** - 不支持定时触发和延时触发
5. ⚠️ **Java 21** - 代码使用 Java 21 特性（Records），需要 Java 21 环境编译

## 未来改进

1. **持久化** - 将流程状态保存到 SQLite 数据库
2. **表达式引擎** - 集成 SpEL 或 JEXL 支持复杂条件
3. **子流程** - 支持流程嵌套和调用
4. **定时任务** - 支持 Cron 表达式和延时触发
5. **流程图可视化** - 提供图形化流程设计器
6. **监控面板** - 实时监控流程执行情况
7. **审计日志** - 记录所有流程操作历史

## 贡献者

- GitHub Copilot Agent

## 变更历史

- 2026-01-31: 完成初始实现
  - 核心引擎
  - HTTP API
  - 前端服务
  - 文档和示例

## 相关任务

- Phase 0 Task 006: 插件系统（依赖）
- Phase 1 Task 001: Frontend Core（依赖）
- 未来: 工作流插件（扩展）

## 参考资料

- [Activiti](https://www.activiti.org/) - BPMN 工作流引擎
- [Camunda](https://camunda.com/) - 企业级工作流平台
- [Temporal](https://temporal.io/) - 现代工作流引擎
