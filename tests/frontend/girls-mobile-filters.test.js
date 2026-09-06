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

test('mobile girls filters are scoped to Girls and use 48px touch targets plus safe area', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /body\[data-app-mode="girls"\] \.girls-mobile-filterbar/);
  assert.match(source, /girls-filter-clear\{min-height:48px/);
  assert.match(source, /girls-filter-chip\{min-height:48px/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
});

test('team filter requires a sport and shows per-team counts', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /state\.currentSport === '全部'/);
  assert.match(source, /請先選擇球種/);
  assert.match(source, /teamCounts\(\)/);
  assert.match(source, /counts\.get\(n\)/);
  assert.match(source, /search\.oninput = render/);
});

test('favorites mode restores shared display limit outside mobile Girls', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /savedDisplayLimit/);
  assert.match(source, /restoreDisplayLimit/);
  assert.match(source, /!isMobile\(\) \|\| !onGirlsRoute\(\)/);
  assert.match(source, /routeObserver\.observe\(document\.body/);
});

test('bottom sheet only removes the scroll lock it owns', async () => {
  const source = await readFile('src/app/girls-mobile-filters.js', 'utf8');
  assert.match(source, /sheetOwnsScrollLock = !document\.body\.classList\.contains\('no-scroll'\)/);
  assert.match(source, /if \(sheetOwnsScrollLock\) document\.body\.classList\.remove\('no-scroll'\)/);
});

test('mobile filter module is loaded by navigation and precached by service worker', async () => {
  const navigation = await readFile('src/app/navigation.js', 'utf8');
  const sw = await readFile('sw.js', 'utf8');
  assert.match(navigation, /import '\.\/girls-mobile-filters\.js'/);
  assert.match(sw, /src\/app\/girls-mobile-filters\.js/);
  assert.match(sw, /CACHE_PREFIX\}v5/);
});
