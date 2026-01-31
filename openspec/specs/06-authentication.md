# 06 - 认证授权规格

## 概述

Localverse 采用极简认证设计：
1. **首次使用**：简单配置（工号、姓名、部门）
2. **日常使用**：设备令牌自动认证，用户无感知
3. **权限控制**：三角色模型（admin/user/guest）

## 设计原则

- **用户透明**：打开即用，无登录框
- **安全足够**：签名防篡改，设备绑定
- **实现简单**：无需复杂的 OAuth 流程

## 设备令牌设计

### 令牌结构

```javascript
const token = {
  // 用户信息
  userId: 'zhangsan',           // 工号
  userName: '张三',              // 姓名
  department: 'dev',            // 部门
  role: 'user',                 // 角色
  
  // 设备信息
  deviceId: 'd_abc123def456',   // 设备指纹
  deviceName: '张三的工作站',    // 设备名称
  platform: 'windows',          // 平台
  
  // 时间信息
  createdAt: 1709888888000,     // 创建时间
  expiresAt: 1712480888000,     // 过期时间（30天后）
  
  // 签名
  signature: 'sha256:...'       // 防篡改签名
};

// 序列化为 Base64
const tokenString = btoa(JSON.stringify(token));
```

### 签名算法

```javascript
function generateSignature(token, secretKey) {
  const payload = [
    token.userId,
    token.deviceId,
    token.createdAt,
    token.expiresAt
  ].join(':');
  
  // 使用 Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const data = encoder.encode(payload);
  
  return crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => 
    crypto.subtle.sign('HMAC', key, data)
  ).then(signature => 
    'sha256:' + Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

function verifySignature(token, secretKey) {
  const expectedSignature = await generateSignature(token, secretKey);
  return token.signature === expectedSignature;
}
```

### 设备指纹生成

```javascript
async function generateDeviceId() {
  const components = [
    // 浏览器信息
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    
    // 屏幕信息
    screen.width,
    screen.height,
    screen.colorDepth,
    
    // 时区
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Canvas 指纹
    await getCanvasFingerprint(),
    
    // WebGL 指���
    await getWebGLFingerprint()
  ];
  
  const fingerprint = components.join('|');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );
  
  return 'd_' + Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function getCanvasFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Localverse fingerprint', 2, 2);
  return canvas.toDataURL();
}

function getWebGLFingerprint() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return '';
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return '';
  
  return [
    gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
    gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
  ].join('|');
}
```

## 首次使用流程

### 配置界面

```html
<div class="setup-container">
  <h1>欢迎使用 Localverse</h1>
  <p>请填写以下信息完成初始化</p>
  
  <form id="setupForm">
    <div class="form-group">
      <label for="userId">工号 <span class="required">*</span></label>
      <input type="text" id="userId" required 
             pattern="[a-zA-Z0-9_]+" 
             placeholder="例如: zhangsan">
    </div>
    
    <div class="form-group">
      <label for="userName">姓名 <span class="required">*</span></label>
      <input type="text" id="userName" required 
             placeholder="例如: 张三">
    </div>
    
    <div class="form-group">
      <label for="department">部门 <span class="required">*</span></label>
      <select id="department" required>
        <option value="">请选择</option>
        <option value="dev">开发部</option>
        <option value="qa">测试部</option>
        <option value="ops">运维部</option>
        <option value="product">产品部</option>
        <option value="design">设计部</option>
        <option value="hr">人事部</option>
        <option value="finance">财务部</option>
        <option value="admin">行政部</option>
      </select>
    </div>
    
    <button type="submit" class="btn-primary">完成设置</button>
  </form>
</div>
```

### 初始化流程

