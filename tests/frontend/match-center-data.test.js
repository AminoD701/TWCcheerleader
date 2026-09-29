import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const snapshot = JSON.parse(await readFile('data/matches-snapshot.json', 'utf8'));
const functionSource = ['parseDateFlexible', 'loadMatchRows', 'parseMatchRows'].map(name => {
  const nameStart = html.indexOf(`function ${name}(`);
  assert.ok(nameStart >= 0, `${name} is present`);
  const start = html.lastIndexOf('\n', nameStart) + 1;
  let depth = 0;
  const bodyStart = html.indexOf('{', start);
  for (let i = bodyStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}).join('\n');

function functionsWith(liveRows) {
  const context = {
    window: { CheerData: { load: async () => liveRows } },
    fetch: async () => ({ ok: true, json: async () => snapshot }),
    Date, console,
  };
  vm.runInNewContext(`${functionSource}\nthis.helpers = { loadMatchRows, parseMatchRows };`, context);
  return context.helpers;
}

test('Match Center falls back to a complete CPBL snapshot when the CSV is empty', async () => {
  const { loadMatchRows, parseMatchRows } = functionsWith([]);
  const rows = parseMatchRows(await loadMatchRows('sheet', 1));
  assert.ok(rows.filter(row => row.league === 'CPBL').length > 300);
  const opener = rows.find(row => row.note === '例行賽；G1');
  assert.equal(opener.safeDate.num, 20260328);
  assert.equal(opener.homescore, 3);
  assert.equal(opener.awayscore, 2);
});

test('Match Center prefers current Sheet rows when CPBL games are present', async () => {
  const live = [{ date: '2026/09/28', league: 'CPBL', homescore: '19', awayscore: '10' }];
  const { loadMatchRows } = functionsWith(live);
  assert.equal(await loadMatchRows('sheet', 1), live);
});
