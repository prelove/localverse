# Database Service

数据库服务模块，提供统一的数据库访问接口。

## 特性

- ✅ 统一接口：支持 WASM、JAR、Mock 三种实现
- ✅ 自动检测：根据环境自动选择最佳实现
- ✅ 自动降级：JAR 不可用时降级到 WASM
- ✅ 迁移系统：版本化数据库迁移
- ✅ 事务支持：ACID 事务保证
- ✅ 持久化：IndexedDB 自动持久化（WASM 模式）

## 使用方法

### 基本用法

```javascript
import DatabaseServiceFactory from './services/database/index.js';

// 自动检测并选择最佳模式
const db = await DatabaseServiceFactory.create('auto');

// 查询数据
const users = await db.query('SELECT * FROM users WHERE age > ?', [18]);

// 插入数据
const result = await db.run(
  'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
  ['user1', 'Alice', 25]
);

// 事务
await db.transaction(async () => {
  await db.run('INSERT INTO accounts (id, balance) VALUES (?, ?)', ['acc1', 1000]);
  await db.run('UPDATE accounts SET balance = balance - 100 WHERE id = ?', ['acc1']);
});

// 关闭数据库
await db.close();
```

### 指定模式

```javascript
// 仅使用 WASM
const wasmDb = await DatabaseServiceFactory.create('wasm');

// 仅使用 JAR
const jarDb = await DatabaseServiceFactory.create('jar', {
  baseUrl: 'http://127.0.0.1:8765'
});

// 使用 Mock（测试用）
const mockDb = await DatabaseServiceFactory.create('mock');
```

### 检测可用模式

```javascript
const mode = await DatabaseServiceFactory.detectMode();
console.log(`Available mode: ${mode}`); // 'jar', 'wasm', or 'none'
```

## API 文档

### DatabaseService 接口

所有数据库实现都遵循以下接口：

#### `init(): Promise<void>`

初始化数据库连接。

#### `close(): Promise<void>`

关闭数据库连接。

#### `query(sql, params): Promise<Array>`

查询多行数据。

- `sql`: SQL 查询语句
- `params`: 参数数组（可选）
- 返回：结果数组

#### `queryOne(sql, params): Promise<Object|null>`

查询单行数据。

- `sql`: SQL 查询语句
- `params`: 参数数组（可选）
- 返回：结果对象或 null

#### `run(sql, params): Promise<{changes, lastInsertRowid}>`

执行 SQL 语句（INSERT、UPDATE、DELETE）。

- `sql`: SQL 语句
- `params`: 参数数组（可选）
- 返回：`{ changes, lastInsertRowid }`

#### `exec(sql): Promise<void>`

执行 SQL 语句（无参数，可以是多条语句）。

- `sql`: SQL 语句

#### `transaction(callback): Promise<any>`

执行事务。

- `callback`: 事务回调函数
- 返回：回调函数的返回值

#### `isReady(): boolean`

检查数据库是否就绪。

#### `getMode(): string`

获取当前模式（'wasm'、'jar' 或 'mock'）。

## 工具函数

### UUID 生成

```javascript
import { uuidv7, generateId } from './services/database/utils/uuid.js';

// 生成 UUID v7
const id = uuidv7();
// 例如: '018d5b7a-8c9e-7abc-8def-0123456789ab'

// 生成带前缀的 ID
const cardId = generateId('card');
// 例如: 'card_018d5b7a-8c9e-7abc-8def-0123456789ab'
```

### Schema 工具

```javascript
import { timestamps, softDelete, toJSON, fromJSON } from './services/database/utils/schema.js';

// 生成时间戳
const ts = timestamps();
// { created_at: 1234567890, updated_at: 1234567890 }

// 软删除
const del = softDelete('user123');
// { deleted: 1, deleted_at: 1234567890, deleted_by: 'user123' }

// JSON 序列化
const json = toJSON({ name: 'Test', value: 123 });
const obj = fromJSON(json);
```

## 迁移系统

数据库迁移在 `migrations/index.js` 中定义：

```javascript
export const migrations = [
  {
    version: 1,
    name: 'initial',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `
  },
  // 更多迁移...
];
```

迁移会在数据库初始化时自动执行。

## 数据库模式

### WASM 模式

- 使用 sql.js（SQLite 编译为 WASM）
- 数据存储在 IndexedDB
- 完全离线可用
- 自动保存（每 30 秒）
- 支持全文搜索（FTS5）

### JAR 模式

- 通过 HTTP API 访问本地 JAR 服务
- 数据存储在文件系统
- 需要本地 JAR 服务运行
- 支持并发访问
- 更好的性能

### Mock 模式

- 内存存储
- 用于单元测试
- 简化的实现
- 不支持复杂查询

## 测试

运行单元测试：

```bash
# 在浏览器中打开
open tests/unit/database.test.html

# 或使用 Node.js
node tests/unit/database.test.js
```

## 架构

```
database/
├── index.js              # 工厂和主入口
├── wasm-database.js      # WASM 实现
├── jar-database.js       # JAR API 实现
├── mock-database.js      # Mock 实现
├── migrations/
│   └── index.js          # 迁移定义
└── utils/
    ├── uuid.js           # UUID v7 生成
    └── schema.js         # Schema 工具
```

## 注意事项

1. **WASM 模式需要 sql.js**：确保 `/lib/sql.js/sql-wasm.js` 和 `/wasm/sql-wasm.dat` 文件存在
2. **JAR 模式需要服务**：确保本地 JAR 服务在 `http://127.0.0.1:8765` 运行
3. **IndexedDB 限制**：WASM 模式受浏览器 IndexedDB 存储限制
4. **事务嵌套**：避免嵌套事务，SQLite 不支持
5. **并发访问**：WASM 模式不支持多标签页并发写入

## 相关文档

- [数据库规格](../../openspec/specs/05-database.md)
- [任务文档](../../openspec/tasks/phase-0/task-004-database.md)