```javascript
async function handleSetup(formData) {
  // 1. 生成设备指纹
  const deviceId = await generateDeviceId();
  
  // 2. 构建令牌
  const token = {
    userId: formData.userId,
    userName: formData.userName,
    department: formData.department,
    role: 'user',
    deviceId: deviceId,
    deviceName: `${formData.userName}的设备`,
    platform: detectPlatform(),
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000  // 30天
  };
  
  // 3. 生成签名
  token.signature = await generateSignature(token, SECRET_KEY);
  
  // 4. 保存令牌
  localStorage.setItem('localverse_token', JSON.stringify(token));
  await saveToIndexedDB('auth', 'token', token);
  
  // 5. 如果有 Sync Server，注册设备
  if (syncServerAvailable) {
    await registerDevice(token);
  }
  
  // 6. 初始化完成
  window.location.reload();
}
```

## 日常使用流程

### 自动认证

```javascript
async function autoAuthenticate() {
  // 1. 读取本地令牌
  let token = localStorage.getItem('localverse_token');
  if (!token) {
    token = await getFromIndexedDB('auth', 'token');
  }
  
  if (!token) {
    // 无令牌，显示配置界面
    showSetupScreen();
    return null;
  }
  
  token = JSON.parse(token);
  
  // 2. 验证签名
  const isValid = await verifySignature(token, SECRET_KEY);
  if (!isValid) {
    // 签名无效，可能被篡改
    clearToken();
    showSetupScreen();
    return null;
  }
  
  // 3. 检查过期
  if (token.expiresAt < Date.now()) {
    // 令牌过期，需要重新配置
    clearToken();
    showSetupScreen();
    return null;
  }
  
  // 4. 验证设备指纹
  const currentDeviceId = await generateDeviceId();
  if (token.deviceId !== currentDeviceId) {
    // 设备变更，可能是复制的令牌
    console.warn('Device fingerprint mismatch');
    // 可以选择：重新配置 或 允许（宽松模式）
  }
  
  // 5. 认证成功
  return token;
}
```

### 令牌刷新

```javascript
async function refreshToken(token) {
  // 检查是否需要刷新（过期前7天）
  const refreshThreshold = 7 * 24 * 60 * 60 * 1000;
  if (token.expiresAt - Date.now() > refreshThreshold) {
    return token;  // 不需要刷新
  }
  
  // 生成新令牌
  const newToken = {
    ...token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  newToken.signature = await generateSignature(newToken, SECRET_KEY);
  
  // 保存
  localStorage.setItem('localverse_token', JSON.stringify(newToken));
  await saveToIndexedDB('auth', 'token', newToken);
  
  // 通知服务器（如果在线）
  if (syncServerAvailable) {
    await updateDeviceToken(newToken);
  }
  
  return newToken;
}
```

## 权限模型

### 三角色定义

```javascript
const ROLES = {
  admin: {
    name: '管理员',
    permissions: ['*']  // 所有权限
  },
  user: {
    name: '普通用户',
    permissions: [
      'card:create', 'card:read', 'card:update', 'card:delete',
      'task:create', 'task:read', 'task:update', 'task:delete',
      'file:create', 'file:read', 'file:delete',
      'chat:send', 'chat:read',
      'vote:create', 'vote:read', 'vote:vote',
      'calendar:create', 'calendar:read', 'calendar:update'
    ]
  },
  guest: {
    name: '访客',
    permissions: [
      'card:read',
      'task:read',
      'file:read',
      'chat:read',
      'vote:read',
      'calendar:read'
    ]
  }
};
```

### 权限检查

```javascript
function hasPermission(user, permission) {
  const role = ROLES[user.role];
  if (!role) return false;
  
  // 管理员拥有所有权限
  if (role.permissions.includes('*')) return true;
  
  // 检查具体权限
  return role.permissions.includes(permission);
}

function requirePermission(permission) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      const user = await getCurrentUser();
      if (!hasPermission(user, permission)) {
        throw new Error(`Permission denied: ${permission}`);
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

// 使用示例
class TaskService {
  @requirePermission('task:create')
  async createTask(data) {
    // ...
  }
}
```

### 数据权限

