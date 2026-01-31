# Local JAR Service

Local JAR (`localverse.jar`) 是 Localverse OS 的本地 Java 服务，提供 HTTP/WebSocket 服务器、文件系统操作和代理转发功能。

## 功能特性

### HTTP 服务器 (端口 8765)
- **健康检查**: `GET /api/local/health`
- **配置管理**: `GET /api/local/config`
- **文件操作**: 
  - `GET /api/local/files?path=...` - 列出目录/读取文件
  - `POST /api/local/files?path=...` - 上传文件
  - `PUT /api/local/files?path=...` - 更新文件
  - `DELETE /api/local/files?path=...` - 删除文件
- **数据库操作**:
  - `POST /api/local/db/query` - 执行查询
  - `POST /api/local/db/exec` - 执行语句
- **代理转发**: `* /api/sync/*` - 转发到 Sync Server

### WebSocket 服务器 (端口 8766)
- 实时双向通信
- 消息类型: auth, subscribe, message, heartbeat
- 自动心跳保活

### 文件系统服务
- 文件读写
- 目录遍历
- 路径安全验证
- 文件操作 (复制、移动、删除)

### 数据库服务
- SQLite 数据库
- 预处理语句
- 事务支持

### 代理服务
- HTTP 请求转发到 Sync Server
- 请求/响应转换
- 超时处理

## 技术栈

- **Java 21** - 使用虚拟线程和现代 Java 特性
- **JDK HttpServer** - 内置 HTTP 服务器
- **Java-WebSocket 1.5.4** - WebSocket 支持
- **Gson 2.10.1** - JSON 序列化
- **SQLite JDBC 3.44.1.0** - 数据库驱动

## 构建

### 前置要求
- Java 21
- Maven 3.6+

### 构建步骤

```bash
# 使用构建脚本
./build-localverse.sh

# 或使用 Maven
mvn clean package
```

构建产物：`dist/localverse.jar` (约 13MB)

## 使用

### 创建配置文件

```bash
java -jar dist/localverse.jar --create-config
```

这将创建 `config.json` 文件，包含默认配置。

### 启动服务

```bash
# 使用默认配置
java -jar dist/localverse.jar

# 指定配置文件
java -jar dist/localverse.jar --config=/path/to/config.json
```

### 其他命令

```bash
# 查看版本
java -jar dist/localverse.jar --version

# 查看帮助
java -jar dist/localverse.jar --help
```

## 配置

配置文件 `config.json` 示例：

```json
{
  "mode": "client",
  "client": {
    "httpPort": 8765,
    "wsPort": 8766,
    "bindAddress": "127.0.0.1",
    "syncServer": "http://192.168.1.100:8080",
    "syncEnabled": true,
    "autoConnect": true,
    "reconnectInterval": 5000
  },
  "database": {
    "path": "./data/localverse.db",
    "maxConnections": 10
  },
  "filesystem": {
    "watchPaths": [],
    "excludePatterns": ["*.tmp", "node_modules/**", ".git/**"],
    "maxFileSize": 104857600
  },
  "security": {
    "jwtSecret": "change-this-secret-in-production",
    "tokenExpiry": 86400,
    "enableCORS": true,
    "allowedOrigins": ["http://127.0.0.1:*", "file://"]
  },
  "user": {
    "id": "user_001",
    "name": "Default User",
    "department": "default"
  },
  "logging": {
    "level": "INFO",
    "file": "./logs/localverse.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

## API 示例

### 健康检查

```bash
curl http://127.0.0.1:8765/api/local/health
```

响应：
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "uptime": 3600,
    "mode": "client",
    "timestamp": 1709888888000
  }
}
```

### 列出目录

```bash
curl "http://127.0.0.1:8765/api/local/files?path=/path/to/directory"
```

### 读取文件

```bash
curl "http://127.0.0.1:8765/api/local/files?path=/path/to/file.txt"
```

### 数据库查询

```bash
curl -X POST http://127.0.0.1:8765/api/local/db/query \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM cards WHERE title LIKE ?","params":["%test%"]}'
```

## 开发

### 项目结构

```
src/java/core/
├── Main.java                    # 入口点
├── config/                      # 配置系统
│   ├── Config.java
│   └── ConfigLoader.java
├── server/                      # 服务器
│   ├── LocalHttpServer.java
│   ├── LocalWebSocketServer.java
│   └── handlers/               # HTTP 处理器
│       ├── HealthHandler.java
│       ├── ConfigHandler.java
│       ├── FileHandler.java
│       ├── DatabaseHandler.java
│       └── ProxyHandler.java
├── services/                    # 业务服务
│   ├── FileSystemService.java
│   ├── DatabaseService.java
│   └── ProxyService.java
├── utils/                       # 工具类
│   ├── JsonUtil.java
│   └── PathUtil.java
└── models/                      # 数据模型
    └── Message.java
```

## 测试

服务启动后，可以使用以下命令测试：

```bash
# 测试 HTTP
curl http://127.0.0.1:8765/api/local/health

# 测试 WebSocket (需要 wscat)
wscat -c ws://127.0.0.1:8766/ws
```

## 安全

- 所有文件操作都经过路径安全验证
- 支持配置允许访问的目录列表
- 禁止访问系统目录
- 文件大小限制
- CORS 可配置

## 许可

参见主项目许可证。
