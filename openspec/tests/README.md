# 测试规范

## 测试类型

### 单元测试 (unit/)

测试单个函数/类的功能。

**覆盖范围：**
- 数据库服务 (DatabaseService)
- 通信层各传输 (WebSocket, SSE, Polling)
- 同步队列 (SyncQueue)
- 变更追踪 (ChangeTracker)
- 冲突解决 (ConflictResolver)
- 插件基类 (Plugin)
- UI 组件 (Components)

**命名规范：**
```
<模块名>.test.js
例：database-service.test.js
```

### 集成测试 (integration/)

测试多个模块协作。

**覆盖范围：**
- 前端 ↔ Local JAR 通信
- Local JAR ↔ Sync Server 通信
- 同步引擎完整流程
- 插件加载和运行

**命名规范：**
```
<流程名>.integration.test.js
例：sync-flow.integration.test.js
```

### 端到端测试 (e2e/)

测试完整用户场景。

**覆盖范围：**
- 首次启动配置流程
- 创建/编辑/删除卡片
- 多设备同步
- 离线使用和恢复
- 冲突解决流程

**命名规范：**
```
<场景名>.e2e.test.js
例：multi-device-sync.e2e.test.js
```

## 测试优先级

### P0: 核心功能测试

必须通过才能发布：

1. 数据库 CRUD 操作
2. 本地数据持久化
3. 同步推送/拉取
4. 冲突检测

### P1: 重要功能测试

应该通过：

1. 通信层降级
2. 离线队列
3. 插件生命周期
4. 用户认证

### P2: 边缘情况测试

建议通过：

1. 大数据量性能
2. 网络异常恢复
3. 并发操作

## 测试环境

### 前端测试

```javascript
// 使用 Vitest 或 Jest
import { describe, test, expect, beforeEach } from 'vitest';

describe('DatabaseService', () => {
  let db;
  
  beforeEach(async () => {
    db = new WasmDatabaseService();
    await db.init();
  });
  
  test('query returns array', () => {
    const results = db.query('SELECT 1 as num');
    expect(results).toHaveLength(1);
  });
});
```

### 后端测试

```java
// 使用 JUnit 5
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class SyncServiceTest {
    private SyncService syncService;
    
    @BeforeEach
    void setUp() {
        syncService = new SyncServiceImpl(new TestDatabase());
    }
    
    @Test
    void testPushSingleChange() {
        // ...
    }
}
```

## Mock 规范

### 数据库 Mock

```javascript
class MockDatabaseService {
  constructor() {
    this.data = new Map();
  }
  
  query(sql, params) {
    // 简化实现
  }
  
  run(sql, params) {
    // 简化实现
  }
}
```

### 通信层 Mock

```javascript
class MockCommunicationLayer {
  constructor() {
    this.messages = [];
    this.handlers = new Map();
  }
  
  send(message) {
    this.messages.push(message);
    return Promise.resolve();
  }
  
  on(event, handler) {
    this.handlers.set(event, handler);
  }
  
  // 测试辅助：触发事件
  _trigger(event, data) {
    const handler = this.handlers.get(event);
    if (handler) handler(data);
  }
}
```

## 测试数据

### 测试用户

```javascript
const TEST_USERS = [
  { userId: 'test_user_1', userName: '测试用户1', department: 'dev' },
  { userId: 'test_user_2', userName: '测试用户2', department: 'dev' },
];
```

### 测试数据集

```javascript
const TEST_CARDS = [
  { id: 'card_1', title: '测试卡片1', content: '内容1' },
  { id: 'card_2', title: '测试卡片2', content: '内容2' },
];

const TEST_TASKS = [
  { id: 'task_1', title: '测试任务1', status: 'todo' },
  { id: 'task_2', title: '测试任务2', status: 'doing' },
];
```

## 运行测试

```bash
# 前端单元测试
npm run test:unit

# 前端集成测试
npm run test:integration

# E2E 测试
npm run test:e2e

# 全部测试
npm run test

# 后端测试
mvn test
```