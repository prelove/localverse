# Launcher - Localverse 启动器

轻量级 Java 启动器，负责启动和监控 Localverse 主程序，支持自动更新和崩溃回滚。

## 特性

- ✅ 启动和监控主程序
- ✅ 自动检测和应用更新
- ✅ 崩溃检测和自动回滚
- ✅ SHA-256 哈希验证
- ✅ 详细日志记录
- ✅ 体积小巧 (< 15KB)

## 系统要求

- Java 21 或更高版本
- 支持 Windows、macOS、Linux

## 快速开始

### 基本使用

```bash
# 正常启动（会自动启动 localverse.jar）
java -jar launcher.jar
```

### 命令行选项

```bash
# 显示版本信息
java -jar launcher.jar --version

# 检查是否有待更新
java -jar launcher.jar --check-update

# 强制回滚到上一个稳定版本
java -jar launcher.jar --rollback

# 静默模式（无控制台输出）
java -jar launcher.jar --silent

# 显示帮助信息
java -jar launcher.jar --help
```

## 文件结构

```
localverse/
├── launcher.jar              # 启动器（本项目）
├── localverse.jar            # 主程序
├── localverse.jar.bak        # 备份（回滚用）
├── version.json              # 版本信息
├── update_pending.flag       # 更新标记文件
├── temp/                     # 临时目录
│   └── localverse-x.x.x.jar  # 下载的新版本
└── logs/
    └── launcher.log          # 日志文件
```

## 工作流程

### 启动流程

1. 读取 `version.json` 获取当前版本信息
2. 检查是否存在 `update_pending.flag`
3. 如果有更新：验证哈希 → 备份 → 替换 → 更新版本信息
4. 启动 `localverse.jar` 子进程
5. 监控子进程状态
6. 根据退出码决定后续动作

### 退出码约定

| 退出码 | 含义 | Launcher 行为 |
|--------|------|---------------|
| 0 | 正常退出 | Launcher 也退出 |
| 100 | 请求重启 | 重新启动子进程 |
| 101 | 请求回滚 | 回滚后重启 |
| 其他 | 崩溃 | 崩溃计数 + 重试/回滚 |

### 崩溃处理

- 子进程异常退出时，崩溃计数 +1
- 达到阈值（默认 3 次）后自动回滚到上一个稳定版本
- 每次成功启动后崩溃计数清零

### 更新流程

1. 主程序下载新版本到 `temp/localverse-x.x.x.jar`
2. 创建 `update_pending.flag` 标记文件
3. 主程序退出
4. Launcher 检测到更新标记
5. 验证新版本的 SHA-256 哈希
6. 备份当前版本到 `.bak`
7. 替换为新版本
8. 更新 `version.json`
9. 删除标记文件和临时文件
10. 启动新版本

## version.json 格式

```json
{
  "current": {
    "jar": "1.1.0",
    "jarHash": "sha256:abc123..."
  },
  "lastGood": {
    "jar": "1.0.0",
    "jarHash": "sha256:def456..."
  },
  "crash": {
    "count": 0,
    "maxBeforeRollback": 3,
    "lastCrashTime": null
  }
}
```

## 开发

### 构建

```bash
# 编译和打包
./build/build-launcher.sh

# 输出文件
dist/launcher.jar
```

### 项目结构

```
src/java/launcher/
├── Launcher.java           # 主入口
├── VersionManager.java     # 版本管理
├── ProcessManager.java     # 进程管理
├── HashUtil.java           # 哈希工具
└── LogUtil.java            # 日志工具
```

### 技术栈

- Java 21（使用 Record、Switch Expression 等现代特性）
- 无外部依赖，仅使用 JDK 内置 API
- ProcessBuilder - 进程管理
- MessageDigest - SHA-256 哈希
- Files API - 文件操作

## 日志示例

```
[2026-01-31 14:30:00] [INFO] === Launcher started ===
[2026-01-31 14:30:00] [INFO] Current version: 1.1.0
[2026-01-31 14:30:00] [INFO] Starting localverse.jar...
[2026-01-31 14:30:01] [INFO] Process started, PID: 12345
[2026-01-31 15:00:00] [WARN] Process crashed with exit code: 1
[2026-01-31 15:00:00] [WARN] Crash count increased to 1/3
[2026-01-31 15:00:00] [INFO] Waiting 5 seconds before restart...
```

## 测试

详见任务文档：`openspec/tasks/phase-0/task-001-launcher.md`

## 许可证

MIT License
