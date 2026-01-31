# Task 插件规格

## 概述

Task 是 Localverse 的任务管理插件，提供：
1. 看板视图（Todo/Doing/Done）
2. 任务属性（优先级、截止日期、负责人）
3. 子任务支持
4. 标签和过滤
5. 任务同步

## manifest.json

```json
{
  "id": "task",
  "name": {
    "zh": "任务",
    "ja": "タスク",
    "en": "Tasks"
  },
  "version": "1.0.0",
  "description": {
    "zh": "任务管理看板，支持协作和同步",
    "ja": "タスク管理カンバン、コラボレーション対応",
    "en": "Task management board with collaboration"
  },
  "icon": "✅",
  "category": "productivity",
  
  "entry": "./index.js",
  "style": "./style.css",
  
  "location": {
    "sidebar": {
      "enabled": true,
      "order": 4
    }
  },
  
  "permissions": [
    "database:read",
    "database:write",
    "network:sync",
    "notification"
  ],
  
  "settings": {
    "defaultView": {
      "type": "select",
      "options": ["board", "list", "calendar"],
      "default": "board",
      "label": { "zh": "默认视图", "en": "Default view" }
    },
    "showCompletedTasks": {
      "type": "boolean",
      "default": true,
      "label": { "zh": "显示已完成任务", "en": "Show completed tasks" }
    },
    "dueDateReminder": {
      "type": "number",
      "default": 24,
      "label": { "zh": "截止提醒(小时)", "en": "Due date reminder (hours)" }
    }
  }
}
```

## 数据模型

```typescript
interface Task {
  id: string;
  title: string;
  content: string;
  status: 'todo' | 'doing' | 'done' | 'cancelled';
  priority: number;           // 1-5, 5 最高
  tags: string[];
  assignee: string | null;    // 用户 ID
  assigneeName: string | null;
  dueDate: number | null;
  reminderAt: number | null;
  projectId: string | null;
  parentId: string | null;    // 父任务（子任务）
  estimatedHours: number | null;
  actualHours: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  version: number;
  syncStatus: SyncStatus;
  deleted: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  members: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

interface TaskFilter {
  status?: string[];
  priority?: number[];
  assignee?: string[];
  tags?: string[];
  projectId?: string;
  dueDate?: {
    start?: number;
    end?: number;
  };
  search?: string;
}
```

## 插件实现

