/**
 * 数据库服务使用示例
 * 演示如何在实际应用中使用数据库服务
 */

import DatabaseServiceFactory from '../services/database/index.js';
import { generateId } from '../services/database/utils/uuid.js';
import { timestamps, toJSON, fromJSON } from '../services/database/utils/schema.js';

/**
 * 示例 1: 基本的 CRUD 操作
 */
async function basicCrudExample() {
  console.log('=== 示例 1: 基本的 CRUD 操作 ===\n');
  
  // 创建数据库实例（自动检测模式）
  const db = await DatabaseServiceFactory.create('auto');
  
  // 插入数据
  const cardId = generateId('card');
  const ts = timestamps();
  
  await db.run(
    `INSERT INTO cards (id, column_id, title, content, content_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cardId, 'col1', '示例卡片', '这是一个示例卡片的内容', 'markdown', ts.created_at, ts.updated_at]
  );
  
  console.log(`✓ 插入卡片: ${cardId}`);
  
  // 查询数据
  const card = await db.queryOne('SELECT * FROM cards WHERE id = ?', [cardId]);
  console.log('✓ 查询卡片:', card);
  
  // 更新数据
  await db.run(
    'UPDATE cards SET title = ?, updated_at = ? WHERE id = ?',
    ['更新后的标题', Date.now(), cardId]
  );
  console.log('✓ 更新卡片标题');
  
  // 软删除
  await db.run(
    'UPDATE cards SET deleted = 1, deleted_at = ? WHERE id = ?',
    [Date.now(), cardId]
  );
  console.log('✓ 软删除卡片\n');
  
  await db.close();
}

/**
 * 示例 2: 事务操作
 */
async function transactionExample() {
  console.log('=== 示例 2: 事务操作 ===\n');
  
  const db = await DatabaseServiceFactory.create('auto');
  
  try {
    await db.transaction(async () => {
      // 创建模块
      const moduleId = generateId('module');
      const ts = timestamps();
      
      await db.run(
        `INSERT INTO modules (id, name, description, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [moduleId, '示例模块', '这是一个示例模块', 1, ts.created_at, ts.updated_at]
      );
      
      console.log(`✓ 创建模块: ${moduleId}`);
      
      // 创建列
      const columnId = generateId('column');
      
      await db.run(
        `INSERT INTO columns (id, module_id, name, description, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [columnId, moduleId, '待办事项', '待处理的任务列表', 1, ts.created_at, ts.updated_at]
      );
      
      console.log(`✓ 创建列: ${columnId}`);
      
      // 创建多个卡片
      for (let i = 1; i <= 3; i++) {
        const cardId = generateId('card');
        await db.run(
          `INSERT INTO cards (id, column_id, title, content, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [cardId, columnId, `任务 ${i}`, `这是第 ${i} 个任务`, i, ts.created_at, ts.updated_at]
        );
        console.log(`✓ 创建卡片 ${i}: ${cardId}`);
      }
    });
    
    console.log('✓ 事务成功提交\n');
  } catch (error) {
    console.error('✗ 事务回滚:', error.message, '\n');
  }
  
  await db.close();
}

/**
 * 示例 3: JSON 字段处理
 */
