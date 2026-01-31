# Task 003: 通信层开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | task-003-communication |
| 阶段 | Phase 0 - 基础设施 |
| 优先级 | P0 (最高) |
| 预估工时 | 12 小时 |
| 依赖 | task-002-local-jar |
| 产出 | 前端通信层模块 |

## 目标

开发前端通信抽象层，提供：
1. 统一的消息收发接口
2. 五级自动降级
3. 离线消息队列
4. 断线重连

## 详细需求

### 1. 传输层级

| 级别 | 传输方式 | 条件 | 延迟 |
|------|----------|------|------|
| 1 | WebSocket | WS 连接成功 | <100ms |
| 2 | SSE + HTTP | SSE 连接成功 | <500ms |
| 3 | 长轮询 | HTTP 可用 | <30s |
| 4 | 短轮询 | HTTP 可用 | <5s |
| 5 | 离线 | 网络不可用 | N/A |

### 2. 统一接口

```typescript
interface CommunicationLayer {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  
  // 状态
  getState(): ConnectionState;
  isOnline(): boolean;
  
  // 消息
  send(message: Message): Promise<void>;
  sendAndWait(message: Message, timeout?: number): Promise<Message>;
  
  // 事件
  on(event: string, handler: MessageHandler): void;
  off(event: string, handler: MessageHandler): void;
  
  // 队列
  getPendingCount(): number;
  retryPending(): Promise<void>;
}
```

### 3. 消息格式

```typescript
interface Message {
  id: string;
  type: 'command' | 'event' | 'data' | 'ack';
  action: string;
  payload: any;
  timestamp: number;
  from?: string;
  to?: string;
  replyTo?: string;
  priority?: 'normal' | 'high' | 'urgent';
}
```

### 4. 离线队列

- 消息存储在 IndexedDB
- 支持重试策略（指数退避）
- 网络恢复后自动发送
- 消息过期处理

## 技术规格

### 文件结构

```
src/frontend/desktop/services/
├── comm/
│   ├── index.js                 # 主入口
│   ├── communication-layer.js   # 抽象层
│   ├── transports/
│   │   ├── websocket.js         # WebSocket 传输
│   │   ├── sse.js               # SSE 传输
│   │   ├── long-polling.js      # 长轮询传输
│   │   └── short-polling.js     # 短轮询传输
│   ├── queue/
│   │   ├── message-queue.js     # 消息队列
│   │   └── queue-storage.js     # 队列存储
│   └── utils/
│       ├── message.js           # 消息工具
│       └── retry.js             # 重试策略
```

## 实现步骤

### Step 1: 基础架构 (2h)
```javascript
// communication-layer.js

export class CommunicationLayer extends EventTarget {
  constructor(options) {
    super();
    this.options = {
      serverUrl: 'http://127.0.0.1:8765',
      autoReconnect: true,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10,
      ...options
    };
    
    this.state = {
      status: 'disconnected',
      transport: null,
      latency: 0,
      reconnectAttempts: 0
    };
    
    this.transports = [];
    this.currentTransport = null;
    this.queue = null;
    this.handlers = new Map();
  }
}
```

### Step 2: WebSocket 传输 (2h)
```javascript
// transports/websocket.js

export class WebSocketTransport {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.ws = null;
    this.connected = false;
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.url.replace('http', 'ws') + '/ws';
      this.ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        this.ws.close();
        reject(new Error('Connection timeout'));
      }, 3000);
      
      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      };
      
      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.onMessage?.(message);
      };
      
      this.ws.onclose = () => {
        this.connected = false;
        this.onDisconnect?.();
      };
    });
  }
  
  send(message) {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.ws.send(JSON.stringify(message));
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### Step 3: SSE 传输 (2h)
```javascript
// transports/sse.js

export class SSETransport {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.eventSource = null;
    this.connected = false;
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.url}/api/events`);
      
      const timeout = setTimeout(() => {
        this.eventSource.close();
        reject(new Error('Connection timeout'));
      }, 3000);
      
      this.eventSource.onopen = () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      };
      
      this.eventSource.onerror = (error) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(error);
      };
      
      this.eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.onMessage?.(message);
      };
    });
  }
  
  async send(message) {
    // SSE 是单向的，发送使用 HTTP
    const response = await fetch(`${this.url}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error('Send failed');
    }
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
```

### Step 4: 轮询传输 (2h)
```javascript
// transports/long-polling.js

