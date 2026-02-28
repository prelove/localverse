import assert from 'node:assert/strict';
import WikiService from '../../../../src/frontend/desktop/plugins/wiki/services/wiki-service.js';

// ==================== Database Mock ====================

function createMockDb() {
  const tables = {
    wiki_modules: [],
    wiki_columns: [],
    wiki_cards: [],
    wiki_card_links: [],
    wiki_card_history: []
  };

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
      if (pair.match(/version\s*=\s*version\s*\+\s*1/i)) {
        // SQL expression with no '?' placeholder – do not advance paramIdx
        row.version = (parseInt(row.version) || 1) + 1;
        continue;
      }
      const eqIdx = pair.indexOf('=');
      const col = pair.slice(0, eqIdx).trim();
      const val = pair.slice(eqIdx + 1).trim();
      if (val === '?') {
        row[col] = params[paramIdx++];
      } else {
        // Literal value (e.g. deleted = 1)
        const num = parseFloat(val);
        row[col] = isNaN(num) ? val.replace(/^['"]|['"]$/g, '') : num;
      }
    }
  }

  function applyDelete(sql, params) {
    const tableName = sql.match(/DELETE\s+FROM\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return;
    if (sql.match(/source_card_id\s*=\s*\?\s*AND\s*target_card_id\s*=\s*\?/i)) {
      tables[tableName] = tables[tableName].filter(
        r => !(r.source_card_id === params[0] && r.target_card_id === params[1])
      );
    }
  }

  function applyQuery(sql, params = []) {
    // COALESCE(MAX(sort_order), 0) queries
    if (/COALESCE\s*\(\s*MAX\s*\(\s*sort_order/i.test(sql)) {
      const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
      if (!tableName || !tables[tableName]) return [{ max_order: 0 }];
      let rows = tables[tableName].filter(r => r.deleted !== 1);
      const andMatch = sql.match(/AND\s+(\w+)\s*=\s*\?/i);
      if (andMatch && params.length > 0) {
        const col = andMatch[1];
        rows = rows.filter(r => r[col] === params[0]);
      }
      const max = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
      return [{ max_order: max }];
    }

    // FTS MATCH query - not supported in mock
    if (sql.includes('MATCH ?')) return [];

    // Backlinks JOIN query: wiki_cards JOIN wiki_card_links WHERE target_card_id = ?
    if (/wiki_card_links\s+l/i.test(sql) && /target_card_id\s*=\s*\?/i.test(sql)) {
      const targetId = params[0];
      const links = tables.wiki_card_links.filter(l => l.target_card_id === targetId);
      const sourceIds = links.map(l => l.source_card_id);
      return tables.wiki_cards.filter(c => sourceIds.includes(c.id) && c.deleted !== 1);
    }

    // getAllCards JOIN query: wiki_cards JOIN wiki_columns WHERE col.module_id = ?
    if (/wiki_columns\s+col/i.test(sql) && /col\.module_id\s*=\s*\?/i.test(sql)) {
      const moduleId = params[0];
      const colIds = tables.wiki_columns
        .filter(c => c.module_id === moduleId && c.deleted !== 1)
        .map(c => c.id);
      return tables.wiki_cards.filter(
        c => colIds.includes(c.column_id) && c.deleted !== 1
      );
    }

    const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (!tableName || !tables[tableName]) return [];
    let rows = [...tables[tableName]];

    if (sql.includes('deleted = 0')) {
      rows = rows.filter(r => r.deleted !== 1);
    }

    // WHERE id = ?
    if (/WHERE\s+(?:\w+\.)?id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    // WHERE id = ? AND deleted = 0 (version history uses WHERE id = ?)
    if (/wiki_card_history.*WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    if (/column_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.column_id === params[0]);
    }

    if (/module_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.module_id === params[0]);
    }

    if (/\bcard_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.card_id === params[0]);
    }

    // wiki_card_links: source_card_id = ? OR target_card_id = ?
    if (/source_card_id\s*=\s*\?\s*OR\s*target_card_id\s*=\s*\?/i.test(sql) && params.length >= 2) {
      rows = rows.filter(r =>
        r.source_card_id === params[0] || r.target_card_id === params[1]
      );
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
      // CREATE TABLE / CREATE INDEX / CREATE VIRTUAL TABLE → no-op
      return true;
    },
    async run(sql, params = []) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT')) applyInsert(sql, params);
      else if (trimmed.startsWith('UPDATE')) applyUpdate(sql, params);
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
  const service = new WikiService(db);
  await service.initSchema(); // should not throw
}

async function testModuleCrud() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  // create
  const mod = await service.createModule({ name: 'Engineering', description: 'Tech docs' });
  assert.ok(mod.id, 'module should have id');
  assert.equal(mod.name, 'Engineering');

  // getModules
  const modules = await service.getModules();
  assert.equal(modules.length, 1);

  // getModule
  const fetched = await service.getModule(mod.id);
  assert.equal(fetched.name, 'Engineering');

  // updateModule
  await service.updateModule(mod.id, { name: 'Engineering Docs' });
  const updated = await service.getModule(mod.id);
  assert.equal(updated.name, 'Engineering Docs');

  // deleteModule (soft)
  await service.deleteModule(mod.id);
  const afterDelete = await service.getModules();
  assert.equal(afterDelete.length, 0, 'deleted module should not appear');
  const deletedGet = await service.getModule(mod.id);
  assert.equal(deletedGet, null, 'getModule should return null after soft-delete');
}

async function testColumnCrud() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'Docs' });

  const col = await service.createColumn({ moduleId: mod.id, name: 'Frontend' });
  assert.ok(col.id, 'column should have id');
  assert.equal(col.name, 'Frontend');
  assert.equal(col.module_id, mod.id);

  const cols = await service.getColumns(mod.id);
  assert.equal(cols.length, 1);

  await service.updateColumn(col.id, { name: 'Frontend Dev' });
  const updated = await service.getColumn(col.id);
  assert.equal(updated.name, 'Frontend Dev');

  await service.deleteColumn(col.id);
  const afterDelete = await service.getColumns(mod.id);
  assert.equal(afterDelete.length, 0);
}

