import assert from 'node:assert/strict';
import CalendarService from '../../../../src/frontend/desktop/plugins/calendar/services/calendar-service.js';

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

    // WHERE id = ? AND deleted = 0
    if (/WHERE\s+id\s*=\s*\?\s+AND\s+deleted/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0] && r.deleted !== 1);
    } else if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    // start_time < ? AND end_time >= ?  (range query)
    if (/start_time\s*<\s*\?\s+AND\s+end_time\s*>=\s*\?/i.test(sql) && params.length >= 2) {
      rows = rows.filter(r => r.start_time < params[0] && r.end_time >= params[1]);
    }

    // end_time >= ? (upcoming)
    if (/end_time\s*>=\s*\?/i.test(sql) && !/start_time/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.end_time >= params[0]);
    }

    // LIMIT ?
    const limitMatch = sql.match(/LIMIT\s+\?/i);
    if (limitMatch && params.length > 0) {
      const limit = params[params.length - 1];
      rows = rows.slice(0, limit);
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

// ==================== Helper ====================

function makeTs(year, month, day, hour = 0, min = 0) {
  return new Date(year, month - 1, day, hour, min).getTime();
}

// ==================== Tests ====================

async function testInitSchema() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();
}

async function testCreateAndGetEvent() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();

  const ev = await svc.createEvent({
    title: '团队会议',
    description: '季度总结',
    startTime: makeTs(2026, 3, 15, 10, 0),
    endTime:   makeTs(2026, 3, 15, 11, 0),
    allDay: false,
    color: '#ef4444',
    createdBy: 'u1'
  });

  assert.ok(ev.id, 'event should have id');
  assert.equal(ev.title, '团队会议');
  assert.equal(ev.color, '#ef4444');
  assert.equal(ev.allDay, false);

  const fetched = await svc.getEvent(ev.id);
  assert.equal(fetched.title, ev.title);
}

async function testGetEventsByDateRange() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();

  // Event in range
  await svc.createEvent({ title: 'In Range', startTime: makeTs(2026, 3, 15, 10), endTime: makeTs(2026, 3, 15, 11), createdBy: 'u1' });
  // Event outside range
  await svc.createEvent({ title: 'Outside', startTime: makeTs(2026, 4, 1, 10), endTime: makeTs(2026, 4, 1, 11), createdBy: 'u1' });

  const rangeStart = new Date(2026, 2, 1);   // March 1
  const rangeEnd   = new Date(2026, 3, 1);   // April 1
  const events = await svc.getEvents(rangeStart, rangeEnd);
  assert.equal(events.length, 1, 'only event in March should be returned');
  assert.equal(events[0].title, 'In Range');
}

async function testUpdateEvent() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();

  const ev = await svc.createEvent({ title: 'Old', startTime: makeTs(2026, 3, 1), endTime: makeTs(2026, 3, 1, 1), createdBy: 'u1' });
  await svc.updateEvent(ev.id, { title: 'New', color: '#10b981' });

  const updated = await svc.getEvent(ev.id);
  assert.equal(updated.title, 'New');
  assert.equal(updated.color, '#10b981');
}

async function testDeleteEvent() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();

  const ev = await svc.createEvent({ title: 'ToDelete', startTime: makeTs(2026, 3, 5, 9), endTime: makeTs(2026, 3, 5, 10), createdBy: 'u1' });
  await svc.deleteEvent(ev.id);

  const fetched = await svc.getEvent(ev.id);
  assert.equal(fetched, null, 'deleted event should return null');

  const range = await svc.getEvents(new Date(2026, 2, 1), new Date(2026, 3, 1));
  assert.equal(range.length, 0, 'deleted event should not appear in range query');
}

async function testAllDayEvent() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();

  const ev = await svc.createEvent({
    title: 'Holiday',
    startTime: makeTs(2026, 3, 10),
    endTime: makeTs(2026, 3, 11),
    allDay: true,
    createdBy: 'u1'
  });

  const fetched = await svc.getEvent(ev.id);
  assert.equal(fetched.allDay, true);
}

async function testRecurringEventExpansion() {
  const db = createMockDb();
  const svc = new CalendarService(db);

  const base = {
    id: 'ev1',
    title: 'Daily standup',
    start_time: makeTs(2026, 3, 1, 9, 0),
    end_time:   makeTs(2026, 3, 1, 9, 15),
    allDay: false,
    color: '#3b82f6',
    recurrence: { type: 'daily' }
  };

  const rangeStart = makeTs(2026, 3, 1);
  const rangeEnd   = makeTs(2026, 3, 5);   // 4 days

  const occurrences = svc.expandRecurring(base, rangeStart, rangeEnd);
  assert.equal(occurrences.length, 4, 'should produce 4 daily occurrences');
  assert.ok(occurrences[0].isRecurrenceInstance, 'instances should be marked');
  assert.equal(occurrences[1].start_time, makeTs(2026, 3, 2, 9, 0));
}

async function testWeeklyRecurrence() {
  const db = createMockDb();
  const svc = new CalendarService(db);

  const base = {
    id: 'ev2',
    title: 'Weekly sync',
    start_time: makeTs(2026, 3, 2, 10, 0),
    end_time:   makeTs(2026, 3, 2, 11, 0),
    allDay: false,
    color: '#3b82f6',
    recurrence: { type: 'weekly' }
  };

  const rangeStart = makeTs(2026, 3, 1);
  const rangeEnd   = makeTs(2026, 3, 31);

  const occurrences = svc.expandRecurring(base, rangeStart, rangeEnd);
  assert.ok(occurrences.length >= 4, 'should have at least 4 weekly occurrences in a month');
}

async function testGetUpcomingEvents() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  await svc.initSchema();

  const future1 = Date.now() + 86400000;
  const future2 = Date.now() + 172800000;
  await svc.createEvent({ title: 'Soon', startTime: future1, endTime: future1 + 3600000, createdBy: 'u1' });
  await svc.createEvent({ title: 'Later', startTime: future2, endTime: future2 + 3600000, createdBy: 'u1' });

  const upcoming = await svc.getUpcomingEvents(1);
  assert.equal(upcoming.length, 1, 'limit=1 should return 1 event');
}

async function testGenerateId() {
  const db = createMockDb();
  const svc = new CalendarService(db);
  const id1 = svc.generateId('ev');
  const id2 = svc.generateId('ev');
  assert.ok(id1.startsWith('ev_'));
  assert.notEqual(id1, id2);
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['createEvent and getEvent', testCreateAndGetEvent],
    ['getEvents filters by date range', testGetEventsByDateRange],
    ['updateEvent changes fields', testUpdateEvent],
    ['deleteEvent soft-deletes', testDeleteEvent],
    ['allDay event stored correctly', testAllDayEvent],
    ['expandRecurring: daily produces correct occurrences', testRecurringEventExpansion],
    ['expandRecurring: weekly produces monthly occurrences', testWeeklyRecurrence],
    ['getUpcomingEvents respects limit', testGetUpcomingEvents],
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

  console.log(`\ncalendar-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
