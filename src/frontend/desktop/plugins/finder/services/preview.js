/**
 * Finder Preview Service
 * Provides basic preview data for files.
 */

import { escapeHtml, formatSize, truncate } from '../utils/formatters.js';
import { getFileCategory } from '../utils/file-icons.js';

export class PreviewService {
  constructor({ fs, t }) {
    this.fs = fs;
    this.t = t;
    this.maxTextBytes = 200 * 1024;
    this.maxImageBytes = 5 * 1024 * 1024;
    this.maxTextChars = 12000;
  }

  async getPreview(file) {
    if (!file) return null;

    const category = getFileCategory(file.extension);
    const fileSize = file.size ?? null;

    if (!this.fs || !this.fs.readFile) {
      return {
        type: 'info',
        content: escapeHtml(file.path || '')
      };
    }

    if (category === 'image') {
      if (fileSize && fileSize > this.maxImageBytes) {
        return {
          type: 'info',
          content: this.formatMessage(
            'previewImageTooLarge',
            `Image preview skipped (${formatSize(fileSize)} > ${formatSize(this.maxImageBytes)})`,
            { size: formatSize(fileSize), limit: formatSize(this.maxImageBytes) }
          )
        };
      }
      try {
        const src = await this.fs.readFile(file.path, 'dataurl');
        return { type: 'image', src };
      } catch {
        return { type: 'info', content: escapeHtml(file.path || '') };
      }
    }

    if (category === 'text' || category === 'code' || category === 'document') {
      if (fileSize && fileSize > this.maxTextBytes) {
        return {
          type: 'info',
          content: this.formatMessage(
            'previewTextTooLarge',
            `Text preview skipped (${formatSize(fileSize)} > ${formatSize(this.maxTextBytes)})`,
            { size: formatSize(fileSize), limit: formatSize(this.maxTextBytes) }
          )
        };
      }
      try {
        const raw = await this.fs.readFile(file.path, 'text');
        const safe = escapeHtml(truncate(raw, this.maxTextChars));
        if (category === 'code') {
          return {
            type: 'code',
            content: safe,
            language: (file.extension || '').toLowerCase()
          };
        }
        return { type: 'text', content: safe };
      } catch {
        return { type: 'info', content: escapeHtml(file.path || '') };
      }
    }

    return {
      type: 'info',
      content: escapeHtml(file.path || '')
    };
  }

  formatMessage(key, fallback, data = {}) {
    const localized = this.t ? this.t(key) : null;
    const template = localized && localized !== key ? localized : fallback;
    return template.replace(/\{(\w+)\}/g, (_, token) => data[token] ?? '');
  }
}
