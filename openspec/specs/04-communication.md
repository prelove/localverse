# 04 - 通信层规格

## 概述

通信层是连接 Browser、Local JAR、Sync Server 的桥梁，提供：
1. 统一的消息格式
2. 五级自动降级
3. 离线队列
4. 断线重连

## 设计原则

- **抽象**：上层代码无需关心底层传输方式
- **可靠**：消息不丢失，自动重试
- **透明**：降级对用户无感知

## 降级策略

```
Level 1: WebSocket
├─ 条件：WebSocket 连接成功
├─ 延迟：<100ms
├─ 特点：双向实时
├─ 图标：🟢
└─ 检测：ws://server/ws, 3秒超时

Level 2: SSE + HTTP
├─ 条件：SSE 连接成功
├─ 延迟：<500ms
├─ 特点：下行实时，上行延迟
├─ 图标：🟡
└─ 检测：GET /api/events, 3秒超时

Level 3: Long Polling
├─ 条件：HTTP 请求成功
├─ 延迟：<30s
├─ 特点：30秒长连接
├─ 图标：🟠
└─ 检测：GET /api/poll, 30秒超时

Level 4: Short Polling
├─ 条件：任何 HTTP 成功
├─ 延迟：<5s
├─ 特点：每5秒轮询
├─ 图标：🔴
└─ 检测：GET /api/health

Level 5: Offline
├─ 条件：所有网络请求失败
├─ 延迟：N/A
├─ 特点：本地队列
├─ 图标：⚫
└─ 检测：无
```

## 消息格式

### 基础消息结构

```typescript
interface Message {
  id: string;              // UUID v7
  type: MessageType;       // command | event | data | ack
  action: string;          // 具体动作
  payload: any;            // 数据载荷
  timestamp: number;       // Unix 时间戳（毫秒）
  from: string;            // 发送方 ID
  to: string;              // 接收方 ID 或 'all'
  replyTo?: string;        // 回复目标消息 ID
  priority: Priority;      // normal | high | urgent
  ttl?: number;            // 消息有效期（秒）
}

type MessageType = 'command' | 'event' | 'data' | 'ack';
type Priority = 'normal' | 'high' | 'urgent';
```

### 消息类型详解

```
command（命令）- 通常 Server → Client
├─ config_update    配置更新
├─ plugin_update    插件更新
├─ task_assign      任务分配
├─ diagnose         诊断请求
├─ lock / unlock    锁定/解锁
└─ restart          重启请求

event（事件）- 双向
├─ announcement     公告
├─ chat             聊天消息
├─ task_update      任务更新
├─ file_shared      文件分享
├─ user_online      用户上线
├─ user_offline     用户离线
└─ heartbeat        心跳

data（数据）- 双向
├─ sync_request     同步请求
├─ sync_response    同步响应
├─ status_report    状态上报
├─ query_result     查询结果
└─ file_chunk       文件分块

ack（确认）- 双向
├─ received         已收到
├─ processed        已处理
├─ failed           处理失败
└─ rejected         已拒绝
```

## 前端通信层接口

### CommunicationLayer 类

```typescript
interface CommunicationLayer {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  
  // 状态查询
  getState(): ConnectionState;
  getTransport(): TransportType;
  getLatency(): number;
  isOnline(): boolean;
  
  // 消息发送
  send(message: Partial<Message>): Promise<void>;
  sendAndWait(message: Partial<Message>, timeout?: number): Promise<Message>;
  
  // 事件监听
  on(event: string, handler: MessageHandler): void;
  off(event: string, handler: MessageHandler): void;
  once(event: string, handler: MessageHandler): void;
  
  // 频道订阅
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
  
  // 离线队列
  getPendingCount(): number;
  getPendingMessages(): PendingMessage[];
  retryPending(): Promise<void>;
  clearPending(): void;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  transport: TransportType;
  latency: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  reconnectAttempts: number;
}

type TransportType = 'websocket' | 'sse' | 'long-polling' | 'short-polling' | 'offline';

type MessageHandler = (message: Message) => void;

interface PendingMessage {
  id: string;
  message: Message;
  status: 'pending' | 'sending' | 'failed';
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt: number | null;
  error: string | null;
}
```

### 使用示例

```javascript
// 初始化
const comm = new CommunicationLayer({
  serverUrl: 'http://127.0.0.1:8765',
  autoReconnect: true,
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
  maxReconnectAttempts: 10,
  messageTimeout: 30000
});

// 连接
await comm.connect();

// 监听事件
comm.on('chat', (msg) => {
  console.log('收到聊天消息:', msg.payload);
});

comm.on('command', (msg) => {
  handleCommand(msg);
});

comm.on('connection_state', (state) => {
  updateStatusBar(state);
});

// 发送消息
await comm.send({
  type: 'event',
  action: 'chat',
  payload: { room: 'dev', content: '大家好' }
});

// 发送并等待响应
const response = await comm.sendAndWait({
  type: 'data',
  action: 'query',
  payload: { sql: 'SELECT * FROM tasks' }
}, 5000);

// 获取状态
const state = comm.getState();
console.log(`当前传输: ${state.transport}, 延迟: ${state.latency}ms`);
```

## Java 端通信接口

### WebSocket 服务端

```java
public interface WebSocketHandler {
    void onConnect(WebSocketSession session);
    void onMessage(WebSocketSession session, String message);
    void onClose(WebSocketSession session, int code, String reason);
    void onError(WebSocketSession session, Throwable error);
}

public interface WebSocketSession {
    String getId();
    String getUserId();
    void send(String message);
    void send(Message message);
    void close();
    boolean isOpen();
    Map<String, Object> getAttributes();
}

public interface WebSocketServer {
    void start(int port);
    void stop();
    void broadcast(Message message);
    void broadcast(Message message, Predicate<WebSocketSession> filter);
    void sendTo(String sessionId, Message message);
    void sendToUser(String userId, Message message);
    List<WebSocketSession> getSessions();
    int getConnectionCount();
}
```

