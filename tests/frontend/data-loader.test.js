import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/services/data-loader.js', 'utf8');

async function loaderWith(storage) {
  const window = { localStorage: storage };
  vm.runInNewContext(source, { window, console, Date, JSON, TypeError });
  return window.CheerData;
}

test('live Sheets/JSON loader returns downloads even when persistence fails', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() { throw new Error('quota'); } });
  assert.deepEqual([...(await loader.load('girls', async () => [{ id: 1 }]))], [{ id: 1 }]);
});

test('live Sheets/JSON loader keeps the last successful payload on failure', async () => {
  const values = new Map([['cheer_data_girls', JSON.stringify({ data: [{ id: 1 }] })]]);
  const loader = await loaderWith({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  const result = await loader.load('girls', async () => { throw new Error('offline'); });
  assert.deepEqual([...result], [{ id: 1 }]);
});

test('source failure without cache does not block startup', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() {} });
  const result = await loader.load('events', async () => { throw new Error('network unavailable'); });
  assert.deepEqual([...result], []);
});

test('AbortController timeout without cache does not block startup', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() {} });
  const abortError = new Error('signal is aborted without reason');
  abortError.name = 'AbortError';
  const result = await loader.load('girls', async () => { throw abortError; });
  assert.deepEqual([...result], []);
});

test('homepage routes Sheets and JSON adapters through the resilient loader', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /CheerData\.load\('girls-sheet'/);
  assert.match(html, /CheerData\.load\('auto-news'/);
  assert.match(html, /CheerData\.load\('manual-events'/);
});
