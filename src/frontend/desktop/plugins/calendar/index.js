/**
 * Calendar Plugin - Team schedule management
 * Supports month view, event creation, color coding, and recurring events
 */
import CalendarService from './services/calendar-service.js';

const EVENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

class CalendarPlugin {
  static id = 'calendar';

  constructor(context) {
    this.context = context;
    this.container = null;

    this.state = {
      currentDate: new Date(),
      viewYear: new Date().getFullYear(),
      viewMonth: new Date().getMonth(),
      events: [],              // events in current month view
      selectedDate: null,      // date clicked
      selectedDateEvents: [],
      editingEvent: null,      // event being edited
      showCreateForm: false,
      form: this.emptyForm()
    };

    this.calendarService = null;
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
    this.firstDayOfWeek = 1; // Monday
  }

  emptyForm(date) {
    const d = date || new Date();
    const start = new Date(d);
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const startDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    return {
      title: '',
      description: '',
      startTime: this.toInputDatetime(start),
      endTime: this.toInputDatetime(end),
      startDate: startDateStr,
      allDay: false,
      color: EVENT_COLORS[0],
      recurrence: '',
      reminderMinutes: ''
    };
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('[Calendar] Installing...');
    this.calendarService = new CalendarService(this.context.services.DatabaseService);
    await this.calendarService.initSchema();
    console.log('[Calendar] Installed');
  }

  async onActivate() {
    console.log('[Calendar] Activating...');
    this.calendarService = new CalendarService(this.context.services.DatabaseService);
    const settings = await this.context.getSettings?.() || {};
    this.firstDayOfWeek = parseInt(settings.firstDayOfWeek ?? 1);
    await this.loadMonthEvents();
    console.log('[Calendar] Activated');
  }

  async onDeactivate() {
    console.log('[Calendar] Deactivating...');
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

  async loadMonthEvents() {
    const { viewYear, viewMonth } = this.state;
    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth + 1, 1);
    this.state.events = await this.calendarService.getEvents(start, end);
  }

  eventsForDate(dateObj) {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();
    return this.state.events.filter(ev => {
      const s = new Date(ev.start_time);
      return s.getFullYear() === y && s.getMonth() === m && s.getDate() === d;
    });
  }

  // ==================== Render ====================

  async render() {
    if (!this.container) return;
    const { viewYear, viewMonth, showCreateForm, editingEvent, selectedDate, selectedDateEvents } = this.state;
    const monthName = new Date(viewYear, viewMonth, 1).toLocaleString(this.locale, { month: 'long', year: 'numeric' });

    this.container.innerHTML = `
      <div class="cal-plugin">
        <div class="cal-header">
          <div class="cal-nav">
            <button class="btn-nav" data-action="prev-month">‹</button>
            <span class="cal-month-label">${monthName}</span>
            <button class="btn-nav" data-action="next-month">›</button>
            <button class="btn-today" data-action="goto-today">${this.t('today')}</button>
          </div>
          <button class="btn-primary btn-sm" data-action="toggle-create">
            + ${this.t('newEvent')}
          </button>
        </div>

        ${(showCreateForm || editingEvent) ? this.renderForm() : ''}

        <div class="cal-body">
          ${this.renderMonthGrid(viewYear, viewMonth)}
        </div>

        ${selectedDate ? this.renderDayPanel(selectedDate, selectedDateEvents) : ''}
      </div>
    `;
  }

