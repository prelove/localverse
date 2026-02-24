import test from 'node:test';
import assert from 'node:assert/strict';

import { PreviewService } from '../../../src/frontend/desktop/plugins/finder/services/preview.js';

/**
 * 为 Node 运行时提供最小 document mock，避免 escapeHtml 在无 DOM 环境报错。
 * 说明：这里只实现本测试需要的 createElement/textContent/innerHTML 行为。
 */
if (!globalThis.document) {
  globalThis.document = {
    createElement() {
      let value = '';
      return {
        set textContent(text) {
          value = String(text ?? '');
        },
        get innerHTML() {
          return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
        }
      };
    }
  };
}

/**
 * 构建一个最小可用的预览服务实例。
 * 说明：t() 回传 key 时，PreviewService 会自动使用 fallback 文案，便于断言稳定。
 */
function createService(fs) {
  return new PreviewService({
    fs,
    t: (key) => key
  });
}

test('returns fallback hint when image exceeds size limit', async () => {
  const service = createService({
    // 该分支不应触发真实读取；若触发说明逻辑回归。
    readFile: async () => {
      throw new Error('readFile should not be called for oversized image');
    }
  });

  const preview = await service.getPreview({
    path: '/tmp/a.png',
    extension: 'png',
    size: 6 * 1024 * 1024
  });

  assert.equal(preview.type, 'info');
  assert.match(preview.content, /^Image preview skipped/);
});

test('returns fallback hint when text exceeds size limit', async () => {
  const service = createService({
    // 该分支不应触发真实读取；若触发说明逻辑回归。
    readFile: async () => {
      throw new Error('readFile should not be called for oversized text');
    }
  });

  const preview = await service.getPreview({
    path: '/tmp/a.md',
    extension: 'md',
    size: 300 * 1024
  });

  assert.equal(preview.type, 'info');
  assert.match(preview.content, /^Text preview skipped/);
});

test('maps EACCES/EPERM to permission message', async () => {
  const service = createService({
    readFile: async () => {
      const error = new Error('permission denied');
      error.code = 'EACCES';
      throw error;
    }
  });

  const preview = await service.getPreview({
    path: '/secret.txt',
    extension: 'txt',
    size: 100
  });

  assert.equal(preview.type, 'info');
  assert.equal(preview.content, 'Preview unavailable due to permission restrictions');
});

test('maps ENOENT to missing-file message', async () => {
  const service = createService({
    readFile: async () => {
      const error = new Error('no such file');
      error.code = 'ENOENT';
      throw error;
    }
  });

  const preview = await service.getPreview({
    path: '/gone.txt',
    extension: 'txt',
    size: 100
  });

  assert.equal(preview.type, 'info');
  assert.equal(preview.content, 'File no longer exists');
});

test('falls back to escaped path on unknown read error', async () => {
  const service = createService({
    readFile: async () => {
      throw new Error('unknown failure');
    }
  });

  const preview = await service.getPreview({
    path: '/tmp/<unsafe>.txt',
    extension: 'txt',
    size: 100
  });

  assert.equal(preview.type, 'info');
  assert.match(preview.content, /&lt;unsafe&gt;/);
});

test('returns code preview for code files', async () => {
  const service = createService({
    readFile: async () => 'const value = 42;'
  });

  const preview = await service.getPreview({
    path: '/tmp/demo.js',
    extension: 'js',
    size: 100
  });

  assert.equal(preview.type, 'code');
  assert.equal(preview.language, 'js');
  assert.match(preview.content, /const value = 42;/);
});
