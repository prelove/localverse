import test from 'node:test';
import assert from 'node:assert/strict';

import FinderPlugin from '../../../src/frontend/desktop/plugins/finder/index.js';

/**
 * 创建用于 performSearch 分支验证的插件实例。
 * 说明：将 render 替换为 no-op，避免在 Node 测试里触发 DOM 依赖。
 */
function createPlugin({ mode = 'light', settings = {}, services = {} } = {}) {
  const plugin = new FinderPlugin({
    mode,
    settings,
    services,
    locale: 'en',
    ui: {}
  });

  plugin.render = () => {};
  return plugin;
}

function defaultFilters() {
  return {
    type: 'all',
    dateRange: 'any',
    sizeRange: 'any',
    extension: ''
  };
}

test('performSearch clears state when query is empty', async () => {
  const plugin = createPlugin();
  plugin.state = {
    ...plugin.state,
    query: '   ',
    filters: defaultFilters(),
    results: [{ path: '/tmp/a.txt' }],
    loading: true
  };

  await plugin.performSearch();

  assert.deepEqual(plugin.state.results, []);
  assert.equal(plugin.state.loading, false);
});

test('performSearch merges filesystem and local results in full mode', async () => {
  const plugin = createPlugin({
    mode: 'full',
    settings: { enableContentSearch: true },
    services: { SearchService: {} }
  });

  const now = Date.now();
  plugin.state = {
    ...plugin.state,
    query: 'note',
    filters: defaultFilters(),
    loading: true
  };

  plugin.searchFilesystem = async () => [
    { path: '/docs/a.md', name: 'a.md', extension: 'md', modifiedAt: now }
  ];
  plugin.searchLocalIndex = async () => [
    { path: '/docs/b.md', name: 'b.md', extension: 'md', modifiedAt: now }
  ];

  await plugin.performSearch();

  assert.equal(plugin.state.loading, false);
  assert.equal(plugin.state.selectedIndex, 0);
  assert.deepEqual(plugin.state.results.map((x) => x.path).sort(), ['/docs/a.md', '/docs/b.md']);
});

test('performSearch falls back to local index when filesystem search fails', async () => {
  const plugin = createPlugin({
    mode: 'full',
    settings: { enableContentSearch: true },
    services: { SearchService: {} }
  });

  const errors = [];
  plugin.showError = (message) => {
    // 记录错误提示，验证 fallback 提示是否触发。
    errors.push(message);
  };

  plugin.state = {
    ...plugin.state,
    query: 'report',
    filters: defaultFilters(),
    loading: true
  };

  plugin.searchFilesystem = async () => {
    throw new Error('filesystem unavailable');
  };
  plugin.searchLocalIndex = async () => [
    { path: '/docs/report.md', name: 'report.md', extension: 'md', modifiedAt: Date.now() }
  ];

  await plugin.performSearch();

  assert.deepEqual(plugin.state.results.map((x) => x.path), ['/docs/report.md']);
  assert.equal(errors.length, 1);
  assert.equal(errors[0], plugin.t('searchFallback'));
});

test('performSearch reports searchError when local search throws', async () => {
  const plugin = createPlugin({ mode: 'light' });

  const errors = [];
  plugin.showError = (message) => {
    // 收集错误提示，确保异常路径可观测。
    errors.push(message);
  };

  plugin.state = {
    ...plugin.state,
    query: 'boom',
    filters: defaultFilters(),
    loading: true,
    results: [{ path: '/tmp/old.md' }]
  };

  plugin.searchLocalIndex = async () => {
    throw new Error('index read failed');
  };

  await plugin.performSearch();

  assert.deepEqual(plugin.state.results, []);
  assert.equal(plugin.state.loading, false);
  assert.equal(errors[0], plugin.t('searchError'));
});
