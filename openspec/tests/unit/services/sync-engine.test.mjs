import assert from 'node:assert/strict';
import { SyncEngine } from '../../../../src/frontend/desktop/services/sync/sync-engine.js';

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
    return { ok: true };
  }
}

class MockBus {
  constructor() {
    this.events = [];
  }

  emit(name, detail) {
    this.events.push({ name, detail });
  }
}

async function testStartAndSyncNow() {
  const comm = new MockComm();
  const bus = new MockBus();
  comm.online = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    eventBus: bus,
    config: {
      entityTypes: ['notes'],
      pullInterval: 100000
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

async function testPushDebounce() {
  const comm = new MockComm();
  comm.online = true;

  const engine = new SyncEngine({
    communicationLayer: comm,
    config: {
      entityTypes: ['notes'],
      pushDebounce: 50,
      pullInterval: 100000
    }
  });

  await engine.start();
  const baselineCalls = comm.calls.length;

  // 连续两次 requestPush，防抖后应合并为一次 push + 一次 pull。
  engine.requestPush();
  engine.requestPush();
  await new Promise((resolve) => setTimeout(resolve, 90));

  const extraCalls = comm.calls.slice(baselineCalls);
  const pushCalls = extraCalls.filter((x) => x.action === 'sync:push');
  const pullCalls = extraCalls.filter((x) => x.action === 'sync:pull');

  assert.equal(pushCalls.length, 1);
  assert.equal(pullCalls.length, 1);

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

async function run() {
  await testStartAndSyncNow();
  await testPushDebounce();
  await testRemoteSyncUpdatedPullsEntity();
  console.log('sync-engine.test: PASS');
}

run();
