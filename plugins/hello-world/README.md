# Hello World Plugin

A simple sample plugin demonstrating the Localverse plugin system.

## Features

- Demonstrates plugin lifecycle hooks (install, activate, deactivate)
- Shows how to use plugin settings
- Demonstrates internationalization (i18n)
- Shows event emission and handling
- Demonstrates state management
- Shows how to export methods for other plugins to call

## Settings

- **Show Icon**: Whether to show the waving hand icon in the greeting
- **User Name**: The name to use in the greeting

## Usage

This plugin is automatically loaded when the plugin system is initialized. It demonstrates:

1. **Installation**: Shows a toast notification on first install
2. **Activation**: Logs to console and listens to global events
3. **Settings**: Can be changed via the UI buttons
4. **Events**: Emits a custom 'greeted' event when the greet button is clicked
5. **Public Methods**: Provides a `greet(name)` method that can be called by other plugins

## Calling from Other Plugins

```javascript
// Call the exported greet method
const message = await pluginLoader.call('hello-world', 'greet', 'Alice');
// Returns: "Hello, Alice!"
```

## Development

To modify this plugin:

1. Edit `index.js` for logic changes
2. Edit `manifest.json` for metadata/settings changes
3. Edit locale files in `locales/` for translation changes
4. Reload the plugin to see changes

## License

MIT
