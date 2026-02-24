import test from 'node:test';
import assert from 'node:assert/strict';

import FinderPlugin from '../../../src/frontend/desktop/plugins/finder/index.js';

/**
 * 构建一个可用于纯逻辑单测的 Finder 插件实例。
 * 说明：这里只测试 normalize/merge/filter 等纯函数行为，不依赖真实 DOM。
 */
function createPlugin() {
  return new FinderPlugin({
    services: {},
    settings: {},
    locale: 'en',
    ui: {}
  });
}

test('normalizeResult maps metadata search result to finder shape', () => {
  const plugin = createPlugin();

  const normalized = plugin.normalizeResult({
    id: 'r1',
    title: 'report.md',
    snippet: 'hello world',
    score: 0.2,
    updatedAt: 1700000000000,
    metadata: {
      path: '/docs/report.md',
      size: 2048,
      mimeType: 'text/markdown'
    }
  });

  assert.equal(normalized.id, 'r1');
  assert.equal(normalized.path, '/docs/report.md');
  assert.equal(normalized.name, 'report.md');
  assert.equal(normalized.extension, 'md');
  assert.equal(normalized.size, 2048);
  assert.equal(normalized.mimeType, 'text/markdown');
  assert.equal(normalized.modifiedAt, 1700000000000);
});

test('mergeResults deduplicates by path and keeps primary result', () => {
  const plugin = createPlugin();

  const primary = [
    { path: '/a.txt', name: 'a.txt', extension: 'txt', score: 0.1 }
  ];
  const secondary = [
    // 同路径：应被去重且不覆盖 primary。
    { path: '/a.txt', name: 'a-alt.txt', extension: 'txt', score: 0.9 },
    { path: '/b.js', name: 'b.js', extension: 'js', score: 0.3 }
  ];

  const merged = plugin.mergeResults(primary, secondary);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].path, '/a.txt');
  assert.equal(merged[0].name, 'a.txt');
  assert.equal(merged[1].path, '/b.js');
});

test('applyFilters supports type + size + date + extension', () => {
  const plugin = createPlugin();
  const now = Date.now();

  const results = [
    {
      path: '/docs/keep.md',
      name: 'keep.md',
      extension: 'md',
      size: 1500,
      modifiedAt: now - 60 * 60 * 1000
    },
    {
      path: '/docs/old.md',
      name: 'old.md',
      extension: 'md',
      size: 1500,
      modifiedAt: now - 10 * 24 * 60 * 60 * 1000
    },
    {
      path: '/docs/big.md',
      name: 'big.md',
      extension: 'md',
      size: 12 * 1024 * 1024,
      modifiedAt: now - 60 * 60 * 1000
    },
    {
      path: '/code/main.js',
      name: 'main.js',
      extension: 'js',
      size: 1024,
      modifiedAt: now - 60 * 60 * 1000
    }
  ];

  const filtered = plugin.applyFilters(results, {
    type: 'document',
    sizeRange: 'small',
    dateRange: 'day',
    extension: '.md'
  });

  assert.deepEqual(filtered.map((x) => x.path), ['/docs/keep.md']);
});

test('applyFilters extension fallback uses file name when extension missing', () => {
  const plugin = createPlugin();

  const results = [
    {
      path: '/tmp/no-ext-field.TXT',
      name: 'no-ext-field.TXT',
      extension: '',
      size: 10,
      modifiedAt: Date.now()
    }
  ];

  const filtered = plugin.applyFilters(results, {
    type: 'all',
    sizeRange: 'any',
    dateRange: 'any',
    extension: 'txt'
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].path, '/tmp/no-ext-field.TXT');
});
