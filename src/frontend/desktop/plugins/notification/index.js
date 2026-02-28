/**
 * Notification Plugin - Cross-plugin notification hub
 */
import NotificationService from './services/notification-service.js';

const SOURCE_ICONS = {
  chat: '💬',
  task: '✅',
  calendar: '📅',
  announcement: '📢',
  system: 'ℹ️'
};

class NotificationPlugin {
  static id = 'notification';

  constructor(context) {
    this.context = context;
    this.container = null;

    this.state = {
      notifications: [],
      unreadCount: 0
    };

    this.notificationService = null;
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
    this._refreshTimer = null;
  }

  // ==================== i18n ====================

  t(key) {
    try {
      return this.i18n?.t?.(`notification.${key}`) || this._fallback(key);
    } catch {
      return this._fallback(key);
    }
  }

  _fallback(key) {
    const fallbacks = {
      notificationCenter: '通知中心',
      markAllRead: '全部已读',
      noNotifications: '暂无通知',
      noNotificationsHint: '来自任务、公告、聊天的通知将显示在这里',
      markRead: '标记已读',
      delete: '删除',
      justNow: '刚刚',
      minutesAgo: '分钟前',
      hoursAgo: '小时前',
      daysAgo: '天前'
    };
    return fallbacks[key] || key;
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('[Notification] Installing...');
    this.notificationService = new NotificationService(this.context.services.DatabaseService);
    await this.notificationService.initSchema();
    console.log('[Notification] Installed');
  }

  async onActivate() {
    console.log('[Notification] Activating...');
    this.notificationService = new NotificationService(this.context.services.DatabaseService);
    await this.notificationService.initSchema();
    await this.loadNotifications();
    console.log('[Notification] Activated');
  }

  async onDeactivate() {
    console.log('[Notification] Deactivating...');
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  async mount(container) {
    this.container = container;
    await this.render();
    this.bindEvents();

    // Auto-refresh every 30 seconds
    this._refreshTimer = setInterval(() => {
      this.loadNotifications()
        .then(() => this.render())
        .catch(err => console.error('[Notification] Auto-refresh failed:', err));
    }, 30000);
  }

  async unmount() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }

  // ==================== Data ====================

  async loadNotifications() {
    const settings = await this.context.getSettings?.() || {};
    const limit = settings.maxHistory || 50;
    this.state.notifications = await this.notificationService.getNotifications(limit);
    this.state.unreadCount = await this.notificationService.getUnreadCount();
  }

  // ==================== Badge (for sidebar) ====================

  getBadgeCount() {
    return this.state.unreadCount;
  }

  // ==================== Public API (for other plugins) ====================

  async push(data) {
    if (!this.notificationService) return null;
    const notif = await this.notificationService.push(data);
    await this.loadNotifications();
    if (this.container) await this.render();
    return notif;
  }

  // ==================== Render ====================

  formatRelativeTime(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (diff < 60000) return this.t('justNow');
    if (hr < 1) return `${min} ${this.t('minutesAgo')}`;
    if (day < 1) return `${hr} ${this.t('hoursAgo')}`;
    return `${day} ${this.t('daysAgo')}`;
  }

  renderNotificationItem(n) {
    const icon = SOURCE_ICONS[n.source_plugin] || 'ℹ️';
    const readClass = n.read ? 'notif-read' : 'notif-unread';
    const time = this.formatRelativeTime(n.created_at);
    const bodyHtml = n.body
      ? `<div class="notif-body">${this.escapeHtml(n.body)}</div>`
      : '';
    return `
      <div class="notif-item ${readClass}" data-id="${n.id}">
        <span class="notif-icon">${icon}</span>
        <div class="notif-content">
          <div class="notif-title">${this.escapeHtml(n.title)}</div>
          ${bodyHtml}
          <div class="notif-meta">${this.escapeHtml(n.source_plugin)} · ${time}</div>
        </div>
        <div class="notif-actions">
          ${!n.read ? `<button class="notif-btn-read" data-id="${n.id}" title="${this.t('markRead')}">✓</button>` : ''}
          <button class="notif-btn-delete" data-id="${n.id}" title="${this.t('delete')}">✕</button>
        </div>
      </div>
    `;
  }

  async render() {
    if (!this.container) return;
    const { notifications, unreadCount } = this.state;

    const listHtml = notifications.length
      ? notifications.map(n => this.renderNotificationItem(n)).join('')
      : `<div class="notif-empty">
           <div class="notif-empty-icon">🔔</div>
           <p>${this.t('noNotifications')}</p>
           <p class="notif-empty-hint">${this.t('noNotificationsHint')}</p>
         </div>`;

    const badgeHtml = unreadCount > 0
      ? `<span class="notif-badge">${unreadCount}</span>`
      : '';

    this.container.innerHTML = `
      <div class="notif-plugin">
        <div class="notif-header">
          <div class="notif-header-left">
            <h2 class="notif-title">${this.t('notificationCenter')}</h2>
            ${badgeHtml}
          </div>
          ${unreadCount > 0
            ? `<button class="btn-text-sm notif-mark-all">${this.t('markAllRead')}</button>`
            : ''}
        </div>
        <div class="notif-list">${listHtml}</div>
      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', async (e) => {
      // Mark all read
      if (e.target.classList.contains('notif-mark-all')) {
        await this.notificationService.markAllRead();
        await this.loadNotifications();
        await this.render();
        return;
      }
      // Mark single read
      if (e.target.classList.contains('notif-btn-read')) {
        const id = e.target.dataset.id;
        await this.notificationService.markRead(id);
        await this.loadNotifications();
        await this.render();
        return;
      }
      // Delete
      if (e.target.classList.contains('notif-btn-delete')) {
        const id = e.target.dataset.id;
        await this.notificationService.deleteNotification(id);
        await this.loadNotifications();
        await this.render();
        return;
      }
      // Click item → mark read
      const item = e.target.closest('.notif-item.notif-unread');
      if (item) {
        const id = item.dataset.id;
        await this.notificationService.markRead(id);
        await this.loadNotifications();
        await this.render();
      }
    });
  }

  // ==================== Helpers ====================

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default NotificationPlugin;
