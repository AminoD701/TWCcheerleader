import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

test('news hub clears stale hidden hashtag and invalid restored category state', () => {
  assert.match(html, /validNewsMains/);
  assert.match(html, /validNewsHashtags/);
  assert.match(html, /!validNewsMains\.has\(window\.currentMainCategory\)/);
  assert.match(html, /window\.currentNewsHashtag\s*=\s*""/);
  assert.match(html, /window\.currentSubCategory\s*=\s*"全部"/);
});
