import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('sw.js', 'utf8');
test('cache cleanup is restricted to the project namespace', () => {
  assert.match(source, /isOwnedCache\(key\) && key !== CACHE_NAME/);
  assert.doesNotMatch(source, /keys\.filter\(key => key !== CACHE_NAME\)/);
});
test('install failures are not swallowed and no-store bypasses cache', () => {
  const install = source.slice(source.indexOf("addEventListener('install'"), source.indexOf("addEventListener('activate'"));
  assert.doesNotMatch(install, /catch/);
  assert.match(source, /request\.cache === 'no-store'/);
  assert.match(source, /response\.ok/);
});
