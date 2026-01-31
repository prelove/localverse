# 10 - 移动端规格

## 概述

移动端是 Localverse 的轻量级版本，特点：
1. 直连 Sync Server（无需 Local JAR）
2. 通过 Server 同源页面访问（无 CORS）
3. PWA 支持（添加到主屏幕）
4. 功能合理降级

## 设计原则

- **触摸优先**：按钮 ≥ 44px，手势支持
- **网络优化**：懒加载、压缩、缓存
- **性能优先**：减少 WASM，简化动画
- **渐进增强**：基础功能保证，高级功能按需

## 访问方式

```
移动设备浏览器访问：
http://192.168.1.100:8080/mobile/

或扫描二维码

首次访问后可"添加到主屏幕"（PWA）
```

## 目录结构

```
src/frontend/mobile/
├── index.html               # 入口
├── app.js                   # 主程序
├── style.css                # 样式
├── manifest.json            # PWA 配置
├── sw.js                    # Service Worker
├── components/              # 移动端组件
│   ├── header.js
│   ├── bottom-nav.js
│   ├── pull-refresh.js
│   ├── swipe-action.js
│   └── ...
├── pages/                   # 页面
│   ├── home.js
│   ├── wiki.js
│   ├── chat.js
│   ├── tasks.js
│   ├── profile.js
│   └── ...
└── icons/                   # 图标
    ├── icon-192.png
    ├── icon-512.png
    └── ...
```

## PWA 配置

```json
// manifest.json
{
  "name": "Localverse",
  "short_name": "Localverse",
  "description": "内网协作平台",
  "start_url": "/mobile/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "icons": [
    {
      "src": "/mobile/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/mobile/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/mobile/screenshots/home.png",
      "sizes": "1080x1920",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "知识库",
      "url": "/mobile/#/wiki",
      "icons": [{ "src": "/mobile/icons/wiki.png", "sizes": "96x96" }]
    },
    {
      "name": "聊天",
      "url": "/mobile/#/chat",
      "icons": [{ "src": "/mobile/icons/chat.png", "sizes": "96x96" }]
    }
  ]
}
```

## 移动端布局

### 基础结构

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, 
        maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#1976d2">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  
  <link rel="manifest" href="/mobile/manifest.json">
  <link rel="apple-touch-icon" href="/mobile/icons/icon-192.png">
  
  <title>Localverse</title>
  <link rel="stylesheet" href="/mobile/style.css">
</head>
<body>
  <div id="app">
    <lv-header></lv-header>
    <main class="main-content">
      <router-view></router-view>
    </main>
    <lv-bottom-nav></lv-bottom-nav>
  </div>
  
  <script type="module" src="/mobile/app.js"></script>
</body>
</html>
```

### 样式规范

```css
/* style.css */

/* 安全区域适配 */
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

/* 基础布局 */
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
               'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-color);
  background: var(--bg-color);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: -webkit-fill-available;
}

.main-content {
  flex: 1;
  padding-top: calc(48px + var(--safe-top));
  padding-bottom: calc(56px + var(--safe-bottom));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Header */
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(48px + var(--safe-top));
  padding-top: var(--safe-top);
  background: var(--surface-color);
  border-bottom: 1px solid var(--border-color);
  z-index: 100;
}

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(56px + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--surface-color);
  border-top: 1px solid var(--border-color);
  display: flex;
  z-index: 100;
}

.bottom-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  padding: 8px 0;
}

.bottom-nav-item.active {
  color: var(--primary-color);
}

.bottom-nav-icon {
  font-size: 24px;
  margin-bottom: 2px;
}

/* 触摸优化 */
button, 
a, 
.touchable {
  min-height: 44px;
  min-width: 44px;
}

/* 列表项 */
.list-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  min-height: 56px;
  border-bottom: 1px solid var(--border-color);
}

/* 卡片 */
.card {
  background: var(--surface-color);
  border-radius: 12px;
  margin: 8px 16px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

/* 表单 */
.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
}

.form-input:focus {
  border-color: var(--primary-color);
}

