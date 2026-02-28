/**
 * Task Plugin - Task management with Kanban board
 * Supports projects, priorities, due dates, tags, subtasks and drag & drop
 */
import TaskService from './services/task-service.js';

class TaskPlugin {
  static id = 'task';

  constructor(context) {
    this.context = context;
    this.container = null;

    // State
    this.state = {
      tasks: [],
      projects: [],
      currentProject: null,
      view: 'board',
      filters: {
        status: [],
        priority: [],
        tags: [],
        search: ''
      },
      selectedTask: null,
      editingTask: null,
      showFilters: false,
      stats: { todo: 0, doing: 0, done: 0 }
    };

    // Services
    this.taskService = null;

    // Timers
    this.reminderInterval = null;
    this.searchTimeout = null;

    // Localization
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('Task plugin installing...');
    this.taskService = new TaskService(this.context.services.DatabaseService);
    await this.taskService.initSchema();
    console.log('Task plugin installed');
  }

  async onActivate() {
    console.log('Task plugin activating...');
    this.taskService = new TaskService(this.context.services.DatabaseService);
    await this.taskService.initSchema();
    await this.loadProjects();
    await this.loadTasks();
    this.startReminderCheck();
    console.log('Task plugin activated');
  }

  async onDeactivate() {
    console.log('Task plugin deactivating...');
    this.stopReminderCheck();
    console.log('Task plugin deactivated');
  }

  async mount(container) {
    this.container = container;

    if (!this.taskService) {
      this.taskService = new TaskService(this.context.services.DatabaseService);
      await this.taskService.initSchema();
      await this.loadProjects();
      await this.loadTasks();
    }

    try {
      const settings = await this.context.getSettings?.();
      if (settings?.defaultView) {
        this.state.view = settings.defaultView;
      }
    } catch (e) {
      // ignore - settings may not be available
    }

    await this.render();
    this.bindEvents();
    this.startReminderCheck();
  }

