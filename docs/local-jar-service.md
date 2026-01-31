# Local JAR Service

本地 JAR 服务为 Localverse 提供系统级功能和 HTTP/WebSocket API。

## 功能特性

### HTTP Server (端口 8765)
- ✅ 健康检查 API
- ✅ 配置管理 API
- ✅ 文件系统操作 API（带安全检查）
- ✅ 数据库操作 API（预留接口）
- ✅ 代理转发到 Sync Server
- ✅ CORS 支持

### WebSocket Server (端口 8766)
- ✅ 实时双向通信
- ✅ 消息类型：auth, subscribe, message, heartbeat
- ✅ 频道订阅/取消订阅
- ✅ 广播消息

### 服务层
- ✅ FileSystemService - 文件操作和安全检查
- ✅ DatabaseService - SQLite 数据库（待实现）
- ✅ ProxyService - HTTP 请求转发

## 构建

### 要求
- Java 21
- Maven 3.6+

### 编译
```bash
# 使用 Maven 构建
mvn clean package

# 或使用构建脚本
./build/build-core.sh
```

构建产物：
- `dist/localverse.jar` - 主程序
- `dist/lib/` - 依赖库

## 运行

### 基本用法
```bash
# 使用默认配置启动（客户端模式）
java -jar dist/localverse.jar

# 显示帮助信息
java -jar dist/localverse.jar --help

# 显示版本信息
java -jar dist/localverse.jar --version
```

### 配置文件
```bash
# 使用指定配置文件
java -jar dist/localverse.jar --config=/path/to/config.json

# 首次运行时会自动创建 config.json
```

### 命令行参数
```bash
# 服务器模式
java -jar dist/localverse.jar --mode=server --http-port=8080

# 自定义端口
java -jar dist/localverse.jar --http-port=9000 --ws-port=9001
```

## API 端点

### 本地 API (`/api/local/`)

#### 健康检查
```bash
GET /api/local/health

# 响应
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "mode": "client"
}
```

#### 配置管理
```bash
# 获取配置
GET /api/local/config

# 更新配置
PUT /api/local/config
Content-Type: application/json

{
  "mode": "client",
  ...
}
```

#### 文件操作
```bash
# 列出目录文件
GET /api/local/files?path=/Documents&recursive=false

# 读取文件
GET /api/local/files/path/to/file.txt

# 创建/上传文件
POST /api/local/files
Content-Type: application/json

{
  "path": "/Documents/test.txt",
  "content": "file content"
}

# 更新文件
PUT /api/local/files/path/to/file.txt
Content-Type: application/octet-stream

<file content>

# 删除文件
DELETE /api/local/files/path/to/file.txt
```

#### 数据库操作（预留）
```bash
# 查询
POST /api/local/db/query
Content-Type: application/json

{
  "sql": "SELECT * FROM cards WHERE title LIKE ?",
  "params": ["%test%"]
}

# 执行
POST /api/local/db/exec
Content-Type: application/json

{
  "sql": "INSERT INTO cards (title) VALUES (?)",
  "params": ["New Card"]
}
```

### 代理 API (`/api/sync/`)

所有 `/api/sync/*` 请求会被转发到配置的 Sync Server。

```bash
# 示例：转发到 Sync Server
GET /api/sync/announcements
# → http://192.168.1.100:8080/api/announcements
```

## WebSocket 连接

### 连接
```javascript
const ws = new WebSocket('ws://127.0.0.1:8766');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### 消息格式
```json
{
  "id": "msg_uuid",
  "type": "event|command|data|ack|error",
  "action": "specific_action",
  "payload": {},
  "timestamp": 1709888888000
}
```

### 消息类型

#### 认证
```javascript
ws.send(JSON.stringify({
  "type": "auth",
  "action": "authenticate",
  "payload": {"token": "your-token"}
}));
```

#### 订阅频道
```javascript
ws.send(JSON.stringify({
  "type": "subscribe",
  "action": "subscribe",
  "payload": {"channel": "chat"}
}));
```

#### 发送消息
```javascript
ws.send(JSON.stringify({
  "type": "message",
  "action": "send",
  "payload": {
    "channel": "chat",
    "text": "Hello"
  }
}));
```

#### 心跳
```javascript
ws.send(JSON.stringify({
  "type": "heartbeat",
  "action": "ping",
  "payload": {}
}));
```

## 配置说明

参考 `config.example.json` 文件。

### 关键配置项

- `mode`: 运行模式 (`client` | `server` | `hybrid`)
- `client.httpPort`: HTTP 服务端口（默认 8765）
- `client.wsPort`: WebSocket 端口（默认 8766）
- `filesystem.allowedPaths`: 允许访问的目录列表（安全限制）
- `filesystem.maxFileSize`: 最大文件大小（字节）
- `syncServer.enabled`: 是否启用 Sync Server 代理

## 测试

```bash
# 测试健康检查
curl http://127.0.0.1:8765/api/local/health

# 测试配置 API
curl http://127.0.0.1:8765/api/local/config

# 测试 WebSocket（使用 nc）
nc -zv 127.0.0.1 8766
```

## 安全特性

1. **路径验证**: 所有文件操作都会检查路径是否在允许的目录内
2. **路径遍历防护**: 禁止使用 `..` 等路径遍历符号
3. **文件大小限制**: 限制上传/读取文件的大小
4. **排除模式**: 自动排除临时文件和敏感目录（如 node_modules）
5. **CORS 配置**: 可配置的跨域访问控制

## 技术栈

- **HTTP Server**: `com.sun.net.httpserver.HttpServer` (JDK 内置)
- **WebSocket**: `Java-WebSocket 1.5.4`
- **JSON**: `Gson 2.10.1`
- **Database**: `SQLite JDBC 3.44.1.0`
- **并发**: Virtual Threads (Java 21)

## 项目结构

```
src/java/core/
├── Main.java                        # 入口点
├── config/
│   ├── Config.java                  # 配置模型
│   └── ConfigLoader.java            # 配置加载器
├── server/
│   ├── LocalHttpServer.java         # HTTP 服务器
│   ├── LocalWebSocketServer.java    # WebSocket 服务器
│   └── handlers/
│       ├── HealthHandler.java       # 健康检查
│       ├── ConfigHandler.java       # 配置 API
│       ├── FileHandler.java         # 文件 API
│       ├── DatabaseHandler.java     # 数据库 API
│       └── ProxyHandler.java        # 代理转发
├── services/
│   ├── FileSystemService.java       # 文件系统服务
│   ├── DatabaseService.java         # 数据库服务
│   └── ProxyService.java            # 代理服务
├── models/
│   ├── Message.java                 # WebSocket 消息模型
│   └── FileInfo.java                # 文件信息模型
└── utils/
    ├── JsonUtil.java                # JSON 工具
    └── PathUtil.java                # 路径工具
```

## 后续开发

- [ ] 完整实现 DatabaseService（SQLite 操作）
- [ ] 实现文件监视（WatchService）
- [ ] 实现全文搜索服务
- [ ] 实现加密服务
- [ ] 添加身份验证和会话管理
- [ ] 实现静态文件服务（前端资源）
- [ ] 添加日志系统
- [ ] 性能优化和压力测试

## 许可证

MIT License
