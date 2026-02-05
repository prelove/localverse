# Demo Plugin

演示插件系统基本功能的示例插件。

## 功能

- ✅ 生命周期管理 (install/activate/deactivate/uninstall)
- ✅ UI 渲染和交互
- ✅ 事件订阅
- ✅ 存储功能
- ✅ 设置管理
- ✅ Shadow DOM 样式隔离

## 使用

```javascript
import { PluginManager } from '../src/frontend/desktop/core/plugin/index.js';

const pluginManager = new PluginManager();
await pluginManager.init();

// 注册插件
pluginManager.register({
  id: 'demo',
  enabled: true
});

// 加载并激活
await pluginManager.load('demo');
await pluginManager.activate('demo');

// 获取插件实例
const demoPlugin = pluginManager.get('demo');

// 挂载到 DOM
const container = document.getElementById('plugin-container');
demoPlugin.mount(container);
```

## 文件结构

- `manifest.json` - 插件元数据和配置
- `index.js` - 插件主代码
- `README.md` - 本文档

## 许可证

MIT
