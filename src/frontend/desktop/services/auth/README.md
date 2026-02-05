# Authentication Module

认证系统模块，提供基于设备指纹的无密码认证机制。

## 功能特性

- ✅ **设备指纹认证**: 基于浏览器特征生成稳定的设备ID
- ✅ **Token 管理**: HMAC-SHA256 签名，localStorage + IndexedDB 双重持久化
- ✅ **自动认证**: 打开应用自动认证，无需登录
- ✅ **权限控制**: 三角色权限模型 (admin/user/guest)
- ✅ **首次配置**: 简洁的用户配置界面
- ✅ **Token 刷新**: 自动刷新即将过期的 token

## 目录结构

```
src/frontend/desktop/services/auth/
├── index.js                # 主入口，导出所有模块
├── device-fingerprint.js   # 设备指纹生成
├── token-manager.js        # Token 管理（生成、验证、存储）
├── auth-service.js         # 认证服务（主要业务逻辑）
├── permission.js           # 权限检查
└── setup-ui.js            # 配置界面

src/frontend/desktop/assets/css/
└── auth.css               # 认证界面样式

openspec/tests/unit/auth/
├── device-fingerprint.test.js  # 设备指纹测试
├── token-manager.test.js       # Token 管理测试
├── permission.test.js          # 权限测试
├── auth-service.test.js        # 认证服务测试
└── test-runner.html           # 测试运行器
```

## 快速开始

### 基本使用

```javascript
import { authService } from './services/auth/index.js';

// 1. 应用启动时自动认证
const user = await authService.authenticate();

if (user) {
  // 用户已认证，进入主界面
  console.log('Welcome:', user.name);
} else {
  // 需要首次配置
  showSetupUI();
}

// 2. 首次配置
import { SetupUI } from './services/auth/index.js';

const setupUI = new SetupUI(container);
setupUI.render();

setupUI.setOnComplete(async (userData) => {
  const user = await authService.setup(userData);
  // 配置完成，进入主界面
});

// 3. 获取当前用户
const currentUser = authService.getCurrentUser();

// 4. 退出登录
await authService.logout();
```

### 权限检查

```javascript
import { hasPermission, canAccessData } from './services/auth/index.js';

// 检查用户权限
if (hasPermission(user, 'card:create')) {
  // 用户有创建卡片的权限
}

// 检查数据访问权限
if (canAccessData(user, cardData)) {
  // 用户可以访问此卡片
}

// 使用装饰器（需要支持装饰器的环境）
import { requirePermission } from './services/auth/index.js';

class CardService {
  @requirePermission('card:create')
  async createCard(data) {
    // 此方法需要 card:create 权限
  }
}
```

### HTTP 请求认证

```javascript
import { authService } from './services/auth/index.js';

// 获取认证 header
const headers = await authService.getAuthHeader();

// 发起请求
fetch('/api/cards', {
  method: 'GET',
  headers: {
    ...headers,
    'Content-Type': 'application/json'
  }
});
```

## Token 结构

```javascript
{
  // 用户信息
  userId: 'zhangsan',           // 工号
  userName: '张三',              // 姓名
  department: 'dev',            // 部门
  role: 'user',                 // 角色
  
  // 设备信息
  deviceId: 'd_abc123def456',   // 设备指纹（16位）
  deviceName: '张三的设备',      // 设备名称
  platform: 'windows',          // 平台
  
  // 时间信息
  createdAt: 1709888888000,     // 创建时间
  expiresAt: 1712480888000,     // 过期时间（30天）
  
  // 签名
  signature: 'sha256:...'       // HMAC-SHA256 签名
}
```

## 权限模型

### 角色定义

| 角色 | 说明 | 权限 |
|------|------|------|
| admin | 管理员 | 所有权限 (*) |
| user | 普通用户 | 读写自己和部门数据 |
| guest | 访客 | 只读公共数据 |

### 权限列表

```javascript
// 用户权限示例
user: {
  permissions: [
    'card:create', 'card:read', 'card:update', 'card:delete',
    'task:create', 'task:read', 'task:update', 'task:delete',
    'file:create', 'file:read', 'file:delete',
    'chat:send', 'chat:read',
    'vote:create', 'vote:read', 'vote:vote',
    'calendar:create', 'calendar:read', 'calendar:update'
  ]
}
```

## API 文档

### AuthService

#### `authenticate(): Promise<User|null>`
自动认证用户，返回用户对象或 null（需要配置）。

