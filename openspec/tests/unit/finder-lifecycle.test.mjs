import test from 'node:test';
import assert from 'node:assert/strict';

import FinderPlugin from '../../../src/frontend/desktop/plugins/finder/index.js';

/**
 * 提供最小 document 事件桩，便于校验全局事件绑定/解绑。
 */
function installDocumentStub() {
  const listeners = new Map();
  globalThis.document = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    }
  };
  return listeners;
}

function createContext({ mode = 'light', watchPaths = [] } = {}) {
  return {
    mode,
    settings: {
      watchPaths,
      enableContentSearch: true,
      maxResults: 100
    },
    services: {
      DatabaseService: {
        async execute() {
          return true;
        }
      },
      FileSystemService: {
        async readFile() {
          return 'demo';
        }
      }
    },
    ui: {}
  };
}

test('onInstall initializes index schema successfully', async () => {
  const plugin = new FinderPlugin(createContext());

  await plugin.onInstall();

  assert.ok(plugin.indexer, 'indexer should be created');
  assert.ok(plugin.previewService, 'previewService should be created');
});

test('onActivate binds global keydown and triggers file watch/buildIndex in full mode', async () => {
  const listeners = installDocumentStub();
  const plugin = new FinderPlugin(createContext({ mode: 'full', watchPaths: ['/tmp'] }));

  let watchStarted = 0;
  let buildTriggered = 0;

  plugin.startFileWatch = async () => {
    // 计数用于验证 full 模式行为。
    watchStarted += 1;
  };
  plugin.buildIndex = async () => {
    // 计数用于验证有 watchPaths 时触发后台索引。
    buildTriggered += 1;
  };

  await plugin.onActivate();

  assert.equal(watchStarted, 1);
  assert.equal(buildTriggered, 1);
  assert.ok(listeners.has('keydown'));
});

test('onDeactivate removes global keydown and stops file watch', async () => {
  const listeners = installDocumentStub();
  const plugin = new FinderPlugin(createContext());

  await plugin.onActivate();

  let stopped = 0;
  plugin.stopFileWatch = () => {
    stopped += 1;
  };

  await plugin.onDeactivate();

  assert.equal(stopped, 1);
  assert.equal(listeners.has('keydown'), false);
});

test('onUninstall clears schema when indexer exists', async () => {
  const plugin = new FinderPlugin(createContext());

  let cleared = 0;
  plugin.indexer = {
    async clearSchema() {
      // 卸载路径应触发 schema 清理。
      cleared += 1;
    }
  };

  await plugin.onUninstall();

  assert.equal(cleared, 1);
});
