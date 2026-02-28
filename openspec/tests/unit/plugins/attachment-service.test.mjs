import assert from 'node:assert/strict';
import AttachmentService from '../../../../src/frontend/desktop/services/attachments/attachment-service.js';

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

    // WHERE id = ?
    if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    // WHERE plugin_id = ? AND ref_id = ?
    if (/WHERE\s+plugin_id\s*=\s*\?/i.test(sql) && params.length >= 2) {
      rows = rows.filter(r => r.plugin_id === params[0] && r.ref_id === params[1]);
    }

    // ORDER BY created_at ASC
    if (/ORDER BY created_at ASC/i.test(sql)) {
      rows.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    }

    return rows;
  }

  return {
    tables,
    async exec(sql, params = []) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT')) applyInsert(sql, params);
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

// ==================== File Mock ====================

function createMockFile(name, type, size, content = 'hello') {
  const bytes = new TextEncoder().encode(content);
  return {
    name,
    type,
    size: size ?? bytes.byteLength,
    async arrayBuffer() { return bytes.buffer; }
  };
}

// ==================== Tests ====================

async function testInitSchema() {
  const db = createMockDb();
  const svc = new AttachmentService(db);
  await svc.initSchema();
  // No error = pass
}

async function testUploadIdbMode() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb' });
  await svc.initSchema();

  const file = createMockFile('photo.png', 'image/png', 100);
  const att = await svc.upload(file, 'chat', 'room_001');

  assert.ok(att.id, 'attachment should have id');
  assert.equal(att.plugin_id, 'chat');
  assert.equal(att.ref_id, 'room_001');
  assert.equal(att.filename, 'photo.png');
  assert.equal(att.mime_type, 'image/png');
  assert.ok(att.storage_path.startsWith('data:'), 'idb mode should produce data URL');
}

async function testGetAttachments() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb' });
  await svc.initSchema();

  const f1 = createMockFile('a.png', 'image/png', 10);
  const f2 = createMockFile('b.txt', 'text/plain', 5);
  await svc.upload(f1, 'wiki', 'card_001');
  await svc.upload(f2, 'wiki', 'card_001');
  await svc.upload(f1, 'wiki', 'card_002');

  const list = await svc.getAttachments('wiki', 'card_001');
  assert.equal(list.length, 2, 'should return 2 attachments for card_001');
}

async function testGetUrl_idb() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb' });
  await svc.initSchema();

  const file = createMockFile('img.jpg', 'image/jpeg', 20);
  const att = await svc.upload(file, 'wiki', 'card_x');

  const url = await svc.getUrl(att.id);
  assert.ok(url.startsWith('data:'), 'getUrl should return data URL in idb mode');
}

async function testGetUrl_missingId() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb' });
  await svc.initSchema();

  const url = await svc.getUrl('nonexistent_id');
  assert.equal(url, null, 'getUrl should return null for missing id');
}

async function testDeleteAttachment() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb' });
  await svc.initSchema();

  const f1 = createMockFile('keep.png', 'image/png', 10);
  const f2 = createMockFile('remove.png', 'image/png', 10);
  const a1 = await svc.upload(f1, 'chat', 'msg_1');
  const a2 = await svc.upload(f2, 'chat', 'msg_1');

  await svc.deleteAttachment(a2.id);

  const list = await svc.getAttachments('chat', 'msg_1');
  assert.equal(list.length, 1, 'should have 1 attachment after deletion');
  assert.equal(list[0].id, a1.id);
}

async function testFileTooLargeForIdb() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb' });
  await svc.initSchema();

  const bigFile = createMockFile('big.bin', 'application/octet-stream', 3 * 1024 * 1024);
  bigFile.arrayBuffer = async () => new ArrayBuffer(3 * 1024 * 1024);

  try {
    await svc.upload(bigFile, 'wiki', 'card_y');
    assert.fail('Should have thrown for file too large');
  } catch (err) {
    assert.ok(err.message.includes('large'), `Expected "large" in error: ${err.message}`);
  }
}

async function testFileTooLargeGlobal() {
  const db = createMockDb();
  const svc = new AttachmentService(db, { mode: 'idb', maxSize: 500 });
  await svc.initSchema();

  const bigFile = createMockFile('big.bin', 'application/octet-stream', 1000);
  bigFile.arrayBuffer = async () => new ArrayBuffer(1000);

  try {
    await svc.upload(bigFile, 'wiki', 'card_z');
    assert.fail('Should have thrown for file exceeding maxSize');
  } catch (err) {
    assert.ok(err.message.includes('large'), `Expected "large" in error: ${err.message}`);
  }
}

async function testGenerateUniqueIds() {
  const db = createMockDb();
  const svc = new AttachmentService(db);
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(svc._generateId('att'));
  assert.equal(ids.size, 20, 'IDs should be unique');
  for (const id of ids) assert.ok(id.startsWith('att_'), 'ID should have prefix');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['upload in idb mode creates data URL entry', testUploadIdbMode],
    ['getAttachments filters by pluginId and refId', testGetAttachments],
    ['getUrl returns data URL in idb mode', testGetUrl_idb],
    ['getUrl returns null for missing id', testGetUrl_missingId],
    ['deleteAttachment removes entry', testDeleteAttachment],
    ['upload throws when file too large for idb', testFileTooLargeForIdb],
    ['upload throws when file exceeds global maxSize', testFileTooLargeGlobal],
    ['generateId produces unique prefixed ids', testGenerateUniqueIds]
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

  console.log(`\nattachment-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
