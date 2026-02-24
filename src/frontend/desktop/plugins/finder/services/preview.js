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
      } catch (error) {
        return this.buildReadErrorPreview(file, error);
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
      } catch (error) {
        return this.buildReadErrorPreview(file, error);
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

  /**
   * 将文件读取异常映射为可展示的预览提示。
   * 说明：这里故意做“宽松匹配”，因为不同运行时返回的错误对象结构并不一致。
   */
  buildReadErrorPreview(file, error) {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();

    // 权限异常：优先识别 code，其次兜底 message 关键词。
    if (code === 'EACCES' || code === 'EPERM' || message.includes('permission')) {
      return {
        type: 'info',
        content: this.formatMessage(
          'previewPermissionDenied',
          'Preview unavailable due to permission restrictions'
        )
      };
    }

    // 文件不存在异常：支持常见 code 与 message 关键字。
    if (code === 'ENOENT' || message.includes('not found') || message.includes('no such file')) {
      return {
        type: 'info',
        content: this.formatMessage('previewFileMissing', 'File no longer exists')
      };
    }

    // 其他异常保持可追踪：显示文件路径，便于用户定位。
    return {
      type: 'info',
      content: escapeHtml(file?.path || '')
    };
  }
}
