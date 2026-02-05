# Localverse API 参考索引

> 📚 Localverse 项目所有 API 文档的统一入口  
> **最后更新**: 2026-01-31

---

## 🎯 快速导航

### 后端 API (Java)
- [Local JAR HTTP API](#local-jar-http-api) - REST API 接口
- [Local JAR WebSocket API](#local-jar-websocket-api) - 实时通信接口

### 前端 API (JavaScript)
- [通信层 API](#通信层-api) - CommunicationLayer
- [数据库 API](#数据库-api) - DatabaseService
- [认证 API](#认证-api) - AuthService
- [搜索 API](#搜索-api) - SearchService

### 插件 API (待完成)
- [插件系统 API](#插件系统-api) - Plugin Framework

---

## Local JAR HTTP API

**基础 URL**: `http://127.0.0.1:8765`

### 健康检查

```http
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": 1706716800000,
  "version": "0.1.0"
}
```

### 数据库操作

```http
POST /api/database
Content-Type: application/json

{
  "action": "query",
  "sql": "SELECT * FROM users WHERE id = ?",
  "params": [1]
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {"id": 1, "username": "alice", "email": "alice@example.com"}
  ]
}
```

**支持的 actions**:
- `query` - 查询数据
- `execute` - 执行更新
- `transaction` - 执行事务

### 文件操作

```http
POST /api/files
Content-Type: application/json

{
  "action": "read",
  "path": "/documents/readme.txt"
}
```

**响应**:
```json
{
  "success": true,
  "content": "File content here...",
  "size": 1024,
  "lastModified": 1706716800000
}
```

**支持的 actions**:
- `read` - 读取文件
- `write` - 写入文件
- `list` - 列出目录
- `delete` - 删除文件
- `move` - 移动文件
- `copy` - 复制文件

### 搜索服务

```http
POST /api/search
Content-Type: application/json

{
  "query": "keyword",
  "limit": 10,
  "offset": 0
}
```

**响应**:
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "title": "Document Title",
      "content": "Snippet...",
      "score": 0.95
    }
  ],
  "total": 42
}
```

### 代理转发

```http
POST /api/proxy
Content-Type: application/json

{
  "method": "POST",
  "url": "/sync/data",
  "body": {"key": "value"},
  "headers": {"Authorization": "Bearer token"}
}
```

### 配置管理

```http
GET /api/config
```

**响应**:
```json
{
  "success": true,
  "config": {
    "httpPort": 8765,
    "wsPort": 8766,
    "dataPath": "./data"
  }
}
```

**完整文档**: [docs/local-jar.md](./local-jar.md)

---

## Local JAR WebSocket API

**连接 URL**: `ws://127.0.0.1:8766`

### 消息格式

```json
{
  "type": "request",
  "id": "uuid-here",
  "method": "database.query",
  "params": {
    "sql": "SELECT * FROM users",
    "params": []
  }
}
```

### 响应格式

```json
{
  "type": "response",
  "id": "uuid-here",
  "success": true,
  "data": [...]
}
```

### 服务器推送

```json
{
  "type": "event",
  "event": "data.updated",
  "data": {
    "table": "users",
    "id": 1
  }
}
```

**完整文档**: [docs/local-jar.md](./local-jar.md)

---

## 通信层 API

**模块**: `src/frontend/desktop/services/comm/`

### 初始化

```javascript
import { CommunicationLayer } from './services/comm/index.js';

const comm = new CommunicationLayer({
  baseUrl: 'http://127.0.0.1:8765',
  wsUrl: 'ws://127.0.0.1:8766',
  autoConnect: true,
  heartbeatInterval: 30000 // 30s
});

// 连接到服务器
await comm.connect();
```

### 发送请求

```javascript
// HTTP 请求
const result = await comm.request('/api/database', {
  method: 'POST',
  body: {
    action: 'query',
    sql: 'SELECT * FROM users'
  }
});

// WebSocket 消息
const result = await comm.send({
  method: 'database.query',
  params: {
    sql: 'SELECT * FROM users'
  }
});
```

### 监听事件

```javascript
// 监听连接状态
comm.on('connected', () => {
  console.log('已连接');
});

comm.on('disconnected', () => {
  console.log('已断开');
});

// 监听服务器推送
comm.on('message', (data) => {
  console.log('收到消息:', data);
});
```

### 传输层级

通信层自动在5个传输层级之间切换：

1. **WebSocket** (最优先) - 双向实时通信
2. **SSE** (Server-Sent Events) - 单向实时推送
3. **Long Polling** - 长轮询
4. **Short Polling** - 短轮询
5. **HTTP** (最后兜底) - 标准 HTTP 请求

**完整文档**: [src/frontend/desktop/services/comm/README.md](../src/frontend/desktop/services/comm/README.md)

---

## 数据库 API

**模块**: `src/frontend/desktop/services/database/`

### 创建数据库实例

```javascript
import { DatabaseServiceFactory } from './services/database/index.js';

// 自动检测最佳模式
const db = await DatabaseServiceFactory.create('auto');

// 或指定模式
const db = await DatabaseServiceFactory.create('full'); // JAR
const db = await DatabaseServiceFactory.create('light'); // WASM
const db = await DatabaseServiceFactory.create('pure'); // IndexedDB
const db = await DatabaseServiceFactory.create('mock'); // Mock
```

### 查询数据

```javascript
// 查询
const users = await db.query(
  'SELECT * FROM users WHERE age > ?',
  [18]
);

// 执行更新
const result = await db.execute(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['Alice', 'alice@example.com']
);

// 事务
await db.transaction(async (tx) => {
  await tx.execute('INSERT INTO users ...');
  await tx.execute('UPDATE settings ...');
});
```

### 三种运行模式

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| Full | SQLite JDBC via JAR | 生产环境 (推荐) |
| Light | SQLite WASM + IndexedDB | 无 Java 环境 |
| Pure | IndexedDB only | 兼容性最大化 |
| Mock | 内存模拟 | 测试和原型 |

**完整文档**: [src/frontend/desktop/services/database/README.md](../src/frontend/desktop/services/database/README.md)

---

## 认证 API

**模块**: `src/frontend/desktop/services/auth/`

### 初始化

```javascript
import { authService } from './services/auth/index.js';

// 自动认证 (检查已保存的 token)
const user = await authService.authenticate();

if (!user) {
  // 用户未认证，显示设置界面
  await authService.setup({
    username: 'alice',
    email: 'alice@example.com',
    department: 'Engineering',
    role: 'user'
  });
}
```

### 获取当前用户

```javascript
const user = authService.getCurrentUser();
// {
//   userId: 'uuid',
//   username: 'alice',
//   email: 'alice@example.com',
//   department: 'Engineering',
//   role: 'user'
// }
```

### 权限检查

```javascript
import { hasPermission, canAccessData } from './services/auth/index.js';

// 检查权限
if (hasPermission(user, 'admin')) {
  // 管理员操作
}

// 检查数据访问权限
if (canAccessData(user, data)) {
  // 可以访问数据
}
```

### Token 管理

```javascript
// 获取 Token (用于 API 请求)
const token = await authService.getToken();

// 获取认证头
const headers = await authService.getAuthHeader();
// { 'Authorization': 'Bearer token-here' }

// 登出
await authService.logout();
```

### 设备指纹

```javascript
import { generateDeviceId, detectPlatform } from './services/auth/index.js';

// 生成设备 ID
const deviceId = await generateDeviceId();

// 检测平台
const platform = detectPlatform(); // 'desktop', 'mobile', 'tablet'
```

**完整文档**: [src/frontend/desktop/services/auth/README.md](../src/frontend/desktop/services/auth/README.md)

---

## 搜索 API

**模块**: `src/frontend/desktop/services/search/`

### 初始化

```javascript
import { SearchService } from './services/search/index.js';

const search = new SearchService({
  endpoint: '/api/search'
});
```

### 搜索

```javascript
// 全文搜索
const results = await search.search('keyword', {
  limit: 10,
  offset: 0
});

// 结果: [{ id, title, content, score }, ...]
```

**完整文档**: [src/frontend/desktop/services/search/README.md](../src/frontend/desktop/services/search/README.md)

---

## 插件系统 API

**状态**: ⏳ 待开发 (Phase 0 Task 006)

### 计划的 API

```javascript
// 插件定义
class MyPlugin extends Plugin {
  constructor() {
    super({
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0'
    });
  }

  async onActivate() {
    // 插件激活时调用
  }

  async onDeactivate() {
    // 插件停用时调用
  }
}

// 注册插件
pluginManager.register(MyPlugin);

// 加载插件
await pluginManager.load('my-plugin');

// 卸载插件
await pluginManager.unload('my-plugin');
```

**规格文档**: [openspec/specs/08-plugin-system.md](../openspec/specs/08-plugin-system.md)

---

## 🔗 相关文档

### 后端文档
- [Local JAR 完整 API](./local-jar.md)
- [Local JAR 实现总结](./phase-0-task-2-summary.md)

### 前端文档
- [通信层 README](../src/frontend/desktop/services/comm/README.md)
- [数据库 README](../src/frontend/desktop/services/database/README.md)
- [认证系统 README](../src/frontend/desktop/services/auth/README.md)
- [认证系统实现总结](./IMPLEMENTATION_SUMMARY.md)

### 规格文档
- [系统架构](../openspec/specs/00-architecture.md)
- [Local JAR 规格](../openspec/specs/02-local-jar.md)
- [通信层规格](../openspec/specs/04-communication.md)
- [数据库规格](../openspec/specs/05-database.md)
- [认证规格](../openspec/specs/06-authentication.md)
- [插件系统规格](../openspec/specs/08-plugin-system.md)

### 开发指南
- [快速入门](../openspec/QUICK-START-GUIDE.md)
- [开发路线图](../openspec/DEVELOPMENT-ROADMAP.md)
- [AI 开发指南](../AGENTS.md)
- [实现状态](./IMPLEMENTATION_STATUS.md)

---

**文档版本**: 1.0  
**最后更新**: 2026-01-31  
**维护者**: Localverse 开发团队
