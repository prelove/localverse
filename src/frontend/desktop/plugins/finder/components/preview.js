import { escapeHtml } from '../utils/formatters.js';

export function renderPreview({ file, preview, labels }) {
  if (!file || !preview) return '';

  let content = '';
  if (preview.type === 'image') {
    content = `<img src="${preview.src}" alt="${escapeHtml(file.name)}" />`;
  } else if (preview.type === 'code') {
    content = `<pre class="preview-code"><code data-language="${escapeHtml(preview.language || '')}">${preview.content}</code></pre>`;
  } else if (preview.type === 'text') {
    content = `<pre class="preview-text">${preview.content}</pre>`;
  } else {
    content = `<div class="preview-info">${escapeHtml(preview.content || '')}</div>`;
  }

  return `
    <div class="preview-panel">
      <div class="preview-header">
        <span class="preview-title">${escapeHtml(file.name)}</span>
        <button class="preview-close" data-action="close-preview">×</button>
      </div>
      <div class="preview-content">
        <div class="preview-meta">
          <p><strong>${labels.filePath}</strong> ${escapeHtml(file.path)}</p>
        </div>
        ${content}
      </div>
    </div>
  `;
}
