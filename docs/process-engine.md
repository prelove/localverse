# Mock Process Engine

## 概述

Mock Process Engine 是 Localverse 的轻量级工作流编排引擎，用于：

- **本地闭环开发**：在无需外部依赖的环境中测试工作流
- **插件测试**：为插件开发者提供可测试的流程执行环境
- **工作流演示**：展示系统的工作流编排能力
- **任务自动化**：自动化执行多步骤任务

## 特性

✅ **顺序执行** - 按依赖顺序执行任务  
✅ **并行执行** - 支持无依赖任务并行  
✅ **条件执行** - 基于变量的条件分支  
✅ **任务类型** - Mock、Delay、Log、Script 等内置类型  
✅ **状态管理** - 实时跟踪流程和任务状态  
✅ **错误处理** - 任务失败时的错误捕获  
✅ **可扩展** - 支持自定义任务执行器

## 架构

```
┌─────────────────────────────────────────┐
│         Frontend (Browser)              │
│  ┌───────────────────────────────────┐  │
│  │   ProcessService (JavaScript)     │  │
│  │   - startProcess()                │  │
│  │   - getStatus()                   │  │
│  │   - cancelProcess()               │  │
│  └───────────────┬───────────────────┘  │
└──────────────────┼──────────────────────┘
                   │ HTTP/JSON
┌──────────────────┼──────────────────────┐
│                  ↓                       │
│         Backend (Java)                   │
│  ┌───────────────────────────────────┐  │
│  │   ProcessHandler                  │  │
│  │   /api/local/process/*            │  │
│  └───────────────┬───────────────────┘  │
│                  ↓                       │
│  ┌───────────────────────────────────┐  │
│  │   ProcessService                  │  │
│  │   - Process definitions           │  │
│  │   - Instance management           │  │
│  └───────────────┬───────────────────┘  │
│                  ↓                       │
│  ┌───────────────────────────────────┐  │
│  │   ProcessEngine                   │  │
│  │   - Execution logic               │  │
│  │   - Dependency resolution         │  │
│  │   - Virtual threads               │  │
│  └───────────────┬───────────────────┘  │
│                  ↓                       │
│  ┌───────────────────────────────────┐  │
│  │   TaskExecutors                   │  │
│  │   - MockTaskExecutor              │  │
│  │   - DelayTaskExecutor             │  │
│  │   - LogTaskExecutor               │  │
│  │   - ScriptTaskExecutor            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## API 端点

### POST /api/local/process/start
启动新的流程实例。

**请求体**:
```json
{
  "definitionId": "simple-sequential",
  "variables": {
    "key": "value"
  }
}
```

**响应**:
```json
{
  "success": true,
  "instanceId": "uuid"
}
```

### GET /api/local/process/{instanceId}/status
获取流程实例状态。

**响应**:
```json
{
  "success": true,
  "process": {
    "instanceId": "uuid",
    "definitionId": "simple-sequential",
    "name": "Simple Sequential Process",
    "status": "RUNNING",
    "startTime": "2026-01-31T14:00:00Z",
    "endTime": null,
    "variables": {},
    "error": "",
    "tasks": [
      {
        "id": "task1",
        "name": "First Task",
        "type": "log",
        "status": "COMPLETED",
        "startTime": "2026-01-31T14:00:00Z",
        "endTime": "2026-01-31T14:00:01Z",
        "result": "Logged: First task executed",
        "error": ""
      }
    ]
  }
}
```

### POST /api/local/process/{instanceId}/cancel
取消运行中的流程。

**响应**:
```json
{
  "success": true,
  "message": "Process cancelled"
}
```

### GET /api/local/process/list
列出所有流程实例。

**响应**:
```json
{
  "success": true,
  "processes": [...]
}
```

## 流程定义格式

流程定义使用 JSON 格式：

```json
{
  "id": "process-id",
  "name": "Process Name",
  "description": "Process description",
  "version": "1.0.0",
  "tasks": [
    {
      "id": "task1",
      "name": "Task Name",
      "type": "mock",
      "config": {
        "duration": 1000,
        "result": "Task result"
      },
      "dependsOn": null,
      "condition": null
    },
    {
      "id": "task2",
      "name": "Second Task",
      "type": "log",
      "config": {
        "message": "Hello"
      },
      "dependsOn": ["task1"],
      "condition": "${shouldRun}"
    }
  ],
  "variables": {
    "shouldRun": true
  }
}
```

### 字段说明

- **id**: 流程定义唯一标识符
- **name**: 流程显示名称
- **description**: 流程描述
- **version**: 版本号
- **tasks**: 任务列表
  - **id**: 任务唯一标识符
  - **name**: 任务显示名称
  - **type**: 任务类型（mock, delay, log, script）
  - **config**: 任务配置参数
  - **dependsOn**: 依赖的任务 ID 列表
  - **condition**: 执行条件（变量表达式）
- **variables**: 初始变量

## 内置任务类型

### 1. Mock Task
模拟任务执行，用于测试。

**配置**:
```json
{
  "type": "mock",
  "config": {
    "duration": 1000,
    "successRate": 0.95,
    "result": "任意结果对象"
  }
}
```

### 2. Delay Task
延迟指定时间。

**配置**:
```json
{
  "type": "delay",
  "config": {
    "duration": 2000
  }
}
```

### 3. Log Task
输出日志消息。

**配置**:
```json
{
  "type": "log",
  "config": {
    "message": "日志消息",
    "level": "INFO"
  }
}
```

### 4. Script Task
执行简单的脚本（变量替换）。

**配置**:
```json
{
  "type": "script",
  "config": {
    "script": "处理 ${variable}",
    "outputVariable": "result"
  }
}
```

## 使用示例

### 前端 JavaScript

```javascript
// 创建服务实例
const processService = new ProcessService();

