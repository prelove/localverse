# Task 001: Launcher 启动器开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | task-001-launcher |
| 阶段 | Phase 0 - 基础设施 |
| 优先级 | P0 (最高) |
| 预估工时 | 8 小时 |
| 依赖 | 无 |
| 产出 | launcher.jar |

## 目标

开发一个轻量级 Java 启动器，负责：
1. 启动和监控主程序 (localverse.jar)
2. 检测更新并执行热替换
3. 崩溃检测和自动回滚

## 详细需求

### 1. 核心功能

#### 1.1 启动流程
```
启动 launcher.jar
    ↓
读取 version.json
    ↓
检查 update_pending.flag
    ├─ 存在 → 执行更新流程
    └─ 不存在 → 继续
    ↓
启动 localverse.jar (子进程)
    ↓
监控子进程状态
    ↓
处理退出码
```

#### 1.2 更新流程
- 检测 `update_pending.flag` 文件
- 验证新版本 JAR 的 SHA256 哈希
- 备份当前 JAR 到 `.bak`
- 替换为新版本
- 删除标记文件
- 继续启动流程

#### 1.3 崩溃检测
- 监控子进程退出码
- 非正常退出时增加崩溃计数
- 崩溃 3 次后自动回滚到上一稳定版本

### 2. 退出码约定

| 退出码 | 含义 | Launcher 行为 |
|--------|------|---------------|
| 0 | 正常退出 | Launcher 也退出 |
| 100 | 请求重启 | 重新启动子进程 |
| 101 | 请求回滚 | 回滚后重启 |
| 其他 | 崩溃 | 崩溃计数 + 重试/回滚 |

### 3. 文件结构

```
localverse/
├── launcher.jar              # 启动器 (本任务产出)
├── localverse.jar            # 主程序
├── localverse.jar.bak        # 备份
├── version.json              # 版本信息
├── update_pending.flag       # 更新标记
├── temp/
│   └── localverse-x.x.x.jar  # 下载的新版本
└── logs/
    └── launcher.log          # 日志
```

### 4. version.json 格式

```json
{
  "current": {
    "jar": "1.0.0",
    "jarHash": "sha256:abc123..."
  },
  "lastGood": {
    "jar": "0.9.0",
    "jarHash": "sha256:def456..."
  },
  "crash": {
    "count": 0,
    "maxBeforeRollback": 3,
    "lastCrashTime": null
  }
}
```

## 技术规格

### 依赖
- Java 21 (无外部依赖)
- 使用 JDK 内置 API

### 类结构

```java
// 主类
public class Launcher {
    public static void main(String[] args);
    private void run();
}

// 版本管理
public class VersionManager {
    public VersionInfo loadVersion();
    public void saveVersion(VersionInfo info);
    public boolean hasUpdate();
    public void applyUpdate();
    public void rollback();
}

// 进程管理
public class ProcessManager {
    public Process startMainJar();
    public int waitForExit(Process process);
    public void killProcess(Process process);
}

// 配置
public record LauncherConfig(
    String mainJar,
    String backupJar,
    String versionFile,
    int maxCrashCount,
    int restartDelay
);

// 版本信息
public record VersionInfo(
    VersionDetail current,
    VersionDetail lastGood,
    CrashInfo crash
);

public record VersionDetail(String jar, String jarHash);
public record CrashInfo(int count, int max, Instant lastCrashTime);
```

## 实现步骤

### Step 1: 项目结构 (1h)
```
src/java/launcher/
├── Launcher.java           # 主入口
├── VersionManager.java     # 版本管理
├── ProcessManager.java     # 进程管理
├── HashUtil.java           # 哈希工具
└── LogUtil.java            # 日志工具
```

### Step 2: 版本管理 (2h)
- 实现 version.json 读写
- 实现 SHA256 哈希计算和校验
- 实现备份和恢复

### Step 3: 进程管理 (2h)
- 使用 ProcessBuilder 启动子进程
- 实现进程监控
- 处理各种退出码

### Step 4: 崩溃检测和回滚 (2h)
- 实现崩溃计数逻辑
- 实现自动回滚
- 实现手动回滚命令

### Step 5: 测试和打包 (1h)
- 编写测试用例
- 打包为 JAR

## 测试要点

### 单元测试

```java
@Test
void testLoadVersion() {
    // 测试正常加载
    // 测试文件不存在
    // 测试格式错误
}

@Test
void testHashValidation() {
    // 测试哈希计算
    // 测试哈希比对
}

@Test
void testCrashDetection() {
    // 测试崩溃计数
    // 测试达到阈值
}
```

### 集成测试

1. **正常启动测试**
   - 无更新时正常启动
   - 子进程正常运行

2. **更新测试**
   - 检测到更新标记
   - 正确执行替换
   - 哈希校验失败时跳过

3. **崩溃测试**
   - 模拟崩溃
   - 验证计数递增
   - 验证自动回滚

4. **回滚测试**
   - 手动回滚命令
   - 自动回滚
   - 验证版本正确

## 验收标准

- [ ] launcher.jar 大小 < 20KB
- [ ] 无外部依赖
- [ ] 支持 Windows/Mac/Linux
- [ ] 正常启动成功
- [ ] 更新流程正确
- [ ] 崩溃检测和回滚正确
- [ ] 日志输出清晰
- [ ] 代码注释完整

## 命令行接口

```bash
# 正常启动
java -jar launcher.jar

# 显示版本
java -jar launcher.jar --version

# 强制检查更新
java -jar launcher.jar --check-update

# 强制回滚
java -jar launcher.jar --rollback

# 静默模式
java -jar launcher.jar --silent
```

## 参考规格

- `specs/01-launcher.md` - 启动器详细规格
- `specs/00-architecture.md` - 整体架构

## 下一步

完成后进入 `task-002-local-jar.md` - 本地 JAR 服务开发