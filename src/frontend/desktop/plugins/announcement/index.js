/**
 * Announcement Plugin - Team broadcast with priority and read tracking
 */
import AnnouncementService from './services/announcement-service.js';

// Priority metadata
const PRIORITY_META = {
  urgent:    { icon: '🔴', badge: 'badge-urgent' },
  important: { icon: '🟡', badge: 'badge-important' },
  normal:    { icon: '⚪', badge: 'badge-normal' }
};

class AnnouncementPlugin {
  static id = 'announcement';

  constructor(context) {
    this.context = context;
    this.container = null;

    this.state = {
      announcements: [],
      currentUserId: null,
      currentUserName: null,
      selectedId: null,
      showCreateForm: false,
      editingId: null,
      form: this.emptyForm()
    };

    this.announcementService = null;
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
  }

  emptyForm() {
    return { title: '', content: '', priority: 'normal', isPinned: false, expiresAt: '' };
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('[Announcement] Installing...');
    this.announcementService = new AnnouncementService(this.context.services.DatabaseService);
    await this.announcementService.initSchema();
    console.log('[Announcement] Installed');
  }

  async onActivate() {
    console.log('[Announcement] Activating...');
    this.announcementService = new AnnouncementService(this.context.services.DatabaseService);
    const auth = this.context.services?.AuthService;
    if (auth) {
      const user = auth.getCurrentUser?.();
      this.state.currentUserId = user?.userId || 'local_user';
      this.state.currentUserName = user?.userName || '';
    } else {
      this.state.currentUserId = 'local_user';
    }
    await this.loadAnnouncements();
    console.log('[Announcement] Activated');
  }

  async onDeactivate() {
    console.log('[Announcement] Deactivating...');
  }

  async mount(container) {
    this.container = container;
    await this.render();
    this.bindEvents();
  }

  async unmount() {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }

  // ==================== Data ====================

  async loadAnnouncements() {
    const settings = await this.context.getSettings?.() || {};
    this.state.announcements = await this.announcementService.getAnnouncements(
      this.state.currentUserId,
      settings.showExpired || false
    );
  }

  get unreadCount() {
    return this.state.announcements.filter(a => !a.isRead).length;
  }

  // ==================== Render ====================

  async render() {
    if (!this.container) return;
    const { announcements, showCreateForm, editingId, selectedId } = this.state;

    this.container.innerHTML = `
      <div class="ann-plugin">
        <div class="ann-header">
          <div class="ann-header-left">
            <h2 class="ann-title">${this.t('announcements')}</h2>
            ${this.unreadCount > 0
              ? `<span class="unread-badge">${this.unreadCount}</span>`
              : ''}
          </div>
          <div class="ann-header-right">
            ${this.unreadCount > 0
              ? `<button class="btn-text-sm" data-action="mark-all-read">${this.t('allRead')}</button>`
              : ''}
            <button class="btn-primary btn-sm" data-action="toggle-create">
              + ${this.t('newAnnouncement')}
            </button>
          </div>
        </div>

        ${(showCreateForm || editingId) ? this.renderForm() : ''}

        <div class="ann-list">
          ${announcements.length === 0
            ? `<div class="empty-state">
                <div class="empty-icon">📢</div>
                <div class="empty-title">${this.t('noAnnouncements')}</div>
                <div class="empty-hint">${this.t('noAnnouncementsHint')}</div>
              </div>`
            : announcements.map(a => this.renderItem(a)).join('')
          }
        </div>

        ${selectedId ? await this.renderDetail(selectedId) : ''}
      </div>
    `;
  }

