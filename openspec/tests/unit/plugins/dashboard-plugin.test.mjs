import assert from 'node:assert/strict';
import DashboardPlugin from '../../../../src/frontend/desktop/plugins/dashboard/index.js';

// ==================== Mock context ====================

function createMockContext(overrides = {}) {
  return {
    i18n: null,
    locale: 'zh',
    services: {},
    getPlugin: () => null,
    getSettings: async () => ({}),
    ...overrides
  };
}

// ==================== Tests ====================

async function testInstantiate() {
  const ctx = createMockContext();
  const plugin = new DashboardPlugin(ctx);
  assert.equal(DashboardPlugin.id, 'dashboard');
  assert.equal(plugin.state.taskStats.todo, 0);
  assert.equal(plugin.state.taskStats.inProgress, 0);
  assert.equal(plugin.state.unreadAnnouncements, 0);
  assert.deepEqual(plugin.state.weekEvents, []);
  assert.deepEqual(plugin.state.recentActivity, []);
}

async function testLoadDataWithNoPlugins() {
  const ctx = createMockContext();
  const plugin = new DashboardPlugin(ctx);
  // Should not throw even when all plugins are absent
  await plugin.loadData();
  assert.equal(plugin.state.taskStats.todo, 0);
  assert.equal(plugin.state.taskStats.inProgress, 0);
}

async function testLoadDataWithTaskPlugin() {
  const mockTaskService = {
    async getTasks() {
      return [
        { status: 'todo', parent_id: null },
        { status: 'todo', parent_id: null },
        { status: 'in_progress', parent_id: null },
        { status: 'done', parent_id: null }
      ];
    }
  };
  const ctx = createMockContext({
    getPlugin: (id) => id === 'task' ? { taskService: mockTaskService } : null
  });
  const plugin = new DashboardPlugin(ctx);
  await plugin._loadTaskStats();
  assert.equal(plugin.state.taskStats.todo, 2);
  assert.equal(plugin.state.taskStats.inProgress, 1);
}

async function testLoadDataWithAnnouncementPlugin() {
  const mockAnnService = {
    async getUnreadCount() { return 3; }
  };
  const ctx = createMockContext({
    getPlugin: (id) => id === 'announcement' ? { announcementService: mockAnnService } : null
  });
  const plugin = new DashboardPlugin(ctx);
  await plugin._loadUnreadAnnouncements();
  assert.equal(plugin.state.unreadAnnouncements, 3);
}

async function testLoadRecentActivity() {
  const mockNotifService = {
    async getNotifications(limit) {
      return [
        { id: 'n1', title: 'Task updated', source_plugin: 'task', created_at: Date.now() },
        { id: 'n2', title: 'New message', source_plugin: 'chat', created_at: Date.now() - 60000 }
      ].slice(0, limit);
    }
  };
  const ctx = createMockContext({
    getPlugin: (id) => id === 'notification' ? { notificationService: mockNotifService } : null
  });
  const plugin = new DashboardPlugin(ctx);
  await plugin._loadRecentActivity();
  assert.equal(plugin.state.recentActivity.length, 2);
  assert.equal(plugin.state.recentActivity[0].title, 'Task updated');
}

async function testTimeAgo() {
  const ctx = createMockContext();
  const plugin = new DashboardPlugin(ctx);
  const now = Date.now();
  assert.equal(plugin._timeAgo(now - 30000), plugin._fallback('justNow'));
  assert.ok(plugin._timeAgo(now - 120000).includes('2'));  // "2 分钟前"
  assert.ok(plugin._timeAgo(now - 7200000).includes('2')); // "2 小时前"
  assert.ok(plugin._timeAgo(now - 172800000).includes('2')); // "2 天前"
}

async function testEscapeHtml() {
  const ctx = createMockContext();
  const plugin = new DashboardPlugin(ctx);
  assert.equal(plugin.escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
}

async function testMountAndUnmount() {
  const ctx = createMockContext();
  const plugin = new DashboardPlugin(ctx);

  const container = {
    innerHTML: '',
    addEventListener() {}
  };
  await plugin.mount(container);
  assert.ok(container.innerHTML.includes('dash-plugin'));
  assert.ok(plugin._refreshTimer !== null);

  await plugin.unmount();
  assert.equal(container.innerHTML, '');
  assert.equal(plugin._refreshTimer, null);
}

async function testCapitalize() {
  const ctx = createMockContext();
  const plugin = new DashboardPlugin(ctx);
  assert.equal(plugin._capitalize('chat'), 'Chat');
  assert.equal(plugin._capitalize(''), '');
  assert.equal(plugin._capitalize(null), '');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['instantiates with correct defaults', testInstantiate],
    ['loadData does not throw when plugins absent', testLoadDataWithNoPlugins],
    ['_loadTaskStats reads from task plugin', testLoadDataWithTaskPlugin],
    ['_loadUnreadAnnouncements reads from announcement plugin', testLoadDataWithAnnouncementPlugin],
    ['_loadRecentActivity reads from notification plugin', testLoadRecentActivity],
    ['_timeAgo formats relative time correctly', testTimeAgo],
    ['escapeHtml sanitizes HTML', testEscapeHtml],
    ['mount renders html; unmount clears container', testMountAndUnmount],
    ['_capitalize uppercases first character', testCapitalize]
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`✔ ${name}`);
      passed++;
    } catch (err) {
      console.error(`✘ ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\ndashboard-plugin.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
