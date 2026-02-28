/**
 * Settings Plugin - Global settings center
 *
 * Stores settings in localStorage (no database required).
 * Integrates with i18n service for live language switching
 * and with theme service for live theme switching.
 */

const STORAGE_KEY = 'localverse_settings';

const SECTIONS = ['profile', 'appearance', 'notifications', 'data'];

const DEFAULTS = {
  username: '',
  language: 'zh',
  theme: 'system',
  fontSize: 'medium',
  sidebarCollapsed: false,
  notifChat: true,
  notifTask: true,
  notifCalendar: true,
  notifAnnouncement: true
};

class SettingsPlugin {
  static id = 'settings';

  constructor(context) {
    this.context = context;
    this.container = null;

    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';

    this.state = {
      activeSection: 'profile',
      settings: { ...DEFAULTS },
      savedFeedback: false
    };
  }

  // ==================== i18n ====================

  t(key) {
    try {
      return this.i18n?.t?.(`settings.${key}`) || this._fallback(key);
    } catch {
      return this._fallback(key);
    }
  }

  _fallback(key) {
    const fb = {
      title: '设置', profile: '个人资料', appearance: '外观',
      notifications: '通知', data: '数据',
      username: '用户名', usernamePlaceholder: '输入用户名',
      language: '语言', langZh: '中文', langEn: 'English', langJa: '日本語',
      theme: '主题', themeLight: '浅色', themeDark: '深色', themeSystem: '跟随系统',
      fontSize: '字体大小', fontSmall: '小', fontMedium: '中', fontLarge: '大',
      sidebarCollapsed: '默认折叠侧边栏',
      notifChat: '聊天通知', notifTask: '任务通知',
      notifCalendar: '日历通知', notifAnnouncement: '公告通知',
      exportData: '导出所有数据', clearCache: '清除本地缓存', resetApp: '重置应用',
      exportSuccess: '数据已导出',
      clearCacheConfirm: '确定要清除本地缓存吗？',
      resetConfirm: '确定要重置应用吗？所有本地数据将被清除。',
      save: '保存', saved: '已保存', cancel: '取消',
      enabled: '开启', disabled: '关闭'
    };
    return fb[key] || key;
  }

  // ==================== Persistence ====================

