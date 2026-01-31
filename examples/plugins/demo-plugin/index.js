/**
 * Demo Plugin - 演示插件系统功能
 */

import { PluginBase } from '../../../src/frontend/desktop/core/plugin/plugin-base.js';

export default class DemoPlugin extends PluginBase {
  static id = 'demo';

  constructor(context) {
    super(context);
    this.clickCount = 0;
  }

  async onInstall() {
    this.log('info', 'Demo plugin installed!');
    await this.storage.set('installDate', new Date().toISOString());
  }

  async onActivate() {
    this.log('info', 'Demo plugin activated!');
    
    // 订阅事件
    this.on('plugin:*', (data, eventName) => {
      console.log(`[Demo] Event: ${eventName}`, data);
    });
  }

  async onDeactivate() {
    this.log('info', 'Demo plugin deactivated!');
  }

  render() {
    const greeting = this.getSetting('greeting', 'Hello');
    return `
      <div class="demo-plugin">
        <h2>${this.manifest.name.zh}</h2>
        <p>${greeting}, Localverse!</p>
        <button id="btn-click">Click: ${this.clickCount}</button>
      </div>
    `;
  }

  styles() {
    return `
      .demo-plugin {
        padding: 20px;
        font-family: sans-serif;
      }
      button {
        padding: 10px 20px;
        background: #1976d2;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;
  }

  onMount() {
    const btn = this._shadowRoot.getElementById('btn-click');
    btn?.addEventListener('click', () => {
      this.clickCount++;
      this.update();
    });
  }
}
