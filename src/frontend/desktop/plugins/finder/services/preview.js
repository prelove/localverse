/**
 * Finder Preview Service
 * Provides basic preview data for files.
 */

import { escapeHtml, truncate } from '../utils/formatters.js';
import { getFileCategory } from '../utils/file-icons.js';

export class PreviewService {
  constructor({ fs }) {
    this.fs = fs;
  }

  async getPreview(file) {
    if (!file) return null;

    const category = getFileCategory(file.extension);

    if (!this.fs || !this.fs.readFile) {
      return {
        type: 'info',
        content: escapeHtml(file.path || '')
      };
    }

    if (category === 'image') {
      try {
        const src = await this.fs.readFile(file.path, 'dataurl');
        return { type: 'image', src };
      } catch {
        return { type: 'info', content: escapeHtml(file.path || '') };
      }
    }

    if (category === 'text' || category === 'code' || category === 'document') {
      try {
        const raw = await this.fs.readFile(file.path, 'text');
        const safe = escapeHtml(truncate(raw, 4000));
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
}
