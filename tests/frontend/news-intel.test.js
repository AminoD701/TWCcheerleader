import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(path, 'utf8');

test('latest intel uses sport main categories with league subcategories', async () => {
  const html = await read('index.html');
  assert.match(html, /return '棒球情報'/);
  assert.match(html, /return '籃球情報'/);
  assert.match(html, /return '排球情報'/);
  assert.match(html, /return '啦啦隊情報'/);
  assert.match(html, /mainCategory === '棒球情報'[\s\S]*return 'MLB'[\s\S]*return '中職'/);
  assert.match(html, /mainCategory === '籃球情報'[\s\S]*return 'TPBL'[\s\S]*return 'PLG'/);
  assert.match(html, /mainCategory === '排球情報'[\s\S]*return 'TVBL'/);
});

test('fresh and startup news both normalize main and subcategories before rendering', async () => {
  const html = await read('index.html');
  assert.match(html, /dbNews = merged\.map\(n => \{ const tag = window\.normalizeNewsCategory[\s\S]*subtag: window\.normalizeNewsSubcategory\(n, tag\)/);
  assert.match(html, /dbNews = dbNews\.map\(n => \{[\s\S]*normalizeNewsCategory[\s\S]*normalizeNewsSubcategory/);
  assert.match(html, /currentMainCategory = window\.normalizeNewsCategory\(legacyMain\)/);
  assert.match(html, /let subTag = window\.normalizeNewsSubcategory\(n, mainTag\)/);
});

test('crawler prioritizes site roster news and caps sports volume', async () => {
  const source = await read('tools/fetch_auto_news.py');
  assert.match(source, /SHEET_CSV/);
  assert.match(source, /build_queries\(girl_names/);
  assert.match(source, /NAME_QUERY_BATCH_SIZE/);
  assert.match(source, /girl_name_matches/);
  assert.match(source, /SPORT_ITEM_LIMITS = \{"MLB": 6, "中職": 6, "TPBL": 5, "PLG": 4, "TVBL": 5\}/);
  assert.match(source, /SPORT_SOURCE_LIMIT = 2/);
  assert.match(source, /CHEER_ITEM_LIMIT = 36/);
});

test('crawler rejects ambiguous short Latin roster names', async () => {
  const source = await read('tools/fetch_auto_news.py');
  assert.match(source, /AMBIGUOUS_LATIN_NAMES/);
  assert.match(source, /"ai", "et", "iu", "tv", "mvp"/);
  assert.match(source, /len\(compact\) >= 3/);
  assert.match(source, /\(\?<\!\[A-Za-z0-9\]\)/);
});

test('generated automatic feed follows taxonomy and sports caps', async () => {
  const rows = JSON.parse(await read('data/auto-news.json'));
  assert.ok(rows.length > 0);
  const allowed = new Set(['啦啦隊情報', '棒球情報', '籃球情報', '排球情報']);
  assert.ok(rows.every(row => allowed.has(row.tag)));
  assert.ok(rows.every(row => typeof row.subtag === 'string' && row.subtag.length > 0));
  assert.ok(!rows.some(row => row.tag === '啦啦隊情報' && ['ET', 'AI', 'TV', 'MVP'].includes(row.subtag)));

  const sports = rows.filter(row => row.tag !== '啦啦隊情報');
  const count = subtag => sports.filter(row => row.subtag === subtag).length;
  assert.ok(count('MLB') <= 6);
  assert.ok(count('中職') <= 6);
  assert.ok(count('TPBL') <= 5);
  assert.ok(count('PLG') <= 4);
  assert.ok(count('TVBL') <= 5);

  const cheer = rows.filter(row => row.tag === '啦啦隊情報');
  assert.ok(cheer.length >= sports.length, 'cheerleader coverage should not be drowned out by sports headlines');
});
