# Task 005: 认证系统开发

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | task-005-authentication |
| 阶段 | Phase 0 - 基础设施 |
| 优先级 | P0 (最高) |
| 预估工时 | 8 小时 |
| 依赖 | task-004-database |
| 产出 | 认证模块 |

## 目标

开发极简认证系统：
1. 首次使用配置（工号、姓名、部门）
2. 设备令牌自动认证
3. 三角色权限模型

## 详细需求

### 1. 首次配置流程

```
用户打开应用
    ↓
检查本地令牌
    ├─ 存在且有效 → 自动认证 → 进入主界面
    └─ 不存在/无效 → 显示配置界面
          ↓
      用户填写信息
      (工号、姓名、部门)
          ↓
      生成设备令牌
          ↓
      保存到本地
          ↓
      进入主界面
```

### 2. 设备令牌结构

```javascript
const token = {
  // 用户信息
  userId: 'zhangsan',
  userName: '张三',
  department: 'dev',
  role: 'user',
  
  // 设备信息
  deviceId: 'd_abc123def456',
  deviceName: '张三的工作站',
  platform: 'windows',
  
  // 时间信息
  createdAt: 1709888888000,
  expiresAt: 1712480888000,  // 30天
  
  // 签名
  signature: 'sha256:...'
};
```

### 3. 权限模型

| 角色 | 权限 |
|------|------|
| admin | 所有权限 |
| user | 读写自己的数据，读公共数据 |
| guest | 只读公共数据 |

## 技术规格

### 文件结构

```
src/frontend/desktop/services/
├── auth/
│   ├── index.js                 # 主入口
│   ├── auth-service.js          # 认证服务
│   ├── token-manager.js         # 令牌管理
│   ├── device-fingerprint.js    # 设备指纹
│   ├── permission.js            # 权限检查
│   └── setup-ui.js              # 配置界面
```

## 实现步骤

### Step 1: 设备指纹 (1h)

```javascript
// auth/device-fingerprint.js

export async function generateDeviceId() {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    await getCanvasFingerprint(),
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

export function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  return 'unknown';
}
```

### Step 2: 令牌管理 (2h)

```javascript
// auth/token-manager.js

const SECRET_KEY = 'localverse-secret-key-2024';
const TOKEN_STORAGE_KEY = 'localverse_token';
const TOKEN_EXPIRY_DAYS = 30;

export class TokenManager {
  async generateToken(userData, deviceId) {
    const now = Date.now();
    
    const token = {
      userId: userData.userId,
      userName: userData.userName,
      department: userData.department,
      role: userData.role || 'user',
      deviceId,
      deviceName: `${userData.userName}的设备`,
      platform: detectPlatform(),
      createdAt: now,
      expiresAt: now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    };
    
    token.signature = await this.generateSignature(token);
    
    return token;
  }
  
  async generateSignature(token) {
    const payload = [
      token.userId,
      token.deviceId,
      token.createdAt,
      token.expiresAt
    ].join(':');
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const data = encoder.encode(payload);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    
    return 'sha256:' + Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  async verifySignature(token) {
    const expectedSignature = await this.generateSignature(token);
    return token.signature === expectedSignature;
  }
  
  async saveToken(token) {
    const tokenString = JSON.stringify(token);
    
    // 保存到 localStorage
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenString);
    
    // 备份到 IndexedDB
    await this.saveToIndexedDB(token);
  }
  
  async loadToken() {
    // 先尝试 localStorage
    let tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
    
    if (!tokenString) {
      // 再尝试 IndexedDB
      const token = await this.loadFromIndexedDB();
      if (token) {
        // 同步回 localStorage
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
        return token;
      }
      return null;
    }
    
    try {
      return JSON.parse(tokenString);
    } catch {
      return null;
    }
  }
  
  async clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    await this.clearFromIndexedDB();
  }
  
  isTokenExpired(token) {
    return token.expiresAt < Date.now();
  }
  
  shouldRefreshToken(token) {
    const refreshThreshold = 7 * 24 * 60 * 60 * 1000; // 7天
    return token.expiresAt - Date.now() < refreshThreshold;
  }
  
  async refreshToken(token) {
    const newToken = {
      ...token,
      expiresAt: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    };
    newToken.signature = await this.generateSignature(newToken);
    await this.saveToken(newToken);
    return newToken;
  }
  
  // IndexedDB 操作
  async saveToIndexedDB(token) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_auth', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth');
        }
      };
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('auth', 'readwrite');
        tx.objectStore('auth').put(token, 'token');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_auth', 1);
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          resolve(null);
          return;
        }
        
        const tx = db.transaction('auth', 'readonly');
        const getRequest = tx.objectStore('auth').get('token');
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async clearFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('localverse_auth', 1);
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('auth')) {
          resolve();
          return;
        }
        
        const tx = db.transaction('auth', 'readwrite');
        tx.objectStore('auth').delete('token');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}
```

