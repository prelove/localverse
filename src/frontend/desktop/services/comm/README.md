# Communication Layer

前端通信抽象层，提供统一的消息收发接口，支持五级自动降级、离线队列、断线重连。

## 特性

- ✅ **五级自动降级**：WebSocket → SSE → 长轮询 → 短轮询 → 离线
- ✅ **离线消息队列**：IndexedDB 持久化，自动重试，断网同步
- ✅ **断线自动重连**：指数退避策略，可配置重试次数
- ✅ **心跳机制**：定期检测连接状态，计算网络延迟
- ✅ **事件驱动**：基于 EventTarget 的原生事件系统
- ✅ **纯 ES2022**：无外部依赖，兼容现代浏览器

## 快速开始

### 基本使用

```javascript
import { CommunicationLayer } from './comm/index.js';

// 创建实例
const comm = new CommunicationLayer({
  serverUrl: 'http://127.0.0.1:8765',
  autoReconnect: true,
  reconnectInterval: 5000,
  heartbeatInterval: 30000
});

// 连接
await comm.connect();

// 监听消息
comm.on('chat', (event) => {
  console.log('收到聊天消息:', event.detail);
});

// 发送消息
await comm.send({
  type: 'event',
  action: 'chat',
  payload: { message: '你好' }
});

// 发送并等待响应
const response = await comm.sendAndWait({
  type: 'data',
  action: 'query',
  payload: { sql: 'SELECT * FROM users' }
}, 5000);

console.log('查询结果:', response.payload);
```

## 传输层级

| 级别 | 传输方式 | 条件 | 延迟 | 说明 |
|------|----------|------|------|------|
| 1 | WebSocket | WS 连接成功 | <100ms | 双向实时 |
| 2 | SSE + HTTP | SSE 连接成功 | <500ms | 下行实时，上行延迟 |
| 3 | 长轮询 | HTTP 可用 | <30s | 30秒长连接 |
| 4 | 短轮询 | HTTP 可用 | <5s | 每5秒轮询 |
| 5 | 离线 | 网络不可用 | N/A | 本地队列 |

## API 文档

### CommunicationLayer

#### 构造函数

```javascript
new CommunicationLayer(options)
```

**参数：**
- `serverUrl` (string): 服务器地址，默认 `http://127.0.0.1:8765`
- `autoReconnect` (boolean): 自动重连，默认 `true`
- `reconnectInterval` (number): 重连间隔（毫秒），默认 `5000`
- `maxReconnectAttempts` (number): 最大重连次数，默认 `10`
- `heartbeatInterval` (number): 心跳间隔（毫秒），默认 `30000`
- `messageTimeout` (number): 消息超时（毫秒），默认 `30000`

#### 连接管理

**`connect()`**  
连接到服务器，自动尝试最佳传输方式。

```javascript
await comm.connect();
```

**`disconnect()`**  
断开连接。

```javascript
comm.disconnect();
```

**`reconnect()`**  
手动重连。

```javascript
await comm.reconnect();
```

#### 状态查询

**`getState()`**  
获取当前连接状态。

```javascript
const state = comm.getState();
// {
//   status: 'connected',
//   transport: 'websocket',
//   latency: 45,
//   lastConnectedAt: 1709888888000,
//   lastDisconnectedAt: null,
//   reconnectAttempts: 0
// }
```

**`getTransport()`**  
获取当前传输方式。

```javascript
const transport = comm.getTransport(); // 'websocket' | 'sse' | 'long-polling' | 'short-polling' | 'offline'
```

**`getLatency()`**  
获取当前网络延迟（毫秒）。

```javascript
const latency = comm.getLatency(); // 45
```

**`isOnline()`**  
检查是否在线。

```javascript
if (comm.isOnline()) {
  console.log('已连接');
}
```

#### 消息发送

**`send(message)`**  
发送消息。离线时自动入队。

```javascript
await comm.send({
  type: 'event',
  action: 'chat',
  payload: { room: 'dev', content: '大家好' }
});
```

**`sendAndWait(message, timeout)`**  
发送消息并等待响应。

