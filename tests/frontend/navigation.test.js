import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NAV_ITEMS, parentForMode } from '../../src/app/navigation-config.js';

test('mobile navigation has five unique destinations', () => {
  assert.deepEqual(NAV_ITEMS.map(item => item.label), ['女孩', '行程', '班表', '我的', '更多']);
  assert.equal(new Set(NAV_ITEMS.map(item => item.mode)).size, 5);
});

test('legacy deep links select the correct parent destination', () => {
  assert.equal(parentForMode('matches'), 'schedule');
  assert.equal(parentForMode('passport'), 'my');
  assert.equal(parentForMode('news'), 'more');
  assert.equal(parentForMode('feedback'), 'more');
});

test('router preserves secondary deep-link query parameters across legacy rendering', async () => {
  const source = await readFile('src/app/navigation.js', 'utf8');
  assert.match(source, /const urlBeforeLegacy = new URL\(location\.href\)/);
  assert.match(source, /const canonical = new URL\(urlBeforeLegacy\)/);
  assert.match(source, /canonical\.searchParams\.set\('mode', mode\)/);
});

test('restored controls re-dispatch events so legacy filter state and cards stay in sync', async () => {
  const source = await readFile('src/app/navigation.js', 'utf8');
  assert.match(source, /function restoreModeState\(mode\)/);
  assert.match(source, /dispatchEvent\(new Event\(el\.tagName === 'SELECT' \? 'change' : 'input'/);
  assert.match(source, /const saved = restoreModeState\(mode\)/);
});