  async unmount() {
    this.stopReminderCheck();
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  // ==================== Rendering ====================

  async render() {
    if (!this.container) return;

    const filteredTasks = this.getFilteredTasks();

    this.container.innerHTML = `
      <div class="task-plugin">
        <div class="task-sidebar">
          ${this.renderSidebar()}
        </div>
        <div class="task-main">
          ${this.renderHeader()}
          <div class="task-body">
            ${this.state.showFilters ? this.renderFilterPanel() : ''}
            ${this.state.view === 'board'
              ? this.renderBoardView(filteredTasks)
              : this.renderListView(filteredTasks)
            }
          </div>
        </div>
        ${this.state.selectedTask ? this.renderTaskDetail(this.state.selectedTask) : ''}
        ${this.state.editingTask !== null ? this.renderTaskEditor(this.state.editingTask) : ''}
      </div>
    `;
  }

  renderSidebar() {
    const { projects, currentProject, tasks } = this.state;
    return `
      <div class="sidebar-header">
        <h2>✅ ${this.t('tasks')}</h2>
        <button class="btn-icon-small" data-action="create-project" title="${this.t('newProject')}">➕</button>
      </div>
      <div class="project-list">
        <div class="project-item ${!currentProject ? 'active' : ''}"
             data-action="select-project"
             data-project-id="">
          <span class="project-icon">📋</span>
          <span class="project-name">${this.t('allTasks')}</span>
          <span class="project-count">${tasks.filter(t => !t.parent_id).length}</span>
        </div>
        ${projects.map(p => this.renderProjectItem(p, currentProject)).join('')}
      </div>
    `;
  }

  renderProjectItem(project, currentProject) {
    const count = this.state.tasks.filter(t => t.project_id === project.id && !t.parent_id).length;
    const isActive = currentProject === project.id;
    return `
      <div class="project-item ${isActive ? 'active' : ''}"
           data-action="select-project"
           data-project-id="${project.id}">
        <span class="project-dot" style="background: ${this.escapeHtml(project.color || '#3b82f6')}"></span>
        <span class="project-name">${this.escapeHtml(project.name)}</span>
        <span class="project-count">${count}</span>
        <div class="project-actions">
          <button class="btn-icon-small"
                  data-action="delete-project"
                  data-project-id="${project.id}"
                  title="${this.t('delete')}">🗑️</button>
        </div>
      </div>
    `;
  }

  renderHeader() {
    const { projects, currentProject, stats } = this.state;
    const project = projects.find(p => p.id === currentProject);
    const title = project ? this.escapeHtml(project.name) : this.t('allTasks');

    return `
      <div class="task-header">
        <div class="header-left">
          <h2 class="header-title">${title}</h2>
          <div class="task-stats">
            <span class="stat todo ${this.state.filters.status.includes('todo') ? 'active-filter' : ''}"
                  data-action="filter-status" data-status="todo">
              ${stats.todo} ${this.t('todo')}
            </span>
            <span class="stat doing ${this.state.filters.status.includes('doing') ? 'active-filter' : ''}"
                  data-action="filter-status" data-status="doing">
              ${stats.doing} ${this.t('doing')}
            </span>
            <span class="stat done ${this.state.filters.status.includes('done') ? 'active-filter' : ''}"
                  data-action="filter-status" data-status="done">
              ${stats.done} ${this.t('done')}
            </span>
          </div>
        </div>
        <div class="header-right">
          <input type="text"
                 class="search-input"
                 placeholder="${this.t('searchPlaceholder')}"
                 data-action="search"
                 value="${this.escapeHtml(this.state.filters.search)}">
          <div class="view-switcher">
            <button class="btn-icon ${this.state.view === 'board' ? 'active' : ''}"
                    data-action="switch-view"
                    data-view="board"
                    title="${this.t('viewBoard')}">☷</button>
            <button class="btn-icon ${this.state.view === 'list' ? 'active' : ''}"
                    data-action="switch-view"
                    data-view="list"
                    title="${this.t('viewList')}">☰</button>
          </div>
          <button class="btn-icon ${this.state.showFilters ? 'active' : ''}"
                  data-action="toggle-filters"
                  title="${this.t('filters')}">🔽</button>
          <button class="btn-primary" data-action="create-task">
            + ${this.t('newTask')}
          </button>
        </div>
      </div>
    `;
  }

  renderFilterPanel() {
    const { filters, tasks } = this.state;
    const allTags = [...new Set(tasks.flatMap(t => t.tags || []))].sort();

    return `
      <div class="filter-panel">
        <div class="filter-row">
          <div class="filter-group">
            <label class="filter-label">${this.t('status')}</label>
            <div class="filter-options">
              ${['todo', 'doing', 'done', 'cancelled'].map(s => `
                <label class="filter-option">
                  <input type="checkbox"
                         data-filter="status"
                         data-value="${s}"
                         ${filters.status.includes(s) ? 'checked' : ''}>
                  ${this.t(s)}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="filter-group">
            <label class="filter-label">${this.t('priority')}</label>
            <div class="filter-options">
              ${[5, 4, 3, 2, 1].map(p => `
                <label class="filter-option">
                  <input type="checkbox"
                         data-filter="priority"
                         data-value="${p}"
                         ${filters.priority.includes(p) ? 'checked' : ''}>
                  <span class="priority-badge p${p}">P${p}</span>
                </label>
              `).join('')}
            </div>
          </div>
          ${allTags.length > 0 ? `
            <div class="filter-group">
              <label class="filter-label">${this.t('tags')}</label>
              <div class="filter-options">
                ${allTags.map(tag => `
                  <label class="filter-option">
                    <input type="checkbox"
                           data-filter="tags"
                           data-value="${this.escapeHtml(tag)}"
                           ${filters.tags.includes(tag) ? 'checked' : ''}>
                    #${this.escapeHtml(tag)}
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="filter-actions">
          <button class="btn-secondary" data-action="clear-filters">${this.t('clearFilters')}</button>
        </div>
      </div>
    `;
  }

  renderBoardView(tasks) {
    const columns = [
      { id: 'todo', name: this.t('todo'), icon: '📋' },
      { id: 'doing', name: this.t('doing'), icon: '🔄' },
      { id: 'done', name: this.t('done'), icon: '✅' }
    ];

    return `
      <div class="board-view">
        ${columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return `
            <div class="board-column" data-status="${col.id}">
              <div class="column-header">
                <span class="column-icon">${col.icon}</span>
                <h3 class="column-title">${col.name}</h3>
                <span class="column-count">${colTasks.length}</span>
                <button class="btn-icon-small"
                        data-action="quick-add-task"
                        data-status="${col.id}"
                        title="${this.t('addTask')}">➕</button>
              </div>
              <div class="column-tasks" data-status="${col.id}">
                ${colTasks.length === 0
                  ? `<div class="empty-column">${this.t('emptyColumn')}</div>`
                  : colTasks.map(task => this.renderTaskCard(task)).join('')
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderTaskCard(task) {
    const priorityColors = { 1: '#4caf50', 2: '#8bc34a', 3: '#ffc107', 4: '#ff9800', 5: '#f44336' };
    const isOverdue = task.due_date && task.due_date < Date.now() && task.status !== 'done';
    const tags = task.tags || [];
    const subtaskCount = this.state.tasks.filter(t => t.parent_id === task.id).length;
    const isSelected = this.state.selectedTask?.id === task.id;

    return `
      <div class="task-card ${isOverdue ? 'overdue' : ''} ${isSelected ? 'selected' : ''}"
           data-task-id="${task.id}"
           data-action="select-task"
           draggable="true">
        <div class="task-priority-bar" style="background: ${priorityColors[task.priority] || '#ffc107'}"></div>
        <div class="task-card-body">
          <div class="task-title">${this.escapeHtml(task.title)}</div>
          ${tags.length > 0 ? `
            <div class="task-tags">
              ${tags.slice(0, 3).map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
              ${tags.length > 3 ? `<span class="tag-more">+${tags.length - 3}</span>` : ''}
            </div>
          ` : ''}
          <div class="task-meta">
            ${task.due_date ? `
              <span class="task-due ${isOverdue ? 'overdue' : ''}">📅 ${this.formatDate(task.due_date)}</span>
            ` : ''}
            ${task.assignee_name ? `
              <span class="task-assignee">👤 ${this.escapeHtml(task.assignee_name)}</span>
            ` : ''}
            ${subtaskCount > 0 ? `
              <span class="subtask-count">⊕ ${subtaskCount}</span>
            ` : ''}
          </div>
        </div>
        <div class="task-card-actions">
          <button class="btn-icon-small"
                  data-action="edit-task"
                  data-task-id="${task.id}"
                  title="${this.t('edit')}">✏️</button>
          <button class="btn-icon-small"
                  data-action="delete-task"
                  data-task-id="${task.id}"
                  title="${this.t('delete')}">🗑️</button>
        </div>
      </div>
    `;
  }

  renderListView(tasks) {
    return `
      <div class="list-view">
        <table class="task-table">
          <thead>
            <tr>
              <th class="col-status">${this.t('status')}</th>
              <th class="col-title">${this.t('title')}</th>
              <th class="col-priority">${this.t('priority')}</th>
              <th class="col-assignee">${this.t('assignee')}</th>
              <th class="col-due">${this.t('dueDate')}</th>
              <th class="col-tags">${this.t('tags')}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${tasks.length === 0 ? `
              <tr><td colspan="7" class="empty-state">${this.t('noTasks')}</td></tr>
            ` : tasks.map(task => {
              const isOverdue = task.due_date && task.due_date < Date.now() && task.status !== 'done';
              const isSelected = this.state.selectedTask?.id === task.id;
              return `
                <tr class="task-row ${isSelected ? 'selected' : ''}"
                    data-task-id="${task.id}"
                    data-action="select-task">
                  <td class="col-status">
                    <select class="status-select" data-task-id="${task.id}"
                            onclick="event.stopPropagation()">
                      <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>📋 ${this.t('todo')}</option>
                      <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>🔄 ${this.t('doing')}</option>
                      <option value="done" ${task.status === 'done' ? 'selected' : ''}>✅ ${this.t('done')}</option>
                      <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>❌ ${this.t('cancelled')}</option>
                    </select>
                  </td>
                  <td class="col-title">${this.escapeHtml(task.title)}</td>
                  <td class="col-priority">
                    <span class="priority-badge p${task.priority}">P${task.priority}</span>
                  </td>
                  <td class="col-assignee">${task.assignee_name ? this.escapeHtml(task.assignee_name) : '-'}</td>
                  <td class="col-due ${isOverdue ? 'overdue' : ''}">
                    ${task.due_date ? this.formatDate(task.due_date) : '-'}
                  </td>
                  <td class="col-tags">
                    ${(task.tags || []).map(t => `<span class="tag">#${this.escapeHtml(t)}</span>`).join('')}
                  </td>
                  <td class="col-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon-small" data-action="edit-task" data-task-id="${task.id}">✏️</button>
                    <button class="btn-icon-small" data-action="delete-task" data-task-id="${task.id}">🗑️</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTaskDetail(task) {
    if (!task) return '';
    const priorityColors = { 1: '#4caf50', 2: '#8bc34a', 3: '#ffc107', 4: '#ff9800', 5: '#f44336' };
    const isOverdue = task.due_date && task.due_date < Date.now() && task.status !== 'done';
    const subtasks = this.state.tasks.filter(t => t.parent_id === task.id);
    const doneSubtasks = subtasks.filter(t => t.status === 'done').length;

    return `
      <div class="task-detail-panel">
        <div class="detail-header">
          <div class="detail-title-wrap">
            <span class="priority-dot" style="background: ${priorityColors[task.priority] || '#ffc107'}"></span>
            <h2 class="detail-title">${this.escapeHtml(task.title)}</h2>
          </div>
          <div class="detail-header-actions">
            <button class="btn-icon-small"
                    data-action="edit-task"
                    data-task-id="${task.id}"
                    title="${this.t('edit')}">✏️</button>
            <button class="btn-icon-small"
                    data-action="close-detail"
                    title="${this.t('close')}">✕</button>
          </div>
        </div>

        <div class="detail-body">
          <div class="detail-meta-grid">
            <div class="detail-meta-item">
              <span class="meta-label">${this.t('status')}</span>
              <span class="status-badge ${task.status}">${this.t(task.status)}</span>
            </div>
            <div class="detail-meta-item">
              <span class="meta-label">${this.t('priority')}</span>
              <span class="priority-badge p${task.priority}">P${task.priority}</span>
            </div>
            ${task.assignee_name ? `
              <div class="detail-meta-item">
                <span class="meta-label">${this.t('assignee')}</span>
                <span>👤 ${this.escapeHtml(task.assignee_name)}</span>
              </div>
            ` : ''}
            ${task.due_date ? `
              <div class="detail-meta-item">
                <span class="meta-label">${this.t('dueDate')}</span>
                <span class="${isOverdue ? 'overdue' : ''}">📅 ${this.formatDateTime(task.due_date)}</span>
              </div>
            ` : ''}
            ${task.estimated_hours ? `
              <div class="detail-meta-item">
                <span class="meta-label">${this.t('estimatedHours')}</span>
                <span>⏱ ${task.estimated_hours}h</span>
              </div>
            ` : ''}
          </div>

          ${task.content ? `
            <div class="detail-section">
              <h4 class="section-heading">${this.t('description')}</h4>
              <div class="task-description">${this.escapeHtml(task.content)}</div>
            </div>
          ` : ''}

          ${(task.tags || []).length > 0 ? `
            <div class="detail-section">
              <h4 class="section-heading">${this.t('tags')}</h4>
              <div class="task-tags">
                ${(task.tags || []).map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="detail-section">
            <div class="subtask-header">
              <h4 class="section-heading">
                ${this.t('subtasks')}
                ${subtasks.length > 0 ? `(${doneSubtasks}/${subtasks.length})` : ''}
              </h4>
              <button class="btn-icon-small"
                      data-action="add-subtask"
                      data-parent-id="${task.id}"
                      title="${this.t('addSubtask')}">➕</button>
            </div>
            ${subtasks.length > 0 ? `
              <div class="subtask-list">
                ${subtasks.map(sub => `
                  <div class="subtask-item ${sub.status === 'done' ? 'done' : ''}">
                    <input type="checkbox"
                           class="subtask-check"
                           data-action="toggle-subtask"
                           data-task-id="${sub.id}"
                           ${sub.status === 'done' ? 'checked' : ''}>
                    <span class="subtask-title">${this.escapeHtml(sub.title)}</span>
                    <button class="btn-icon-small"
                            data-action="delete-task"
                            data-task-id="${sub.id}">🗑️</button>
                  </div>
                `).join('')}
              </div>
            ` : `<div class="empty-state small">${this.t('noSubtasks')}</div>`}
          </div>

          <div class="detail-timestamps">
            <span class="timestamp">${this.t('created')}: ${this.formatDateTime(task.created_at)}</span>
            ${task.completed_at ? `
              <span class="timestamp">${this.t('completed')}: ${this.formatDateTime(task.completed_at)}</span>
            ` : ''}
          </div>
        </div>

        <div class="detail-footer">
          <button class="btn-secondary" data-action="edit-task" data-task-id="${task.id}">${this.t('edit')}</button>
          <button class="btn-secondary btn-danger" data-action="delete-task" data-task-id="${task.id}">${this.t('delete')}</button>
        </div>
      </div>
    `;
  }

  renderTaskEditor(task) {
    if (task === null) return '';
    const isNew = !task.id;
    const { projects } = this.state;

    return `
      <div class="editor-overlay" data-action="overlay-close">
        <div class="task-editor" onclick="event.stopPropagation()">
          <div class="editor-header">
            <h3>${isNew ? this.t('newTask') : this.t('editTask')}</h3>
            <button class="btn-icon-small" data-action="close-editor">✕</button>
          </div>

          <div class="editor-body">
            <div class="form-group">
              <label class="form-label">${this.t('title')} <span class="required">*</span></label>
              <input type="text"
                     class="form-input"
                     id="taskTitle"
                     value="${this.escapeHtml(task.title || '')}"
                     placeholder="${this.t('taskTitlePlaceholder')}">
            </div>

            <div class="form-group">
              <label class="form-label">${this.t('description')}</label>
              <textarea class="form-textarea"
                        id="taskContent"
                        rows="4"
                        placeholder="${this.t('taskDescPlaceholder')}">${this.escapeHtml(task.content || '')}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${this.t('status')}</label>
                <select class="form-select" id="taskStatus">
                  <option value="todo" ${(task.status || 'todo') === 'todo' ? 'selected' : ''}>📋 ${this.t('todo')}</option>
                  <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>🔄 ${this.t('doing')}</option>
                  <option value="done" ${task.status === 'done' ? 'selected' : ''}>✅ ${this.t('done')}</option>
                  <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>❌ ${this.t('cancelled')}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">${this.t('priority')}</label>
                <select class="form-select" id="taskPriority">
                  ${[5, 4, 3, 2, 1].map(p => `
                    <option value="${p}" ${(task.priority || 3) === p ? 'selected' : ''}>
                      P${p}${p === 5 ? ' (' + this.t('highest') + ')' : p === 1 ? ' (' + this.t('lowest') + ')' : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${this.t('dueDate')}</label>
                <input type="datetime-local"
                       class="form-input"
                       id="taskDueDate"
                       value="${task.due_date ? this.toDateTimeLocal(task.due_date) : ''}">
              </div>
              <div class="form-group">
                <label class="form-label">${this.t('assignee')}</label>
                <input type="text"
                       class="form-input"
                       id="taskAssignee"
                       value="${this.escapeHtml(task.assignee_name || '')}"
                       placeholder="${this.t('assigneePlaceholder')}">
              </div>
            </div>

            ${projects.length > 0 ? `
              <div class="form-group">
                <label class="form-label">${this.t('project')}</label>
                <select class="form-select" id="taskProject">
                  <option value="">${this.t('noProject')}</option>
                  ${projects.map(p => `
                    <option value="${p.id}" ${task.project_id === p.id ? 'selected' : ''}>
                      ${this.escapeHtml(p.name)}
                    </option>
                  `).join('')}
                </select>
              </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label">${this.t('estimatedHours')}</label>
              <input type="number"
                     class="form-input"
                     id="taskEstHours"
                     min="0"
                     step="0.5"
                     value="${task.estimated_hours || ''}"
                     placeholder="0">
            </div>

            <div class="form-group">
              <label class="form-label">${this.t('tags')}</label>
              <div class="tag-editor" id="tagEditor">
                ${(task.tags || []).map(tag => `
                  <span class="tag editable">
                    #${this.escapeHtml(tag)}
                    <button class="tag-remove" data-action="remove-tag" data-tag="${this.escapeHtml(tag)}">×</button>
                  </span>
                `).join('')}
                <input type="text" class="tag-input" placeholder="${this.t('tagInputPlaceholder')}">
              </div>
              <div class="form-hint">${this.t('tagHint')}</div>
            </div>
          </div>

          <div class="editor-footer">
            <button class="btn-secondary" data-action="close-editor">${this.t('cancel')}</button>
            <button class="btn-primary" data-action="save-task">${isNew ? this.t('create') : this.t('save')}</button>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== Event Handling ====================

  bindEvents() {
    if (!this.container) return;

    // Click events (delegated)
    this.container.addEventListener('click', async (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      // Let default behavior through for these
      if (action === 'toggle-subtask') return;

      e.preventDefault();
      e.stopPropagation();

      await this.handleAction(action, actionEl);
    });

    // Input events (delegated) - for search field
    this.container.addEventListener('input', (e) => {
      if (e.target.matches('.search-input')) {
        this.handleSearch(e.target.value);
      }
    });

    // Keydown events (delegated) - for tag input + Escape
    this.container.addEventListener('keydown', async (e) => {
      if (e.target.matches('.tag-input')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tag = e.target.value.trim();
          if (tag && this.state.editingTask) {
            const tags = this.state.editingTask.tags || [];
            if (!tags.includes(tag)) {
              this.state.editingTask.tags = [...tags, tag];
              this.updateTagEditorUI(this.state.editingTask.tags);
            }
            e.target.value = '';
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (this.state.editingTask !== null) {
          this.state.editingTask = null;
          await this.render();
        } else if (this.state.selectedTask) {
          this.state.selectedTask = null;
          await this.render();
        }
      }
    });

    // Change events for select dropdowns and filter checkboxes
    this.container.addEventListener('change', async (e) => {
      const target = e.target;
      if (target.matches('.status-select')) {
        e.stopPropagation();
        await this.moveTask(target.dataset.taskId, target.value);
        return;
      }
      if (target.matches('[data-filter]')) {
        this.handleFilterChange(
          target.dataset.filter,
          target.dataset.value,
          target.checked
        );
        return;
      }
      if (target.matches('.subtask-check')) {
        e.stopPropagation();
        await this.toggleSubtask(target.dataset.taskId, target.checked);
      }
    });

    // Drag and drop (delegated)
    this.container.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card[draggable]');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    this.container.addEventListener('dragend', (e) => {
      const card = e.target.closest('.task-card');
      if (card) card.classList.remove('dragging');
      this.$('.column-tasks.drag-over')?.classList.remove('drag-over');
    });

    this.container.addEventListener('dragover', (e) => {
      const col = e.target.closest('.column-tasks');
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!col.classList.contains('drag-over')) {
        this.$$('.column-tasks.drag-over').forEach(c => c.classList.remove('drag-over'));
        col.classList.add('drag-over');
      }
    });

    this.container.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.column-tasks');
      if (col && !col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    this.container.addEventListener('drop', async (e) => {
      const col = e.target.closest('.column-tasks');
      if (!col) return;
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.status;
      if (taskId && newStatus) {
        await this.moveTask(taskId, newStatus);
      }
    });
  }

  async handleAction(action, element) {
    const handlers = {
      'select-project': async () => this.selectProject(element.dataset.projectId || null),
      'create-project': async () => this.createProject(),
      'delete-project': async () => this.deleteProject(element.dataset.projectId),
      'create-task': async () => this.openEditor({
        status: 'todo',
        priority: 3,
        tags: [],
        project_id: this.state.currentProject
      }),
      'quick-add-task': async () => this.quickAddTask(element.dataset.status),
      'select-task': async () => this.selectTask(element.dataset.taskId),
      'edit-task': async () => {
        const task = this.state.tasks.find(t => t.id === element.dataset.taskId);
        if (task) this.openEditor(task);
      },
      'delete-task': async () => this.deleteTask(element.dataset.taskId),
      'save-task': async () => this.saveEditingTask(),
      'close-editor': async () => this.closeEditor(),
      'overlay-close': async () => this.closeEditor(),
      'close-detail': async () => this.closeDetail(),
      'switch-view': async () => {
        this.state.view = element.dataset.view;
        await this.render();
      },
      'toggle-filters': async () => {
        this.state.showFilters = !this.state.showFilters;
        await this.render();
      },
      'clear-filters': async () => this.clearFilters(),
      'filter-status': async () => this.quickFilterStatus(element.dataset.status),
      'add-subtask': async () => this.addSubtask(element.dataset.parentId),
      'remove-tag': async () => this.removeTagFromEditor(element.dataset.tag)
    };

    const handler = handlers[action];
    if (handler) {
      await handler();
    }
  }

  // ==================== Data Operations ====================

  async loadProjects() {
    this.state.projects = await this.taskService.getProjects();
  }

  async loadTasks() {
    const tasks = await this.taskService.getTasks({
      projectId: this.state.currentProject || undefined
    });
    this.state.tasks = tasks;
    this.state.stats = this.computeStats(tasks);
  }

  async selectProject(projectId) {
    this.state.currentProject = projectId || null;
    this.state.selectedTask = null;
    await this.loadTasks();
    await this.render();
  }

  async createProject() {
    const name = prompt(this.t('projectNamePrompt'));
    if (!name?.trim()) return;

    const project = await this.taskService.createProject({ name: name.trim() });
    this.state.projects.push(project);
    await this.render();
  }

  async deleteProject(projectId) {
    if (!projectId) return;
    if (!confirm(this.t('confirmDeleteProject'))) return;

    await this.taskService.deleteProject(projectId);
    this.state.projects = this.state.projects.filter(p => p.id !== projectId);

    if (this.state.currentProject === projectId) {
      this.state.currentProject = null;
      await this.loadTasks();
    }

    await this.render();
  }

  async quickAddTask(status) {
    const title = prompt(this.t('taskTitlePrompt'));
    if (!title?.trim()) return;

    await this.createTaskData({
      title: title.trim(),
      status: status || 'todo',
      priority: 3,
      tags: [],
      project_id: this.state.currentProject
    });

    await this.render();
  }

  openEditor(task) {
    this.state.editingTask = task ? { ...task, tags: [...(task.tags || [])] } : null;
    this.state.selectedTask = null;
    this.render();
  }

  closeEditor() {
    this.state.editingTask = null;
    this.render();
  }

  selectTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    this.state.selectedTask = task;
    this.render();
  }

  closeDetail() {
    this.state.selectedTask = null;
    this.render();
  }

  async saveEditingTask() {
    const task = this.state.editingTask;
    if (!task) return;

    const title = this.$('#taskTitle')?.value.trim();
    if (!title) {
      this.showToast(this.t('titleRequired'), 'error');
      return;
    }

    const data = {
      title,
      content: this.$('#taskContent')?.value || '',
      status: this.$('#taskStatus')?.value || 'todo',
      priority: parseInt(this.$('#taskPriority')?.value) || 3,
      due_date: this.$('#taskDueDate')?.value
        ? new Date(this.$('#taskDueDate').value).getTime()
        : null,
      assignee_name: this.$('#taskAssignee')?.value.trim() || null,
      project_id: this.$('#taskProject')?.value || task.project_id || this.state.currentProject || null,
      estimated_hours: parseFloat(this.$('#taskEstHours')?.value) || null,
      tags: task.tags || []
    };

    if (task.id) {
      await this.updateTaskData(task.id, data);
    } else {
      await this.createTaskData({ ...data, parent_id: task.parent_id || null });
    }

    this.state.editingTask = null;
    this.showToast(this.t('saved'), 'success');
    await this.render();
  }

  async createTaskData(data) {
    const task = await this.taskService.createTask(data);
    this.state.tasks.push(task);
    this.state.stats = this.computeStats(this.state.tasks);
    return task;
  }

  async updateTaskData(taskId, updates) {
    const updated = await this.taskService.updateTask(taskId, updates);
    const idx = this.state.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      this.state.tasks[idx] = updated;
    }
    if (this.state.selectedTask?.id === taskId) {
      this.state.selectedTask = updated;
    }
    this.state.stats = this.computeStats(this.state.tasks);
    return updated;
  }

  async deleteTask(taskId) {
    if (!taskId) return;
    if (!confirm(this.t('confirmDelete'))) return;

    await this.taskService.deleteTask(taskId);

    // Also soft-delete subtasks
    const subtasks = this.state.tasks.filter(t => t.parent_id === taskId);
    for (const sub of subtasks) {
      await this.taskService.deleteTask(sub.id);
    }

    this.state.tasks = this.state.tasks.filter(t => t.id !== taskId && t.parent_id !== taskId);

    if (this.state.selectedTask?.id === taskId) {
      this.state.selectedTask = null;
    }

    this.state.stats = this.computeStats(this.state.tasks);
    await this.render();
  }

  async moveTask(taskId, newStatus) {
    if (!taskId || !newStatus) return;
    await this.updateTaskData(taskId, { status: newStatus });
    await this.render();
  }

  async addSubtask(parentId) {
    const title = prompt(this.t('subtaskTitlePrompt'));
    if (!title?.trim()) return;

    const parent = this.state.tasks.find(t => t.id === parentId);
    await this.createTaskData({
      title: title.trim(),
      status: 'todo',
      priority: parent?.priority || 3,
      tags: [],
      parent_id: parentId,
      project_id: parent?.project_id || this.state.currentProject || null
    });

    await this.render();
  }

  async toggleSubtask(taskId, isDone) {
    await this.updateTaskData(taskId, { status: isDone ? 'done' : 'todo' });

    // Refresh detail panel in place if open
    if (this.state.selectedTask) {
      const updatedParent = this.state.tasks.find(t => t.id === this.state.selectedTask.id);
      if (updatedParent) {
        this.state.selectedTask = updatedParent;
      }
      const panel = this.$('.task-detail-panel');
      if (panel) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this.renderTaskDetail(this.state.selectedTask);
        panel.replaceWith(tmp.firstElementChild);
      }
    }
  }

  removeTagFromEditor(tag) {
    if (!this.state.editingTask) return;
    this.state.editingTask.tags = (this.state.editingTask.tags || []).filter(t => t !== tag);
    this.updateTagEditorUI(this.state.editingTask.tags);
  }

  updateTagEditorUI(tags) {
    const tagEditor = this.$('#tagEditor');
    if (!tagEditor) return;

    const tagInput = tagEditor.querySelector('.tag-input');

    // Remove existing tag spans (keep the input)
    Array.from(tagEditor.querySelectorAll('.tag.editable')).forEach(el => el.remove());

    const fragment = document.createDocumentFragment();
    tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag editable';
      span.innerHTML = `#${this.escapeHtml(tag)}<button class="tag-remove" data-action="remove-tag" data-tag="${this.escapeHtml(tag)}">×</button>`;
      fragment.appendChild(span);
    });

    if (tagInput) {
      tagEditor.insertBefore(fragment, tagInput);
    } else {
      tagEditor.appendChild(fragment);
    }
  }

  handleFilterChange(filterType, value, checked) {
    if (!filterType) return;
    const filters = this.state.filters;
    if (!filters[filterType]) filters[filterType] = [];

    const coercedValue = filterType === 'priority' ? parseInt(value) : value;

    if (checked) {
      if (!filters[filterType].includes(coercedValue)) {
        filters[filterType] = [...filters[filterType], coercedValue];
      }
    } else {
      filters[filterType] = filters[filterType].filter(v => v !== coercedValue);
    }

    this.render();
  }

  quickFilterStatus(status) {
    const filters = this.state.filters;
    if (filters.status.includes(status)) {
      filters.status = filters.status.filter(s => s !== status);
    } else {
      filters.status = [status];
    }
    this.render();
  }

  clearFilters() {
    this.state.filters = { status: [], priority: [], tags: [], search: '' };
    this.render();
  }

  handleSearch(query) {
    this.state.filters.search = query;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.render(), 250);
  }

  getFilteredTasks() {
    const { tasks, filters, currentProject } = this.state;

    let filtered = tasks.filter(t => !t.parent_id); // Only top-level tasks in main views

    if (currentProject) {
      filtered = filtered.filter(t => t.project_id === currentProject);
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(t => filters.status.includes(t.status));
    }

    if (filters.priority.length > 0) {
      filtered = filtered.filter(t => filters.priority.includes(t.priority));
    }

    if (filters.tags.length > 0) {
      filtered = filtered.filter(t =>
        filters.tags.every(tag => (t.tags || []).includes(tag))
      );
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.content || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
        (t.assignee_name || '').toLowerCase().includes(q)
      );
    }

    // Sort: priority desc, then overdue first, then due_date asc, then created_at desc
    filtered.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.due_date && b.due_date) return a.due_date - b.due_date;
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.created_at - a.created_at;
    });

    return filtered;
  }

