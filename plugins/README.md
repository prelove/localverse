# Plugins Directory

This directory contains plugins for Localverse OS 2.0.

## Available Plugins

- **hello-world** - Sample plugin demonstrating plugin system features

## Adding New Plugins

1. Create a new directory in this folder (e.g., `my-plugin/`)
2. Add a `manifest.json` file (required)
3. Add an `index.js` file with your plugin class (required)
4. Add to `plugins.json` to enable auto-discovery
5. Optionally add:
   - `style.css` for plugin styles
   - `locales/` directory for translations
   - `README.md` for documentation

## Plugin Structure

```
plugins/
├── plugins.json           # Plugin listing
├── hello-world/           # Sample plugin
│   ├── manifest.json
│   ├── index.js
│   ├── locales/
│   │   ├── zh.json
│   │   ├── en.json
│   │   └── ja.json
│   └── README.md
└── your-plugin/           # Your plugin here
    ├── manifest.json
    ├── index.js
    └── ...
```

## Documentation

- [Plugin System](../src/frontend/desktop/core/plugin/README.md)
- [Task 006 Specification](../openspec/tasks/phase-0/task-006-plugin-system.md)
- [Plugin System Specification](../openspec/specs/08-plugin-system.md)