#### `setup(userData): Promise<User>`
首次配置，生成 token 并保存。

- `userData.userId` - 工号（必填）
- `userData.userName` - 姓名（必填）
- `userData.department` - 部门（必填）
- `userData.role` - 角色（可选，默认 'user'）

#### `logout(): Promise<void>`
退出登录，清除 token。

#### `getCurrentUser(): User|null`
获取当前用户对象。

#### `isAuthenticated(): boolean`
检查是否已认证。

#### `getToken(): Promise<Token|null>`
获取当前 token。

#### `getAuthHeader(): Promise<Object>`
获取 HTTP 认证 header。

### TokenManager

#### `generateToken(userData, deviceId): Promise<Token>`
生成新 token。

#### `verifySignature(token): Promise<boolean>`
验证 token 签名。

#### `saveToken(token): Promise<void>`
保存 token 到存储。

#### `loadToken(): Promise<Token|null>`
加载 token。

#### `clearToken(): Promise<void>`
清除 token。

#### `isTokenExpired(token): boolean`
检查 token 是否过期。

#### `shouldRefreshToken(token): boolean`
检查是否需要刷新 token。

#### `refreshToken(token): Promise<Token>`
刷新 token。

### Permission Functions

#### `hasPermission(user, permission): boolean`
检查用户是否有指定权限。

#### `canAccessData(user, data): boolean`
检查用户是否可以访问数据。

#### `requirePermission(permission): Decorator`
权限装饰器。

#### `getRoleName(roleKey): string`
获取角色显示名称。

#### `getRolePermissions(roleKey): Array<string>`
获取角色权限列表。

### Device Fingerprint

#### `generateDeviceId(): Promise<string>`
生成设备 ID。

#### `detectPlatform(): string`
检测平台类型。

## 测试

### 运行测试

在浏览器中打开测试页面：

```
openspec/tests/unit/auth/test-runner.html
```

测试覆盖：
- ✅ 设备指纹生成和稳定性
- ✅ Token 生成和验证
- ✅ 签名验证
- ✅ Token 过期检查
- ✅ Token 刷新逻辑
- ✅ 存储持久化（localStorage + IndexedDB）
- ✅ 权限检查
- ✅ 数据访问控制
- ✅ 认证流程
- ✅ 登出功能

### 演示页面

```
src/frontend/desktop/demo-auth.html
```

交互式演示包括：
- 首次配置界面
- 自动认证
- 用户信息显示
- 登出功能

## 安全考虑

### 已实现的安全措施

1. **签名防篡改**: Token 使用 HMAC-SHA256 签名，防止客户端篡改
2. **设备绑定**: 基于设备指纹验证，限制 token 在其他设备使用
3. **过期机制**: Token 30天自动过期
4. **双重存储**: localStorage + IndexedDB，提高可靠性
5. **自动刷新**: 过期前7天自动刷新

### 安全限制

⚠️ 本认证系统设计用于**内网环境**，有以下限制：

1. **非加密连接**: 在 HTTP 环境下运行（内网场景）
2. **客户端存储**: Token 存储在客户端，可被用户访问
3. **无中心验证**: 没有中央服务器验证（可选）
4. **设备指纹可变**: 浏览器更新或设置变化可能改变指纹

### 安全建议

在生产环境中建议：

1. 使用 HTTPS（如果可用）
2. 配合 Sync Server 进行中央验证
3. 定期更新密钥
4. 实施访问日志记录
5. 添加异常检测机制

## 技术细节

### 设备指纹生成

使用以下浏览器特征：
- User Agent
- 语言设置
- 平台信息
- 屏幕分辨率和色深
- 时区
- Canvas 指纹
- WebGL 指纹

### Token 签名算法

```javascript
// Payload
payload = userId:deviceId:createdAt:expiresAt

// Signature
signature = HMAC-SHA256(payload, SECRET_KEY)
```

### 存储策略

1. 优先使用 localStorage（快速访问）
2. 同时备份到 IndexedDB（更可靠）
3. 读取时先尝试 localStorage，失败则尝试 IndexedDB
4. 如果从 IndexedDB 恢复，同步回 localStorage

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

要求：
- Web Crypto API
- IndexedDB
- localStorage
- ES2022 支持

## 相关文档

- [任务文档](../../../openspec/tasks/phase-0/task-005-authentication.md)
- [规格文档](../../../openspec/specs/06-authentication.md)
- [架构设计](../../../openspec/specs/00-architecture.md)

## License

MIT
