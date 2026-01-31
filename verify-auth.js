#!/usr/bin/env node

/**
 * Verification Script
 * 
 * This script verifies the authentication module structure and exports.
 * It doesn't run full tests (which require a browser environment),
 * but checks that all files exist and exports are correct.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.join(__dirname, 'src/frontend/desktop/services/auth');
const testDir = path.join(__dirname, 'openspec/tests/unit/auth');

console.log('🔍 Verifying Authentication Module Structure...\n');

// Check if all required files exist
const requiredFiles = [
  'index.js',
  'device-fingerprint.js',
  'token-manager.js',
  'auth-service.js',
  'permission.js',
  'setup-ui.js',
  'README.md'
];

const requiredTestFiles = [
  'device-fingerprint.test.js',
  'token-manager.test.js',
  'permission.test.js',
  'auth-service.test.js',
  'test-runner.html'
];

let allFilesExist = true;

console.log('📁 Checking source files:');
for (const file of requiredFiles) {
  const filePath = path.join(baseDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
}

console.log('\n📁 Checking test files:');
for (const file of requiredTestFiles) {
  const filePath = path.join(testDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
}

// Check CSS file
const cssPath = path.join(__dirname, 'src/frontend/desktop/assets/css/auth.css');
const cssExists = fs.existsSync(cssPath);
console.log(`\n📁 Checking CSS file:`);
console.log(`  ${cssExists ? '✅' : '❌'} auth.css`);
if (!cssExists) allFilesExist = false;

// Check demo file
const demoPath = path.join(__dirname, 'src/frontend/desktop/demo-auth.html');
const demoExists = fs.existsSync(demoPath);
console.log(`\n📁 Checking demo file:`);
console.log(`  ${demoExists ? '✅' : '❌'} demo-auth.html`);
if (!demoExists) allFilesExist = false;

// Check file contents for key exports
console.log('\n📝 Checking exports:');

const indexContent = fs.readFileSync(path.join(baseDir, 'index.js'), 'utf8');
const exports = [
  'generateDeviceId',
  'detectPlatform',
  'TokenManager',
  'AuthService',
  'authService',
  'hasPermission',
  'requirePermission',
  'canAccessData',
  'SetupUI'
];

let allExportsFound = true;
for (const exportName of exports) {
  const found = indexContent.includes(exportName);
  console.log(`  ${found ? '✅' : '❌'} ${exportName}`);
  if (!found) allExportsFound = false;
}

// Count lines of code
console.log('\n📊 Code Statistics:');
let totalLines = 0;
for (const file of requiredFiles.filter(f => f.endsWith('.js'))) {
  const filePath = path.join(baseDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  totalLines += lines;
  console.log(`  ${file}: ${lines} lines`);
}
console.log(`  Total: ${totalLines} lines`);

// Summary
console.log('\n' + '='.repeat(60));
if (allFilesExist && allExportsFound) {
  console.log('✅ All checks passed! Authentication module is properly structured.');
  console.log('\n📋 Next steps:');
  console.log('  1. Open test-runner.html in a browser to run unit tests');
  console.log('  2. Open demo-auth.html to see the setup UI in action');
  console.log('  3. Integrate with your application');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the output above.');
  process.exit(1);
}
