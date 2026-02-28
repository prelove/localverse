/**
 * Dashboard Plugin - Home overview aggregating key info from all plugins
 */

const SOURCE_ICONS = {
  chat: '💬',
  task: '✅',
  calendar: '📅',
  announcement: '📢',
  wiki: '📖',
  system: 'ℹ️'
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

class DashboardPlugin {
  static id = 'dashboard';

  constructor(context) {
    this.context = context;
    this.container = null;

    this.state = {
      taskStats: { todo: 0, inProgress: 0 },
      unreadAnnouncements: 0,
      weekEvents: [],
      recentActivity: []
    };

    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
    this._refreshTimer = null;
  }

  // ==================== i18n ====================

  t(key) {
    try {
      return this.i18n?.t?.(`dashboard.${key}`) || this._fallback(key);
    } catch {
      return this._fallback(key);
    }
  }

  _fallback(key) {
    const fallbacks = {
      title: '主页',
      taskStats: '任务统计',
      todayTodo: '今日待办',
      inProgress: '进行中',
      unreadAnnouncements: '未读公告',
      weekCalendar: '本周日历',
      recentActivity: '最近活动',
      noActivity: '暂无最近活动',
      noActivityHint: '来自任务、聊天、Wiki 的动态将显示在这里',
      noEvents: '本周暂无事件',
      refresh: '刷新',
      justNow: '刚刚',
      minutesAgo: '分钟前',
      hoursAgo: '小时前',
      daysAgo: '天前',
      today: '今天',
      allDay: '全天',
      overdue: '已逾期',
      items: '项'
    };
    return fallbacks[key] || key;
  }

  // ==================== Lifecycle ====================

  async onActivate() {
    await this.loadData();
  }

  async onDeactivate() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  async mount(container) {
    this.container = container;
    await this.render();
    this.bindEvents();

    // Auto-refresh every 60 seconds
    this._refreshTimer = setInterval(() => {
      this.loadData()
        .then(() => this.render())
        .catch(err => console.error('[Dashboard] Auto-refresh failed:', err));
    }, 60000);
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

  async loadData() {
    await Promise.all([
      this._loadTaskStats(),
      this._loadUnreadAnnouncements(),
      this._loadWeekEvents(),
      this._loadRecentActivity()
    ]);
  }

  async _loadTaskStats() {
    try {
      const taskPlugin = this._getPlugin('task');
      if (taskPlugin?.taskService) {
        const allTasks = await taskPlugin.taskService.getTasks({ parentId: null });
        this.state.taskStats = {
          todo: allTasks.filter(t => t.status === 'todo').length,
          inProgress: allTasks.filter(t => t.status === 'in_progress').length
        };
      } else {
        this.state.taskStats = { todo: 0, inProgress: 0 };
      }
    } catch {
      this.state.taskStats = { todo: 0, inProgress: 0 };
    }
  }

  async _loadUnreadAnnouncements() {
    try {
      const annPlugin = this._getPlugin('announcement');
      if (annPlugin?.announcementService) {
        const userId = this._getCurrentUserId();
        const count = await annPlugin.announcementService.getUnreadCount(userId);
        this.state.unreadAnnouncements = count;
      } else {
        this.state.unreadAnnouncements = 0;
      }
    } catch {
      this.state.unreadAnnouncements = 0;
    }
  }

  async _loadWeekEvents() {
    try {
      const calPlugin = this._getPlugin('calendar');
      if (calPlugin?.calendarService) {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        const events = await calPlugin.calendarService.getEvents(
          startOfWeek.getTime(),
          endOfWeek.getTime()
        );
        this.state.weekEvents = events.slice(0, 20);
      } else {
        this.state.weekEvents = [];
      }
    } catch {
      this.state.weekEvents = [];
    }
  }

  async _loadRecentActivity() {
    try {
      const notifPlugin = this._getPlugin('notification');
      if (notifPlugin?.notificationService) {
        const items = await notifPlugin.notificationService.getNotifications(10);
        this.state.recentActivity = items;
      } else {
        this.state.recentActivity = [];
      }
    } catch {
      this.state.recentActivity = [];
    }
  }

  _getPlugin(id) {
    try {
      return this.context.getPlugin?.(id) || null;
    } catch {
      return null;
    }
  }

  _getCurrentUserId() {
    try {
      const auth = this.context.services?.AuthService;
      return auth?.getCurrentUser?.()?.userId || 'local_user';
    } catch {
      return 'local_user';
    }
  }

  // ==================== Render ====================

  async render() {
    if (!this.container) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString(this.locale, {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    this.container.innerHTML = `
      <div class="dash-plugin">
        <div class="dash-header">
          <div class="dash-header-left">
            <h2 class="dash-title">🏠 ${this.t('title')}</h2>
            <span class="dash-date">${this.escapeHtml(dateStr)}</span>
          </div>
          <button class="dash-refresh-btn" data-action="refresh" title="${this.t('refresh')}">🔄</button>
        </div>

        <div class="dash-body">
          <div class="dash-stats-row">
            ${this._renderStatCard('✅', this.t('todayTodo'), this.state.taskStats.todo, 'stat-todo')}
            ${this._renderStatCard('🔄', this.t('inProgress'), this.state.taskStats.inProgress, 'stat-progress')}
            ${this._renderStatCard('📢', this.t('unreadAnnouncements'), this.state.unreadAnnouncements, 'stat-ann')}
          </div>

          <div class="dash-section">
            <h3 class="dash-section-title">📅 ${this.t('weekCalendar')}</h3>
            ${this._renderWeekCalendar()}
          </div>

          <div class="dash-section">
            <h3 class="dash-section-title">🕐 ${this.t('recentActivity')}</h3>
            ${this._renderRecentActivity()}
          </div>
        </div>
      </div>
    `;
  }

  _renderStatCard(icon, label, value, cls) {
    return `
      <div class="dash-stat-card ${cls}">
        <div class="stat-icon">${icon}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${this.escapeHtml(label)}</div>
      </div>
    `;
  }

  _renderWeekCalendar() {
    const now = new Date();
    const today = now.getDay();

    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - today);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400000;
      const eventsToday = this.state.weekEvents.filter(
        e => e.start_time < dayEnd && (e.end_time || e.start_time + 3600000) > dayStart
      );
      days.push({ date: d, events: eventsToday, isToday: i === today });
    }

    if (this.state.weekEvents.length === 0) {
      const weekGrid = days.map(d => `
        <div class="week-day ${d.isToday ? 'week-day-today' : ''}">
          <div class="week-day-num">${d.date.getDate()}</div>
          <div class="week-day-dot"></div>
        </div>
      `).join('');
      return `
        <div class="week-grid">${weekGrid}</div>
        <p class="dash-empty-hint">${this.t('noEvents')}</p>
      `;
    }

    const weekGrid = days.map(d => `
      <div class="week-day ${d.isToday ? 'week-day-today' : ''}">
        <div class="week-day-num">${d.date.getDate()}</div>
        <div class="week-day-dot ${d.events.length > 0 ? 'has-events' : ''}"></div>
      </div>
    `).join('');

    const eventList = days.flatMap(d => d.events.map(e => ({ ...e, _dayDate: d.date })))
      .sort((a, b) => a.start_time - b.start_time)
      .slice(0, 5)
      .map(e => {
        const timeStr = e.all_day
          ? this.t('allDay')
          : new Date(e.start_time).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="week-event-item">
            <span class="week-event-time">${timeStr}</span>
            <span class="week-event-title">${this.escapeHtml(e.title || '')}</span>
          </div>
        `;
      }).join('');

    return `
      <div class="week-grid">${weekGrid}</div>
      <div class="week-events">${eventList}</div>
    `;
  }

  _renderRecentActivity() {
    const { recentActivity } = this.state;

    if (recentActivity.length === 0) {
      return `
        <div class="dash-empty">
          <div class="dash-empty-icon">📭</div>
          <p>${this.t('noActivity')}</p>
          <p class="dash-empty-hint">${this.t('noActivityHint')}</p>
        </div>
      `;
    }

    return `<div class="activity-list">
      ${recentActivity.map(n => {
        const icon = SOURCE_ICONS[n.source_plugin] || 'ℹ️';
        const time = this._timeAgo(n.created_at);
        const sourceLabel = this.t(`source${this._capitalize(n.source_plugin)}`);
        return `
          <div class="activity-item">
            <span class="activity-icon">${icon}</span>
            <div class="activity-content">
              <span class="activity-title">${this.escapeHtml(n.title)}</span>
              <span class="activity-meta">[${this.escapeHtml(sourceLabel)}] · ${time}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  }

  // ==================== Events ====================

  bindEvents() {
    if (!this.container) return;
    this.container.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'refresh') {
        await this.loadData();
        await this.render();
        this.bindEvents();
      }
    });
  }

  // ==================== Helpers ====================

  _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return this.t('justNow');
    if (diff < 3600000) return `${Math.floor(diff / 60000)} ${this.t('minutesAgo')}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${this.t('hoursAgo')}`;
    return `${Math.floor(diff / 86400000)} ${this.t('daysAgo')}`;
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default DashboardPlugin;
