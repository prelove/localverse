import assert from 'node:assert/strict';
import { formatSize, buildFtsQuery } from '../../../../src/frontend/desktop/plugins/finder/utils/formatters.js';
import { getFileIcon, getFileCategory, getCategoryIcon } from '../../../../src/frontend/desktop/plugins/finder/utils/file-icons.js';

function testFormatSize() {
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(1024), '1.0 KB');
  assert.equal(formatSize(1048576), '1.0 MB');
}

function testBuildFtsQuery() {
  assert.equal(buildFtsQuery(''), '');
  assert.equal(buildFtsQuery('hello world'), 'hello* world*');
  assert.equal(buildFtsQuery('name:"test"'), 'name* test*');
}

function testFileIconAndCategory() {
  assert.equal(getFileIcon({ isDirectory: true }), '📁');
  assert.equal(getFileIcon({ extension: 'JS' }), '📜');
  assert.equal(getFileCategory('png'), 'image');
  assert.equal(getFileCategory('zip'), 'archive');
  assert.equal(getCategoryIcon('code'), '📜');
  assert.equal(getCategoryIcon('non-existing'), '📄');
}

function run() {
  testFormatSize();
  testBuildFtsQuery();
  testFileIconAndCategory();
  console.log('finder-utils.test: PASS');
}

run();
