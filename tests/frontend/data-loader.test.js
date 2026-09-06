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

test('live Sheets/JSON loader keeps the last successful payload on availability failure', async () => {
  const values = new Map([['cheer_data_girls', JSON.stringify({ data: [{ id: 1 }] })]]);
  const loader = await loaderWith({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  const result = await loader.load('girls', async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual([...result], [{ id: 1 }]);
});

test('network failure without cache does not block startup', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() {} });
  const result = await loader.load('events', async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual([...result], []);
});

test('AbortController timeout without cache does not block startup', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() {} });
  const abortError = new Error('signal is aborted without reason');
  abortError.name = 'AbortError';
  const result = await loader.load('girls', async () => { throw abortError; });
  assert.deepEqual([...result], []);
});

test('malformed non-array source data still fails loudly', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() {} });
  await assert.rejects(() => loader.load('girls', async () => ({ broken: true })), error => error?.name === 'DataFormatError');
});

test('JSON parse failures still propagate when no valid cache exists', async () => {
  const loader = await loaderWith({ getItem: () => null, setItem() {} });
  await assert.rejects(() => loader.load('manual-events', async () => JSON.parse('{bad json')));
});

test('malformed source data still fails even when a valid cache exists', async () => {
  const values = new Map([['cheer_data_girls', JSON.stringify({ data: [{ id: 1 }] })]]);
  const loader = await loaderWith({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  await assert.rejects(() => loader.load('girls', async () => ({ broken: true })), error => error?.name === 'DataFormatError');
});

test('JSON parse failures still propagate when a valid cache exists', async () => {
  const values = new Map([['cheer_data_manual-events', JSON.stringify({ data: [{ id: 1 }] })]]);
  const loader = await loaderWith({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  await assert.rejects(() => loader.load('manual-events', async () => JSON.parse('{bad json')));
});

test('homepage routes Sheets and JSON adapters through the resilient loader', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /CheerData\.load\('girls-sheet'/);
  assert.match(html, /CheerData\.load\('auto-news'/);
  assert.match(html, /CheerData\.load\('manual-events'/);
  assert.match(html, /src\/services\/data-loader\.js\?v=4/);
});
