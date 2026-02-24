#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

import FinderPlugin from '../../../src/frontend/desktop/plugins/finder/index.js';
import { FinderIndexer } from '../../../src/frontend/desktop/plugins/finder/services/indexer.js';

/**
 * 生成模拟文件数据，用于性能基线验证。
 * @param {number} count 文件数量
 */
function buildMockFiles(count) {
  const files = [];
  for (let i = 0; i < count; i += 1) {
    files.push({
      id: `f-${i}`,
      path: `/workspace/project/file-${i}.md`,
      name: `file-${i}.md`,
      extension: 'md',
      size: 1024 + (i % 4096),
      mimeType: 'text/markdown',
      createdAt: Date.now() - i * 10,
      modifiedAt: Date.now() - i * 5
    });
  }
  return files;
}

/**
 * 构建最小可用 DB Mock，仅支持 indexer 依赖的方法。
 */
function createMockDb() {
  const rowIdByPath = new Map();
  let nextRowId = 1;

  return {
    async execute(sql, params = []) {
      if (typeof sql === 'string' && sql.includes('INSERT OR REPLACE INTO finder_index')) {
        const path = params[1];
        if (!rowIdByPath.has(path)) {
          rowIdByPath.set(path, nextRowId);
          nextRowId += 1;
        }
      }
      // 其他 SQL 为 no-op，仅用于性能计时基线。
      return true;
    },
    async queryOne(sql, params = []) {
      const path = params[0];
      if (!rowIdByPath.has(path)) return null;
      return { rowid: rowIdByPath.get(path) };
    }
  };
}

function createPluginForSearch() {
  const plugin = new FinderPlugin({
    mode: 'light',
    settings: {},
    services: {},
    locale: 'en',
    ui: {}
  });

  // 测试环境禁用渲染，避免 DOM 影响纯逻辑性能结果。
  plugin.render = () => {};
  return plugin;
}

async function benchmarkSearchLatency(fileCount) {
  const plugin = createPluginForSearch();
  const dataset = buildMockFiles(fileCount);
  plugin.searchLocalIndex = async () => dataset;

  plugin.state = {
    ...plugin.state,
    query: 'file',
    filters: {
      type: 'all',
      dateRange: 'any',
      sizeRange: 'any',
      extension: ''
    },
    loading: true
  };

  const start = performance.now();
  await plugin.performSearch();
  const durationMs = performance.now() - start;

  return {
    fileCount,
    durationMs,
    resultCount: plugin.state.results.length
  };
}

async function benchmarkIndexBuild(fileCount) {
  const files = buildMockFiles(fileCount);
  const indexer = new FinderIndexer({
    db: createMockDb(),
    fs: null,
    settings: { enableContentSearch: false }
  });

  const start = performance.now();
  for (const file of files) {
    await indexer.indexFile(file);
  }
  const durationMs = performance.now() - start;

  return {
    fileCount,
    durationMs,
    filesPerSecond: fileCount / (durationMs / 1000)
  };
}

function memoryUsageMb() {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

async function main() {
  if (globalThis.gc) {
    globalThis.gc();
  }
  const memoryBefore = memoryUsageMb();

  const search1k = await benchmarkSearchLatency(1000);
  const search10k = await benchmarkSearchLatency(10000);
  const index10k = await benchmarkIndexBuild(10000);

  if (globalThis.gc) {
    globalThis.gc();
  }
  const memoryAfter = memoryUsageMb();
  const memoryDeltaMb = Math.max(0, memoryAfter - memoryBefore);

  const thresholds = {
    search1kMs: 100,
    search10kMs: 500,
    indexFilesPerSec: 1000,
    memoryDeltaMb: 50
  };

  const verdict = {
    search1kPass: search1k.durationMs < thresholds.search1kMs,
    search10kPass: search10k.durationMs < thresholds.search10kMs,
    indexPass: index10k.filesPerSecond > thresholds.indexFilesPerSec,
    memoryPass: memoryDeltaMb < thresholds.memoryDeltaMb
  };

  const summary = {
    search1k,
    search10k,
    index10k,
    memory: {
      beforeMb: memoryBefore,
      afterMb: memoryAfter,
      deltaMb: memoryDeltaMb
    },
    thresholds,
    verdict,
    allPass: Object.values(verdict).every(Boolean)
  };

  console.log(JSON.stringify(summary, null, 2));

  // 只在明显失败时返回非 0，便于 CI 快速发现性能回归。
  if (!summary.allPass) {
    process.exitCode = 1;
  }
}

await main();
