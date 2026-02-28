import assert from 'node:assert/strict';
import SettingsPlugin from '../../../../src/frontend/desktop/plugins/settings/index.js';

// ==================== Mock localStorage ====================

function createMockLocalStorage() {
  const store = {};
  return {
    getItem(key) { return store[key] ?? null; },
    setItem(key, val) { store[key] = String(val); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };
}

// ==================== Mock context ====================

function createMockContext(overrides = {}) {
  return {
    i18n: null,
    locale: 'zh',
    services: {},
    getSettings: async () => ({}),
    ...overrides
  };
}

// ==================== Tests ====================

async function testInstantiate() {
  const ctx = createMockContext();
  const plugin = new SettingsPlugin(ctx);
  assert.equal(SettingsPlugin.id, 'settings');
  assert.equal(plugin.state.activeSection, 'profile');
  assert.equal(plugin.state.savedFeedback, false);
}

async function testDefaultSettings() {
  const ctx = createMockContext();
  const plugin = new SettingsPlugin(ctx);
  await plugin.onActivate();
  // Should have defaults since localStorage is not set in Node
  assert.equal(plugin.state.settings.language, 'zh');
  assert.equal(plugin.state.settings.theme, 'system');
  assert.equal(plugin.state.settings.fontSize, 'medium');
  assert.equal(plugin.state.settings.notifChat, true);
}

async function testSaveAndLoad() {
  // Patch localStorage on globalThis for test
  const mockLS = createMockLocalStorage();
  const orig = globalThis.localStorage;
  globalThis.localStorage = mockLS;

  try {
    const ctx = createMockContext();
    const plugin = new SettingsPlugin(ctx);
    plugin.state.settings = {
      username: 'TestUser',
      language: 'en',
      theme: 'dark',
      fontSize: 'large',
      sidebarCollapsed: true,
      notifChat: false,
      notifTask: true,
      notifCalendar: false,
      notifAnnouncement: true
    };
    plugin._save(plugin.state.settings);

    const plugin2 = new SettingsPlugin(ctx);
    const loaded = plugin2._load();
    assert.equal(loaded.username, 'TestUser');
    assert.equal(loaded.language, 'en');
    assert.equal(loaded.theme, 'dark');
    assert.equal(loaded.fontSize, 'large');
    assert.equal(loaded.sidebarCollapsed, true);
    assert.equal(loaded.notifChat, false);
  } finally {
    globalThis.localStorage = orig;
  }
}

async function testLoadWithCorruptData() {
  const mockLS = createMockLocalStorage();
  mockLS.setItem('localverse_settings', 'NOT_JSON{{{');
  const orig = globalThis.localStorage;
  globalThis.localStorage = mockLS;

  try {
    const ctx = createMockContext();
    const plugin = new SettingsPlugin(ctx);
    const loaded = plugin._load();
    // Should fall back to defaults
    assert.equal(loaded.language, 'zh');
    assert.equal(loaded.theme, 'system');
  } finally {
    globalThis.localStorage = orig;
  }
}

async function testMountRenders() {
  const ctx = createMockContext();
  const plugin = new SettingsPlugin(ctx);
  const container = { innerHTML: '', addEventListener() {} };
  await plugin.mount(container);
  assert.ok(container.innerHTML.includes('set-plugin'), 'should render set-plugin class');
  assert.ok(container.innerHTML.includes('set-nav'), 'should render navigation');
}

async function testSectionNavigation() {
  const ctx = createMockContext();
  const plugin = new SettingsPlugin(ctx);
  const container = { innerHTML: '', addEventListener() {} };
  await plugin.mount(container);

  // Simulate nav action
  await plugin._handleAction('nav', { dataset: { section: 'appearance' } });
  assert.equal(plugin.state.activeSection, 'appearance');

  await plugin._handleAction('nav', { dataset: { section: 'notifications' } });
  assert.equal(plugin.state.activeSection, 'notifications');
}

async function testSaveAction() {
  const mockLS = createMockLocalStorage();
  const orig = globalThis.localStorage;
  globalThis.localStorage = mockLS;

  try {
    const ctx = createMockContext();
    const plugin = new SettingsPlugin(ctx);
    const container = { innerHTML: '', addEventListener() {} };
    await plugin.mount(container);

    plugin.state.settings.language = 'en';
    await plugin._handleAction('save', { dataset: {} });

    assert.equal(plugin.state.savedFeedback, true, 'savedFeedback should be true after save');
    // Verify persisted
    const saved = JSON.parse(mockLS.getItem('localverse_settings'));
    assert.equal(saved.language, 'en');
  } finally {
    globalThis.localStorage = orig;
  }
}

async function testFallbackI18n() {
  const ctx = createMockContext();
  const plugin = new SettingsPlugin(ctx);
  assert.equal(plugin.t('title'), '设置');
  assert.equal(plugin.t('save'), '保存');
  assert.equal(plugin._fallback('nonexistent'), 'nonexistent');
}

async function testEscapeHtml() {
  const ctx = createMockContext();
  const plugin = new SettingsPlugin(ctx);
  assert.equal(plugin.escapeHtml('<b>test</b>'), '&lt;b&gt;test&lt;/b&gt;');
  assert.equal(plugin.escapeHtml(null), '');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['instantiates with correct defaults', testInstantiate],
    ['onActivate loads default settings', testDefaultSettings],
    ['_save and _load round-trip settings', testSaveAndLoad],
    ['_load returns defaults on corrupt data', testLoadWithCorruptData],
    ['mount renders plugin HTML', testMountRenders],
    ['nav action changes activeSection', testSectionNavigation],
    ['save action persists and sets savedFeedback', testSaveAction],
    ['_fallback i18n returns correct strings', testFallbackI18n],
    ['escapeHtml sanitizes HTML characters', testEscapeHtml]
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

  console.log(`\nsettings-plugin.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
