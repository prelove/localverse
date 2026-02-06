import { escapeHtml } from '../utils/formatters.js';

export function renderSearchBox({ query, placeholder, shortcut }) {
  return `
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        class="search-input"
        placeholder="${escapeHtml(placeholder)}"
        value="${escapeHtml(query)}"
        autofocus
      >
      <span class="search-shortcut">${escapeHtml(shortcut)}</span>
    </div>
  `;
}
