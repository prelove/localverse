# Task 001: Mobile 移动端适配

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase3-task-001-mobile |
| 阶段 | Phase 3 - 扩展功能 |
| 优先级 | P3 (低) |
| 预估工时 | 16 小时 |
| 依赖 | Phase 2 全部 |
| 产出 | 移动端 Web App |
| 状态 | ✅ 已完成 |

## 目标

将 Localverse 适配为移动端可用的 PWA（渐进式 Web 应用）：
1. 响应式布局（手机/平板适配）
2. PWA 支持（添加到主屏幕）
3. 触摸优化（手势操作）
4. 离线优先（Service Worker 缓存）
5. 移动端导航（底部标签栏）

## 详细需求

### 1. 响应式断点

| 断点 | 设备 | 布局调整 |
|------|------|---------|
| < 480px | 手机竖屏 | 单列，全屏面板 |
| 480-768px | 手机横屏/小平板 | 双列，侧边抽屉 |
| 768-1024px | 平板 | 三列，折叠侧边栏 |
| > 1024px | 桌面 | 完整布局 |

### 2. 移动端导航

```
┌─────────────────────────────┐
│         页面内容              │
│                              │
│                              │
├──────────────────────────────┤
│  📚  💬  ✅  📁  ⚙️          │
│ Wiki Chat Task Finder More   │
└─────────────────────────────┘
```

### 3. PWA 配置

- `manifest.json` - Web App Manifest
- Service Worker（缓存静态资源和 API 响应）
- 离线页面（网络不可用时的提示）

### 4. 触摸手势

- 左滑/右滑：返回/前进
- 下拉刷新：重新加载数据
- 长按：显示上下文菜单
- 捏合缩放：禁用（防止意外操作）

## 实现步骤

### Step 1: CSS 响应式适配 (4h)
- 审查所有插件 CSS，添加移动端媒体查询
- 实现折叠侧边栏
- 底部导航栏组件

### Step 2: PWA 配置 (3h)
- 创建 `manifest.json`（图标、颜色、显示模式）
- Service Worker（缓存策略）
- 离线提示页面

### Step 3: 触摸优化 (4h)
- 增大点击目标区域（最小 44x44px）
- 添加触摸手势处理
- 禁用 hover 效果（触摸设备）

### Step 4: 测试 (5h)
- Chrome DevTools 移动端模拟
- 真机测试（Android/iOS）
- 离线功能测试

## 验收标准

- [x] 在手机浏览器上布局正常（响应式 CSS，max-width:480px 断点）
- [x] 可以添加到主屏幕（PWA）— manifest.webmanifest + theme-color + apple-mobile-web-app meta
- [x] 离线状态下基本功能可用（Service Worker sw.js 缓存静态资源）
- [x] 触摸操作流畅（44x44px 最小触摸目标）
- [x] 离线提示横幅（offline-banner，online/offline 事件驱动）
- [x] 字体大小和间距适合移动端（content padding 在小屏缩减）

## 注意事项

1. **性能优先**: 移动端网络和计算能力有限，避免过度渲染
2. **触摸友好**: 所有可交互元素至少 44x44px
3. **iOS 兼容**: 注意 Safari 的特殊限制（viewport 高度、滚动等）
4. **PWA 限制**: iOS Safari 对 Service Worker 和 PWA 功能有限制

## 更新记录

- 2026-02-28: 创建任务文档，规划移动端适配需求与实现步骤。
- 2026-02-28: 完成开发 — manifest.webmanifest + sw.js Service Worker + 移动端响应式 CSS + offline banner + index.html PWA meta 标签。
