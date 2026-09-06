import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fetchWithLastSuccess } from '../../src/services/resilient-cache.js';

const memoryStorage = initial => {
  const values = new Map(Object.entries(initial || {}));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), entries: () => [...values] };
};

test('legacy malformed arrays are recoverable and do not crash startup', async () => {
  const storage = memoryStorage({ cheer_favorites: '{broken' });
  const window = { localStorage: storage };
  vm.runInNewContext(await readFile('src/storage/legacy-storage.js', 'utf8'), { window });
  assert.equal(window.CheerStorage.readArray('cheer_favorites').length, 0);
  assert.equal(storage.entries().some(([key]) => key.startsWith('cheer_favorites__recovery__')), true);
});

test('failed refresh returns last successful data without overwriting it', async () => {
  const storage = memoryStorage();
  const first = await fetchWithLastSuccess('feed', async () => [1, 2], storage, 123);
  const stale = await fetchWithLastSuccess('feed', async () => { throw new Error('offline'); }, storage);
  assert.deepEqual(first.data, [1, 2]);
  assert.deepEqual(stale.data, [1, 2]);
  assert.equal(stale.stale, true);
});

test('downloaded data survives a cache quota failure', async () => {
  const storage = { getItem: () => null, setItem() { throw new Error('quota'); } };
  const result = await fetchWithLastSuccess('feed', async () => ['fresh'], storage);
  assert.deepEqual(result.data, ['fresh']);
  assert.match(result.storageError.message, /quota/);
});

test('legacy arrays discard malformed elements without deleting the stored value', async () => {
  const storage = memoryStorage({ cheer_my_schedules: JSON.stringify([null, {}, { id: 'event-1' }]) });
  const window = { localStorage: storage };
  vm.runInNewContext(await readFile('src/storage/legacy-storage.js', 'utf8'), { window });
  assert.deepEqual([...window.CheerStorage.readArray('cheer_my_schedules')].map(item => item.id), ['event-1']);
  assert.equal(storage.getItem('cheer_my_schedules'), JSON.stringify([null, {}, { id: 'event-1' }]));
});