  renderMonthGrid(year, month) {
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Day headers
    const dayHeaders = [];
    for (let i = 0; i < 7; i++) {
      const idx = (this.firstDayOfWeek + i) % 7;
      dayHeaders.push(`<div class="cal-day-header">${this.t(DAY_KEYS[idx])}</div>`);
    }

    // Offset for first day of month
    let startOffset = (firstDay.getDay() - this.firstDayOfWeek + 7) % 7;

    const cells = [];

    // Empty cells before month starts
    for (let i = 0; i < startOffset; i++) {
      cells.push('<div class="cal-day empty"></div>');
    }

    // Day cells
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      const dayEvents = this.eventsForDate(date);
      const isSelected = this.state.selectedDate &&
        this.state.selectedDate.getFullYear() === year &&
        this.state.selectedDate.getMonth() === month &&
        this.state.selectedDate.getDate() === day;

      const eventDots = dayEvents.slice(0, 3).map(ev =>
        `<span class="event-dot" style="background:${ev.color || '#3b82f6'}"></span>`
      ).join('');
      const moreCount = dayEvents.length > 3 ? `<span class="event-more">+${dayEvents.length - 3}</span>` : '';

      cells.push(`
        <div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayEvents.length ? 'has-events' : ''}"
             data-action="select-date" data-date="${date.toISOString()}">
          <span class="day-number">${day}</span>
          <div class="day-events-preview">
            ${dayEvents.slice(0, 2).map(ev =>
              `<div class="day-event-chip" style="background:${ev.color || '#3b82f6'}" title="${this.escapeHtml(ev.title)}">
                ${this.escapeHtml(ev.title.slice(0, 14))}
              </div>`
            ).join('')}
            ${dayEvents.length > 2 ? `<div class="day-event-more">+${dayEvents.length - 2}</div>` : ''}
          </div>
        </div>
      `);
    }

