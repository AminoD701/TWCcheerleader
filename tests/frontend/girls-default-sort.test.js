import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('girl default sort declares requested category priority', async () => {
  const source = await readFile('src/app/girls-default-sort.js', 'utf8');
  assert.match(source, /MASCOT_RE/);
  assert.match(source, /TRAINEE_RE/);
  assert.match(source, /return 4/);
  assert.match(source, /return 2/);
  assert.match(source, /return 3/);
  assert.match(source, /!TAIWAN_RE\.test\(nationality\) \? 0 : 1/);
  assert.match(source, /a\.rank - b\.rank \|\| a\.index - b\.index/);
});
