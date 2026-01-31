# Task 002: Local JAR 服务开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | task-002-local-jar |
| 阶段 | Phase 0 - 基础设施 |
| 优先级 | P0 (最高) |
| 预估工时 | 16 小时 |
| 依赖 | task-001-launcher |
| 产出 | localverse.jar (客户端模式) |

## 目标

开发 localverse.jar 的客户端模式，提供：
1. HTTP 服务器（供浏览器访问）
2. WebSocket 服务器（实时通信）
3. 文件系统操作
4. 代理转发到 Sync Server

## 详细需求

### 1. HTTP 服务器

#### 端口配置
- 默认端口: 8765
- 绑定地址: 127.0.0.1 (仅本地访问)

#### API 路由

```
本地 API:
GET  /api/local/health              # 健康检查
GET  /api/local/config              # 获取配置
PUT  /api/local/config              # 更新配置
GET  /api/local/version             # 版本信息

文件 API:
GET  /api/local/files               # 文件列表
GET  /api/local/files/*path         # 读取文件
POST /api/local/files               # 上传文件
PUT  /api/local/files/*path         # 更新文件
DELETE /api/local/files/*path       # 删除文件

数据库 API:
POST /api/local/db/query            # 执行查询
POST /api/local/db/exec             # 执行语句

代理 API:
*    /api/sync/*                    # 转发到 Sync Server
```

#### CORS 配置
```java
response.setHeader("Access-Control-Allow-Origin", "*");
response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
```

### 2. WebSocket 服务器

#### 端口配置
- 默认端口: 8766

#### 消息格式
```json
{
  "id": "msg_uuid",
  "type": "event|command|data|ack",
  "action": "具体动作",
  "payload": {},
  "timestamp": 1709888888000
}
```

#### 支持的消息类型
- `auth`: 认证
- `subscribe`: 订阅频道
- `message`: 普通消息
- `heartbeat`: 心跳

### 3. 文件系统服务

#### 功能
- 读取文件内容
- 写入文件
- 目录遍历
- 文件监视 (WatchService)
- 文件搜索

#### 安全限制
- 只允许访问配置的目录
- 禁止访问系统目录
- 文件大小限制

### 4. 代理转发

#### 功能
- 将 `/api/sync/*` 请求转发到 Sync Server
- 处理认证头
- 超时处理
- 错误处理

## 技术规格

### 依赖
- Java 21
- com.sun.net.httpserver (JDK 内置)
- Java-WebSocket (轻量级 WebSocket 库)
- Gson (JSON 处理)
- SQLite JDBC

### Maven 依赖
```xml
<dependencies>
    <dependency>
        <groupId>org.java-websocket</groupId>
        <artifactId>Java-WebSocket</artifactId>
        <version>1.5.4</version>
    </dependency>
    <dependency>
        <groupId>com.google.code.gson</groupId>
        <artifactId>gson</artifactId>
        <version>2.10.1</version>
    </dependency>
    <dependency>
        <groupId>org.xerial</groupId>
        <artifactId>sqlite-jdbc</artifactId>
        <version>3.44.1.0</version>
    </dependency>
</dependencies>
```

### 项目结构

```
src/java/core/
├── Main.java                        # 入口点
├── config/
│   ├── Config.java                  # 配置类
│   └── ConfigLoader.java            # 配置加载器
├── server/
│   ├── HttpServer.java              # HTTP 服务器
│   ├── WebSocketServer.java         # WebSocket 服务器
│   └── handlers/
│       ├── HealthHandler.java       # 健康检查
│       ├── ConfigHandler.java       # 配置 API
│       ├── FileHandler.java         # 文件 API
│       ├── DatabaseHandler.java     # 数据库 API
│       ├── ProxyHandler.java        # 代理转发
│       └── StaticHandler.java       # 静态文件
├── services/
│   ├── FileSystemService.java       # 文件系统服务
│   ├── DatabaseService.java         # 数据库服务
│   └── ProxyService.java            # 代理服务
└── utils/
    ├── JsonUtil.java                # JSON 工具
    ├── HashUtil.java                # 哈希工具
    └── PathUtil.java                # 路径工具
```

## 实现步骤

### Step 1: 项目骨架 (2h)
- 创建 Maven 项目
- 配置依赖
- 创建基础类结构

### Step 2: 配置系统 (2h)
- 实现配置文件加载
- 支持命令行参数
- 默认配置

### Step 3: HTTP 服务器 (4h)
- 使用 com.sun.net.httpserver
- 实现路由分发
- 实现 CORS 处理
- 实现各 Handler

### Step 4: WebSocket 服务器 (3h)
- 使用 Java-WebSocket
- 实现连接管理
- 实现消息处理
- 实现心跳

### Step 5: 文件系统服务 (3h)
- 实现文件读写
- 实现目录遍历
- 实现文件监视

### Step 6: 代理服务 (2h)
- 实现请求转发
- 处理响应
- 错误处理

## 配置文件

```json
// config.json
{
  "mode": "client",
  "client": {
    "httpPort": 8765,
    "wsPort": 8766,
    "bindAddress": "127.0.0.1"
  },
  "syncServer": {
    "url": "http://192.168.1.100:8080",
    "enabled": true,
    "timeout": 30000
  },
  "database": {
    "path": "./data/localverse.db"
  },
  "filesystem": {
    "allowedPaths": ["D:/Documents", "D:/Projects"],
    "maxFileSize": 104857600
  },
  "security": {
    "enableCORS": true,
    "allowedOrigins": ["http://127.0.0.1:*", "file://"]
  }
}
```

## API 详细设计

### GET /api/local/health
```json
// Response
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "mode": "client"
}
```

### GET /api/local/files
```json
// Request Query
?path=/Documents&recursive=false

// Response
{
  "files": [
    {
      "path": "/Documents/readme.md",
      "name": "readme.md",
      "size": 1024,
      "isDirectory": false,
      "modifiedAt": 1709888888000
    }
  ]
}
```

### POST /api/local/db/query
```json
// Request
{
  "sql": "SELECT * FROM cards WHERE title LIKE ?",
  "params": ["%test%"]
}

// Response
{
  "rows": [...],
  "rowCount": 10
}
```

## 测试要点

### 单元测试
1. 配置加载
2. 路径解析
3. JSON 序列化

### 集成测试
1. HTTP 服务器启动
2. API 响应正确
3. WebSocket 连接
4. 文件操作
5. 代理转发

### 性能测试
1. 并发请求处理
2. 大文件传输
3. WebSocket 消息吞吐

## 验收标准

- [ ] HTTP 服务器正常启动
- [ ] 所有 API 端点可用
- [ ] WebSocket 连接稳定
- [ ] 文件操作正确
- [ ] 代理转发正常
- [ ] CORS 处理正确
- [ ] 错误处理完善
- [ ] 日志输出清晰

## 参考规格

- `specs/02-local-jar.md` - Local JAR 详细规格
- `specs/04-communication.md` - 通信协议

## 下一步

完成后进入 `task-003-communication.md` - 通信层开发