  // ==================== Reminder ====================

  startReminderCheck() {
    if (this.reminderInterval) return;
    this.checkReminders();
    this.reminderInterval = setInterval(() => this.checkReminders(), 60000);
  }

  stopReminderCheck() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }

  async checkReminders() {
    if (!this.state.tasks.length) return;

    const now = Date.now();
    let reminderHours = 24;
    try {
      const settings = await this.context.getSettings?.();
      reminderHours = settings?.dueDateReminder ?? 24;
    } catch (e) {
      // ignore
    }
    const threshold = now + reminderHours * 3600000;

    const dueTasks = this.state.tasks.filter(t =>
      t.status !== 'done' &&
      t.status !== 'cancelled' &&
      t.due_date &&
      t.due_date <= threshold &&
      t.due_date > now
    );

    for (const task of dueTasks) {
      const key = `task_reminder_${task.id}_${task.due_date}`;
      if (!localStorage.getItem(key)) {
        this.showReminder(task);
        localStorage.setItem(key, '1');
      }
    }
  }

  showReminder(task) {
    if (!('Notification' in window)) return;

    const dispatch = () => {
      try {
        const hoursLeft = Math.round((task.due_date - Date.now()) / 3600000);
        new Notification(this.t('taskDueSoon'), {
          body: `${task.title} — ${hoursLeft}${this.t('hoursLeft')}`,
          tag: `task-reminder-${task.id}`
        });
      } catch (e) {
        // Notification API unavailable in this environment
      }
    };

    if (Notification.permission === 'granted') {
      dispatch();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') dispatch();
      });
    }
  }

  // ==================== Helper Methods ====================

  $(selector) {
    return this.container?.querySelector(selector);
  }

  $$(selector) {
    return Array.from(this.container?.querySelectorAll(selector) || []);
  }

  t(key) {
    return this.i18n?.t?.(key) || key;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleDateString(this.locale);
    } catch (e) {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  formatDateTime(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleString(this.locale);
    } catch (e) {
      return new Date(timestamp).toLocaleString();
    }
  }

  toDateTimeLocal(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  computeStats(tasks) {
    const topLevel = tasks.filter(t => !t.parent_id);
    return {
      todo: topLevel.filter(t => t.status === 'todo').length,
      doing: topLevel.filter(t => t.status === 'doing').length,
      done: topLevel.filter(t => t.status === 'done').length
    };
  }

  showToast(message, type = 'info') {
    try {
      this.context.ui?.showToast?.(message, type);
    } catch (e) {
      console.log(`[Task] ${type}: ${message}`);
    }
  }
}

export default TaskPlugin;
