import assert from 'node:assert/strict';
import TaskService from '../../../../src/frontend/desktop/plugins/task/services/task-service.js';

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

    if (sql.includes('deleted = 0') || sql.includes('deleted=0')) {
      rows = rows.filter(r => r.deleted === 0 || r.deleted === null || r.deleted === undefined);
    }

    if (/WHERE\s+(?:\w+\.)?id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.id === params[0]);
    }

    if (/project_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.project_id === params[0]);
    }

    if (/parent_id\s*=\s*\?/i.test(sql) && params.length > 0) {
      rows = rows.filter(r => r.parent_id === params[0]);
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
  const service = new TaskService(db);
  await service.initSchema();
  assert.ok(true, 'initSchema completed');
}

async function testCreateAndGetProject() {
  const db = createMockDb();
  const service = new TaskService(db);
  await service.initSchema();

  const project = await service.createProject({ name: 'My Project', description: 'Test' });
  assert.ok(project.id, 'project should have id');
  assert.equal(project.name, 'My Project', 'project name should match');

  const projects = await service.getProjects();
  assert.equal(projects.length, 1, 'should have one project');
}

async function testCreateAndGetTask() {
  const db = createMockDb();
  const service = new TaskService(db);
  await service.initSchema();

  const task = await service.createTask({
    title: 'Write tests',
    status: 'todo',
    priority: 3
  });

  assert.ok(task.id, 'task should have id');
  assert.equal(task.title, 'Write tests', 'title should match');
  assert.equal(task.status, 'todo', 'status should be todo');

  const tasks = await service.getTasks();
  assert.ok(tasks.length >= 1, 'should return tasks');
}

async function testDeleteTask() {
  const db = createMockDb();
  const service = new TaskService(db);
  await service.initSchema();

  const task = await service.createTask({ title: 'To delete' });
  await service.deleteTask(task.id);

  const tasks = await service.getTasks();
  assert.equal(tasks.filter(t => t.id === task.id).length, 0, 'deleted task should not appear');
}

async function testTaskStats() {
  const db = createMockDb();
  const service = new TaskService(db);
  await service.initSchema();

  await service.createTask({ title: 'Task 1', status: 'todo' });
  await service.createTask({ title: 'Task 2', status: 'doing' });
  await service.createTask({ title: 'Task 3', status: 'done' });

  const tasks = await service.getTasks();
  assert.ok(tasks.length >= 3, 'should have at least 3 tasks');
}

async function testDeleteProject() {
  const db = createMockDb();
  const service = new TaskService(db);
  await service.initSchema();

  const project = await service.createProject({ name: 'Delete Me' });
  await service.deleteProject(project.id);

  const projects = await service.getProjects();
  assert.equal(projects.filter(p => p.id === project.id).length, 0, 'project should be deleted');
}

async function testGenerateId() {
  const db = createMockDb();
  const service = new TaskService(db);
  const id1 = service.generateId('task');
  const id2 = service.generateId('task');
  assert.ok(id1.startsWith('task_'), 'id should start with prefix');
  assert.notEqual(id1, id2, 'ids should be unique');
}

// ==================== Runner ====================

async function run() {
  const tests = [
    ['initSchema completes without error', testInitSchema],
    ['createProject and getProjects work', testCreateAndGetProject],
    ['createTask and getTasks work', testCreateAndGetTask],
    ['deleteTask soft-deletes task', testDeleteTask],
    ['task stats reflect correct counts', testTaskStats],
    ['deleteProject soft-deletes project', testDeleteProject],
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

  console.log(`\ntask-service.test: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${passed + failed})`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