/* 按钮 */
.btn {
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-block {
  width: 100%;
}
```

## 底部导航组件

```javascript
// components/bottom-nav.js

class LVBottomNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.items = [
      { id: 'home', icon: '🏠', label: '首页', path: '/' },
      { id: 'wiki', icon: '📚', label: '知识库', path: '/wiki' },
      { id: 'chat', icon: '💬', label: '聊天', path: '/chat' },
      { id: 'tasks', icon: '✅', label: '任务', path: '/tasks' },
      { id: 'profile', icon: '👤', label: '我的', path: '/profile' }
    ];
  }
  
  connectedCallback() {
    this.render();
    window.addEventListener('hashchange', () => this.updateActive());
  }
  
  render() {
    const currentPath = window.location.hash.slice(1) || '/';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: calc(56px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: var(--surface-color, #fff);
          border-top: 1px solid var(--border-color, #e0e0e0);
          z-index: 100;
        }
        
        nav {
          display: flex;
          height: 56px;
        }
        
        a {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: var(--text-secondary, #757575);
          font-size: 12px;
          transition: color 0.2s;
        }
        
        a.active {
          color: var(--primary-color, #1976d2);
        }
        
        .icon {
          font-size: 24px;
          margin-bottom: 2px;
        }
        
        .badge {
          position: absolute;
          top: 4px;
          right: calc(50% - 20px);
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          background: #f44336;
          color: white;
          font-size: 11px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      </style>
      
      <nav>
        ${this.items.map(item => `
          <a href="#${item.path}" 
             class="${currentPath === item.path || currentPath.startsWith(item.path + '/') ? 'active' : ''}"
             data-id="${item.id}">
            <span class="icon">${item.icon}</span>
            <span class="label">${item.label}</span>
            ${item.badge ? `<span class="badge">${item.badge}</span>` : ''}
          </a>
        `).join('')}
      </nav>
    `;
  }
  
  updateActive() {
    const currentPath = window.location.hash.slice(1) || '/';
    
    this.shadowRoot.querySelectorAll('a').forEach(link => {
      const path = link.getAttribute('href').slice(1);
      const isActive = currentPath === path || currentPath.startsWith(path + '/');
      link.classList.toggle('active', isActive);
    });
  }
  
  setBadge(itemId, count) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      item.badge = count > 0 ? (count > 99 ? '99+' : count) : null;
      this.render();
    }
  }
}

customElements.define('lv-bottom-nav', LVBottomNav);
```

## 下拉刷新组件

```javascript
// components/pull-refresh.js

class LVPullRefresh extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.startY = 0;
    this.currentY = 0;
    this.pulling = false;
    this.refreshing = false;
    this.threshold = 60;
  }
  
  connectedCallback() {
    this.render();
    this.bindEvents();
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
        }
        
        .pull-indicator {
          position: absolute;
          top: -50px;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        
        .pull-indicator.visible {
          transform: translateX(-50%) translateY(60px);
        }
        
        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .arrow {
          font-size: 24px;
          transition: transform 0.2s;
        }
        
        .arrow.flipped {
          transform: rotate(180deg);
        }
        
        .content {
          transition: transform 0.2s;
        }
      </style>
      
      <div class="pull-indicator" id="indicator">
        <span class="arrow" id="arrow">↓</span>
        <div class="spinner" id="spinner" style="display:none"></div>
      </div>
      <div class="content" id="content">
        <slot></slot>
      </div>
    `;
  }
  
  bindEvents() {
    const content = this.shadowRoot.getElementById('content');
    
    content.addEventListener('touchstart', (e) => {
      if (this.scrollTop > 0 || this.refreshing) return;
      this.startY = e.touches[0].pageY;
      this.pulling = true;
    }, { passive: true });
    
    content.addEventListener('touchmove', (e) => {
      if (!this.pulling) return;
      
      this.currentY = e.touches[0].pageY;
      const diff = this.currentY - this.startY;
      
      if (diff > 0) {
        const pullDistance = Math.min(diff * 0.5, 80);
        content.style.transform = `translateY(${pullDistance}px)`;
        
        const indicator = this.shadowRoot.getElementById('indicator');
        const arrow = this.shadowRoot.getElementById('arrow');
        
        indicator.classList.add('visible');
        arrow.classList.toggle('flipped', pullDistance > this.threshold);
      }
    }, { passive: true });
    
    content.addEventListener('touchend', () => {
      if (!this.pulling) return;
      this.pulling = false;
      
      const diff = this.currentY - this.startY;
      const content = this.shadowRoot.getElementById('content');
      
      if (diff * 0.5 > this.threshold) {
        this.startRefresh();
      } else {
        content.style.transform = '';
        this.shadowRoot.getElementById('indicator').classList.remove('visible');
      }
    });
  }
  
  startRefresh() {
    this.refreshing = true;
    
    const content = this.shadowRoot.getElementById('content');
    const indicator = this.shadowRoot.getElementById('indicator');
    const arrow = this.shadowRoot.getElementById('arrow');
    const spinner = this.shadowRoot.getElementById('spinner');
    
    content.style.transform = `translateY(${this.threshold}px)`;
    arrow.style.display = 'none';
    spinner.style.display = 'block';
    
    this.dispatchEvent(new CustomEvent('refresh'));
  }
  
  endRefresh() {
    this.refreshing = false;
    
    const content = this.shadowRoot.getElementById('content');
    const indicator = this.shadowRoot.getElementById('indicator');
    const arrow = this.shadowRoot.getElementById('arrow');
    const spinner = this.shadowRoot.getElementById('spinner');
    
    content.style.transform = '';
    indicator.classList.remove('visible');
    arrow.style.display = '';
    arrow.classList.remove('flipped');
    spinner.style.display = 'none';
  }
}

customElements.define('lv-pull-refresh', LVPullRefresh);
```

## 功能降级矩阵

```javascript
// 功能检测和降级

const FEATURES = {
  // 完全支持
  FULL: [
    'wiki.read',
    'wiki.edit',
    'chat.send',
    'chat.receive',
    'tasks.list',
    'tasks.update',
    'announcements.read',
    'vote.participate',
    'calendar.view',
    'profile.view',
    'search.cloud'
  ],
  
  // 受限支持
  LIMITED: [
    'file.upload',      // 大小限制 10MB
    'file.preview',     // 仅图片和 PDF
    'wiki.offline',     // 有限离线缓存
  ],
  
  // 不支持
  UNSUPPORTED: [
    'file.localSearch', // 本地文件搜索
    'file.watch',       // 文件监视
    'p2p.transfer',     // P2P 直传
    'ide.run',          // 代码运行
    'wasm.heavy'        // 重型 WASM 计算
  ]
};

function checkFeature(feature) {
  if (FEATURES.FULL.includes(feature)) {
    return { supported: true, limited: false };
  }
  if (FEATURES.LIMITED.includes(feature)) {
    return { supported: true, limited: true };
  }
  return { supported: false, limited: false };
}

// 显示不支持提示
function showUnsupportedMessage(feature) {
  const messages = {
    'file.localSearch': '本地文件搜索需要在 PC 端使用',
    'p2p.transfer': 'P2P 传输需要在 PC 端使用',
    'ide.run': '代码运行需要在 PC 端使用'
  };
  
  showToast(messages[feature] || '此功能在移动端不可用');
}
```

## 移动端专属功能

### 扫码功能

```javascript
// 使用原生相机 API
async function scanQRCode() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    
    // 使用 jsQR 库解析
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          stream.getTracks().forEach(track => track.stop());
          return code.data;
        }
      }
      requestAnimationFrame(scan);
    };
    
    return scan();
    
  } catch (error) {
    console.error('Camera access denied:', error);
    throw error;
  }
}
```

### 拍照上传

```javascript
async function takePhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';  // 使用后置摄像头
  
  return new Promise((resolve, reject) => {
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      // 压缩图片
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8
      });
      
      resolve(compressed);
    };
    
    input.click();
  });
}

async function compressImage(file, options) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        if (width > options.maxWidth) {
          height = (height * options.maxWidth) / width;
          width = options.maxWidth;
        }
        if (height > options.maxHeight) {
          width = (width * options.maxHeight) / height;
          height = options.maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', options.quality);
      };
      img.src = e.target.result;
    };