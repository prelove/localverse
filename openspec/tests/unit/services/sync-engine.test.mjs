import assert from 'node:assert/strict';
import { SyncEngine } from '../../../../src/frontend/desktop/services/sync/sync-engine.js';
import { SyncQueue } from '../../../../src/frontend/desktop/services/sync/sync-queue.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) { return this.map.get(k) ?? null; }
  setItem(k, v) { this.map.set(k, String(v)); }
}

class MockComm {
  constructor() {
    this.handlers = new Map();
    this.online = false;
    this.calls = [];
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  off(event) {
    this.handlers.delete(event);
  }

  emit(event, detail) {
    const handler = this.handlers.get(event);
    if (handler) {
      handler({ detail });
    }
  }

  isOnline() {
    return this.online;
  }

  async sendAndWait(payload) {
    this.calls.push(payload);

    if (payload.action === 'sync:pull') {
      return {
        payload: {
          changes: [{ version: 1 }]
        }
      };
    }

    if (payload.action === 'sync:push') {
      return {
        payload: {
          accepted: payload.payload.changes.length,
          conflictDetails: []
        }
      };
    }

    return { ok: true };
  }
}

async function testStartAndSyncNow() {
  const comm = new MockComm();
  comm.online = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();

  // start() 在线时会立即触发 pullAll（notes 一次）。
  assert.equal(comm.calls.length, 1);
  assert.equal(comm.calls[0].action, 'sync:pull');

  const status = engine.getStatus();
  assert.equal(status.running, true);
  assert.equal(status.online, true);

  engine.stop();
}

async function testTrackChangeAndDebouncedPush() {
  const comm = new MockComm();
  comm.online = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pushDebounce: 50,
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();
  const baselineCalls = comm.calls.length;

  await engine.trackLocalChange({
    entityType: 'notes',
    entityId: 'n-1',
    operation: 'upsert',
    payload: { title: 'hello' }
  });

  await engine.trackLocalChange({
    entityType: 'notes',
    entityId: 'n-2',
    operation: 'upsert',
    payload: { title: 'world' }
  });

  await new Promise((resolve) => setTimeout(resolve, 120));

  const extraCalls = comm.calls.slice(baselineCalls);
  const pushCalls = extraCalls.filter((x) => x.action === 'sync:push');
  const pullCalls = extraCalls.filter((x) => x.action === 'sync:pull');

  // 两次变更经防抖后合并为一次 push（批量 2 条）。
  assert.equal(pushCalls.length, 1);
  assert.equal(pushCalls[0].payload.changes.length, 2);
  assert.equal(pullCalls.length, 1);

  const status = engine.getStatus();
  assert.equal(status.pendingCount, 0);

  engine.stop();
}

async function testRemoteSyncUpdatedPullsEntity() {
  const comm = new MockComm();
  comm.online = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();
  const baselineCalls = comm.calls.length;

  comm.emit('sync-updated', { payload: { entity: 'tasks' } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const lastCall = comm.calls[comm.calls.length - 1];
  assert.equal(comm.calls.length, baselineCalls + 1);
  assert.equal(lastCall.action, 'sync:pull');
  assert.equal(lastCall.payload.entityType, 'tasks');

  engine.stop();
}

async function testSyncQueuePersistence() {
  const storage = new MemoryStorage();
  const queueA = new SyncQueue({ storage });
  await queueA.init();

  await queueA.enqueue({
    entityType: 'cards',
    entityId: 'c-1',
    operation: 'upsert',
    payload: { title: 'A' }
  });

  const queueB = new SyncQueue({ storage });
  await queueB.init();

  const batch = await queueB.getPendingBatch(10);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].entityId, 'c-1');
}

async function run() {
  await testStartAndSyncNow();
  await testTrackChangeAndDebouncedPush();
  await testRemoteSyncUpdatedPullsEntity();
  await testSyncQueuePersistence();
  console.log('sync-engine.test: PASS');
}

run();