  _load() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  }

  _save(settings) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
    } catch { /* ignore */ }
  }

  // ==================== Lifecycle ====================

  async onActivate() {
    this.state.settings = this._load();
  }

  async mount(container) {
    this.container = container;
    this.state.settings = this._load();
    await this.render();
    this.bindEvents();
  }

  async unmount() {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }

  // ==================== Apply settings ====================

  _applySettings(settings) {
    // Language
    try {
      if (this.i18n?.setLocale) {
        this.i18n.setLocale(settings.language);
        this.locale = settings.language;
      }
    } catch { /* ignore */ }

    // Theme
    try {
      const themeService = this.context.services?.ThemeService;
      if (themeService?.setTheme) {
        themeService.setTheme(settings.theme);
      } else {
        const root = typeof document !== 'undefined' ? document.documentElement : null;
        if (root) {
          const effective = settings.theme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : settings.theme;
          root.setAttribute('data-theme', effective);
        }
      }
    } catch { /* ignore */ }

    // Font size
    try {
      const root = typeof document !== 'undefined' ? document.documentElement : null;
      if (root) root.setAttribute('data-font-size', settings.fontSize);
    } catch { /* ignore */ }
  }

  // ==================== Render ====================

  async render() {
    if (!this.container) return;
    const { activeSection, settings, savedFeedback } = this.state;

    const navItems = SECTIONS.map(s => `
      <button class="set-nav-item ${s === activeSection ? 'active' : ''}" data-action="nav" data-section="${s}">
        ${this._sectionIcon(s)} ${this.t(s)}
      </button>
    `).join('');

    this.container.innerHTML = `
      <div class="set-plugin">
        <div class="set-header">
          <h2 class="set-title">⚙️ ${this.t('title')}</h2>
          ${savedFeedback ? `<span class="set-saved-badge">✓ ${this.t('saved')}</span>` : ''}
        </div>
        <div class="set-layout">
          <nav class="set-nav">${navItems}</nav>
          <div class="set-content">${this._renderSection(activeSection, settings)}</div>
        </div>
      </div>
    `;
  }

  _sectionIcon(s) {
    return { profile: '👤', appearance: '🎨', notifications: '🔔', data: '💾' }[s] || '';
  }

  _renderSection(section, settings) {
    switch (section) {
      case 'profile':    return this._renderProfile(settings);
      case 'appearance': return this._renderAppearance(settings);
      case 'notifications': return this._renderNotifications(settings);
      case 'data':       return this._renderData();
      default:           return '';
    }
  }

  _renderProfile(s) {
    return `
      <div class="set-section">
        <div class="set-field">
          <label class="set-label">${this.t('username')}</label>
          <input class="set-input" data-field="username" type="text"
            value="${this.escapeHtml(s.username)}"
            placeholder="${this.t('usernamePlaceholder')}">
        </div>
        <div class="set-actions">
          <button class="btn-primary set-save-btn" data-action="save">${this.t('save')}</button>
        </div>
      </div>
    `;
  }

  _renderAppearance(s) {
    const langOpts = [
      { value: 'zh', label: this.t('langZh') },
      { value: 'en', label: this.t('langEn') },
      { value: 'ja', label: this.t('langJa') }
    ];
    const themeOpts = [
      { value: 'light', label: this.t('themeLight') },
      { value: 'dark',  label: this.t('themeDark') },
      { value: 'system', label: this.t('themeSystem') }
    ];
    const fontOpts = [
      { value: 'small',  label: this.t('fontSmall') },
      { value: 'medium', label: this.t('fontMedium') },
      { value: 'large',  label: this.t('fontLarge') }
    ];

    return `
      <div class="set-section">
        <div class="set-field">
          <label class="set-label">${this.t('language')}</label>
          <div class="set-radio-group">
            ${langOpts.map(o => `
              <label class="set-radio-label">
                <input type="radio" name="language" data-field="language" value="${o.value}" ${s.language === o.value ? 'checked' : ''}>
                ${o.label}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="set-field">
          <label class="set-label">${this.t('theme')}</label>
          <div class="set-radio-group">
            ${themeOpts.map(o => `
              <label class="set-radio-label">
                <input type="radio" name="theme" data-field="theme" value="${o.value}" ${s.theme === o.value ? 'checked' : ''}>
                ${o.label}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="set-field">
          <label class="set-label">${this.t('fontSize')}</label>
          <div class="set-radio-group">
            ${fontOpts.map(o => `
              <label class="set-radio-label">
                <input type="radio" name="fontSize" data-field="fontSize" value="${o.value}" ${s.fontSize === o.value ? 'checked' : ''}>
                ${o.label}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="set-field set-field-inline">
          <label class="set-label">${this.t('sidebarCollapsed')}</label>
          <label class="set-toggle">
            <input type="checkbox" data-field="sidebarCollapsed" ${s.sidebarCollapsed ? 'checked' : ''}>
            <span class="set-toggle-track"></span>
          </label>
        </div>
        <div class="set-actions">
          <button class="btn-primary set-save-btn" data-action="save">${this.t('save')}</button>
        </div>
      </div>
    `;
  }

  _renderNotifications(s) {
    const items = [
      { field: 'notifChat',         label: this.t('notifChat') },
      { field: 'notifTask',         label: this.t('notifTask') },
      { field: 'notifCalendar',     label: this.t('notifCalendar') },
      { field: 'notifAnnouncement', label: this.t('notifAnnouncement') }
    ];
    return `
      <div class="set-section">
        ${items.map(item => `
          <div class="set-field set-field-inline">
            <label class="set-label">${this.escapeHtml(item.label)}</label>
            <label class="set-toggle">
              <input type="checkbox" data-field="${item.field}" ${s[item.field] ? 'checked' : ''}>
              <span class="set-toggle-track"></span>
            </label>
          </div>
        `).join('')}
        <div class="set-actions">
          <button class="btn-primary set-save-btn" data-action="save">${this.t('save')}</button>
        </div>
      </div>
    `;
  }

  _renderData() {
    return `
      <div class="set-section">
        <div class="set-data-actions">
          <button class="btn-secondary set-data-btn" data-action="export">
            📤 ${this.t('exportData')}
          </button>
          <button class="btn-secondary set-data-btn" data-action="clear-cache">
            🗑️ ${this.t('clearCache')}
          </button>
          <button class="btn-danger set-data-btn" data-action="reset-app">
            ⚠️ ${this.t('resetApp')}
          </button>
        </div>
      </div>
    `;
  }

  // ==================== Events ====================

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      await this._handleAction(el.dataset.action, el);
    });

    this.container.addEventListener('input', (e) => {
      const el = e.target;
      const field = el.dataset.field;
      if (!field) return;
      if (el.type === 'checkbox') {
        this.state.settings[field] = el.checked;
      } else if (el.type === 'radio' && el.checked) {
        this.state.settings[field] = el.value;
      } else if (el.tagName === 'INPUT') {
        this.state.settings[field] = el.value;
      }
    });

    this.container.addEventListener('change', (e) => {
      const el = e.target;
      const field = el.dataset.field;
      if (!field) return;
      if (el.type === 'checkbox') {
        this.state.settings[field] = el.checked;
      } else if (el.type === 'radio' && el.checked) {
        this.state.settings[field] = el.value;
      }
    });
  }

  async _handleAction(action, el) {
    switch (action) {
      case 'nav':
        this.state.activeSection = el.dataset.section;
        await this.render();
        this.bindEvents();
        break;

      case 'save':
        this._save(this.state.settings);
        this._applySettings(this.state.settings);
        this.state.savedFeedback = true;
        await this.render();
        this.bindEvents();
        setTimeout(() => {
          this.state.savedFeedback = false;
          this.render().then(() => this.bindEvents()).catch(() => {});
        }, 2000);
        break;

      case 'export':
        this._exportData();
        break;

      case 'clear-cache':
        if (typeof confirm !== 'undefined' && confirm(this.t('clearCacheConfirm'))) {
          this._clearCache();
        }
        break;

      case 'reset-app':
        if (typeof confirm !== 'undefined' && confirm(this.t('resetConfirm'))) {
          this._resetApp();
        }
        break;
    }
  }

  _exportData() {
    try {
      const data = { settings: this.state.settings, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `localverse-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* non-browser environment */ }
  }

  _clearCache() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      localStorage.clear();
      if (saved) localStorage.setItem(STORAGE_KEY, saved);
    } catch { /* ignore */ }
  }

  _resetApp() {
    try {
      localStorage.clear();
      this.state.settings = { ...DEFAULTS };
      this.render().then(() => this.bindEvents());
    } catch { /* ignore */ }
  }

  // ==================== Helpers ====================

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default SettingsPlugin;
