import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function pngSize(path) {
  const b = readFileSync(path);
  assert.equal(b.subarray(1, 4).toString(), 'PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('app icon PNG assets have the declared dimensions', () => {
  assert.deepEqual(pngSize('favicon-32.png'), [32, 32]);
  assert.deepEqual(pngSize('app-icon-192.png'), [192, 192]);
  assert.deepEqual(pngSize('app-icon-512.png'), [512, 512]);
  assert.deepEqual(pngSize('app-icon-maskable-512.png'), [512, 512]);
});

test('manifest and page use unified cheerleader icons without baseball fallback', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  assert.ok(manifest.icons.some(i => i.src === 'app-icon-192.png' && i.purpose === 'any'));
  assert.ok(manifest.icons.some(i => i.src === 'app-icon-512.png' && i.purpose === 'any'));
  assert.ok(manifest.icons.some(i => i.src === 'app-icon-maskable-512.png' && i.purpose === 'maskable'));
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /favicon-32\.png/);
  assert.match(html, /apple-touch-icon[^>]+app-icon-192\.png/);
  assert.doesNotMatch(html, /apple-touch-icon[^>]+baseball\.png/);
});