```javascript
// plugins/task/index.js

import Plugin from '../../core/plugin-base.js';

class TaskPlugin extends Plugin {
  static id = 'task';
  
  constructor(context) {
    super(context);
    
    this.state = {
      tasks: [],
      projects: [],
      currentProject: null,
      view: 'board',
      filters: {},
      selectedTask: null,
      editingTask: null,
      stats: {
        todo: 0,
        doing: 0,
        done: 0
      }
    };
  }
  
  // ============ 生命周期 ============
  
  async onActivate() {
    await this.loadProjects();
    await this.loadTasks();
    this.startReminderCheck();
    this.subscribeToUpdates();
  }
  
  async onDeactivate() {
    this.stopReminderCheck();
    this.unsubscribeFromUpdates();
  }
  
  // ============ 数据操作 ============
  
  async loadProjects() {
    const projects = await this.services.DatabaseService.query(`
      SELECT * FROM task_projects WHERE deleted = 0 ORDER BY created_at
    `);
    
    this.setState({ 
      projects: projects.map(p => ({
        ...p,
        members: JSON.parse(p.members || '[]')
      }))
    });
  }
  
  async loadTasks(projectId = null) {
    let sql = `
      SELECT * FROM tasks WHERE deleted = 0
    `;
    const params = [];
    
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    
    // 应用过滤器
    const { filters } = this.state;
    
    if (filters.status?.length > 0) {
      sql += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    }
    
    if (filters.assignee?.length > 0) {
      sql += ` AND assignee IN (${filters.assignee.map(() => '?').join(',')})`;
      params.push(...filters.assignee);
    }
    
    if (filters.priority?.length > 0) {
      sql += ` AND priority IN (${filters.priority.map(() => '?').join(',')})`;
      params.push(...filters.priority);
    }
    
    if (!this.getSetting('showCompletedTasks')) {
      sql += ` AND status != 'done'`;
    }
    
    sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';
    
    const tasks = await this.services.DatabaseService.query(sql, params);
    
    const parsedTasks = tasks.map(t => ({
      ...t,
      tags: JSON.parse(t.tags || '[]')
    }));
    
    // 计算统计
    const stats = {
      todo: parsedTasks.filter(t => t.status === 'todo').length,
      doing: parsedTasks.filter(t => t.status === 'doing').length,
      done: parsedTasks.filter(t => t.status === 'done').length
    };
    
    this.setState({ tasks: parsedTasks, stats, currentProject: projectId });
  }
  
  async createTask(data) {
    const id = this.generateId();
    const now = Date.now();
    
    const task = {
      id,
      title: data.title || this.t('newTask'),
      content: data.content || '',
      status: data.status || 'todo',
      priority: data.priority || 3,
      tags: data.tags || [],
      assignee: data.assignee || null,
      assignee_name: data.assigneeName || null,
      due_date: data.dueDate || null,
      reminder_at: data.reminderAt || null,
      project_id: data.projectId || this.state.currentProject,
      parent_id: data.parentId || null,
      estimated_hours: data.estimatedHours || null,
      actual_hours: null,
      created_by: this.getCurrentUserId(),
      created_at: now,
      updated_at: now,
      completed_at: null,
      version: 1,
      sync_status: 'local',
      deleted: 0
    };
    
    await this.services.DatabaseService.run(`
      INSERT INTO tasks 
      (id, title, content, status, priority, tags, assignee, assignee_name, due_date, 
       reminder_at, project_id, parent_id, estimated_hours, actual_hours, created_by, 
       created_at, updated_at, completed_at, version, sync_status, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      task.id, task.title, task.content, task.status, task.priority,
      JSON.stringify(task.tags), task.assignee, task.assignee_name, task.due_date,
      task.reminder_at, task.project_id, task.parent_id, task.estimated_hours,
      task.actual_hours, task.created_by, task.created_at, task.updated_at,
      task.completed_at, task.version, task.sync_status, task.deleted
    ]);
    
    // 更新状态
    const newTask = { ...task, tags: task.tags };
    this.setState({
      tasks: [...this.state.tasks, newTask],
      stats: {
        ...this.state.stats,
        [task.status]: this.state.stats[task.status] + 1
      }
    });
    
    // 同步
    this.enqueueSync('create', 'task', id);
    
    return id;
  }
  
  async updateTask(taskId, updates) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const now = Date.now();
    const newVersion = task.version + 1;
    
    // 特殊处理状态变更
    if (updates.status === 'done' && task.status !== 'done') {
      updates.completed_at = now;
    } else if (updates.status && updates.status !== 'done') {
      updates.completed_at = null;
    }
    
    // 构建更新 SQL
    const updateFields = [];
    const updateValues = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = this.toSnakeCase(key);
      
      if (key === 'tags') {
        updateFields.push(`${dbKey} = ?`);
        updateValues.push(JSON.stringify(value));
      } else {
        updateFields.push(`${dbKey} = ?`);
        updateValues.push(value);
      }
    }
    
    updateFields.push('updated_at = ?', 'version = ?', "sync_status = 'modified'");
    updateValues.push(now, newVersion, taskId);
    
    await this.services.DatabaseService.run(`
      UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?
    `, updateValues);
    
    // 更新状态
    const updatedTask = {
      ...task,
      ...updates,
      updated_at: now,
      version: newVersion,
      sync_status: 'modified'
    };
    
    // 更新统计
    const stats = { ...this.state.stats };
    if (updates.status && updates.status !== task.status) {
      stats[task.status]--;
      stats[updates.status]++;
    }
    
    this.setState({
      tasks: this.state.tasks.map(t => t.id === taskId ? updatedTask : t),
      selectedTask: this.state.selectedTask?.id === taskId ? updatedTask : this.state.selectedTask,
      stats
    });
    
    // 同步
    this.enqueueSync('update', 'task', taskId);
  }
  
  async deleteTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const confirmed = await this.context.ui.showConfirm(this.t('confirmDelete'));
    if (!confirmed) return;
    
    const now = Date.now();
    
    await this.services.DatabaseService.run(`
      UPDATE tasks SET deleted = 1, deleted_at = ?, sync_status = 'modified' WHERE id = ?
    `, [now, taskId]);
    
    // 更新状态
    const stats = { ...this.state.stats };
    stats[task.status]--;
    
    this.setState({
      tasks: this.state.tasks.filter(t => t.id !== taskId),
      selectedTask: this.state.selectedTask?.id === taskId ? null : this.state.selectedTask,
      stats
    });
    
    // 同步
    this.enqueueSync('delete', 'task', taskId);
  }
  
  async moveTask(taskId, newStatus) {
    await this.updateTask(taskId, { status: newStatus });
  }
  
  // ============ 提醒功能 ============
  
  startReminderCheck() {
    // 每分钟检查一次
    this.reminderInterval = setInterval(() => {
      this.checkReminders();
    }, 60000);
    
    // 立即检查一次
    this.checkReminders();
  }
  
  stopReminderCheck() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }
  }
  
  async checkReminders() {
    const now = Date.now();
    const reminderHours = this.getSetting('dueDateReminder');
    const threshold = now + reminderHours * 60 * 60 * 1000;
    
    const dueTasks = this.state.tasks.filter(t => 
      t.status !== 'done' &&
      t.due_date &&
      t.due_date <= threshold &&
      t.due_date > now
    );
    
    for (const task of dueTasks) {
      // 检查是否已经提醒过
      const reminded = await this.hasReminded(task.id, task.due_date);
      if (!reminded) {
        this.showReminder(task);
        await this.markReminded(task.id, task.due_date);
      }
    }
  }
  
  showReminder(task) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    
    const hoursLeft = Math.round((task.due_date - Date.now()) / 3600000);
    
    new Notification(this.t('taskDueSoon'), {
      body: `${task.title} - ${hoursLeft}${this.t('hoursLeft')}`,
      icon: '/icons/task.png',
      tag: `task-reminder-${task.id}`
    }).onclick = () => {
      window.focus();
      this.selectTask(task.id);
    };
  }
  
  // ============ 渲染 ============
  
  render() {
    const { tasks, projects, currentProject, view, stats, selectedTask, editingTask } = this.state;
    
    return `
      <div class="task-plugin">
        <div class="task-header">
          ${this.renderHeader(projects, currentProject, stats)}
        </div>
        
        <div class="task-body">
          ${view === 'board' 
            ? this.renderBoardView(tasks) 
            : view === 'list'
            ? this.renderListView(tasks)
            : this.renderCalendarView(tasks)
          }
        </div>
        
        ${selectedTask ? this.renderTaskDetail(selectedTask) : ''}
        ${editingTask ? this.renderTaskEditor(editingTask) : ''}
      </div>
    `;
  }
  
  renderHeader(projects, currentProject, stats) {
    return `
      <div class="header-left">
        <select class="project-select" value="${currentProject || ''}">
          <option value="">${this.t('allTasks')}</option>
          ${projects.map(p => `
            <option value="${p.id}" ${p.id === currentProject ? 'selected' : ''}>
              ${this.escapeHtml(p.name)}
            </option>
          `).join('')}
        </select>
        
        <div class="task-stats">
          <span class="stat todo">${stats.todo} ${this.t('todo')}</span>
          <span class="stat doing">${stats.doing} ${this.t('doing')}</span>
          <span class="stat done">${stats.done} ${this.t('done')}</span>
        </div>
      </div>
      
      <div class="header-right">
        <div class="view-switcher">
          <button class="btn-icon ${this.state.view === 'board' ? 'active' : ''}" 
                  data-view="board">☷</button>
          <button class="btn-icon ${this.state.view === 'list' ? 'active' : ''}" 
                  data-view="list">☰</button>
          <button class="btn-icon ${this.state.view === 'calendar' ? 'active' : ''}" 
                  data-view="calendar">📅</button>
        </div>
        
        <button class="btn-icon" data-action="filter">🔽</button>
        
        <button class="btn-primary" data-action="create-task">
          + ${this.t('newTask')}
        </button>
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
        ${columns.map(column => `
          <div class="board-column" data-status="${column.id}">
            <div class="column-header">
              <span class="column-icon">${column.icon}</span>
              <h3 class="column-title">${column.name}</h3>
              <span class="column-count">
                ${tasks.filter(t => t.status === column.id).length}
              </span>
            </div>
            <div class="column-tasks" data-status="${column.id}">
              ${tasks
                .filter(t => t.status === column.id)
                .map(task => this.renderTaskCard(task))
                .join('')}
              
              ${column.id === 'todo' ? `
                <button class="btn-add-task" data-action="quick-add" data-status="${column.id}">
                  + ${this.t('addTask')}
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  renderTaskCard(task) {
    const priorityColors = ['', '#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'];
    const isOverdue = task.due_date && task.due_date < Date.now() && task.status !== 'done';
    
    return `
      <div class="task-card ${isOverdue ? 'overdue' : ''}" 
           data-task-id="${task.id}"
           draggable="true">
        <div class="task-priority" style="background: ${priorityColors[task.priority]}"></div>
        
        <div class="task-content">
          <div class="task-title">${this.escapeHtml(task.title)}</div>
          
          ${task.tags.length > 0 ? `
            <div class="task-tags">
              ${task.tags.slice(0, 2).map(tag => `
                <span class="tag">${tag}</span>
              `).join('')}
              ${task.tags.length > 2 ? `<span class="tag-more">+${task.tags.length - 2}</span>` : ''}
            </div>
          ` : ''}
          
          <div class="task-meta">
            ${task.due_date ? `
              <span class="task-due ${isOverdue ? 'overdue' : ''}">
                📅 ${this.formatDate(task.due_date)}
              </span>
            ` : ''}
            
            ${task.assignee_name ? `
              <span class="task-assignee">
                👤 ${task.assignee_name}
              </span>
            ` : ''}
          </div>
        </div>
        
        <div class="task-actions">
          <button class="btn-icon" data-action="edit-task" data-task-id="${task.id}">✏️</button>
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
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(task => `
              <tr class="task-row" data-task-id="${task.id}">
                <td class="col-status">
                  <select class="status-select" data-task-id="${task.id}">
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>📋 ${this.t('todo')}</option>
                    <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>🔄 ${this.t('doing')}</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>✅ ${this.t('done')}</option>
                  </select>
                </td>
                <td class="col-title">${this.escapeHtml(task.title)}</td>
                <td class="col-priority">
                  <span class="priority-badge p${task.priority}">P${task.priority}</span>
                </td>
                <td class="col-assignee">${task.assignee_name || '-'}</td>
                <td class="col-due ${task.due_date && task.due_date < Date.now() ? 'overdue' : ''}">
                  ${task.due_date ? this.formatDate(task.due_date) : '-'}
                </td>
                <td class="col-actions">
                  <button class="btn-icon" data-action="edit-task" data-task-id="${task.id}">✏️</button>
                  <button class="btn-icon" data-action="delete-task" data-task-id="${task.id}">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  renderCalendarView(tasks) {
    // 简化的日历视图
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return `
      <div class="calendar-view">
        <div class="calendar-header">
          <button class="btn-icon" data-action="prev-month">◀</button>
          <h3>${year}年${month + 1}月</h3>
          <button class="btn-icon" data-action="next-month">▶</button>
        </div>
        
        <div class="calendar-grid">
          <div class="calendar-weekdays">
            ${['日', '一', '二', '三', '四', '五', '六'].map(d => `
              <div class="weekday">${d}</div>
            `).join('')}
          </div>
          
          <div class="calendar-days">
            ${days.map(day => {
              if (!day) return '<div class="day empty"></div>';
              
              const date = new Date(year, month, day);
              const dayStart = date.getTime();
              const dayEnd = dayStart + 86400000;
              
              const dayTasks = tasks.filter(t => 
                t.due_date && t.due_date >= dayStart && t.due_date < dayEnd
              );
              
              const isToday = day === today.getDate();
              
              return `
                <div class="day ${isToday ? 'today' : ''}" data-date="${date.toISOString()}">
                  <span class="day-number">${day}</span>
                  ${dayTasks.slice(0, 3).map(t => `
                    <div class="day-task ${t.status}" data-task-id="${t.id}">
                      ${this.truncate(t.title, 10)}
                    </div>
                  `).join('')}
                  ${dayTasks.length > 3 ? `
                    <div class="day-more">+${dayTasks.length - 3}</div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  renderTaskDetail(task) {
    return `
      <div class="task-detail-overlay" data-action="close-detail">
        <div class="task-detail" onclick="event.stopPropagation()">
          <div class="detail-header">
            <h2>${this.escapeHtml(task.title)}</h2>
            <div class="detail-actions">
              <button class="btn-icon" data-action="edit-task" data-task-id="${task.id}">✏️</button>
              <button class="btn-icon" data-action="close-detail">×</button>
            </div>
          </div>
          
          <div class="detail-body">
            <div class="detail-section">
              <label>${this.t('status')}</label>
              <span class="status-badge ${task.status}">${this.t(task.status)}</span>
            </div>
            
            <div class="detail-section">
              <label>${this.t('priority')}</label>
              <span class="priority-badge p${task.priority}">P${task.priority}</span>
            </div>
            
            ${task.assignee_name ? `
              <div class="detail-section">
                <label>${this.t('assignee')}</label>
                <span>${task.assignee_name}</span>
              </div>
            ` : ''}
            
            ${task.due_date ? `
              <div class="detail-section">
                <label>${this.t('dueDate')}</label>
                <span>${this.formatDateTime(task.due_date)}</span>
              </div>
            ` : ''}
            
            ${task.content ? `
              <div class="detail-section">
                <label>${this.t('description')}</label>
                <div class="task-description">${this.escapeHtml(task.content)}</div>
              </div>
            ` : ''}
            
            ${task.tags.length > 0 ? `
              <div class="detail-section">
                <label>${this.t('tags')}</label>
                <div class="task-tags">
                  ${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
          
          <div class="detail-footer">
            <span>${this.t('created')}: ${this.formatDateTime(task.created_at)}</span>
            ${task.completed_at ? `
              <span>${this.t('completed')}: ${this.formatDateTime(task.completed_at)}</span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
  
  renderTaskEditor(task) {
    const isNew = !task.id;
    
    return `
      <div class="editor-overlay">
        <div class="task-editor">
          <div class="editor-header">
            <h3>${isNew ? this.t('newTask') : this.t('editTask')}</h3>
            <button class="btn-icon" data-action="close-editor">×</button>
          </div>
          
          <div class="editor-body">
            <div class="form-group">
              <label>${this.t('title')} *</label>
              <input type="text" class="form-input" id="taskTitle" 
                     value="${this.escapeHtml(task.title || '')}" required>
            </div>
            
            <div class="form-group">
              <label>${this.t('description')}</label>
              <textarea class="form-textarea" id="taskContent" rows="4"
              >${this.escapeHtml(task.content || '')}</textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>${this.t('status')}</label>
                <select class="form-select" id="taskStatus">
                  <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>${this.t('todo')}</option>
                  <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>${this.t('doing')}</option>
                  <option value="done" ${task.status === 'done' ? 'selected' : ''}>${this.t('done')}</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>${this.t('priority')}</label>
                <select class="form-select" id="taskPriority">
                  ${[1, 2, 3, 4, 5].map(p => `
                    <option value="${p}" ${task.priority === p ? 'selected' : ''}>
                      P${p} ${p === 5 ? '(最高)' : p === 1 ? '(最低)' : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label>${this.t('dueDate')}</label>
              <input type="datetime-local" class="form-input" id="taskDueDate"
                     value="${task.due_date ? this.toDateTimeLocal(task.due_date) : ''}">
            </div>
            
            <div class="form-group">
              <label>${this.t('tags')}</label>
              <div class="tag-editor">
                ${(task.tags || []).map(tag => `
                  <span class="tag editable">${tag}<button class="tag-remove" data-tag="${tag}">×</button></span>
                `).join('')}
                <input type="text" class="tag-input" placeholder="${this.t('addTag')}">
              </div>
            </div>
          </div>
          
          <div class="editor-footer">
            <button class="btn-secondary" data-action="cancel-edit">${this.t('cancel')}</button>
            <button class="btn-primary" data-action="save-task">${this.t('save')}</button>
          </div>
        </div>
      </div>
    `;
  }
  
  // ============ 事件绑定 ============
  
  bindEvents() {
    // 视图切换
    this.$$('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setState({ view: btn.dataset.view });
      });
    });
    
    // 项目切换
    this.$('.project-select')?.addEventListener('change', (e) => {
      this.loadTasks(e.target.value || null);
    });
    
    // 创建任务
    this.$('[data-action="create-task"]')?.addEventListener('click', () => {
      this.setState({ editingTask: { status: 'todo', priority: 3, tags: [] } });
    });
    
    // 快速添加
    this.$$('[data-action="quick-add"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = await this.context.ui.showPrompt(this.t('taskTitle'));
        if (title) {
          await this.createTask({ title, status: btn.dataset.status });
        }
        
 # Task 插件规格（续）

## 事件绑定（续）

```javascript
    // 快速添加
    this.$$('[data-action="quick-add"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = await this.context.ui.showPrompt(this.t('taskTitle'));
        if (title) {
          await this.createTask({ title, status: btn.dataset.status });
        }
      });
    });
    
    // 任务卡片点击
    this.$$('.task-card').forEach(card => {
      card.addEventListener('click', () => {
        const taskId = card.dataset.taskId;
        const task = this.state.tasks.find(t => t.id === taskId);
        this.setState({ selectedTask: task });
      });
    });
    
    // 编辑任务
    this.$$('[data-action="edit-task"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        const task = this.state.tasks.find(t => t.id === taskId);
        this.setState({ editingTask: task, selectedTask: null });
      });
    });
    
    // 删除任务
    this.$$('[data-action="delete-task"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTask(btn.dataset.taskId);
      });
    });
    
    // 状态选择器（列表视图）
    this.$$('.status-select').forEach(select => {
      select.addEventListener('change', (e) => {
        this.moveTask(select.dataset.taskId, e.target.value);
      });
    });
    
    // 关闭详情
    this.$('[data-action="close-detail"]')?.addEventListener('click', () => {
      this.setState({ selectedTask: null });
    });
    
    // 编辑器事件
    this.bindEditorEvents();
    
    // 拖拽事件
    this.bindDragEvents();
  }
  
  bindEditorEvents() {
    // 保存
    this.$('[data-action="save-task"]')?.addEventListener('click', async () => {
      await this.saveEditingTask();
    });
    
    // 取消
    this.$('[data-action="cancel-edit"]')?.addEventListener('click', () => {
      this.setState({ editingTask: null });
    });
    
    // 关闭
    this.$('[data-action="close-editor"]')?.addEventListener('click', () => {
      this.setState({ editingTask: null });
    });
    
    // 标签输入
    this.$('.tag-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        const tag = e.target.value.trim();
        const task = this.state.editingTask;
        if (!task.tags.includes(tag)) {
          this.setState({
            editingTask: { ...task, tags: [...task.tags, tag] }
          });
        }
        e.target.value = '';
      }
    });
    
    // 移除标签
    this.$$('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        const task = this.state.editingTask;
        this.setState({
          editingTask: { ...task, tags: task.tags.filter(t => t !== tag) }
        });
      });
    });
  }
  
  bindDragEvents() {
    // 拖拽开始
    this.$$('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
        card.classList.add('dragging');
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });
    
    // 拖拽目标
    this.$$('.column-tasks').forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });
      
      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });
      
      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = column.dataset.status;
        
        this.moveTask(taskId, newStatus);
      });
    });
  }
  
  async saveEditingTask() {
    const task = this.state.editingTask;
    if (!task) return;
    
    const title = this.$('#taskTitle')?.value.trim();
    if (!title) {
      this.context.ui.showToast(this.t('titleRequired'), 'error');
      return;
    }
    
    const data = {
      title,
      content: this.$('#taskContent')?.value || '',
      status: this.$('#taskStatus')?.value || 'todo',
      priority: parseInt(this.$('#taskPriority')?.value) || 3,
      dueDate: this.$('#taskDueDate')?.value 
        ? new Date(this.$('#taskDueDate').value).getTime() 
        : null,
      tags: task.tags || []
    };
    
    if (task.id) {
      // 更新
      await this.updateTask(task.id, data);
    } else {
      // 创建
      await this.createTask(data);
    }
    
    this.setState({ editingTask: null });
    this.context.ui.showToast(this.t('saved'), 'success');
  }
  
  // ============ 实时同步 ============
  
  subscribeToUpdates() {
    this.services.CommunicationLayer.on('task_update', (msg) => {
      this.handleTaskUpdate(msg.payload);
    });
  }
  
  unsubscribeFromUpdates() {
    this.services.CommunicationLayer.off('task_update');
  }
  
  handleTaskUpdate(payload) {
    const { action, task } = payload;
    
    // 跳过自己的更新
    if (task.updated_by === this.getCurrentUserId()) return;
    
    switch (action) {
      case 'create':
        this.setState({
          tasks: [...this.state.tasks, task],
          stats: { ...this.state.stats, [task.status]: this.state.stats[task.status] + 1 }
        });
        break;
        
      case 'update':
        const oldTask = this.state.tasks.find(t => t.id === task.id);
        const stats = { ...this.state.stats };
        if (oldTask && oldTask.status !== task.status) {
          stats[oldTask.status]--;
          stats[task.status]++;
        }
        
        this.setState({
          tasks: this.state.tasks.map(t => t.id === task.id ? task : t),
          stats
        });
        break;
        
      case 'delete':
        const deletedTask = this.state.tasks.find(t => t.id === task.id);
        if (deletedTask) {
          this.setState({
            tasks: this.state.tasks.filter(t => t.id !== task.id),
            stats: { ...this.state.stats, [deletedTask.status]: this.state.stats[deletedTask.status] - 1 }
          });
        }
        break;
    }
  }
  
  enqueueSync(action, type, id) {
    this.eventBus.emit('sync:enqueue', { action, entityType: type, entityId: id });
  }
  
  // ============ 辅助方法 ============
  
  async hasReminded(taskId, dueDate) {
    const key = `reminder_${taskId}_${dueDate}`;
    return localStorage.getItem(key) === 'true';
  }
  
  async markReminded(taskId, dueDate) {
    const key = `reminder_${taskId}_${dueDate}`;
    localStorage.setItem(key, 'true');
  }
  
  selectTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    this.setState({ selectedTask: task });
  }
  
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString();
  }
  
  formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
  
  toDateTimeLocal(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16);
  }
  
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
  
  generateId() {
    return 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  
  getCurrentUserId() {
    return window.app?.user?.id || 'unknown';
  }
}

export default TaskPlugin;
```

## 样式

```css
/* plugins/task/style.css */

.task-plugin {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
}

.task-stats {
  display: flex;
  gap: 12px;
}

.task-stats .stat {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.stat.todo { background: #e3f2fd; color: #1976d2; }
.stat.doing { background: #fff3e0; color: #f57c00; }
.stat.done { background: #e8f5e9; color: #388e3c; }

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Board View */
.board-view {
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  flex: 1;
}

.board-column {
  flex: 0 0 300px;
  background: var(--gray-100);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.column-header {
  display: flex;
  align-items: center;
  padding: 12px;
  gap: 8px;
}

.column-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.column-count {
  background: var(--gray-300);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.column-tasks {
  flex: 1;
  padding: 0 8px 8px;
  overflow-y: auto;
  min-height: 100px;
}

.column-tasks.drag-over {
  background: var(--primary-color);
  background-opacity: 0.1;
}

/* Task Card */
.task-card {
  background: var(--surface-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  position: relative;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s;
}

.task-card:hover {
  box-shadow: var(--shadow-md);
}

.task-card.dragging {
  opacity: 0.5;
}

.task-card.overdue {
  border-left: 3px solid var(--error-color);
}

.task-priority {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  border-radius: 8px 0 0 8px;
}

.task-title {
  font-weight: 500;
  margin-bottom: 8px;
  padding-left: 8px;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  padding-left: 8px;
}

.task-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  padding-left: 8px;
}

.task-due.overdue {
  color: var(--error-color);
}

/* Editor */
.task-editor {
  background: var(--surface-color);
  border-radius: 12px;
  width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.editor-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 14px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.priority-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.priority-badge.p1 { background: #e8f5e9; color: #388e3c; }
.priority-badge.p2 { background: #f1f8e9; color: #689f38; }
.priority-badge.p3 { background: #fff3e0; color: #f57c00; }
.priority-badge.p4 { background: #fff3e0; color: #ef6c00; }
.priority-badge.p5 { background: #ffebee; color: #d32f2f; }
```

## 多语言

```json
// plugins/task/locales/zh.json
{
  "newTask": "新建任务",
  "editTask": "编辑任务",
  "allTasks": "所有任务",
  "todo": "待办",
  "doing": "进行中",
  "done": "已完成",
  "addTask": "添加任务",
  "title": "标题",
  "description": "描述",
  "status": "状态",
  "priority": "优先级",
  "assignee": "负责人",
  "dueDate": "截止日期",
  "tags": "标签",
  "addTag": "添加标签",
  "save": "保存",
  "cancel": "取消",
  "saved": "已保存",
  "created": "创建于",
  "completed": "完成于",
  "confirmDelete": "确定删除这个任务吗？",
  "titleRequired": "请输入任务标题",
  "taskDueSoon": "任务即将到期",
  "hoursLeft": "小时后到期"
}
```

## 相关任务

- `tasks/phase-2/task-004-task-plugin.md`