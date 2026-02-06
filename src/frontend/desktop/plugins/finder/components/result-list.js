import { getFileIcon } from '../utils/file-icons.js';
import { escapeHtml, formatDate, formatSize, formatSnippet, highlightMatch } from '../utils/formatters.js';

export function renderResultList({ results, selectedIndex, query, locale, emptyLabel }) {
  if (results.length === 0) {
    return `
      <div class="empty-state">
        <span class="empty-icon">📂</span>
        <p>${escapeHtml(emptyLabel)}</p>
      </div>
    `;
  }

  return `
    <ul class="result-list">
      ${results.map((result, index) => `
        <li class="result-item ${index === selectedIndex ? 'selected' : ''}"
            data-index="${index}"
            data-path="${escapeHtml(result.path)}">
          <span class="file-icon">${getFileIcon(result)}</span>
          <div class="file-info">
            <div class="file-name">${highlightMatch(result.name, query)}</div>
            <div class="file-path">${highlightMatch(result.path, query)}</div>
            ${result.snippet ? `<div class="file-snippet">${formatSnippet(result.snippet, query)}</div>` : ''}
          </div>
          <div class="file-meta">
            <span class="file-size">${formatSize(result.size)}</span>
            <span class="file-date">${formatDate(result.modifiedAt, locale)}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}
