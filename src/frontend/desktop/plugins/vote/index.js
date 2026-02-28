/**
 * Vote Plugin - Create and participate in team polls
 * Supports single-choice, multiple-choice, and anonymous voting
 */
import VoteService from './services/vote-service.js';

class VotePlugin {
  static id = 'vote';

  constructor(context) {
    this.context = context;
    this.container = null;

    // State
    this.state = {
      votes: [],
      currentUserId: null,
      currentUserName: null,
      activeVoteId: null,    // vote being viewed/participated in
      showCreateForm: false,
      createForm: this.emptyForm()
    };

    this.voteService = null;
    this.i18n = context.i18n;
    this.locale = this.i18n?.getLocale?.() || context.locale || 'zh';
  }

  emptyForm() {
    return {
      title: '',
      description: '',
      type: 'single',
      options: ['', ''],
      expiresAt: ''
    };
  }

  // ==================== Lifecycle ====================

  async onInstall() {
    console.log('[Vote] Installing...');
    this.voteService = new VoteService(this.context.services.DatabaseService);
    await this.voteService.initSchema();
    console.log('[Vote] Installed');
  }

  async onActivate() {
    console.log('[Vote] Activating...');
    this.voteService = new VoteService(this.context.services.DatabaseService);
    const auth = this.context.services?.AuthService;
    if (auth) {
      const user = auth.getCurrentUser?.();
      this.state.currentUserId = user?.userId || 'local_user';
      this.state.currentUserName = user?.userName || '';
    } else {
      this.state.currentUserId = 'local_user';
    }
    await this.loadVotes();
    console.log('[Vote] Activated');
  }