  renderForm() {
    const f = this.state.form;
    const isEdit = !!this.state.editingId;
    return `
      <div class="ann-form-panel">
        <h3 class="form-title">${this.t(isEdit ? 'edit' : 'createAnnouncement')}</h3>
        <div class="form-field">
          <label>${this.t('title')} *</label>
          <input class="form-input" data-field="title" value="${this.escapeHtml(f.title)}" placeholder="${this.t('titlePlaceholder')}">
        </div>
        <div class="form-field">
          <label>${this.t('content')} *</label>
          <textarea class="form-textarea" data-field="content" rows="4" placeholder="${this.t('contentPlaceholder')}">${this.escapeHtml(f.content)}</textarea>
        </div>
        <div class="form-row">
          <div class="form-field" style="flex:1">
            <label>${this.t('priority')}</label>
            <div class="priority-tabs">
              ${['normal', 'important', 'urgent'].map(p => `
                <button class="priority-tab ${f.priority === p ? 'active priority-' + p : ''}"
                  data-action="set-priority" data-priority="${p}">
                  ${PRIORITY_META[p].icon} ${this.t('priority' + p.charAt(0).toUpperCase() + p.slice(1))}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="form-field form-field-pin">
            <label>
              <input type="checkbox" data-field="isPinned" ${f.isPinned ? 'checked' : ''}>
              ${this.t('pinned')}
            </label>
          </div>
        </div>
        <div class="form-field">
          <label>${this.t('expiresAt')}</label>
          <input class="form-input" type="datetime-local" data-field="expiresAt" value="${f.expiresAt}">
        </div>
        <div class="form-actions">
          <button class="btn-primary" data-action="submit-form">${this.t(isEdit ? 'save' : 'publish')}</button>
          <button class="btn-secondary" data-action="cancel-form">${this.t('cancel')}</button>
        </div>
      </div>
    `;
  }

  renderItem(ann) {
    const meta = PRIORITY_META[ann.priority] || PRIORITY_META.normal;
    const timeStr = this.timeAgo(ann.created_at);
    return `
      <div class="ann-item ${!ann.isRead ? 'unread' : ''} ${ann.isPinned ? 'pinned' : ''}" data-ann-id="${ann.id}">
        <div class="ann-item-header">
          <div class="ann-item-meta">
            <span class="priority-icon">${meta.icon}</span>
            ${ann.isPinned ? `<span class="pin-badge">📌</span>` : ''}
            ${ann.isExpired ? `<span class="badge badge-expired">${this.t('expired')}</span>` : ''}
            ${!ann.isRead ? `<span class="badge badge-unread">${this.t('unread')}</span>` : ''}
          </div>
          <div class="ann-item-actions">
            <button class="btn-icon-sm" data-action="edit-ann" data-ann-id="${ann.id}">✏️</button>
            <button class="btn-icon-sm danger" data-action="delete-ann" data-ann-id="${ann.id}">🗑️</button>
          </div>
        </div>
        <h3 class="ann-item-title" data-action="open-ann" data-ann-id="${ann.id}">
          ${this.escapeHtml(ann.title)}
        </h3>
        <p class="ann-item-preview">${this.escapeHtml(this.getPreview(ann.content, 100))}</p>
        <div class="ann-item-footer">
          <span class="ann-author">${this.t('by')}: ${this.escapeHtml(ann.author_name || ann.author_id)}</span>
          <span class="ann-time">${timeStr}</span>
        </div>
      </div>
    `;
  }

  async renderDetail(id) {
    const ann = await this.announcementService.getAnnouncement(id);
    if (!ann) return '';
    const meta = PRIORITY_META[ann.priority] || PRIORITY_META.normal;
    return `
      <div class="ann-overlay" data-action="close-detail">
        <div class="ann-detail-panel" data-stop-propagation>
          <div class="ann-detail-header">
            <div class="ann-detail-meta">
              <span class="priority-icon-lg">${meta.icon}</span>
              ${ann.isPinned ? '<span class="pin-badge">📌</span>' : ''}
              ${ann.isExpired ? `<span class="badge badge-expired">${this.t('expired')}</span>` : ''}
            </div>
            <button class="btn-icon" data-action="close-detail">✕</button>
          </div>
          <h2 class="ann-detail-title">${this.escapeHtml(ann.title)}</h2>
          <div class="ann-detail-info">
            <span>${this.t('by')}: ${this.escapeHtml(ann.author_name || ann.author_id)}</span>
            <span>${this.formatDate(ann.created_at)}</span>
          </div>
          <div class="ann-detail-content">${this.renderContent(ann.content)}</div>
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
      if (e.target.closest('[data-stop-propagation]') && el.dataset.action !== 'close-detail') return;
      await this.handleAction(el.dataset.action, el);
    });

    this.container.addEventListener('input', (e) => {
      const el = e.target;
      const field = el.dataset.field;
      if (!field) return;
      if (field === 'isPinned') {
        this.state.form.isPinned = el.checked;
      } else if (field in this.state.form) {
        this.state.form[field] = el.value;
      }
    });

    this.container.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.field === 'isPinned') {
        this.state.form.isPinned = el.checked;
      }
    });
  }

  async handleAction(action, el) {
    switch (action) {
      case 'toggle-create':
        this.state.showCreateForm = !this.state.showCreateForm;
        this.state.editingId = null;
        if (this.state.showCreateForm) this.state.form = this.emptyForm();
        await this.render();
        this.bindEvents();
        break;

      case 'cancel-form':
        this.state.showCreateForm = false;
        this.state.editingId = null;
        await this.render();
        this.bindEvents();
        break;

      case 'set-priority':
        this.state.form.priority = el.dataset.priority;
        await this.render();
        this.bindEvents();
        break;

      case 'submit-form': {
        const f = this.state.form;
        if (!f.title.trim() || !f.content.trim()) {
          alert(this.t('titleContentRequired'));
          return;
        }
        if (this.state.editingId) {
          await this.announcementService.updateAnnouncement(this.state.editingId, {
            title: f.title.trim(),
            content: f.content.trim(),
            priority: f.priority,
            isPinned: f.isPinned,
            expiresAt: f.expiresAt ? new Date(f.expiresAt).getTime() : null
          });
          this.state.editingId = null;
        } else {
          await this.announcementService.createAnnouncement({
            title: f.title.trim(),
            content: f.content.trim(),
            priority: f.priority,
            isPinned: f.isPinned,
            authorId: this.state.currentUserId,
            authorName: this.state.currentUserName,
            expiresAt: f.expiresAt ? new Date(f.expiresAt).getTime() : null
          });
          this.state.showCreateForm = false;
        }
        await this.loadAnnouncements();
        await this.render();
        this.bindEvents();
        break;
      }

      case 'open-ann': {
        const id = el.dataset.annId;
        await this.announcementService.markRead(id, this.state.currentUserId);
        this.state.selectedId = id;
        await this.loadAnnouncements();
        await this.render();
        this.bindEvents();
        break;
      }

      case 'close-detail':
        this.state.selectedId = null;
        await this.render();
        this.bindEvents();
        break;

      case 'edit-ann': {
        const id = el.dataset.annId;
        const ann = await this.announcementService.getAnnouncement(id);
        if (!ann) return;
        this.state.editingId = id;
        this.state.showCreateForm = false;
        this.state.form = {
          title: ann.title,
          content: ann.content,
          priority: ann.priority,
          isPinned: ann.isPinned,
          expiresAt: ann.expires_at ? new Date(ann.expires_at).toISOString().slice(0, 16) : ''
        };
        await this.render();
        this.bindEvents();
        break;
      }

      case 'delete-ann': {
        if (!confirm(this.t('confirmDelete'))) return;
        await this.announcementService.deleteAnnouncement(el.dataset.annId);
        if (this.state.selectedId === el.dataset.annId) this.state.selectedId = null;
        await this.loadAnnouncements();
        await this.render();
        this.bindEvents();
        break;
      }

      case 'mark-all-read': {
        for (const ann of this.state.announcements.filter(a => !a.isRead)) {
          await this.announcementService.markRead(ann.id, this.state.currentUserId);
        }
        await this.loadAnnouncements();
        await this.render();
        this.bindEvents();
        break;
      }
    }
  }

  // ==================== Helpers ====================

  t(key) {
    try { return this.i18n?.t?.(key) || key; } catch { return key; }
  }

  escapeHtml(str) {
    if (!str) return '';
    const el = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (el) { el.textContent = String(str); return el.innerHTML; }
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  getPreview(content, maxLen) {
    const text = content?.replace(/[#*`>\-]/g, '').replace(/\n/g, ' ').trim() || '';
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }

  renderContent(content) {
    // Simple markdown-like rendering
    return this.escapeHtml(content).replace(/\n/g, '<br>');
  }

  formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return this.t('justNow');
    if (diff < 3600000) return `${Math.floor(diff / 60000)} ${this.t('minutesAgo')}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${this.t('hoursAgo')}`;
    return this.formatDate(ts);
  }
}

export default AnnouncementPlugin;