// 启动流程
const instanceId = await processService.startProcess('simple-sequential');

// 监控进度
const process = await processService.pollUntilComplete(
  instanceId,
  500,
  (updated) => {
    const progress = ProcessService.calculateProgress(updated);
    console.log(`进度: ${progress}%`);
  }
);

console.log('完成:', process.status);
```

### Java 后端

```java
// 创建流程定义
ProcessDefinition definition = new ProcessDefinition(
    "my-process",
    "My Process",
    "Description",
    "1.0.0",
    List.of(
        new TaskDefinition("task1", "First", "mock", 
            Map.of("duration", 500), null, null)
    ),
    Map.of()
);

// 注册并启动
ProcessEngine engine = new ProcessEngine();
engine.registerDefinition(definition);
String instanceId = engine.startProcess("my-process", Map.of());

// 查询状态
ProcessInstance instance = engine.getProcessInstance(instanceId);
System.out.println("Status: " + instance.getStatus());
```

## 演示页面

访问 `/src/frontend/desktop/services/process/demo.html` 查看交互式演示。

演示功能：
- 启动三种预置流程
- 实时查看流程状态
- 查看任务执行进度
- 取消运行中的流程
- 控制台日志输出

## 扩展开发

### 自定义任务执行器

```java
public class MyTaskExecutor implements TaskExecutor {
    @Override
    public Object execute(TaskInstance task, ProcessInstance process) 
            throws Exception {
        // 自定义逻辑
        String param = (String) task.getConfig().get("param");
        
        // 执行任务
        Object result = doWork(param);
        
        return result;
    }
}

// 注册执行器
processEngine.registerExecutor("mytype", new MyTaskExecutor());
```

### 加载外部流程定义

```java
// 从 JSON 文件加载
String json = Files.readString(Path.of("process.json"));
Map<String, Object> data = JsonUtil.fromJson(json);

ProcessDefinition definition = new ProcessDefinition(
    (String) data.get("id"),
    (String) data.get("name"),
    // ...
);

engine.registerDefinition(definition);
```

## 性能特性

- **虚拟线程**: 使用 Java 21 虚拟线程，支持大量并发流程
- **异步执行**: 流程在后台异步执行，不阻塞 HTTP 请求
- **并行优化**: 无依赖任务自动并行执行
- **内存高效**: 使用 ConcurrentHashMap 管理实例状态

## 限制与约束

- ⚠️ Mock 实现，不持久化流程状态
- ⚠️ 条件表达式仅支持简单变量检查
- ⚠️ 不支持子流程和循环
- ⚠️ 不支持定时触发
- ⚠️ 内存中存储，重启后丢失

## 未来扩展

- 持久化到数据库
- 支持复杂表达式引擎
- 子流程和循环支持
- 定时任务调度
- 流程版本管理
- 流程监控和审计

## 相关文档

- [Frontend Process Service](../src/frontend/desktop/services/process/README.md)
- [Process Definition Examples](../src/resources/processes/)
- [API Documentation](./API.md)
