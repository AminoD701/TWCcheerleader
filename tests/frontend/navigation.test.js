import test from 'node:test';
import assert from 'node:assert/strict';
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
