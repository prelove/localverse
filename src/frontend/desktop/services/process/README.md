# Process Service

前端流程引擎服务，用于与后端 Process Engine 通信。

## 功能

- 启动流程实例
- 查询流程状态
- 取消运行中的流程
- 列出所有流程
- 轮询等待流程完成
- 事件监听

## 使用示例

### 启动流程

```javascript
const processService = new ProcessService();

// 启动一个简单的顺序流程
const instanceId = await processService.startProcess('simple-sequential');
console.log('Process started:', instanceId);
```

### 查询状态

```javascript
const process = await processService.getStatus(instanceId);
console.log('Process status:', process.status);
console.log('Tasks:', process.tasks);
```

### 启动并等待完成

```javascript
const process = await processService.startAndWait(
  'simple-sequential',
  {},
  (updatedProcess) => {
    console.log('Progress:', ProcessService.calculateProgress(updatedProcess) + '%');
  }
);

console.log('Process completed:', process.status);
```

### 取消流程

```javascript
const cancelled = await processService.cancelProcess(instanceId);
console.log('Cancelled:', cancelled);
```

### 列出所有流程

```javascript
const processes = await processService.listProcesses();
processes.forEach(p => {
  console.log(`${p.instanceId}: ${p.name} - ${p.status}`);
});
```

## API

### `startProcess(definitionId, variables)`

启动新的流程实例。

- **definitionId**: 流程定义 ID
- **variables**: 初始变量（可选）
- **返回**: Promise<string> - 流程实例 ID

### `getStatus(instanceId)`

获取流程状态。

- **instanceId**: 流程实例 ID
- **返回**: Promise<Object> - 流程实例数据

### `cancelProcess(instanceId)`

取消运行中的流程。

- **instanceId**: 流程实例 ID
- **返回**: Promise<boolean> - 是否成功取消

### `listProcesses()`

列出所有流程实例。

- **返回**: Promise<Array> - 流程实例数组

### `pollUntilComplete(instanceId, interval, onUpdate)`

轮询直到流程完成。

- **instanceId**: 流程实例 ID
- **interval**: 轮询间隔（毫秒，默认 500）
- **onUpdate**: 状态更新回调（可选）
- **返回**: Promise<Object> - 最终流程状态

### `startAndWait(definitionId, variables, onUpdate)`

启动并等待流程完成。

- **definitionId**: 流程定义 ID
- **variables**: 初始变量（可选）
- **onUpdate**: 状态更新回调（可选）
- **返回**: Promise<Object> - 最终流程状态

### Static Methods

#### `ProcessService.formatTaskStatus(task)`

格式化任务状态显示。

#### `ProcessService.calculateProgress(process)`

计算流程进度百分比（0-100）。

## 内置流程定义

后端已预置以下流程定义：

### 1. simple-sequential

简单顺序流程，三个任务依次执行。

### 2. parallel-tasks

并行任务流程，多个任务同时执行。

### 3. conditional-flow

条件流程，根据变量决定是否执行任务。
