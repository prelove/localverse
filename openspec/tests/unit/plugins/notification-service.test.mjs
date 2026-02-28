import assert from 'node:assert/strict';
import NotificationService from '../../../../src/frontend/desktop/plugins/notification/services/notification-service.js';

// ==================== Database Mock ====================

function createMockDb() {
  const tables = {};

  function applyInsert(sql, params) {
    const match = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (!match) return;
    const table = match[1];
    const cols = match[2].split(',').map(c => c.trim());
    if (!tables[table]) tables[table] = [];
    const row = {};
    cols.forEach((col, i) => { row[col] = params[i] ?? null; });
    tables[table].push(row);
  }

  function applyUpdate(sql, params) {
    const tableName = sql.match(/UPDATE\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return;

    const whereMatch = sql.match(/WHERE\s+([\s\S]+)$/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : '';

    const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i);
    if (!setMatch) return;
    const setPairs = setMatch[1].split(',').map(s => s.trim());

    // Determine which rows match
    let rows;
    if (/id\s*=\s*\?/i.test(whereClause) && params.length > 0) {
      const id = params[params.length - 1];
      rows = tables[tableName].filter(r => r.id === id);
    } else if (/read\s*=\s*0/i.test(whereClause)) {
      rows = tables[tableName].filter(r => r.read === 0 || r.read === '0' || r.read === false);
    } else {
      rows = [...tables[tableName]];
    }

    for (const row of rows) {
      let paramIdx = 0;
      for (const pair of setPairs) {
        const eqIdx = pair.indexOf('=');
        const col = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        if (val === '?') {
          row[col] = params[paramIdx++];
        } else {
          const num = parseFloat(val);
          row[col] = isNaN(num) ? val.replace(/^['"]|['"]$/g, '') : num;
        }
      }
    }
  }

  function applyDelete(sql, params) {
    const tableName = sql.match(/DELETE\s+FROM\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return;
    if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      const id = params[0];
      tables[tableName] = tables[tableName].filter(r => r.id !== id);
    }
  }

  function applyQuery(sql, params = []) {
    const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return [];
    let rows = [...tables[tableName]];

    // WHERE read = 0
    if (/WHERE\s+read\s*=\s*0/i.test(sql)) {
      rows = rows.filter(r => r.read === 0 || r.read === '0' || r.read === false);
    }

    // WHERE id = ?
    if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    // ORDER BY created_at DESC
    if (/ORDER BY created_at DESC/i.test(sql)) {
      rows.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    }

    // LIMIT (handle both LIMIT N and LIMIT ?)
    const limitMatch = sql.match(/LIMIT\s+(\?|\d+)(?:\s+OFFSET\s+(\?|\d+))?/i);
    if (limitMatch) {
      const limitVal = limitMatch[1] === '?' ? params[0] : parseInt(limitMatch[1], 10);
      const offsetVal = limitMatch[2]
        ? (limitMatch[2] === '?' ? params[limitMatch[1] === '?' ? 1 : 0] : parseInt(limitMatch[2], 10))
        : 0;
      if (!isNaN(offsetVal) && offsetVal > 0) {
        rows = rows.slice(offsetVal);
      }
      if (!isNaN(limitVal) && limitVal >= 0) {
        rows = rows.slice(0, limitVal);
      }
    }

    return rows;
  }

  return {
    tables,
    async exec(sql, params = []) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT')) applyInsert(sql, params);
      else if (trimmed.startsWith('UPDATE')) applyUpdate(sql, params);
      else if (trimmed.startsWith('DELETE')) applyDelete(sql, params);
      return true;
    },
    async run(sql, params = []) {
      applyInsert(sql, params);
      return { changes: 1 };
    },
    async query(sql, params = []) {
      return applyQuery(sql, params);
    }
  };
}

// ==================== Tests ====================

async function testInitSchema() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();
  // No error = pass
}

async function testPushAndGetNotification() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  const notif = await svc.push({
    sourcePlugin: 'task',
    sourceId: 'task_001',
    type: 'task_due',
    title: '"完成API设计" 即将到期',
    body: '任务将在1小时内到期'
  });

  assert.ok(notif.id, 'notification should have id');
  assert.equal(notif.source_plugin, 'task');
  assert.equal(notif.type, 'task_due');
  assert.equal(notif.title, '"完成API设计" 即将到期');
  assert.equal(notif.read, false, 'new notification should be unread');

  const fetched = await svc.getNotification(notif.id);
  assert.equal(fetched.id, notif.id);
  assert.equal(fetched.source_plugin, 'task');
}

