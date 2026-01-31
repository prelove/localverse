# Localverse Plugins

This directory contains Localverse plugins.

## Plugin Structure

Each plugin should be in its own directory with the following structure:

```
plugins/
├── demo/
│   ├── manifest.json    # Plugin metadata and configuration
│   ├── index.js         # Main plugin entry point
│   ├── style.css        # Plugin styles (optional)
│   └── README.md        # Plugin documentation (optional)
├── finder/
├── wiki/
└── ...
```

## manifest.json

Required structure:

```json
{
  "id": "plugin-id",
  "name": {
    "zh": "中文名称",
    "en": "English Name",
    "ja": "日本語名"
  },
  "version": "1.0.0",
  "description": {
    "zh": "中文描述",
    "en": "English description",
    "ja": "日本語説明"
  },
  "icon": "🎯",
  "category": "productivity",
  "entry": "./index.js",
  "style": "./style.css",
  "permissions": ["database:read", "database:write"],
  "dependencies": {
    "services": ["DatabaseService"]
  },
  "settings": {
    "option1": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "选项1", "en": "Option 1" }
    }
  }
}
```

## index.js

Plugin class must extend `PluginBase`:

```javascript
import { PluginBase } from '../../src/frontend/desktop/core/plugin/plugin-base.js';

export default class MyPlugin extends PluginBase {
  async onActivate() {
    await super.onActivate();
    // Initialization code
  }

  render() {
    return `<div>My Plugin UI</div>`;
  }

  bindEvents(container) {
    // Bind event listeners
  }
}
```

## Available Plugins

- **demo**: Demonstration plugin showing plugin system capabilities

## Creating a New Plugin

1. Create a new directory under `plugins/`
2. Create `manifest.json` with required fields
3. Create `index.js` with plugin class extending `PluginBase`
4. Optionally create `style.css` for styling
5. Add plugin ID to the discovery list in `plugin-loader.js`

## Plugin API

Plugins have access to:

- `this.context.services` - System services (database, filesystem, search)
- `this.context.eventBus` - Event system for inter-plugin communication
- `this.context.i18n` - Internationalization
- `this.context.router` - Routing
- `this.context.store` - Global state
- `this.storage` - Plugin-specific localStorage
- `this.settings` - Plugin settings management
