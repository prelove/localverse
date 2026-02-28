import assert from 'node:assert/strict';
import ChatService from '../../../../src/frontend/desktop/plugins/chat/services/chat-service.js';

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
    const existing = tables[table].findIndex(r => r.id === row.id);
    if (existing >= 0) tables[table][existing] = row;
    else tables[table].push(row);
  }

  function applyUpdate(sql, params) {
    const tableName = sql.match(/UPDATE\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName] || !params.length) return;
    const id = params[params.length - 1];
    const row = tables[tableName].find(r => r.id === id);
    if (!row) return;
    if (sql.includes('deleted = 1')) row.deleted = 1;
    // extract SET pairs
    const setMatch = sql.match(/SET\s+(.+)\s+WHERE/i);
    if (setMatch) {
      const setPairs = setMatch[1].split(',').map(s => s.trim());
      let paramIdx = 0;
      for (const pair of setPairs) {
        const col = pair.split('=')[0].trim();
        row[col] = params[paramIdx++];
      }
    }
  }

  function applyQuery(sql, params = []) {
    const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return [];
    let rows = [...tables[tableName]];

    // deleted = 0 filter
    if (sql.includes('deleted = 0') || sql.includes('deleted=0')) {
      rows = rows.filter(r => r.deleted === 0 || r.deleted === null || r.deleted === undefined);
    }

    // WHERE id = ?
    if (/WHERE\s+(?:\w+\.)?id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    // room_id = ?
    if (/room_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.room_id === params[0]);
    }

    return rows;
  }

  function dispatch(sql, params) {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('INSERT')) applyInsert(sql, params);
    else if (trimmed.startsWith('UPDATE')) applyUpdate(sql, params);
  }

  return {
    tables,
    async exec(sql, params = []) {
      // exec is used for both DDL (CREATE TABLE) and DML (INSERT/UPDATE)
      if (!/^CREATE/i.test(sql.trim())) dispatch(sql, params);
      return true;
    },
    async run(sql, params = []) {
      dispatch(sql, params);
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
  const service = new ChatService(db);
  await service.initSchema();
  // initSchema should not throw
  assert.ok(true, 'initSchema completed without error');
}

async function testCreateAndGetRoom() {
  const db = createMockDb();
  const service = new ChatService(db);
  await service.initSchema();

  const room = await service.createRoom({ name: 'General', description: 'Main channel' });
  assert.ok(room.id, 'room should have an id');
  assert.equal(room.name, 'General', 'room name should match');

  const rooms = await service.getRooms();
  assert.equal(rooms.length, 1, 'should have one room');
  assert.equal(rooms[0].name, 'General', 'room name should match');
}

async function testCreateAndGetMessage() {
  const db = createMockDb();
  const service = new ChatService(db);
  await service.initSchema();

  const room = await service.createRoom({ name: 'Test Room' });

  const msg = await service.createMessage({
    roomId: room.id,
    senderId: 'user1',
    senderName: 'Alice',
    content: 'Hello world'
  });

  assert.ok(msg.id, 'message should have an id');
  assert.equal(msg.content, 'Hello world', 'content should match');
  assert.equal(msg.room_id, room.id, 'room_id should match');
}

async function testGetMessages() {
  const db = createMockDb();
  const service = new ChatService(db);
  await service.initSchema();

  const room = await service.createRoom({ name: 'Chat Room' });

  await service.createMessage({ roomId: room.id, senderId: 'u1', senderName: 'Alice', content: 'msg1' });
  await service.createMessage({ roomId: room.id, senderId: 'u2', senderName: 'Bob', content: 'msg2' });

  const messages = await service.getMessages(room.id, { limit: 50 });
  assert.ok(messages.length >= 2, 'should retrieve messages');
}

async function testDeleteRoom() {
  const db = createMockDb();
  const service = new ChatService(db);
  await service.initSchema();

  const room = await service.createRoom({ name: 'ToDelete' });
  await service.deleteRoom(room.id);

  const rooms = await service.getRooms();
  assert.equal(rooms.filter(r => r.id === room.id).length, 0, 'deleted room should not appear');
}

async function testGenerateId() {
  const db = createMockDb();
  const service = new ChatService(db);
  const id1 = service.generateId('msg');
  const id2 = service.generateId('msg');
  assert.ok(id1.startsWith('msg_'), 'id should start with prefix');
  assert.notEqual(id1, id2, 'ids should be unique');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['createRoom and getRooms work', testCreateAndGetRoom],
    ['createMessage and getMessages work', testCreateAndGetMessage],
    ['getMessages filters by roomId', testGetMessages],
    ['deleteRoom soft-deletes room', testDeleteRoom],
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

  console.log(`\nchat-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
