import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const window = {};
vm.runInNewContext(readFileSync('src/app/girl-status.js', 'utf8'), { window });
const { isActiveGirl, CheerGirlStatus } = window;
test('all explicit departure notes override trainee and active status', () => {
  for (const note of ['已離隊','離隊','已退隊','退隊','不續約','已卸任','前成員']) {
    assert.equal(isActiveGirl({ note: '培訓生，' + note, status: 'active' }), false);
    assert.equal(isActiveGirl({ 備註: note }), false);
  }
  assert.equal(isActiveGirl({ note: '練習生' }), true);
  assert.equal(isActiveGirl({ note: '', 備註: '已離隊' }), false);
});
test('membership filtering preserves person and other current teams', () => {
  const rows = [{ realname:'測試', team:'Si-ster', note:'已離隊' }, { realname:'測試', team:'另一隊', note:'' }];
  assert.equal(CheerGirlStatus.currentRows(rows).length, 1);
  assert.equal(rows.length, 2);
  assert.equal(CheerGirlStatus.scheduleIsCurrent({ name:'測試', team:'Si-ster' }, rows), false);
  assert.equal(CheerGirlStatus.scheduleIsCurrent({ name:'測試', team:'另一隊' }, rows), true);
});