    return `
      <div class="cal-grid">
        <div class="cal-day-headers">${dayHeaders.join('')}</div>
        <div class="cal-days">${cells.join('')}</div>
      </div>
    `;
  }

  renderDayPanel(date, events) {
    const dateStr = date.toLocaleDateString(this.locale, { weekday: 'long', month: 'long', day: 'numeric' });
    return `
      <div class="day-panel">
        <div class="day-panel-header">
          <span class="day-panel-date">${dateStr}</span>
          <div class="day-panel-actions">
            <button class="btn-sm btn-secondary" data-action="create-on-date" data-date="${date.toISOString()}">
              + ${this.t('newEvent')}
            </button>
            <button class="btn-icon" data-action="close-day-panel">✕</button>
          </div>
        </div>
        <div class="day-event-list">
          ${events.length === 0
            ? `<div class="no-events">${this.t('noEvents')}</div>`
            : events.map(ev => this.renderEventRow(ev)).join('')
          }
        </div>
      </div>
    `;
  }

  renderEventRow(ev) {
    const startStr = ev.allDay ? '' : new Date(ev.start_time).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
    const endStr   = ev.allDay ? '' : new Date(ev.end_time).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="event-row" data-event-id="${ev.id}">
        <div class="event-color-bar" style="background:${ev.color || '#3b82f6'}"></div>
        <div class="event-row-content">
          <div class="event-row-title">${this.escapeHtml(ev.title)}</div>
          ${ev.allDay
            ? `<div class="event-row-time">${this.t('allDay')}</div>`
            : `<div class="event-row-time">${startStr} – ${endStr}</div>`}
          ${ev.description ? `<div class="event-row-desc">${this.escapeHtml(ev.description)}</div>` : ''}
        </div>
        <div class="event-row-actions">
          <button class="btn-icon-sm" data-action="edit-event" data-event-id="${ev.id}">✏️</button>
          <button class="btn-icon-sm danger" data-action="delete-event" data-event-id="${ev.id}">🗑️</button>
        </div>
      </div>
    `;
  }

  renderForm() {
    const f = this.state.form;
    const isEdit = !!this.state.editingEvent;
    return `
      <div class="cal-form-panel">
        <h3 class="form-title">${this.t(isEdit ? 'editEvent' : 'createEvent')}</h3>
        <div class="form-field">
          <label>${this.t('title')} *</label>
          <input class="form-input" data-field="title" value="${this.escapeHtml(f.title)}" placeholder="${this.t('titlePlaceholder')}">
        </div>
        <div class="form-field">
          <label>
            <input type="checkbox" data-field="allDay" ${f.allDay ? 'checked' : ''}> ${this.t('allDay')}
          </label>
        </div>
        ${!f.allDay ? `
        <div class="form-row">
          <div class="form-field" style="flex:1">
            <label>${this.t('startTime')}</label>
            <input class="form-input" type="datetime-local" data-field="startTime" value="${f.startTime}">
          </div>
          <div class="form-field" style="flex:1">
            <label>${this.t('endTime')}</label>
            <input class="form-input" type="datetime-local" data-field="endTime" value="${f.endTime}">
          </div>
        </div>
        ` : `
        <div class="form-row">
          <div class="form-field" style="flex:1">
            <label>${this.t('startTime')}</label>
            <input class="form-input" type="date" data-field="startDate" value="${f.startTime.slice(0, 10)}">
          </div>
        </div>
        `}
        <div class="form-row">
          <div class="form-field" style="flex:1">
            <label>${this.t('recurrence')}</label>
            <select class="form-input" data-field="recurrence">
              <option value="" ${!f.recurrence ? 'selected' : ''}>${this.t('noRecurrence')}</option>
              <option value="daily" ${f.recurrence === 'daily' ? 'selected' : ''}>${this.t('daily')}</option>
              <option value="weekly" ${f.recurrence === 'weekly' ? 'selected' : ''}>${this.t('weekly')}</option>
              <option value="monthly" ${f.recurrence === 'monthly' ? 'selected' : ''}>${this.t('monthly')}</option>
            </select>
          </div>
          <div class="form-field" style="flex:1">
            <label>${this.t('reminder')}</label>
            <select class="form-input" data-field="reminderMinutes">
              <option value="" ${!f.reminderMinutes ? 'selected' : ''}>${this.t('noReminder')}</option>
              <option value="5"  ${f.reminderMinutes === '5'  ? 'selected' : ''}>${this.t('remind5')}</option>
              <option value="15" ${f.reminderMinutes === '15' ? 'selected' : ''}>${this.t('remind15')}</option>
              <option value="30" ${f.reminderMinutes === '30' ? 'selected' : ''}>${this.t('remind30')}</option>
              <option value="60" ${f.reminderMinutes === '60' ? 'selected' : ''}>${this.t('remind60')}</option>
            </select>
          </div>
        </div>
        <div class="form-field">
          <label>${this.t('color')}</label>
          <div class="color-swatches">
            ${EVENT_COLORS.map(c => `
              <button class="color-swatch ${f.color === c ? 'selected' : ''}"
                style="background:${c}" data-action="set-color" data-color="${c}"></button>
            `).join('')}
          </div>
        </div>
        <div class="form-field">
          <label>${this.t('description')}</label>
          <textarea class="form-textarea" data-field="description" rows="2" placeholder="${this.t('descriptionPlaceholder')}">${this.escapeHtml(f.description)}</textarea>
        </div>
        <div class="form-actions">
          <button class="btn-primary" data-action="submit-form">${this.t('save')}</button>
          <button class="btn-secondary" data-action="cancel-form">${this.t('cancel')}</button>
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
      await this.handleAction(el.dataset.action, el, e);
    });

    this.container.addEventListener('input', (e) => {
      const el = e.target;
      const field = el.dataset.field;
      if (!field) return;
      if (field === 'allDay') {
        const currentStart = this.state.form.startTime?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        this.state.form.allDay = el.checked;
        if (el.checked) this.state.form.startDate = currentStart;
        this.render().then(() => this.bindEvents());
        return;
      }
      if (field in this.state.form) {
        this.state.form[field] = el.value;
      }
    });

    this.container.addEventListener('change', (e) => {
      const el = e.target;
      const field = el.dataset.field;
      if (!field) return;
      if (field === 'allDay') {
        const currentStart = this.state.form.startTime?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        this.state.form.allDay = el.checked;
        if (el.checked) this.state.form.startDate = currentStart;
        this.render().then(() => this.bindEvents());
        return;
      }
      if (field in this.state.form) this.state.form[field] = el.value;
    });
  }

  async handleAction(action, el, e) {
    switch (action) {
      case 'prev-month':
        if (this.state.viewMonth === 0) { this.state.viewMonth = 11; this.state.viewYear--; }
        else this.state.viewMonth--;
        await this.loadMonthEvents();
        await this.render(); this.bindEvents();
        break;

      case 'next-month':
        if (this.state.viewMonth === 11) { this.state.viewMonth = 0; this.state.viewYear++; }
        else this.state.viewMonth++;
        await this.loadMonthEvents();
        await this.render(); this.bindEvents();
        break;

      case 'goto-today': {
        const today = new Date();
        this.state.viewYear = today.getFullYear();
        this.state.viewMonth = today.getMonth();
        await this.loadMonthEvents();
        await this.render(); this.bindEvents();
        break;
      }

      case 'select-date': {
        const date = new Date(el.dataset.date);
        this.state.selectedDate = date;
        this.state.selectedDateEvents = this.eventsForDate(date);
        await this.render(); this.bindEvents();
        break;
      }

      case 'close-day-panel':
        this.state.selectedDate = null;
        await this.render(); this.bindEvents();
        break;

      case 'toggle-create':
        this.state.showCreateForm = !this.state.showCreateForm;
        this.state.editingEvent = null;
        if (this.state.showCreateForm) this.state.form = this.emptyForm();
        await this.render(); this.bindEvents();
        break;

      case 'create-on-date': {
        const date = new Date(el.dataset.date);
        this.state.showCreateForm = true;
        this.state.editingEvent = null;
        this.state.form = this.emptyForm(date);
        await this.render(); this.bindEvents();
        break;
      }

      case 'cancel-form':
        this.state.showCreateForm = false;
        this.state.editingEvent = null;
        await this.render(); this.bindEvents();
        break;

      case 'set-color':
        this.state.form.color = el.dataset.color;
        await this.render(); this.bindEvents();
        break;

      case 'submit-form': {
        const f = this.state.form;
        if (!f.title.trim()) { alert(this.t('titlePlaceholder')); return; }
        const startTime = f.allDay
          ? new Date(f.startDate || f.startTime.slice(0, 10)).getTime()
          : new Date(f.startTime).getTime();
        const endTime = f.allDay
          ? startTime + 86400000
          : new Date(f.endTime).getTime();
        const recurrence = f.recurrence ? { type: f.recurrence } : null;
        const data = {
          title: f.title.trim(),
          description: f.description.trim(),
          startTime,
          endTime,
          allDay: f.allDay,
          color: f.color,
          recurrence,
          reminderMinutes: f.reminderMinutes ? parseInt(f.reminderMinutes) : null
        };
        if (this.state.editingEvent) {
          await this.calendarService.updateEvent(this.state.editingEvent.id, data);
          this.state.editingEvent = null;
        } else {
          await this.calendarService.createEvent(data);
          this.state.showCreateForm = false;
        }
        await this.loadMonthEvents();
        if (this.state.selectedDate) {
          this.state.selectedDateEvents = this.eventsForDate(this.state.selectedDate);
        }
        await this.render(); this.bindEvents();
        break;
      }

      case 'edit-event': {
        const ev = await this.calendarService.getEvent(el.dataset.eventId);
        if (!ev) return;
        this.state.editingEvent = ev;
        this.state.showCreateForm = false;
        this.state.form = {
          title: ev.title,
          description: ev.description || '',
          startTime: this.toInputDatetime(new Date(ev.start_time)),
          endTime: this.toInputDatetime(new Date(ev.end_time)),
          allDay: ev.allDay,
          color: ev.color || EVENT_COLORS[0],
          recurrence: ev.recurrence?.type || '',
          reminderMinutes: ev.reminder_minutes ? String(ev.reminder_minutes) : ''
        };
        await this.render(); this.bindEvents();
        break;
      }

      case 'delete-event': {
        if (!confirm(this.t('confirmDelete'))) return;
        const evId = el.dataset.eventId;
        await this.calendarService.deleteEvent(evId);
        await this.loadMonthEvents();
        if (this.state.selectedDate) {
          this.state.selectedDateEvents = this.eventsForDate(this.state.selectedDate);
        }
        await this.render(); this.bindEvents();
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

  toInputDatetime(date) {
    // Returns YYYY-MM-DDTHH:MM format for datetime-local input
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}

export default CalendarPlugin;
