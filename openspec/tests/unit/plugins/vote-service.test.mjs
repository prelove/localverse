import assert from 'node:assert/strict';
import VoteService from '../../../../src/frontend/desktop/plugins/vote/services/vote-service.js';

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

    if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    if (/vote_id\s*=\s*\?\s+AND\s+user_id\s*=\s*\?/i.test(sql) && params.length >= 2) {
      rows = rows.filter(r => r.vote_id === params[0] && r.user_id === params[1]);
    } else if (/\bvote_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.vote_id === params[0]);
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
  const svc = new VoteService(db);
  await svc.initSchema(); // should not throw
}

async function testCreateAndGetVote() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  const vote = await svc.createVote({
    title: '今天吃什么？',
    description: '选择午餐',
    type: 'single',
    options: ['面条', '寿司', '披萨'],
    createdBy: 'user1',
    createdByName: 'Alice'
  });

  assert.ok(vote.id, 'vote should have id');
  assert.equal(vote.title, '今天吃什么？');
  assert.deepEqual(vote.options, ['面条', '寿司', '披萨']);
  assert.equal(vote.type, 'single');

  const fetched = await svc.getVote(vote.id);
  assert.equal(fetched.title, vote.title);
}

async function testGetVotesFiltersExpired() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  // Create one active and one expired vote
  await svc.createVote({ title: 'Active', type: 'single', options: ['A', 'B'], createdBy: 'u1', expiresAt: Date.now() + 999999 });
  await svc.createVote({ title: 'Expired', type: 'single', options: ['A', 'B'], createdBy: 'u1', expiresAt: Date.now() - 1000 });

  const activeOnly = await svc.getVotes(false);
  assert.equal(activeOnly.length, 1, 'only active vote should be returned');
  assert.equal(activeOnly[0].title, 'Active');

  const all = await svc.getVotes(true);
  assert.equal(all.length, 2, 'both votes returned when includeExpired=true');
}

async function testDeleteVote() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  const vote = await svc.createVote({ title: 'ToDelete', type: 'single', options: ['Yes', 'No'], createdBy: 'u1' });
  await svc.deleteVote(vote.id);

  const votes = await svc.getVotes(true);
  assert.equal(votes.length, 0, 'deleted vote should not appear');

  const fetched = await svc.getVote(vote.id);
  assert.equal(fetched, null, 'getVote should return null after deletion');
}

async function testSubmitAndGetResponse() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  const vote = await svc.createVote({ title: 'Q', type: 'single', options: ['A', 'B', 'C'], createdBy: 'u1' });

  const resp = await svc.submitResponse(vote.id, 'u2', 'Bob', [1]);
  assert.ok(resp.id, 'response should have id');
  assert.deepEqual(resp.selectedOptions, [1]);

  const responses = await svc.getResponses(vote.id);
  assert.equal(responses.length, 1);
  assert.deepEqual(responses[0].selectedOptions, [1]);
}

async function testGetUserResponse() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  const vote = await svc.createVote({ title: 'Q', type: 'single', options: ['A', 'B'], createdBy: 'u1' });

  let userResp = await svc.getUserResponse(vote.id, 'u2');
  assert.equal(userResp, null, 'no response initially');

  await svc.submitResponse(vote.id, 'u2', 'Bob', [0]);
  userResp = await svc.getUserResponse(vote.id, 'u2');
  assert.ok(userResp, 'response should exist after submitting');
  assert.deepEqual(userResp.selectedOptions, [0]);
}

async function testGetResults() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  const vote = await svc.createVote({ title: 'Q', type: 'single', options: ['A', 'B', 'C'], createdBy: 'u1' });
  await svc.submitResponse(vote.id, 'u1', 'Alice', [0]);
  await svc.submitResponse(vote.id, 'u2', 'Bob', [0]);
  await svc.submitResponse(vote.id, 'u3', 'Carol', [1]);

  const results = await svc.getResults(vote);
  assert.equal(results.length, 3);
  assert.equal(results[0].count, 2);
  assert.equal(results[0].percent, 67);
  assert.equal(results[1].count, 1);
  assert.equal(results[2].count, 0);
}

async function testMultiChoiceVote() {
  const db = createMockDb();
  const svc = new VoteService(db);
  await svc.initSchema();

  const vote = await svc.createVote({ title: 'Multi', type: 'multi', options: ['A', 'B', 'C'], createdBy: 'u1' });
  await svc.submitResponse(vote.id, 'u1', 'Alice', [0, 2]);

  const results = await svc.getResults(vote);
  assert.equal(results[0].count, 1);
  assert.equal(results[2].count, 1);
  assert.equal(results[1].count, 0);
}

async function testGenerateId() {
  const db = createMockDb();
  const svc = new VoteService(db);
  const id1 = svc.generateId('vote');
  const id2 = svc.generateId('vote');
  assert.ok(id1.startsWith('vote_'));
  assert.notEqual(id1, id2);
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['createVote and getVote', testCreateAndGetVote],
    ['getVotes filters expired votes', testGetVotesFiltersExpired],
    ['deleteVote soft-deletes', testDeleteVote],
    ['submitResponse and getResponses', testSubmitAndGetResponse],
    ['getUserResponse returns null then response', testGetUserResponse],
    ['getResults tallies correctly', testGetResults],
    ['multi-choice vote tallies all selected', testMultiChoiceVote],
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

  console.log(`\nvote-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