### Step 3: 认证服务 (2h)

```javascript
// auth/auth-service.js

import { TokenManager } from './token-manager.js';
import { generateDeviceId, detectPlatform } from './device-fingerprint.js';

export class AuthService {
  constructor() {
    this.tokenManager = new TokenManager();
    this.currentUser = null;
    this.deviceId = null;
  }
  
  async init() {
    // 生成/获取设备 ID
    this.deviceId = await this.getOrCreateDeviceId();
  }
  
  async getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('localverse_device_id');
    
    if (!deviceId) {
      deviceId = await generateDeviceId();
      localStorage.setItem('localverse_device_id', deviceId);
    }
    
    return deviceId;
  }
  
  async authenticate() {
    await this.init();
    
    // 加载令牌
    const token = await this.tokenManager.loadToken();
    
    if (!token) {
      return null; // 需要配置
    }
    
    // 验证签名
    const isValid = await this.tokenManager.verifySignature(token);
    if (!isValid) {
      console.warn('Token signature invalid');
      await this.tokenManager.clearToken();
      return null;
    }
    
    // 检查过期
    if (this.tokenManager.isTokenExpired(token)) {
      console.warn('Token expired');
      await this.tokenManager.clearToken();
      return null;
    }
    
    // 验证设备 ID
    if (token.deviceId !== this.deviceId) {
      console.warn('Device ID mismatch');
      // 可选：强制重新配置或允许（宽松模式）
    }
    
    // 刷新令牌（如果快过期）
    let finalToken = token;
    if (this.tokenManager.shouldRefreshToken(token)) {
      finalToken = await this.tokenManager.refreshToken(token);
    }
    
    this.currentUser = {
      id: finalToken.userId,
      name: finalToken.userName,
      department: finalToken.department,
      role: finalToken.role,
      deviceId: finalToken.deviceId
    };
    
    return this.currentUser;
  }
  
  async setup(userData) {
    await this.init();
    
    // 生成令牌
    const token = await this.tokenManager.generateToken(userData, this.deviceId);
    
    // 保存
    await this.tokenManager.saveToken(token);
    
    // 设置当前用户
    this.currentUser = {
      id: token.userId,
      name: token.userName,
      department: token.department,
      role: token.role,
      deviceId: token.deviceId
    };
    
    return this.currentUser;
  }
  
  async logout() {
    await this.tokenManager.clearToken();
    this.currentUser = null;
  }
  
  getCurrentUser() {
    return this.currentUser;
  }
  
  isAuthenticated() {
    return this.currentUser !== null;
  }
  
  async getToken() {
    return await this.tokenManager.loadToken();
  }
  
  async getAuthHeader() {
    const token = await this.getToken();
    if (!token) return {};
    
    return {
      'Authorization': `Bearer ${btoa(JSON.stringify(token))}`,
      'X-Device-Id': token.deviceId
    };
  }
}

// 单例
export const authService = new AuthService();
```

### Step 4: 权限检查 (1h)