async function jsonFieldsExample() {
  console.log('=== 示例 3: JSON 字段处理 ===\n');
  
  const db = await DatabaseServiceFactory.create('auto');
  
  const cardId = generateId('card');
  const ts = timestamps();
  
  // 准备 JSON 数据
  const tags = ['重要', '紧急', '工作'];
  const metadata = {
    priority: 1,
    assignee: 'user123',
    deadline: '2026-02-01'
  };
  
  // 插入带 JSON 字段的数据
  await db.run(
    `INSERT INTO cards (id, column_id, title, content, tags, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cardId,
      'col1',
      '重要任务',
      '这是一个重要任务',
      toJSON(tags),
      toJSON(metadata),
      ts.created_at,
      ts.updated_at
    ]
  );
  
  console.log('✓ 插入带 JSON 字段的卡片');
  
  // 查询并解析 JSON 字段
  const card = await db.queryOne('SELECT * FROM cards WHERE id = ?', [cardId]);
  const parsedTags = fromJSON(card.tags, []);
  const parsedMetadata = fromJSON(card.metadata, {});
  
  console.log('✓ 标签:', parsedTags);
  console.log('✓ 元数据:', parsedMetadata, '\n');
  
  await db.close();
}

/**
 * 示例 4: 批量查询和聚合
 */
async function queryExample() {
  console.log('=== 示例 4: 批量查询和聚合 ===\n');
  
  const db = await DatabaseServiceFactory.create('auto');
  
  // 查询所有模块
  const modules = await db.query('SELECT * FROM modules WHERE deleted = 0 ORDER BY sort_order');
  console.log(`✓ 找到 ${modules.length} 个模块`);
  
  // 查询未删除的卡片数量
  const cardCount = await db.queryOne('SELECT COUNT(*) as count FROM cards WHERE deleted = 0');
  console.log(`✓ 未删除的卡片数量: ${cardCount?.count || 0}`);
  
  // 查询最近创建的卡片
  const recentCards = await db.query(
    'SELECT * FROM cards WHERE deleted = 0 ORDER BY created_at DESC LIMIT 5'
  );
  console.log(`✓ 最近的 ${recentCards.length} 个卡片:`);
  recentCards.forEach(card => {
    console.log(`   - ${card.title}`);
  });
  
  console.log();
  
  await db.close();
}

/**
 * 示例 5: 全文搜索
 */
async function fullTextSearchExample() {
  console.log('=== 示例 5: 全文搜索 ===\n');
  
  const db = await DatabaseServiceFactory.create('auto');
  
  // 注意：FTS 需要 WASM 模式或 JAR 模式支持
  // Mock 模式不支持全文搜索
  
  try {
    // 搜索卡片
    const searchTerm = '示例';
    const results = await db.query(
      `SELECT c.* FROM cards c
       JOIN cards_fts ON cards_fts.rowid = c.rowid
       WHERE cards_fts MATCH ?
       AND c.deleted = 0`,
      [searchTerm]
    );
    
    console.log(`✓ 搜索 "${searchTerm}" 找到 ${results.length} 个结果`);
    results.forEach(card => {
      console.log(`   - ${card.title}`);
    });
  } catch (error) {
    console.log('✗ 全文搜索不可用（可能使用的是 Mock 模式）');
  }
  
  console.log();
  
  await db.close();
}

/**
 * 示例 6: 检测数据库模式
 */
async function detectModeExample() {
  console.log('=== 示例 6: 检测数据库模式 ===\n');
  
  // 检测可用的模式
  const mode = await DatabaseServiceFactory.detectMode();
  console.log(`✓ 可用的数据库模式: ${mode}`);
  
  // 创建指定模式的数据库
  if (mode === 'jar') {
    const db = await DatabaseServiceFactory.create('jar');
    console.log('✓ 使用 JAR 模式');
    await db.close();
  } else if (mode === 'wasm') {
    const db = await DatabaseServiceFactory.create('wasm');
    console.log('✓ 使用 WASM 模式');
    await db.close();
  }
  
  console.log();
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  try {
    await basicCrudExample();
    await transactionExample();
    await jsonFieldsExample();
    await queryExample();
    await fullTextSearchExample();
    await detectModeExample();
    
    console.log('✓ 所有示例运行完成');
  } catch (error) {
    console.error('✗ 运行示例时出错:', error);
  }
}

// 如果直接运行此文件
if (typeof window !== 'undefined') {
  // 浏览器环境
  window.addEventListener('DOMContentLoaded', () => {
    runAllExamples();
  });
} else {
  // Node.js 环境（仅供参考，实际需要浏览器环境）
  runAllExamples();
}

export {
  basicCrudExample,
  transactionExample,
  jsonFieldsExample,
  queryExample,
  fullTextSearchExample,
  detectModeExample
};
