#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Phase 2 / task-001-sync-server 冒烟验证。
 *
 * 覆盖目标：
 * 1) server 模式可启动；
 * 2) /api/sync 与 /api/local/sync 双前缀可用；
 * 3) push/pull/status 主流程可用；
 * 4) WebSocket 能收到 sync-updated 广播事件。
 */

const HTTP_PORT = 18080;
const WS_PORT = 18081;

async function waitForHttpReady(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 服务尚未就绪，继续重试。
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`HTTP server not ready within ${timeoutMs}ms: ${url}`);
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), 'localverse-sync-smoke-'));
  const configPath = join(workDir, 'config.json');
  const dbPath = join(workDir, 'sync-smoke.db');

  // 使用独立临时配置，避免污染仓库默认数据和端口。
  const config = {
    mode: 'server',
    client: {
      httpPort: 8765,
      wsPort: 8766,
      bindAddress: '127.0.0.1',
      syncServer: 'http://127.0.0.1:8080',
      syncEnabled: true,
      autoConnect: true,
      reconnectInterval: 5000
    },
    server: {
      httpPort: HTTP_PORT,
      wsPort: WS_PORT,
      bindAddress: '127.0.0.1',
      maxConnections: 100,
      sessionTimeout: 3600
    },
    database: {
      path: dbPath,
      maxConnections: 4
    },
    filesystem: {
      watchPaths: [],
      excludePatterns: ['*.tmp'],
      maxFileSize: 10485760
    },
    security: {
      jwtSecret: 'test-secret',
      tokenExpiry: 3600,
      enableCORS: true,
      allowedOrigins: ['*']
    },
    user: {
      id: 'smoke',
      name: 'Smoke Test',
      department: 'qa'
    },
    logging: {
      level: 'INFO',
      file: join(workDir, 'localverse.log'),
      maxSize: '1MB',
      maxFiles: 1
    }
  };

  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

  // 通过 build/test-classes 覆盖 dist 包内旧字节码，确保验证的是当前工作区代码。
  const proc = spawn('java', ['-cp', 'build/test-classes:dist/localverse.jar', 'Main', '--config', configPath, '--mode=server'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const cleanup = async () => {
    if (!proc.killed) {
      proc.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await rm(workDir, { recursive: true, force: true });
  };

  try {
    await waitForHttpReady(`http://127.0.0.1:${HTTP_PORT}/api/health`);

    // 建立 WS 连接并监听 sync-updated 事件。
    const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
    const wsMessages = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      ws.addEventListener('error', (event) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${event.message || 'unknown'}`));
      }, { once: true });
    });

    ws.addEventListener('message', (event) => {
      wsMessages.push(String(event.data));
    });

    const pushResponse = await fetch(`http://127.0.0.1:${HTTP_PORT}/api/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entity: 'notes',
        changes: [{ id: 'n-1', title: 'hello', baseVersion: 0 }]
      })
    });
    if (!pushResponse.ok) {
      throw new Error(`push failed: HTTP ${pushResponse.status}`);
    }

    const pushJson = await pushResponse.json();
    if (pushJson?.success !== true || pushJson?.data?.accepted !== 1) {
      throw new Error(`push unexpected payload: ${JSON.stringify(pushJson)}`);
    }

    const pullResponse = await fetch(`http://127.0.0.1:${HTTP_PORT}/api/local/sync?entity=notes&since=0&limit=10`);
    const pullJson = await pullResponse.json();
    if (pullJson?.success !== true || pullJson?.data?.count !== 1) {
      throw new Error(`pull unexpected payload: ${JSON.stringify(pullJson)}`);
    }

    const statusResponse = await fetch(`http://127.0.0.1:${HTTP_PORT}/api/sync/status`);
    const statusJson = await statusResponse.json();
    const notesVersion = statusJson?.data?.entityVersions?.find((x) => x.entity === 'notes');
    if (statusJson?.success !== true || !notesVersion || Number(notesVersion.latestVersion) < 1) {
      throw new Error(`status unexpected payload: ${JSON.stringify(statusJson)}`);
    }

    // 给广播事件一点到达时间。
    await new Promise((resolve) => setTimeout(resolve, 500));
    const gotSyncEvent = wsMessages.some((msg) => msg.includes('sync-updated'));
    if (!gotSyncEvent) {
      throw new Error(`expected sync-updated broadcast, got: ${JSON.stringify(wsMessages)}`);
    }

    ws.close();
    console.log('sync-server smoke test passed');
  } catch (error) {
    console.error('sync-server smoke test failed');
    console.error(String(error));
    if (stdout.trim()) {
      console.error('\n[server stdout]\n' + stdout);
    }
    if (stderr.trim()) {
      console.error('\n[server stderr]\n' + stderr);
    }
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

await main();