```javascript
// auth/permission.js

const ROLES = {
  admin: {
    name: '管理员',
    permissions: ['*']
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

export function hasPermission(user, permission) {
  if (!user) return false;
  
  const role = ROLES[user.role];
  if (!role) return false;
  
  // 管理员拥有所有权限
  if (role.permissions.includes('*')) return true;
  
  // 检查具体权限
  return role.permissions.includes(permission);
}

export function requirePermission(permission) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const { authService } = await import('./auth-service.js');
      const user = authService.getCurrentUser();
      
      if (!hasPermission(user, permission)) {
        throw new Error(`Permission denied: ${permission}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

export function canAccessData(user, data) {
  if (!user) return false;
  
  // 管理员可以访问所有数据
  if (user.role === 'admin') return true;
  
  // 自己创建的数据
  if (data.created_by === user.id) return true;
  
  // 同部门的数据
  if (data.department === user.department) return true;
  
  // 公开数据
  if (data.visibility === 'public') return true;
  
  // 被授权的数据
  if (data.shared_with?.includes(user.id)) return true;
  
  return false;
}
```

### Step 5: 配置界面 (2h)

```javascript
// auth/setup-ui.js

export class SetupUI {
  constructor(container) {
    this.container = container;
    this.onComplete = null;
  }
  
  render() {
    this.container.innerHTML = `
      <div class="setup-container">
        <div class="setup-card">
          <div class="setup-header">
            <h1>欢迎使用 Localverse</h1>
            <p>请填写以下信息完成初始化</p>
          </div>
          
          <form id="setupForm" class="setup-form">
            <div class="form-group">
              <label for="userId">工号 <span class="required">*</span></label>
              <input type="text" id="userId" name="userId" required
                     pattern="[a-zA-Z0-9_]+"
                     placeholder="例如: zhangsan"
                     autocomplete="off">
              <span class="form-hint">字母、数字、下划线</span>
            </div>
            
            <div class="form-group">
              <label for="userName">姓名 <span class="required">*</span></label>
              <input type="text" id="userName" name="userName" required
                     placeholder="例如: 张三">
            </div>
            
            <div class="form-group">
              <label for="department">部门 <span class="required">*</span></label>
              <select id="department" name="department" required>
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
            
            <button type="submit" class="btn-primary btn-block">
              完成设置
            </button>
          </form>
          
          <div class="setup-footer">
            <p>数据将保存在本地设备上</p>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }
  
  bindEvents() {
    const form = this.container.querySelector('#setupForm');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const userData = {
        userId: formData.get('userId'),
        userName: formData.get('userName'),
        department: formData.get('department'),
        role: 'user'
      };
      
      // 验证
      if (!this.validate(userData)) {
        return;
      }
      
      // 禁用按钮
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '设置中...';
      
      try {
        if (this.onComplete) {
          await this.onComplete(userData);
        }
      } catch (error) {
        console.error('Setup failed:', error);
        alert('设置失败，请重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '完成设置';
      }
    });
  }
  
  validate(userData) {
    if (!/^[a-zA-Z0-9_]+$/.test(userData.userId)) {
      alert('工号只能包含字母、数字和下划线');
      return false;
    }
    
    if (userData.userName.length < 2) {
      alert('姓名至少2个字符');
      return false;
    }
    
    if (!userData.department) {
      alert('请选择部门');
      return false;
    }
    
    return true;
  }
}
```

## 测试要点

### 单元测试
1. 令牌生成和验证
2. 签名计算
3. 设备指纹生成
4. 权限检查

### 集成测试
1. 首次配置流程
2. 自动认证流程
3. 令牌过期处理
4. 令牌刷新

## 验收标准

- [ ] 首次配置界面正常
- [ ] 令牌生成和保存正确
- [ ] 签名验证正确
- [ ] 自动认证正常
- [ ] 令牌刷新正常
- [ ] 权限检查正确
- [ ] IndexedDB 备份正常

## 参考规格

- `specs/06-authentication.md` - 认证详细规格

## 下一步

完成后进入 `task-006-plugin-system.md` - 插件系统开发