```javascript
const response = await comm.sendAndWait({
  type: 'data',
  action: 'query',
  payload: { sql: 'SELECT * FROM tasks' }
}, 5000);
```

#### 事件监听

**`on(event, handler)`**  
注册事件处理器。

```javascript
comm.on('chat', (event) => {
  console.log('收到聊天:', event.detail);
});
```

**`off(event, handler)`**  
移除事件处理器。

```javascript
const handler = (event) => { /* ... */ };
comm.on('message', handler);
comm.off('message', handler);
```

**`once(event, handler)`**  
注册一次性事件处理器。

```javascript
comm.once('connected', (event) => {
  console.log('首次连接成功');
});
```

#### 离线队列

**`getPendingCount()`**  
获取待发送消息数量。

```javascript
const count = await comm.getPendingCount();
console.log(`待发送: ${count} 条`);
```

**`getPendingMessages()`**  
获取所有待发送消息。

```javascript
const messages = await comm.getPendingMessages();
```

**`retryPending()`**  
手动重试待发送消息。

```javascript
await comm.retryPending();
```

**`clearPending()`**  
清空待发送队列。

```javascript
await comm.clearPending();
```

## 事件列表

### 连接事件

- `connected` - 连接成功
- `disconnected` - 断开连接
- `offline` - 进入离线模式
- `connection_state` - 连接状态变化

### 消息事件

- `message` - 收到任何消息
- `{action}` - 收到特定 action 的消息（如 `chat`、`query`）
- `{type}` - 收到特定类型的消息（如 `command`、`event`、`data`、`ack`）

### 其他事件

- `heartbeat` - 心跳响应
- `error` - 发生错误

## 消息格式

```typescript
interface Message {
  id: string;              // 消息 ID
  type: MessageType;       // command | event | data | ack
  action: string;          // 具体动作
  payload: any;            // 数据载荷
  timestamp: number;       // Unix 时间戳（毫秒）
  from?: string;           // 发送方 ID
  to?: string;             // 接收方 ID
  replyTo?: string;        // 回复目标消息 ID
  priority?: Priority;     // normal | high | urgent
  ttl?: number;            // 消息有效期（秒）
}
```

## 重试策略

消息发送失败时，会自动加入队列并使用指数退避策略重试：

| 重试次数 | 延迟 |
|---------|------|
| 第1次 | 1秒 |
| 第2次 | 2秒 |
| 第3次 | 4秒 |
| 第4次 | 8秒 |
| 第5次 | 16秒 |
| 失败 | 标记为失败 |

### 重试条件

- ✅ 网络错误 - 继续重试
- ✅ 超时 - 继续重试
- ✅ 5xx 服务器错误 - 继续重试
- ✅ 429 Too Many Requests - 继续重试
- ❌ 4xx 客户端错误 - 不重试
- ❌ 消息过期（TTL）- 丢弃

## 文件结构

```
comm/
├── index.js                      # 主入口
├── communication-layer.js        # 抽象层
├── demo.html                     # 演示页面
├── README.md                     # 本文档
├── transports/
│   ├── websocket.js              # WebSocket 传输
│   ├── sse.js                    # SSE 传输
│   ├── long-polling.js           # 长轮询传输
│   └── short-polling.js          # 短轮询传输
├── queue/
│   ├── message-queue.js          # 消息队列
│   └── queue-storage.js          # IndexedDB 存储
└── utils/
    ├── message.js                # 消息工具
    └── retry.js                  # 重试策略
```

## 演示

打开 `demo.html` 可以看到通信层的实时演示：

1. 连接状态显示
2. 传输方式和延迟
3. 消息发送测试
4. 事件日志

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

需要支持：
- ES2022 (class fields, private methods)
- WebSocket API
- EventSource (SSE) API
- IndexedDB API
- Fetch API with AbortController

## 技术规格

详见：
- `openspec/specs/04-communication.md` - 通信层详细规格
- `openspec/tasks/phase-0/task-003-communication.md` - 任务文档

## 许可

MIT License
