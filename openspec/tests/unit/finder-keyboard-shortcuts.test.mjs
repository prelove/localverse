import test from 'node:test';
import assert from 'node:assert/strict';

import FinderPlugin from '../../../src/frontend/desktop/plugins/finder/index.js';

/**
 * 创建仅用于快捷键逻辑验证的插件实例。
 * 说明：render 置空，避免 Node 测试中访问真实 DOM。
 */
function createPlugin() {
  const plugin = new FinderPlugin({
    mode: 'light',
    settings: {},
    services: {},
    locale: 'en',
    ui: {}
  });
  plugin.render = () => {};
  return plugin;
}

function createEvent({ key, ctrlKey = false, metaKey = false, isInput = false }) {
  let prevented = false;
  return {
    key,
    ctrlKey,
    metaKey,
    target: {
      classList: {
        contains: (name) => isInput && name === 'search-input'
      }
    },
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    }
  };
}

test('ArrowDown/ArrowUp updates selected index within bounds', () => {
  const plugin = createPlugin();
  plugin.state = {
    ...plugin.state,
    selectedIndex: 0,
    results: [{ path: 'a' }, { path: 'b' }, { path: 'c' }]
  };

  const down = createEvent({ key: 'ArrowDown' });
  plugin.handleKeydown(down);
  assert.equal(down.prevented, true);
  assert.equal(plugin.state.selectedIndex, 1);

  const up = createEvent({ key: 'ArrowUp' });
  plugin.handleKeydown(up);
  assert.equal(up.prevented, true);
  assert.equal(plugin.state.selectedIndex, 0);

  // 边界：不能小于 0。
  const upAtStart = createEvent({ key: 'ArrowUp' });
  plugin.handleKeydown(upAtStart);
  assert.equal(plugin.state.selectedIndex, 0);
});

test('Enter triggers openSelectedFile', () => {
  const plugin = createPlugin();
  let called = 0;
  plugin.openSelectedFile = () => {
    // 计数用于验证快捷键触发路径。
    called += 1;
  };

  const event = createEvent({ key: 'Enter' });
  plugin.handleKeydown(event);

  assert.equal(event.prevented, true);
  assert.equal(called, 1);
});

test('Space triggers preview only when focus is not in search input', () => {
  const plugin = createPlugin();
  let called = 0;
  plugin.previewSelectedFile = () => {
    called += 1;
  };

  const spaceOnPanel = createEvent({ key: ' ', isInput: false });
  plugin.handleKeydown(spaceOnPanel);
  assert.equal(spaceOnPanel.prevented, true);
  assert.equal(called, 1);

  const spaceInInput = createEvent({ key: ' ', isInput: true });
  plugin.handleKeydown(spaceInInput);
  assert.equal(spaceInInput.prevented, false);
  assert.equal(called, 1);
});

test('Escape closes preview or clears query/results', () => {
  const plugin = createPlugin();
  plugin.previewData = { type: 'text' };
  plugin.state = {
    ...plugin.state,
    preview: { path: '/tmp/a.md' },
    query: 'abc',
    results: [{ path: '/tmp/a.md' }]
  };

  const escClosePreview = createEvent({ key: 'Escape' });
  plugin.handleKeydown(escClosePreview);
  assert.equal(plugin.state.preview, null);
  assert.equal(plugin.previewData, null);

  const escClearQuery = createEvent({ key: 'Escape' });
  plugin.handleKeydown(escClearQuery);
  assert.equal(plugin.state.query, '');
  assert.deepEqual(plugin.state.results, []);
});

test('Ctrl+C copies selected path', () => {
  const plugin = createPlugin();
  let copied = null;
  plugin.copyPath = (path) => {
    copied = path;
  };
  plugin.state = {
    ...plugin.state,
    selectedIndex: 1,
    results: [{ path: '/tmp/a' }, { path: '/tmp/b' }]
  };

  const event = createEvent({ key: 'c', ctrlKey: true });
  plugin.handleKeydown(event);

  assert.equal(event.prevented, true);
  assert.equal(copied, '/tmp/b');
});

test('Ctrl+Shift+F triggers focus in global handler', () => {
  const plugin = createPlugin();
  let focused = 0;
  plugin.focus = () => {
    focused += 1;
  };

  const event = {
    key: 'F',
    ctrlKey: true,
    shiftKey: true,
    preventDefaultCalled: false,
    preventDefault() {
      this.preventDefaultCalled = true;
    }
  };

  plugin.handleGlobalKeydown(event);

  assert.equal(event.preventDefaultCalled, true);
  assert.equal(focused, 1);
});
