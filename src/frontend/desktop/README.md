# Localverse 前端桌面端

## 快速开始

### 1. 启动开发服务器

由于 ES6 模块的安全限制，不能直接用 `file://` 协议打开，需要使用 HTTP 服务器。

#### 方法一：使用 Node.js (推荐)

```bash
# 在 desktop 目录下运行
node start-server.js
```

然后访问: http://localhost:8080

#### 方法二：使用 Python

```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

#### 方法三：使用 VS Code Live Server

安装 Live Server 插件，右键点击 `index.html` → "Open with Live Server"

---

## 项目结构

```
desktop/
├── index.html              # 入口页面
├── app.js                  # 应用入口
├── style.css               # 全局样式
├── start-server.js         # 开发服务器
├── core/                   # 核心框架
│   ├── app.js             # 应用主类
│   ├── router.js          # 路由系统
│   ├── state.js           # 状态管理
│   ├── i18n.js            # 国际化
│   ├── theme.js           # 主题管理
│   └── plugin/            # 插件系统
├── components/            # UI 组件
│   ├── header.js
│   ├── sidebar.js
│   ├── modal.js
│   └── toast.js
├── services/              # 服务层
│   ├── comm/             # 通信层
│   ├── database/         # 数据库
│   ├── auth/             # 认证
│   ├── search/           # 搜索
│   └── backup/           # 备份
└── plugins/              # 内置插件
    ├── wiki/            # Wiki 知识库
    └── finder/          # 文件搜索
```

---

## 开发说明

### 运行模式

系统支持三种运行模式：

1. **Full (完整模式)**: JAR 后端 + WASM 前端
2. **Light (轻量模式)**: 仅 WASM 前端
3. **Pure (纯净模式)**: 仅 IndexedDB

### 后端依赖

在 Full 模式下需要启动 JAR 后端：

```bash
cd ../../../dist
java -jar launcher.jar
```

后端默认端口：
- HTTP: 8765
- WebSocket: 8766

---

## 常见问题

### Q: 打开页面空白，控制台显示 CORS 错误
**A**: 必须使用 HTTP 服务器访问，不能用 `file://` 协议直接打开。请使用 `node start-server.js` 启动服务器。

### Q: 插件无法加载
**A**: 检查后端是否已启动（Full 模式），或检查插件 manifest.json 是否正确。

### Q: 数据库连接失败
**A**: 
- Full 模式：确保 JAR 后端已启动
- Light 模式：检查浏览器是否支持 WebAssembly

---

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

需要支持：
- ES2022
- WebAssembly
- ES6 Modules
- Custom Elements
- IndexedDB