```javascript
function canAccessData(user, data) {
  // 管理员可以访问所有数据
  if (user.role === 'admin') return true;
  
  // 自己创建的数据
  if (data.created_by === user.userId) return true;
  
  // 同部门的数据（如果数据有部门限制）
  if (data.department && data.department === user.department) return true;
  
  // 公开数据
  if (data.visibility === 'public') return true;
  
  // 被明确授权的数据
  if (data.shared_with && data.shared_with.includes(user.userId)) return true;
  
  return false;
}
```

## Sync Server 认证

### 设备注册

```javascript
async function registerDevice(token) {
  const response = await fetch(`${SYNC_SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: token.userId,
      userName: token.userName,
      department: token.department,
      deviceId: token.deviceId,
      deviceName: token.deviceName,
      platform: token.platform,
      localAddresses: await getLocalAddresses(),
      version: APP_VERSION
    })
  });
  
  if (!response.ok) {
    throw new Error('Device registration failed');
  }
  
  const result = await response.json();
  return result;
}
```

### 请求认证

```javascript
async function authenticatedFetch(url, options = {}) {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${btoa(JSON.stringify(token))}`,
    'X-Device-Id': token.deviceId
  };
  
  return fetch(url, { ...options, headers });
}
```

### 服务端验证

```java
public class AuthFilter implements Filter {
    
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(401);
            return;
        }
        
        String tokenStr = authHeader.substring(7);
        try {
            String json = new String(Base64.getDecoder().decode(tokenStr));
            Token token = gson.fromJson(json, Token.class);
            
            // 验证签名
            if (!verifySignature(token)) {
                response.setStatus(401);
                return;
            }
            
            // 验证过期
            if (token.expiresAt < System.currentTimeMillis()) {
                response.setStatus(401);
                return;
            }
            
            // 设置用户上下文
            request.setAttribute("user", token);
            chain.doFilter(request, response);
            
        } catch (Exception e) {
            response.setStatus(401);
        }
    }
}
```

## 存储位置

### 令牌存储

```javascript
// 存储位置（双备份）
// 1. localStorage（快速访问）
localStorage.setItem('localverse_token', JSON.stringify(token));

// 2. IndexedDB（更可靠）
await db.put('auth', { key: 'token', value: token });

// 读取顺序
async function getToken() {
  // 先尝试 localStorage
  let token = localStorage.getItem('localverse_token');
  if (token) return JSON.parse(token);
  
  // 再尝试 IndexedDB
  const record = await db.get('auth', 'token');
  if (record) {
    // 同步到 localStorage
    localStorage.setItem('localverse_token', JSON.stringify(record.value));
    return record.value;
  }
  
  return null;
}
```

### JAR 端存储

```java
// 配置文件存储
// data/config/auth.json
{
  "token": { ... },
  "lastLogin": 1709888888000,
  "loginHistory": [
    { "time": 1709888888000, "ip": "127.0.0.1" }
  ]
}
```

## 安全考虑

### 防护措施

1. **签名防篡改**：令牌包含 HMAC-SHA256 签名
2. **设备绑定**：设备指纹验证
3. **过期机制**：30天自动过期
4. **传输安全**：HTTPS（如果可用）

### 攻击防护

1. **令牌泄露**：设备指纹验证限制在其他设备使用
2. **重放攻击**：时间戳 + 过期检查
3. **暴力破解**：限流 + 锁定
4. **XSS**：HttpOnly Cookie（如果使用 Cookie）

## 测试要点

### 单元测试

1. **令牌生成**
   - 格式正确
   - 签名有效
   - 设备指纹稳定

2. **权限检查**
   - 各角色权限正确
   - 数据权限正确

3. **过期处理**
   - 过期检测
   - 自动刷新

### 集成测试

1. **首次配置流程**
2. **自动认证流程**
3. **服务器注册流程**
4. **令牌刷新流程**

### 安全测试

1. **篡改令牌**
2. **过期令牌**
3. **跨设备使用**

## 相关规格

- `03-sync-server.md` - 服务端认证
- `04-communication.md` - 认证消息传输

## 相关任务

- `tasks/phase-0/task-005-authentication.md`