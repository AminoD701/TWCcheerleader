import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('mobile girls filters expose sport, team, favorites and clear actions', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /data-open="sport"/);
  assert.match(source, /data-open="team"/);
  assert.match(source, /data-favorites/);
  assert.match(source, /data-clear/);
});

test('mobile girls filters use 48px touch targets and safe area', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /min-height:48px/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
});

test('team choices are sourced from current sport team menu and are searchable', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /#team-menu \.dropdown-item/);
  assert.match(source, /search\.oninput = render/);
});

test('mobile filter module is loaded by navigation entrypoint', async () => {
  const source = await readFile('src/app/navigation.js', 'utf8');
  assert.match(source, /import '\.\/girls-mobile-filters\.js'/);
});
