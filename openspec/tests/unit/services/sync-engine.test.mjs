import assert from 'node:assert/strict';
import { SyncEngine } from '../../../../src/frontend/desktop/services/sync/sync-engine.js';
import { SyncQueue } from '../../../../src/frontend/desktop/services/sync/sync-queue.js';
import { ConflictResolver } from '../../../../src/frontend/desktop/services/sync/conflict-resolver.js';

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
    this.pushConflictMode = false;
    this.pushThrowMode = false;
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
      if (this.pushThrowMode) {
        throw new Error('network down');
      }

      if (this.pushConflictMode) {
        return {
          payload: {
            accepted: 0,
            conflictDetails: [
              {
                reason: 'stale_base_version',
                entity: 'notes',
                change: { id: 'n-1' }
              }
            ]
          }
        };
      }

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

async function testConflictFlowInEngine() {
  const comm = new MockComm();
  comm.online = true;
  comm.pushConflictMode = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pushDebounce: 30,
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();

  await engine.trackLocalChange({
    entityType: 'notes',
    entityId: 'n-1',
    operation: 'upsert',
    payload: { title: 'need-conflict' }
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  const conflicts = await engine.listConflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(engine.getStatus().conflictCount, 1);

  await engine.resolveConflict(conflicts[0].id, { title: 'resolved' });
  assert.equal(engine.getStatus().conflictCount, 0);

  engine.stop();
}


async function testReconnectAutoSyncFromOfflineQueue() {
  const comm = new MockComm();
  comm.online = false;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pushDebounce: 20,
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();

  // 离线期间记录变更：应仅入队，不会立即发请求。
  await engine.trackLocalChange({
    entityType: 'notes',
    entityId: 'offline-1',
    operation: 'upsert',
    payload: { title: 'offline' }
  });
  const callsBeforeReconnect = comm.calls.length;

  // 连接恢复后应自动触发一次同步（push + pull）。
  comm.online = true;
  comm.emit('connected', {});
  await new Promise((resolve) => setTimeout(resolve, 40));

  const reconnectCalls = comm.calls.slice(callsBeforeReconnect);
  assert.equal(reconnectCalls.some((x) => x.action === 'sync:push'), true);
  assert.equal(reconnectCalls.some((x) => x.action === 'sync:pull'), true);

  engine.stop();
}

async function testFailedQueueRetryOnReconnect() {
  const comm = new MockComm();
  comm.online = true;
  comm.pushThrowMode = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pushDebounce: 20,
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();
  await engine.trackLocalChange({
    entityType: 'notes',
    entityId: 'retry-1',
    operation: 'upsert',
    payload: { title: 'retry' }
  });
  await new Promise((resolve) => setTimeout(resolve, 60));

  // 首次失败后应进入 failed 计数。
  assert.equal(engine.getStatus().failedCount >= 1, true);

  // 模拟重连：failed -> pending -> push 成功。
  comm.pushThrowMode = false;
  comm.emit('connected', {});
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(engine.getStatus().pendingCount, 0);
  assert.equal(engine.getStatus().failedCount, 0);

  engine.stop();
}


async function testManualComplexConflictResolutionEnqueue() {
  const comm = new MockComm();
  comm.online = true;
  comm.pushConflictMode = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pushDebounce: 20,
      pullInterval: 100000
    },
    queueOptions: {
      storage: new MemoryStorage()
    }
  });

  await engine.start();
  await engine.trackLocalChange({
    entityType: 'notes',
    entityId: 'n-1',
    operation: 'upsert',
    payload: { title: 'local', content: 'draft' }
  });
  await new Promise((resolve) => setTimeout(resolve, 60));

  const conflicts = await engine.listConflicts();
  assert.equal(conflicts.length, 1);

  // 手动解决复杂冲突后，合并结果应被重新入队（随后进入自动同步）。
  await engine.resolveConflict(conflicts[0].id, { title: 'resolved', content: 'final' });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(engine.getStatus().pendingCount >= 1 || engine.getStatus().syncing, true);

  engine.stop();
}

async function testConflictResolverAutoMerge() {
  const resolver = new ConflictResolver({ now: () => 100 });

  const record = await resolver.createConflict({
    reason: 'field_overlap_check',
    localChange: {
      payload: { title: 'A' }
    },
    serverChange: {
      payload: { content: 'B' }
    }
  });

  // 字段无重叠时走自动合并。
  assert.equal(record.resolved, true);
  assert.deepEqual(record.mergedPayload, {
    content: 'B',
    title: 'A'
  });

  const unresolved = await resolver.getConflictCount();
  assert.equal(unresolved, 0);
}

async function run() {
  await testStartAndSyncNow();
  await testTrackChangeAndDebouncedPush();
  await testRemoteSyncUpdatedPullsEntity();
  await testSyncQueuePersistence();
  await testConflictFlowInEngine();
  await testReconnectAutoSyncFromOfflineQueue();
  await testFailedQueueRetryOnReconnect();
  await testManualComplexConflictResolutionEnqueue();
  await testConflictResolverAutoMerge();
  console.log('sync-engine.test: PASS');
}

run();
