/**
 * Hello World Plugin
 * 示例插件 - 展示插件系统的基本用法
 */

import { Plugin } from '../../core/plugin/plugin-base.js';

class HelloWorldPlugin extends Plugin {
  static id = 'hello-world';
  
  async onInstall() {
    console.log('Hello World Plugin: onInstall');
  }
  
  async onActivate() {
    console.log('Hello World Plugin: onActivate');
  }
  
  async onDeactivate() {
    console.log('Hello World Plugin: onDeactivate');
  }
  
  async onSettingsChange(key, value, oldValue) {
    console.log('Setting changed:', key, oldValue, '→', value);
    if (this._mounted) {
      this._render();
      this.bindEvents();
    }
  }
  
  render() {
    const greeting = this.getSetting('greeting');
    const showTime = this.getSetting('showTime');
    const now = new Date().toLocaleTimeString();
    
    return `
      <div class="hello-world">
        <h1>${this.escapeHtml(greeting)}, ${this.escapeHtml(this.getCurrentUserName())}!</h1>
        ${showTime ? `<p class="time">Current time: ${now}</p>` : ''}
        <button class="btn-greet">Say Hello</button>
        <div class="counter">
          <p>Click count: <span class="count">${this.state.count || 0}</span></p>
          <button class="btn-increment">+1</button>
          <button class="btn-reset">Reset</button>
        </div>
      </div>
    `;
  }
  
  styles() {
    return `
      .hello-world {
        padding: 24px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      h1 {
        color: var(--primary, #007bff);
        margin: 0 0 16px 0;
      }
      
      .time {
        color: var(--text-secondary, #666);
        font-size: 14px;
        margin-bottom: 24px;
      }
      
      button {
        padding: 8px 16px;
        margin: 4px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      button:hover {
        background: #f5f5f5;
      }
      
      button:active {
        transform: scale(0.95);
      }
      
      .counter {
        margin-top: 24px;
        padding: 16px;
        background: #f9f9f9;
        border-radius: 8px;
      }
      
      .count {
        font-weight: bold;
        color: var(--primary, #007bff);
      }
    `;
  }
  
  bindEvents() {
    const btnGreet = this.$('.btn-greet');
    const btnIncrement = this.$('.btn-increment');
    const btnReset = this.$('.btn-reset');
    
    if (btnGreet) {
      btnGreet.onclick = () => this.handleGreet();
    }
    
    if (btnIncrement) {
      btnIncrement.onclick = () => this.handleIncrement();
    }
    
    if (btnReset) {
      btnReset.onclick = () => this.handleReset();
    }
  }
  
  async handleGreet() {
    const greeting = this.getSetting('greeting');
    alert(`${greeting}! This is from the Hello World plugin.`);
    
    // 发出事件
    this.emit('greeted', { greeting, time: Date.now() });
  }
  
  async handleIncrement() {
    const currentCount = this.state.count || 0;
    const newCount = currentCount + 1;
    
    this.setState({ count: newCount });
    
    // 保存到存储
    await this.storage.set('count', newCount);
  }
  
  async handleReset() {
    this.setState({ count: 0 });
    await this.storage.set('count', 0);
  }
  
  async mount(container) {
    // 从存储加载计数
    const savedCount = await this.storage.get('count');
    if (savedCount !== null) {
      this.setState({ count: savedCount });
    }
    
    // 调用父类 mount
    super.mount(container);
    
    // 如果设置了显示时间，启动定时器
    if (this.getSetting('showTime')) {
      this._timer = setInterval(() => {
        if (this._mounted) {
          this._render();
          this.bindEvents();
        }
      }, 1000);
    }
    
    // 监听设置变化
    this.settings.onChange((key, value, oldValue) => {
      this.onSettingsChange(key, value, oldValue);
      
      // 如果改变了 showTime，重新处理定时器
      if (key === 'showTime') {
        if (this._timer) {
          clearInterval(this._timer);
          this._timer = null;
        }
        if (value) {
          this._timer = setInterval(() => {
            if (this._mounted) {
              this._render();
              this.bindEvents();
            }
          }, 1000);
        }
      }
    });
  }
  
  unmount() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    super.unmount();
  }
}

export default HelloWorldPlugin;
