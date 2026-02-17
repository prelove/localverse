import assert from 'node:assert/strict';
import LinkParser from '../../../../src/frontend/desktop/plugins/wiki/services/link-parser.js';
import VersionManager from '../../../../src/frontend/desktop/plugins/wiki/services/version-manager.js';

if (!globalThis.document) {
  globalThis.document = {
    createElement() {
      return {
        _text: '',
        set textContent(value) {
          this._text = String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
        },
        get innerHTML() {
          return this._text;
        }
      };
    }
  };
}

function testLinkParser() {
  const parser = new LinkParser();
  const content = '链接到 [[Card A]] 和 [[Card B]]，标签 #测试 #wiki';

  const links = parser.parseLinks(content);
  assert.equal(links.length, 2);
  assert.deepEqual(parser.getLinkedTitles(content), ['Card A', 'Card B']);

  const tags = parser.parseTags(content);
  assert.deepEqual(tags.sort(), ['wiki', '测试']);

  const renamed = parser.updateLinksForRename('Card A', 'Card C', content);
  assert.equal(renamed.includes('[[Card C]]'), true);

  const backlinks = parser.findBacklinks('2', 'Card B', [
    { id: '1', title: 'Source', content: 'see [[Card B]]', column_id: 'col-1' },
    { id: '2', title: 'Card B', content: 'target', column_id: 'col-1' }
  ]);
  assert.equal(backlinks.length, 1);
  assert.equal(backlinks[0].cardId, '1');
}

async function testVersionManager() {
  const versions = [
    { id: 'v1', version: 1, title: 'Old', content: 'line1', created_at: 1, created_by: 'u1' },
    { id: 'v2', version: 2, title: 'New', content: 'line1\nline2', created_at: 2, created_by: 'u2' }
  ];

  const wikiService = {
    getVersions: async () => versions,
    getVersion: async (id) => versions.find(v => v.id === id),
    updateCard: async (cardId, payload) => ({ id: cardId, ...payload }),
    saveVersion: async () => {},
    db: { exec: async () => {} }
  };

  const manager = new VersionManager(wikiService);
  const restored = await manager.restoreVersion('card-1', 'v1', 'u3');
  assert.equal(restored.title, 'Old');

  const compared = await manager.compareVersions('v1', 'v2');
  assert.equal(compared.titleChanged, true);
  assert.equal(compared.contentChanged, true);

  const diff = manager.getDiffStats('a', 'a\nb');
  assert.equal(diff.linesAdded, 1);
  assert.equal(diff.charsAdded, 2);

  const preview = manager.getContentPreview('# Header\nBody', 20);
  assert.equal(preview.includes('#'), false);
}

async function run() {
  testLinkParser();
  await testVersionManager();
  console.log('wiki-services.test: PASS');
}

await run();