  async onDeactivate() {
    console.log('[Vote] Deactivating...');
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

  async loadVotes() {
    const settings = await this.context.getSettings?.() || {};
    this.state.votes = await this.voteService.getVotes(settings.showExpired || false);
  }

  // ==================== Render ====================

  async render() {
    if (!this.container) return;
    const { votes, showCreateForm, activeVoteId } = this.state;
    this.container.innerHTML = `
      <div class="vote-plugin">
        <div class="vote-header">
          <h2 class="vote-title">${this.t('votes')}</h2>
          <button class="btn-primary btn-sm" data-action="toggle-create">
            + ${this.t('newVote')}
          </button>
        </div>
        ${showCreateForm ? this.renderCreateForm() : ''}
        <div class="vote-list">
          ${votes.length === 0
            ? `<div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-title">${this.t('noVotes')}</div>
                <div class="empty-hint">${this.t('noVotesHint')}</div>
              </div>`
            : votes.map(v => this.renderVoteCard(v)).join('')
          }
        </div>
        ${activeVoteId ? await this.renderVoteDetail(activeVoteId) : ''}
      </div>
    `;
  }

  renderCreateForm() {
    const f = this.state.createForm;
    return `
      <div class="create-form-panel">
        <h3 class="form-title">${this.t('createVote')}</h3>
        <div class="form-field">
          <label>${this.t('voteTitle')} *</label>
          <input class="form-input" data-field="title" value="${this.escapeHtml(f.title)}" placeholder="${this.t('voteTitlePlaceholder')}">
        </div>
        <div class="form-field">
          <label>${this.t('voteDescription')}</label>
          <input class="form-input" data-field="description" value="${this.escapeHtml(f.description)}" placeholder="${this.t('voteDescriptionPlaceholder')}">
        </div>
        <div class="form-field">
          <label>${this.t('voteType')}</label>
          <div class="type-tabs">
            ${['single', 'multi', 'anonymous'].map(type => `
              <button class="type-tab ${f.type === type ? 'active' : ''}" data-action="set-type" data-type="${type}">
                ${this.t('type' + type.charAt(0).toUpperCase() + type.slice(1))}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="form-field">
          <label>${this.t('options')}</label>
          <div class="options-list" data-role="options-list">
            ${f.options.map((opt, i) => `
              <div class="option-row" data-option-index="${i}">
                <input class="form-input option-input" data-field="option" data-index="${i}" value="${this.escapeHtml(opt)}" placeholder="${this.t('optionPlaceholder')} ${i + 1}">
                ${f.options.length > 2 ? `<button class="btn-icon-sm" data-action="remove-option" data-index="${i}">✕</button>` : ''}
              </div>
            `).join('')}
          </div>
          <button class="btn-text" data-action="add-option">${this.t('addOption')}</button>
        </div>
        <div class="form-field">
          <label>${this.t('expiresAt')}</label>
          <input class="form-input" type="datetime-local" data-field="expiresAt" value="${f.expiresAt}">
        </div>
        <div class="form-actions">
          <button class="btn-primary" data-action="submit-create">${this.t('submit')}</button>
          <button class="btn-secondary" data-action="cancel-create">${this.t('cancel')}</button>
        </div>
      </div>
    `;
  }

  renderVoteCard(vote) {
    const isExpired = vote.isExpired;
    return `
      <div class="vote-card ${isExpired ? 'expired' : ''}" data-vote-id="${vote.id}">
        <div class="vote-card-header">
          <div class="vote-card-meta">
            ${isExpired ? `<span class="badge badge-expired">${this.t('expired')}</span>` : ''}
            <span class="badge badge-type">${this.t('type' + vote.type.charAt(0).toUpperCase() + vote.type.slice(1))}</span>
          </div>
          <button class="btn-icon-sm danger" data-action="delete-vote" data-vote-id="${vote.id}">🗑️</button>
        </div>
        <h3 class="vote-card-title" data-action="open-vote" data-vote-id="${vote.id}">${this.escapeHtml(vote.title)}</h3>
        ${vote.description ? `<p class="vote-card-desc">${this.escapeHtml(vote.description)}</p>` : ''}
        ${vote.expires_at ? `<div class="vote-expires">${this.t('expires')}: ${this.formatDate(vote.expires_at)}</div>` : ''}
        <button class="btn-secondary btn-sm vote-action-btn" data-action="open-vote" data-vote-id="${vote.id}">
          ${this.t('participate')} →
        </button>
      </div>
    `;
  }

  async renderVoteDetail(voteId) {
    const vote = await this.voteService.getVote(voteId);
    if (!vote) return '';
    const results = await this.voteService.getResults(vote);
    const userResponse = await this.voteService.getUserResponse(voteId, this.state.currentUserId);
    const totalResponders = (await this.voteService.getResponses(voteId)).length;
    const hasVoted = !!userResponse;
    const isAnonymous = vote.type === 'anonymous';
    const isExpired = vote.isExpired;

    let votersList = '';
    if (!isAnonymous && hasVoted) {
      const responses = await this.voteService.getResponses(voteId);
      votersList = `
        <div class="voters-section">
          <div class="section-label">${this.t('voters')} (${totalResponders})</div>
          <div class="voters-list">
            ${responses.map(r => `
              <span class="voter-chip">${this.escapeHtml(r.user_name || r.user_id)}</span>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="vote-overlay" data-action="close-detail">
        <div class="vote-detail-panel" data-stop-propagation>
          <div class="vote-detail-header">
            <h2 class="vote-detail-title">${this.escapeHtml(vote.title)}</h2>
            <button class="btn-icon" data-action="close-detail">✕</button>
          </div>
          ${vote.description ? `<p class="vote-detail-desc">${this.escapeHtml(vote.description)}</p>` : ''}
          <div class="vote-meta">
            <span class="badge badge-type">${this.t('type' + vote.type.charAt(0).toUpperCase() + vote.type.slice(1))}</span>
            ${isExpired ? `<span class="badge badge-expired">${this.t('expired')}</span>` : ''}
            <span class="vote-total">${totalResponders} ${this.t('totalVotes')}</span>
          </div>

          ${(!hasVoted && !isExpired) ? this.renderVoteForm(vote) : ''}

          <div class="results-section">
            <div class="section-label">${this.t('results')}</div>
            ${results.map(r => `
              <div class="result-row ${userResponse?.selectedOptions?.includes(r.index) ? 'my-choice' : ''}">
                <div class="result-label">${this.escapeHtml(r.label)}</div>
                <div class="result-bar-wrap">
                  <div class="result-bar" style="width:${r.percent}%"></div>
                </div>
                <div class="result-stats">${r.count} ${this.t('votes_count')} (${r.percent}%)</div>
              </div>
            `).join('')}
          </div>

          ${votersList}

          ${hasVoted && !isExpired ? `
            <button class="btn-secondary btn-sm" data-action="change-vote" data-vote-id="${voteId}">
              ${this.t('changeVote')}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderVoteForm(vote) {
    const isMulti = vote.type === 'multi';
    return `
      <div class="vote-form">
        <div class="vote-options">
          ${vote.options.map((opt, i) => `
            <label class="vote-option-label">
              <input type="${isMulti ? 'checkbox' : 'radio'}" name="vote-option" value="${i}" class="vote-option-input">
              <span>${this.escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
        <button class="btn-primary" data-action="submit-vote" data-vote-id="${vote.id}" data-type="${vote.type}">
          ${this.t('submitVote')}
        </button>
      </div>
    `;
  }

  // ==================== Events ====================

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      // Stop detail overlay from closing on panel click
      if (e.target.closest('[data-stop-propagation]') && el.dataset.action !== 'close-detail') {
        e.stopPropagation();
      }
      await this.handleAction(el.dataset.action, el, e);
    });

    this.container.addEventListener('input', (e) => {
      const el = e.target;
      const field = el.dataset.field;
      if (!field) return;
      if (field === 'option') {
        const idx = parseInt(el.dataset.index);
        this.state.createForm.options[idx] = el.value;
      } else if (field in this.state.createForm) {
        this.state.createForm[field] = el.value;
      }
    });
  }

  async handleAction(action, el, e) {
    switch (action) {
      case 'toggle-create':
        this.state.showCreateForm = !this.state.showCreateForm;
        if (this.state.showCreateForm) this.state.createForm = this.emptyForm();
        await this.render();
        this.bindEvents();
        break;

      case 'cancel-create':
        this.state.showCreateForm = false;
        await this.render();
        this.bindEvents();
        break;

      case 'set-type':
        this.state.createForm.type = el.dataset.type;
        await this.render();
        this.bindEvents();
        break;

      case 'add-option':
        this.state.createForm.options.push('');
        await this.render();
        this.bindEvents();
        break;

      case 'remove-option': {
        const idx = parseInt(el.dataset.index);
        this.state.createForm.options.splice(idx, 1);
        await this.render();
        this.bindEvents();
        break;
      }

      case 'submit-create': {
        const f = this.state.createForm;
        if (!f.title.trim()) { alert(this.t('voteTitlePlaceholder')); return; }
        const validOpts = f.options.filter(o => o.trim());
        if (validOpts.length < 2) { alert(this.t('minTwoOptions')); return; }
        await this.voteService.createVote({
          title: f.title.trim(),
          description: f.description.trim(),
          type: f.type,
          options: validOpts,
          createdBy: this.state.currentUserId,
          createdByName: this.state.currentUserName,
          expiresAt: f.expiresAt ? new Date(f.expiresAt).getTime() : null
        });
        this.state.showCreateForm = false;
        await this.loadVotes();
        await this.render();
        this.bindEvents();
        break;
      }

      case 'open-vote':
        this.state.activeVoteId = el.dataset.voteId;
        await this.render();
        this.bindEvents();
        break;

      case 'close-detail':
        this.state.activeVoteId = null;
        await this.render();
        this.bindEvents();
        break;

      case 'delete-vote': {
        if (!confirm(this.t('confirmDelete'))) return;
        await this.voteService.deleteVote(el.dataset.voteId);
        if (this.state.activeVoteId === el.dataset.voteId) this.state.activeVoteId = null;
        await this.loadVotes();
        await this.render();
        this.bindEvents();
        break;
      }

      case 'submit-vote': {
        const voteId = el.dataset.voteId;
        const voteType = el.dataset.type;
        const panel = this.container.querySelector('.vote-detail-panel');
        const inputs = panel?.querySelectorAll('.vote-option-input:checked') || [];
        const selected = Array.from(inputs).map(i => parseInt(i.value));
        if (selected.length === 0) { alert(this.t('selectAtLeastOne')); return; }
        await this.voteService.submitResponse(voteId, this.state.currentUserId, this.state.currentUserName, selected);
        await this.render();
        this.bindEvents();
        break;
      }

      case 'change-vote':
        // Reset user response to allow re-voting
        this.state.activeVoteId = el.dataset.voteId;
        await this.render();
        this.bindEvents();
        break;
    }
  }

  // ==================== Helpers ====================

  t(key) {
    try {
      return this.i18n?.t?.(key) || key;
    } catch {
      return key;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const el = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (el) {
      el.textContent = String(str);
      return el.innerHTML;
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(this.locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

export default VotePlugin;