async function testGetNotificationsOrderedByTime() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  await svc.push({ sourcePlugin: 'chat', type: 'chat_message', title: 'First' });
  // Ensure second notification has a strictly later timestamp
  await new Promise(r => setTimeout(r, 5));
  await svc.push({ sourcePlugin: 'announcement', type: 'announcement', title: 'Second' });

  const list = await svc.getNotifications(10);
  assert.equal(list.length, 2);
  // newest first
  assert.equal(list[0].title, 'Second', 'newest notification should come first');
  assert.equal(list[1].title, 'First');
}

async function testGetUnreadCount() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  const n1 = await svc.push({ sourcePlugin: 'task', type: 'task_due', title: 'T1' });
  const n2 = await svc.push({ sourcePlugin: 'task', type: 'task_due', title: 'T2' });
  await svc.push({ sourcePlugin: 'task', type: 'task_due', title: 'T3' });

  await svc.markRead(n1.id);
  await svc.markRead(n2.id);

  const count = await svc.getUnreadCount();
  assert.equal(count, 1, 'unread count should be 1');
}

async function testMarkRead() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  const notif = await svc.push({ sourcePlugin: 'calendar', type: 'calendar_event', title: 'Meeting' });
  assert.equal(notif.read, false);

  await svc.markRead(notif.id);

  const updated = await svc.getNotification(notif.id);
  assert.equal(updated.read, true, 'notification should be read after markRead');
}

async function testMarkAllRead() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  await svc.push({ sourcePlugin: 'chat', type: 'chat_message', title: 'M1' });
  await svc.push({ sourcePlugin: 'chat', type: 'chat_message', title: 'M2' });
  await svc.push({ sourcePlugin: 'chat', type: 'chat_message', title: 'M3' });

  let count = await svc.getUnreadCount();
  assert.equal(count, 3);

  await svc.markAllRead();

  count = await svc.getUnreadCount();
  assert.equal(count, 0, 'all notifications should be read after markAllRead');
}

async function testDeleteNotification() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  const n1 = await svc.push({ sourcePlugin: 'system', type: 'info', title: 'Keep' });
  const n2 = await svc.push({ sourcePlugin: 'system', type: 'info', title: 'Delete me' });

  await svc.deleteNotification(n2.id);

  const list = await svc.getNotifications(10);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, n1.id);

  const deleted = await svc.getNotification(n2.id);
  assert.equal(deleted, null, 'deleted notification should not be found');
}

async function testGetNotificationsLimit() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  for (let i = 0; i < 10; i++) {
    await svc.push({ sourcePlugin: 'task', type: 'task_due', title: `Task ${i}` });
  }

  const limited = await svc.getNotifications(5);
  assert.equal(limited.length, 5, 'getNotifications should respect limit');
}

async function testPruneOld() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  for (let i = 0; i < 8; i++) {
    await svc.push({ sourcePlugin: 'system', type: 'info', title: `N${i}` });
  }

  await svc.pruneOld(5);

  const all = await svc.getNotifications(100);
  assert.ok(all.length <= 5, `should have at most 5 notifications, got ${all.length}`);
}

async function testDefaultSourcePlugin() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  await svc.initSchema();

  const notif = await svc.push({ type: 'info', title: 'Hello' });
  assert.equal(notif.source_plugin, 'system', 'default source_plugin should be system');
}

async function testGenerateId() {
  const db = createMockDb();
  const svc = new NotificationService(db);
  const id1 = svc.generateId('notif');
  const id2 = svc.generateId('notif');
  assert.ok(id1.startsWith('notif_'), 'id should have prefix');
  assert.notEqual(id1, id2, 'ids should be unique');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['push and getNotification work', testPushAndGetNotification],
    ['getNotifications ordered newest first', testGetNotificationsOrderedByTime],
    ['getUnreadCount returns correct count', testGetUnreadCount],
    ['markRead sets read flag', testMarkRead],
    ['markAllRead clears all unread', testMarkAllRead],
    ['deleteNotification removes entry', testDeleteNotification],
    ['getNotifications respects limit', testGetNotificationsLimit],
    ['pruneOld removes excess notifications', testPruneOld],
    ['generateId creates unique prefixed ids', testGenerateId]
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

  console.log(`\nnotification-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
