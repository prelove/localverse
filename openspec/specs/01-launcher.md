# 01 - Launcher 启动器规格

## 概述

Launcher 是一个轻量级的 Java 启动器，负责：
1. 检查和执行 JAR 更新
2. 启动和监控主程序
3. 崩溃检测和自动回滚
4. 健康检查

## 设计原则

- **极简**：代码量 < 500 行，JAR 大小 < 10KB
- **稳定**：几乎不需要更新
- **可靠**：崩溃检测、自动回滚

## 文件结构

```
localverse/
├── launcher.jar              # 启动器（永久稳定）
├── localverse.jar            # 主程序（可更新）
├── localverse.jar.bak        # 备份（回滚用）
├── version.json              # 版本信息
├── update_pending.flag       # 更新标记文件
└── temp/
    └── localverse-x.x.x.jar  # 下载的新版本
```

## version.json 结构

```json
{
  "current": {
    "jar": "1.1.0",
    "jarHash": "sha256:abc123...",
    "wasm": "2.0.0",
    "frontend": "3.0.0"
  },
  "lastGood": {
    "jar": "1.0.0",
    "jarHash": "sha256:def456...",
    "wasm": "1.9.0",
    "frontend": "2.9.0"
  },
  "remote": {
    "url": "http://192.168.1.100:8080/api/version",
    "checkInterval": 3600
  },
  "crash": {
    "count": 0,
    "maxBeforeRollback": 3,
    "lastCrashTime": null
  },
  "updateHistory": [
    {
      "version": "1.0.0",
      "date": "2026-01-01T00:00:00Z",
      "status": "stable"
    }
  ]
}
```

## 启动流程

```
┌─────────────────────────────────────┐
│ 1. 启动 launcher.jar               │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 2. 读取 version.json               │
│    - 当前版本信息                   │
│    - 崩溃计数                       │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 3. 检查 update_pending.flag        │
│    存在？                           │
│    ├─ 是 → 执行更新流程            │
│    └─ 否 → 继续                    │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 4. 启动 localverse.jar（子进程）   │
│    ProcessBuilder                   │
│    java -jar localverse.jar         │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 5. 监控子进程                       │
│    - 等待退出                       │
│    - 检查退出码                     │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 6. 处理退出                         │
│    exit 0   → launcher 退出        │
│    exit 100 → 重新启动子进程       │
│    exit 101 → 执行回滚后重启       │
│    其他     → 崩溃处理             │
└─────────────────────────────────────┘
```

## 更新流程

```
┌─────────────────────────────────────┐
│ 检测到 update_pending.flag         │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 验证新版本                          │
│ - 检查 temp/localverse-x.x.x.jar   │
│ - 校验 SHA256 哈希                  │
│ - 哈希不匹配？删除并跳过更新       │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 备份当前版本                        │
│ localverse.jar → localverse.jar.bak│
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 替换为新版本                        │
│ temp/xxx.jar → localverse.jar      │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 更新 version.json                   │
│ - lastGood = current               │
│ - current = new                    │
│ - crash.count = 0                  │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 清理                                │
│ - 删除 update_pending.flag         │
│ - 删除 temp/ 下的文件              │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 继续启动流程                        │
└─────────────────────────────────────┘
```

## 崩溃处理

```
┌─────────────────────────────────────┐
│ 子进程异常退出（exit != 0/100/101）│
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ crash.count++                       │
│ crash.lastCrashTime = now           │
│ 保存 version.json                   │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ crash.count >= maxBeforeRollback?   │
│ ├─ 是 → 自动回滚                   │
│ └─ 否 → 等待 5 秒后重启            │
└─────────────────────────────────────┘
```

## 自动回滚

```
┌─────────────────────────────────────┐
│ 触发回滚                            │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 恢复备份                            │
│ localverse.jar.bak → localverse.jar│
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 更新 version.json                   │
│ - current = lastGood               │
│ - crash.count = 0                  │
│ - 记录回滚日志                     │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ 重新启动                            │
└─────────────────────────────────────┘
```

## 退出码约定

| 退出码 | 含义 | Launcher 行为 |
|--------|------|---------------|
| 0 | 正常退出 | Launcher 也退出 |
| 100 | 请求重启 | 重新启动子进程 |
| 101 | 请求回滚 | 回滚后重启 |
| 其他 | 崩溃 | 崩溃计数 + 重试/回滚 |

## 命令行参数

```bash
# 正常启动
java -jar launcher.jar

# 强制检查更新
java -jar launcher.jar --check-update

# 强制回滚
java -jar launcher.jar --rollback

# 显示版本信息
java -jar launcher.jar --version

# 静默模式（无 GUI 提示）
java -jar launcher.jar --silent
```

## 日志

```
logs/
└── launcher.log

格式：
[2026-01-31 14:30:00] [INFO] Launcher started
[2026-01-31 14:30:00] [INFO] Current version: 1.1.0
[2026-01-31 14:30:00] [INFO] Starting localverse.jar...
[2026-01-31 14:30:01] [INFO] Process started, PID: 12345
[2026-01-31 15:00:00] [WARN] Process crashed, exit code: 1
[2026-01-31 15:00:00] [INFO] Crash count: 1/3, restarting...
```

## 接口定义

### LauncherConfig
```java
public record LauncherConfig(
    String mainJar,           // 主程序 JAR 路径
    String backupJar,         // 备份 JAR 路径
    String tempDir,           // 临时目录
    String versionFile,       // version.json 路径
    String logFile,           // 日志文件路径
    int maxCrashCount,        // 最大崩溃次数
    int restartDelay          // 重启延迟（毫秒）
) {}
```

### VersionInfo
```java
public record VersionInfo(
    VersionDetail current,
    VersionDetail lastGood,
    RemoteConfig remote,
    CrashInfo crash,
    List<UpdateRecord> updateHistory
) {}

public record VersionDetail(
    String jar,
    String jarHash,
    String wasm,
    String frontend
) {}

public record CrashInfo(
    int count,
    int maxBeforeRollback,
    Instant lastCrashTime
) {}
```

## 测试要点

1. **正常启动测试**
   - 无更新时正常启动
   - 子进程正常运行

2. **更新测试**
   - 检测到更新标记
   - 正确执行替换
   - 哈希校验失败时跳过

3. **崩溃测试**
   - 崩溃计数正确递增
   - 达到阈值时自动回滚
   - 回滚后正常运行

4. **回滚测试**
   - 手动回滚命令
   - 自动回滚
   - 回滚后版���正确

## 相关任务

- `tasks/phase-0/task-001-launcher.md`