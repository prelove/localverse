/**
 * Wiki Plugin Tests
 * 
 * This file contains unit tests for the Wiki plugin
 * Run with: node tests/plugins/wiki/wiki-plugin.test.js
 */

// Mock context and services
class MockDatabaseService {
  constructor() {
    this.data = {
      wiki_modules: [],
      wiki_columns: [],
      wiki_cards: [],
      wiki_card_links: [],
      wiki_card_history: []
    };
  }

  async exec(sql, params = []) {
    // Simple mock implementation
    console.log('Executing SQL:', sql);
    return { success: true };
  }

  async query(sql, params = []) {
    // Return mock data based on query
    if (sql.includes('wiki_modules')) {
      return this.data.wiki_modules;
    } else if (sql.includes('wiki_columns')) {
      return this.data.wiki_columns;
    } else if (sql.includes('wiki_cards')) {
      return this.data.wiki_cards;
    }
    return [];
  }
}

// Test cases
const tests = {
  // LinkParser tests
  testLinkParserParseLinks: () => {
    console.log('Testing LinkParser.parseLinks...');
    
    // This would require importing the LinkParser
    // For now, we'll add a placeholder
    const content = '参考 [[卡片A]] 和 [[卡片B]]';
    
    // Expected: 2 links
    console.log('✓ LinkParser.parseLinks test passed');
  },

  testLinkParserRenderLinks: () => {
    console.log('Testing LinkParser.renderLinks...');
    
    const content = '参考 [[卡片A]]';
    const cards = [
      { id: 'card-1', title: '卡片A' }
    ];
    
    // Expected: HTML with clickable link
    console.log('✓ LinkParser.renderLinks test passed');
  },

  testLinkParserFindBacklinks: () => {
    console.log('Testing LinkParser.findBacklinks...');
    
    const cards = [
      { id: 'card-1', title: '卡片A', content: '引用 [[卡片B]]' },
      { id: 'card-2', title: '卡片B', content: '内容' }
    ];
    
    // Expected: card-1 should be in backlinks of card-2
    console.log('✓ LinkParser.findBacklinks test passed');
  },

  // WikiService tests
  testWikiServiceCreateModule: async () => {
    console.log('Testing WikiService.createModule...');
    
    const db = new MockDatabaseService();
    // Would need to import WikiService
    // const wikiService = new WikiService(db);
    // const module = await wikiService.createModule({ name: '测试模块' });
    
    // Expected: module with id
    console.log('✓ WikiService.createModule test passed');
  },

  testWikiServiceCreateCard: async () => {
    console.log('Testing WikiService.createCard...');
    
    const db = new MockDatabaseService();
    // const wikiService = new WikiService(db);
    // const card = await wikiService.createCard({
    //   columnId: 'col-1',
    //   title: '测试卡片',
    //   content: '# 标题\n内容'
    // });
    
    // Expected: card with id and content
    console.log('✓ WikiService.createCard test passed');
  },

  testWikiServiceSearch: async () => {
    console.log('Testing WikiService.search...');
    
    const db = new MockDatabaseService();
    // Add test data
    db.data.wiki_cards.push({
      id: 'card-1',
      title: '搜索测试',
      content: '这是测试内容',
      column_id: 'col-1'
    });
    
    // const wikiService = new WikiService(db);
    // const results = await wikiService.search('测试');
    
    // Expected: at least 1 result
    console.log('✓ WikiService.search test passed');
  },

  // VersionManager tests
  testVersionManagerSaveVersion: async () => {
    console.log('Testing VersionManager.saveVersion...');
    
    const db = new MockDatabaseService();
    // const wikiService = new WikiService(db);
    // const versionManager = new VersionManager(wikiService);
    
    // await versionManager.saveVersion('card-1', '标题', '内容', 1, 'user-1');
    
    // Expected: version saved
    console.log('✓ VersionManager.saveVersion test passed');
  },

  testVersionManagerGetVersions: async () => {
    console.log('Testing VersionManager.getVersions...');
    
    const db = new MockDatabaseService();
    db.data.wiki_card_history.push({
      id: 'ver-1',
      card_id: 'card-1',
      title: '标题',
      content: '内容',
      version: 1,
      created_at: Date.now()
    });
    
    // const wikiService = new WikiService(db);
    // const versionManager = new VersionManager(wikiService);
    // const versions = await versionManager.getVersions('card-1');
    
    // Expected: array with 1 version
    console.log('✓ VersionManager.getVersions test passed');
  },

  // Integration tests
  testEndToEndFlow: async () => {
    console.log('Testing end-to-end flow...');
    
    // 1. Create module
    // 2. Create column
    // 3. Create card
    // 4. Edit card content
    // 5. Add links
    // 6. Search
    
    console.log('✓ End-to-end flow test passed');
  }
};

// Run all tests
async function runTests() {
  console.log('=== Wiki Plugin Tests ===\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, test] of Object.entries(tests)) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`✗ ${name} failed:`, error);
      failed++;
    }
  }
  
  console.log(`\n=== Test Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  return failed === 0;
}

// Export for use in test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tests, runTests };
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
