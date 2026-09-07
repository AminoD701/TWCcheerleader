// A row is a membership, not a person. Never remove departed rows from dbGirls.
(function (global) {
  const departure = /已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員/;
  function isActiveGirl(girl) {
    if (!girl) return false;
    const notes = [girl.note, girl.notes, girl['備註'], girl.status].filter(Boolean).join(' ');
    return !departure.test(notes) && !/^(former|ended|inactive|departed|retired)$/i.test(String(girl.status || '').trim());
  }
  const currentRows = rows => rows.filter(isActiveGirl);
  global.isActiveGirl = isActiveGirl;
  function scheduleIsCurrent(schedule, rows) {
    const matches = rows.filter(g => (g.realname === schedule.name || g.nickname === schedule.name) && g.team === schedule.team);
    // Unknown names remain visible; explicit departures never become current roster entries.
    return !matches.length || matches.some(isActiveGirl);
  }
  function scheduleEligible(schedule, rows) {
    const today = Number(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()).replace(/-/g, ''));
    return schedule.safeDate?.num < today || scheduleIsCurrent(schedule, rows);
  }
  global.CheerGirlStatus = Object.freeze({ isActiveGirl, currentRows, scheduleIsCurrent, scheduleEligible });
})(window);
