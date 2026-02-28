import assert from 'node:assert/strict';
import AnnouncementService from '../../../../src/frontend/desktop/plugins/announcement/services/announcement-service.js';

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
    if (!tableName || !tables[tableName] || !params.length) return;
    const id = params[params.length - 1];
    const row = tables[tableName].find(r => r.id === id);
    if (!row) return;

    const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i);
    if (!setMatch) return;
    const setPairs = setMatch[1].split(',').map(s => s.trim());
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

  function applyQuery(sql, params = []) {
    const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return [];
    let rows = [...tables[tableName]];

    if (sql.includes('deleted = 0')) {
      rows = rows.filter(r => r.deleted !== 1 && r.deleted !== '1');
    }

    if (/WHERE\s+id\s*=\s*\?\s+AND\s+deleted/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0] && r.deleted !== 1);
    } else if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    // announcement_id = ? AND user_id = ?
    if (/announcement_id\s*=\s*\?\s+AND\s+user_id\s*=\s*\?/i.test(sql) && params.length >= 2) {
      rows = rows.filter(r => r.announcement_id === params[0] && r.user_id === params[1]);
    } else if (/announcement_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.announcement_id === params[0]);
    }

    return rows;
  }

  return {
    tables,
    async exec(sql, params = []) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT')) applyInsert(sql, params);
      else if (trimmed.startsWith('UPDATE')) applyUpdate(sql, params);
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
  const svc = new AnnouncementService(db);
  await svc.initSchema();
}

async function testCreateAndGet() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  const ann = await svc.createAnnouncement({
    title: '系统维护通知',
    content: '明天系统将进行维护',
    priority: 'urgent',
    isPinned: true,
    authorId: 'admin',
    authorName: '管理员'
  });

  assert.ok(ann.id, 'announcement should have id');
  assert.equal(ann.title, '系统维护通知');
  assert.equal(ann.priority, 'urgent');
  assert.equal(ann.isPinned, true);

  const fetched = await svc.getAnnouncement(ann.id);
  assert.equal(fetched.title, ann.title);
}

async function testGetAnnouncementsWithReadStatus() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  const a1 = await svc.createAnnouncement({ title: 'A1', content: 'C1', priority: 'normal', authorId: 'u1' });
  const a2 = await svc.createAnnouncement({ title: 'A2', content: 'C2', priority: 'important', authorId: 'u1' });

  // Mark A1 as read for user1
  await svc.markRead(a1.id, 'user1');

  const list = await svc.getAnnouncements('user1');
  assert.equal(list.length, 2);

  const item1 = list.find(a => a.id === a1.id);
  const item2 = list.find(a => a.id === a2.id);
  assert.equal(item1.isRead, true, 'A1 should be read');
  assert.equal(item2.isRead, false, 'A2 should be unread');
}

async function testUpdateAnnouncement() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  const ann = await svc.createAnnouncement({ title: 'Old Title', content: 'Old content', priority: 'normal', authorId: 'u1' });
  await svc.updateAnnouncement(ann.id, { title: 'New Title', priority: 'important' });

  const updated = await svc.getAnnouncement(ann.id);
  assert.equal(updated.title, 'New Title');
  assert.equal(updated.priority, 'important');
}

async function testDeleteAnnouncement() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  const ann = await svc.createAnnouncement({ title: 'ToDelete', content: 'C', priority: 'normal', authorId: 'u1' });
  await svc.deleteAnnouncement(ann.id);

  const list = await svc.getAnnouncements('u1');
  assert.equal(list.length, 0, 'deleted announcement should not appear');

  const fetched = await svc.getAnnouncement(ann.id);
  assert.equal(fetched, null, 'getAnnouncement should return null');
}

async function testMarkReadIdempotent() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  const ann = await svc.createAnnouncement({ title: 'A', content: 'C', priority: 'normal', authorId: 'u1' });

  await svc.markRead(ann.id, 'user1');
  await svc.markRead(ann.id, 'user1'); // should not throw or create duplicate

  const reads = db.tables.announcement_reads || [];
  const count = reads.filter(r => r.announcement_id === ann.id && r.user_id === 'user1').length;
  assert.equal(count, 1, 'markRead should be idempotent');
}

async function testGetUnreadCount() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  const a1 = await svc.createAnnouncement({ title: 'A1', content: 'C', priority: 'normal', authorId: 'u1' });
  const a2 = await svc.createAnnouncement({ title: 'A2', content: 'C', priority: 'normal', authorId: 'u1' });
  await svc.createAnnouncement({ title: 'A3', content: 'C', priority: 'normal', authorId: 'u1' });

  await svc.markRead(a1.id, 'user1');
  await svc.markRead(a2.id, 'user1');

  const count = await svc.getUnreadCount('user1');
  assert.equal(count, 1, 'unread count should be 1');
}

async function testFilterExpired() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  await svc.initSchema();

  await svc.createAnnouncement({ title: 'Active', content: 'C', priority: 'normal', authorId: 'u1', expiresAt: Date.now() + 9999999 });
  await svc.createAnnouncement({ title: 'Expired', content: 'C', priority: 'normal', authorId: 'u1', expiresAt: Date.now() - 1000 });

  const active = await svc.getAnnouncements('u1', false);
  assert.equal(active.length, 1, 'only active announcements returned');
  assert.equal(active[0].title, 'Active');

  const all = await svc.getAnnouncements('u1', true);
  assert.equal(all.length, 2, 'all announcements returned with includeExpired=true');
}

async function testGenerateId() {
  const db = createMockDb();
  const svc = new AnnouncementService(db);
  const id1 = svc.generateId('ann');
  const id2 = svc.generateId('ann');
  assert.ok(id1.startsWith('ann_'));
  assert.notEqual(id1, id2);
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['createAnnouncement and getAnnouncement', testCreateAndGet],
    ['getAnnouncements attaches isRead status', testGetAnnouncementsWithReadStatus],
    ['updateAnnouncement changes fields', testUpdateAnnouncement],
    ['deleteAnnouncement soft-deletes', testDeleteAnnouncement],
    ['markRead is idempotent', testMarkReadIdempotent],
    ['getUnreadCount returns correct count', testGetUnreadCount],
    ['getAnnouncements filters expired', testFilterExpired],
    ['generateId creates unique ids', testGenerateId]
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

  console.log(`\nannouncement-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