export class LongPollingTransport {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.polling = false;
    this.connected = false;
  }
  
  async connect() {
    // 测试连接
    const response = await fetch(`${this.url}/api/local/health`);
    if (!response.ok) {
      throw new Error('Server not available');
    }
    
    this.connected = true;
    this.polling = true;
    this.poll();
  }
  
  async poll() {
    while (this.polling) {
      try {
        const response = await fetch(`${this.url}/api/poll`, {
          method: 'GET',
          signal: AbortSignal.timeout(30000)
        });
        
        if (response.ok) {
          const messages = await response.json();
          for (const message of messages) {
            this.onMessage?.(message);
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Poll error:', error);
          await this.sleep(1000);
        }
      }
    }
  }
  
  async send(message) {
    const response = await fetch(`${this.url}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error('Send failed');
    }
  }
  
  disconnect() {
    this.polling = false;
    this.connected = false;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Step 5: 消息队列 (2h)
```javascript
// queue/message-queue.js

export class MessageQueue {
  constructor(storage) {
    this.storage = storage;
    this.processing = false;
  }
  
  async enqueue(message, options = {}) {
    const item = {
      id: this.generateId(),
      message,
      status: 'pending',
      retryCount: 0,
      maxRetries: options.maxRetries || 5,
      createdAt: Date.now(),
      nextAttempt: Date.now()
    };
    
    await this.storage.save(item);
    return item.id;
  }
  
  async process(sendFn) {
    if (this.processing) return;
    this.processing = true;
    
    try {
      const items = await this.storage.getPending();
      
      for (const item of items) {
        if (item.nextAttempt > Date.now()) continue;
        
        try {
          await sendFn(item.message);
          await this.storage.remove(item.id);
        } catch (error) {
          item.retryCount++;
          
          if (item.retryCount >= item.maxRetries) {
            item.status = 'failed';
          } else {
            // 指数退避
            const delay = Math.pow(2, item.retryCount) * 1000;
            item.nextAttempt = Date.now() + delay;
          }
          
          await this.storage.update(item);
        }
      }
    } finally {
      this.processing = false;
    }
  }
  
  generateId() {
    return 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
```

### Step 6: 自动降级 (2h)
```javascript
// communication-layer.js (续)

export class CommunicationLayer {
  async connect() {
    const transports = [
      { name: 'websocket', factory: () => new WebSocketTransport(this.options.serverUrl) },
      { name: 'sse', factory: () => new SSETransport(this.options.serverUrl) },
      { name: 'long-polling', factory: () => new LongPollingTransport(this.options.serverUrl) },
      { name: 'short-polling', factory: () => new ShortPollingTransport(this.options.serverUrl) }
    ];
    
    for (const { name, factory } of transports) {
      try {
        const transport = factory();
        transport.onMessage = (msg) => this.handleMessage(msg);
        transport.onDisconnect = () => this.handleDisconnect();
        
        await transport.connect();
        
        this.currentTransport = transport;
        this.state.transport = name;
        this.state.status = 'connected';
        
        this.emit('connected', { transport: name });
        this.startHeartbeat();
        
        return;
      } catch (error) {
        console.warn(`${name} failed:`, error.message);
      }
    }
    
    // 所有传输都失败，进入离线模式
    this.state.status = 'offline';
    this.state.transport = 'offline';
    this.emit('offline');
  }
}
```

## 测试要点

### 单元测试
1. 各传输方式连接/断开
2. 消息序列化/反序列化
3. 队列入队/出队
4. 重试逻辑

### 集成测试
1. 自动降级流程
2. 断线重连
3. 离线消息同步
4. 心跳机制

### 模拟测试
1. 网络断开恢复
2. 服务器不可用
3. 超时处理

## 验收标准

- [ ] WebSocket 连接正常
- [ ] SSE 降级正常
- [ ] 轮询降级正常
- [ ] 离线队列工作
- [ ] 自动重连正常
- [ ] 心跳机制正常
- [ ] 事件分发正确
- [ ] 性能可接受

## 参考规格

- `specs/04-communication.md` - 通信层详细规格

## 下一步

完成后进入 `task-004-database.md` - 数据库服务开发