async function testCardCrud() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'Wiki' });
  const col = await service.createColumn({ moduleId: mod.id, name: 'Notes' });

  const card = await service.createCard({
    columnId: col.id,
    title: 'Hello World',
    content: '# Hello\nThis is content',
    tags: ['js', 'intro'],
    createdBy: 'user1'
  });

  assert.ok(card.id, 'card should have id');
  assert.equal(card.title, 'Hello World');
  assert.deepEqual(card.tags, ['js', 'intro']);

  // getCard
  const fetched = await service.getCard(card.id);
  assert.equal(fetched.title, 'Hello World');

  // getCards by column
  const cards = await service.getCards(col.id);
  assert.equal(cards.length, 1);

  // updateCard
  await service.updateCard(card.id, { title: 'Updated Title', tags: ['js', 'updated'] });
  const updated = await service.getCard(card.id);
  assert.equal(updated.title, 'Updated Title');
  assert.deepEqual(updated.tags, ['js', 'updated']);

  // deleteCard
  await service.deleteCard(card.id);
  const afterDelete = await service.getCards(col.id);
  assert.equal(afterDelete.length, 0);
}

async function testMoveCard() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'Project' });
  const col1 = await service.createColumn({ moduleId: mod.id, name: 'Todo' });
  const col2 = await service.createColumn({ moduleId: mod.id, name: 'Done' });

  const card = await service.createCard({ columnId: col1.id, title: 'Task A' });
  assert.equal(card.column_id, col1.id);

  await service.moveCard(card.id, col2.id);
  const moved = await service.getCard(card.id);
  assert.equal(moved.column_id, col2.id);
}

async function testGetAllCards() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'M' });
  const col1 = await service.createColumn({ moduleId: mod.id, name: 'C1' });
  const col2 = await service.createColumn({ moduleId: mod.id, name: 'C2' });

  await service.createCard({ columnId: col1.id, title: 'Card 1' });
  await service.createCard({ columnId: col2.id, title: 'Card 2' });

  const all = await service.getAllCards(mod.id);
  assert.equal(all.length, 2);
}

async function testVersionHistory() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'M' });
  const col = await service.createColumn({ moduleId: mod.id, name: 'C' });
  const card = await service.createCard({ columnId: col.id, title: 'V1', content: 'content1', createdBy: 'u1' });

  await service.updateCard(card.id, { title: 'V2', content: 'content2', updatedBy: 'u1' });

  const versions = await service.getVersions(card.id);
  assert.ok(versions.length >= 2, 'should have at least 2 versions (create + update)');

  const v1 = versions.find(v => v.title === 'V1');
  assert.ok(v1, 'v1 should exist');
  const fetched = await service.getVersion(v1.id);
  assert.equal(fetched.title, 'V1');
}

async function testLinks() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'M' });
  const col = await service.createColumn({ moduleId: mod.id, name: 'C' });
  const cardA = await service.createCard({ columnId: col.id, title: 'Card A' });
  const cardB = await service.createCard({ columnId: col.id, title: 'Card B' });

  await service.createLink(cardA.id, cardB.id);

  const links = await service.getLinks(cardA.id);
  assert.equal(links.length, 1);

  const backlinks = await service.getBacklinks(cardB.id);
  assert.equal(backlinks.length, 1);
  assert.equal(backlinks[0].id, cardA.id);

  await service.deleteLink(cardA.id, cardB.id);
  const afterDelete = await service.getLinks(cardA.id);
  assert.equal(afterDelete.length, 0);
}

async function testSortOrder() {
  const db = createMockDb();
  const service = new WikiService(db);
  await service.initSchema();

  const mod = await service.createModule({ name: 'M1' });
  const mod2 = await service.createModule({ name: 'M2' });
  const modules = await service.getModules();
  assert.equal(modules.length, 2);
  assert.ok(modules[1].sort_order > modules[0].sort_order, 'sort_order should increment');
}

async function testGenerateId() {
  const db = createMockDb();
  const service = new WikiService(db);
  const id1 = service.generateId('mod');
  const id2 = service.generateId('mod');
  assert.ok(id1.startsWith('mod_'), 'id should start with prefix');
  assert.notEqual(id1, id2, 'ids should be unique');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['module CRUD (create/get/update/delete)', testModuleCrud],
    ['column CRUD (create/get/update/delete)', testColumnCrud],
    ['card CRUD (create/get/update/delete)', testCardCrud],
    ['moveCard changes column_id', testMoveCard],
    ['getAllCards returns cards across columns', testGetAllCards],
    ['version history is saved on create and update', testVersionHistory],
    ['links: create, get, getBacklinks, delete', testLinks],
    ['sort_order increments for sequential modules', testSortOrder],
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

  console.log(`\nwiki-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