### SSE 服务端

```java
public interface SSEHandler {
    void onSubscribe(SSEClient client);
    void onUnsubscribe(SSEClient client);
}

public interface SSEClient {
    String getId();
    String getUserId();
    void send(String event, String data);
    void send(Message message);
    void close();
    boolean isActive();
}

public interface SSEServer {
    void addClient(HttpExchange exchange, String userId);
    void removeClient(String clientId);
    void broadcast(Message message);
    void sendTo(String clientId, Message message);
    void sendToUser(String userId, Message message);
}
```

## 离线队列设计

### 队列存储结构（IndexedDB）

```javascript
// 数据库名: localverse_queue
// Store 名: pending_messages

const pendingMessageSchema = {
  id: 'string',           // UUID v7
  message: 'object',      // 完整消息对象
  status: 'string',       // pending | sending | failed
  retryCount: 'number',   // 已重试次数
  maxRetries: 'number',   // 最大重试次数（默认5）
  createdAt: 'number',    // 创建时间戳
  lastAttempt: 'number',  // 上次尝试时间戳
  nextAttempt: 'number',  // 下次尝试时间戳
  error: 'string'         // 错误信息
};

// 索引
// - status: 查询待发送消息
// - nextAttempt: 按时间排序
// - createdAt: 清理过期消息
```

### 重试策略

```
重试间隔（指数退避）:
├─ 第1次: 1秒
├─ 第2次: 2秒
├─ 第3次: 4秒
├─ 第4次: 8秒
├─ 第5次: 16秒
└─ 之后: 标记为 failed

失败处理:
├─ 网络错误: 继续重试
├─ 服务器 5xx: 继续重试
├─ 服务器 4xx: 标记失败，不重试
├─ 超时: 继续重试
└─ 消息过期(TTL): 丢弃
```

### 队列处理流程

```
┌─────────────────────────────────────┐
│ 定时器触发（每5秒）或网络恢复      │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 检查网络状态                        │
│ 离线？→ 跳过本轮                   │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 查询 status='pending' 的消息        │
│ WHERE nextAttempt <= now            │
│ ORDER BY priority DESC, createdAt   │
│ LIMIT 10                            │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 逐条发送                            │
│ ├─ 更新 status='sending'           │
│ ├─ 发送请求                        │
│ ├─ 成功 → 删除记录                 │
│ └─ 失败 → retryCount++, 计算下次   │
└─────────────────────────────────────┘
```

## 心跳机制

### 心跳消息格式

```json
{
  "id": "msg_xxx",
  "type": "event",
  "action": "heartbeat",
  "payload": {
    "clientTime": 1709888888000,
    "status": {
      "cpu": 25,
      "memory": 512,
      "pendingSync": 3
    }
  },
  "timestamp": 1709888888000,
  "from": "client_001"
}
```

### 心跳响应

```json
{
  "id": "msg_yyy",
  "type": "ack",
  "action": "heartbeat",
  "payload": {
    "serverTime": 1709888888500
  },
  "timestamp": 1709888888500,
  "replyTo": "msg_xxx"
}
```

### 心跳策略

```
心跳间隔: 30秒
超时检测: 90秒无响应视为断开
延迟计算: (收到响应时间 - 发送时间) / 2

连接健康判断:
├─ 延迟 < 100ms: 优秀
├─ 延迟 < 500ms: 良好
├─ 延迟 < 1000ms: 一般
└─ 延迟 >= 1000ms: 较差
```

## 状态栏 UI 规格

```
连接状态显示:

┌─────────────────────────────────────┐
│ Localverse                    🟢 ▼ │
└─────────────────────────────────────┘

点击展开:
┌─────────────────────────────────┐
│ 连接状态                        │
├─────────────────────────────────┤
│ 状态: 已连接                    │
│ 传输: WebSocket                 │
│ 延迟: 45ms                      │
│ 待同步: 0 条                    │
│                                 │
│ 服务器: 192.168.1.100:8080     │
│ 在线时长: 2小时30分             │
│                                 │
│ [断开连接] [网络诊断]           │
└─────────────────────────────────┘

图标含义:
🟢 WebSocket 已连接
🟡 SSE 模式
🟠 轮询模式
🔴 连接异常
⚫ 离线模式
```

## 测试要点

### 单元测试

1. **消息序列化/反序列化**
   - 各种消息类型正确解析
   - 特殊字符处理
   - 大消息处理

2. **降级逻辑**
   - 各级降级条件判断
   - 降级顺序正确
   - 恢复时自动升级

3. **队列操作**
   - 入队/出队
   - 重试计算
   - 过期清理

### 集成测试

1. **WebSocket 通信**
   - 连接建立
   - 消息收发
   - 断线重连

2. **SSE 通信**
   - 连接建立
   - 事件接收
   - 断线处理

3. **离线同步**
   - 离线时消息入队
   - 在线时自动发送
   - 顺序保证

### E2E 测试

1. **网络切换场景**
   - WiFi → 断网 → WiFi
   - 快速切换
   - 长时间离线后恢复

2. **性能测试**
   - 高频消息（100msg/s）
   - 大消息（1MB）
   - 长时间运行稳定性

## 相关规格

- `02-local-jar.md` - Local JAR 服务
- `03-sync-server.md` - Sync Server
- `07-sync-engine.md` - 同步引擎

## 相关任务

- `tasks/phase-0/task-003-communication.md`