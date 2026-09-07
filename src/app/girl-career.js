(() => {
  const DATA_URL = './data/girl-careers.json?v=1';
  let careerDataPromise = null;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const loadCareerData = () => {
    if (!careerDataPromise) {
      careerDataPromise = fetch(DATA_URL, { cache: 'no-store' })
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`career data ${res.status}`)))
        .then(data => Array.isArray(data?.records) ? data.records : [])
        .catch(err => {
          console.warn('Girl career data unavailable:', err);
          return [];
        });
    }
    return careerDataPromise;
  };

  const recordMatches = (record, realname, nickname) => {
    const keys = [record.realname, record.nickname, record.name, record.girl].map(normalize).filter(Boolean);
    if (record.girlId) return normalize(record.girlId) === normalize(`${realname}|${nickname}`);
    return keys.includes(normalize(realname)) || (nickname && keys.includes(normalize(nickname)));
  };

  const formatPeriod = record => {
    const start = record.startDate || record.start || record.startYear || record.from || '';
    const end = record.endDate || record.end || record.endYear || record.to || '';
    if (start && end) return `${esc(start)}－${esc(end)}`;
    if (start && !end) return `${esc(start)}－現在`;
    if (!start && end) return `－${esc(end)}`;
    return '期間未註記';
  };

  const makeHistoryRows = (records, currentTeams) => records.map(record => {
    const squad = record.cheerTeam || record.squad || record.team || record.group || '未註記團隊';
    const sportsTeam = record.sportsTeam || record.club || record.organization || '';
    const sport = record.sport || '';
    const ended = Boolean(record.end || record.endYear || record.endDate || record.to || !window.isActiveGirl(record) || !currentTeams.some(team => normalize(team) === normalize(squad)));
    const badge = ended ? '已結束' : '現役';
    const note = record.note || '';
    return `
      <div class="girl-career__item">
        <div class="girl-career__period">${ended ? formatPeriod(record).replace('－現在', '（結束時間未註記）') : formatPeriod(record)}</div>
        <div class="girl-career__body">
          <div class="girl-career__title-row">
            <strong>${esc(squad)}</strong>
            <span class="girl-career__badge ${ended ? 'is-former' : 'is-current'}">${badge}</span>
          </div>
          ${sportsTeam ? `<div class="girl-career__meta">${esc(sportsTeam)}${sport ? ` · ${esc(sport)}` : ''}</div>` : (sport ? `<div class="girl-career__meta">${esc(sport)}</div>` : '')}
          ${note ? `<div class="girl-career__note">${esc(note)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const makeCurrentRows = (teams, sports) => {
    if (!teams.length) return '';
    return teams.map((team, index) => `
      <div class="girl-career__item">
        <div class="girl-career__period">現在</div>
        <div class="girl-career__body">
          <div class="girl-career__title-row">
            <strong>${esc(team)}</strong>
            <span class="girl-career__badge is-current">現役</span>
          </div>
          ${sports[index] || sports[0] ? `<div class="girl-career__meta">${esc(sports[index] || sports[0])}</div>` : ''}
        </div>
      </div>`).join('');
  };

  const injectStyles = () => {
    if (document.getElementById('girl-career-style')) return;
    const style = document.createElement('style');
    style.id = 'girl-career-style';
    style.textContent = `
      .girl-career{margin-top:18px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.025);overflow:hidden}
      .girl-career summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;font-weight:900;color:#fff}
      .girl-career summary::-webkit-details-marker{display:none}.girl-career summary .girl-career__hint{font-size:12px;color:var(--text-sub);font-weight:700}
      .girl-career summary::after{content:'＋';font-size:20px;color:var(--event-accent,#fff);transition:.2s transform}.girl-career[open] summary::after{content:'−'}
      .girl-career__content{padding:0 18px 18px;border-top:1px solid rgba(255,255,255,.07)}
      .girl-career__intro{font-size:12px;line-height:1.6;color:var(--text-sub);margin:14px 0 10px}
      .girl-career__item{display:grid;grid-template-columns:92px 1fr;gap:14px;padding:14px 0;border-bottom:1px dashed rgba(255,255,255,.08)}.girl-career__item:last-child{border-bottom:0}
      .girl-career__period{font-family:var(--sport-font);font-size:12px;font-weight:900;color:var(--event-accent,#fff);padding-top:2px}
      .girl-career__title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.girl-career__title-row strong{font-size:15px;color:#fff}
      .girl-career__badge{font-size:10px;font-weight:900;border-radius:999px;padding:3px 7px}.girl-career__badge.is-current{background:rgba(34,197,94,.13);color:#86efac;border:1px solid rgba(34,197,94,.28)}.girl-career__badge.is-former{background:rgba(148,163,184,.10);color:#cbd5e1;border:1px solid rgba(148,163,184,.22)}
      .girl-career__meta,.girl-career__note{font-size:12px;color:var(--text-sub);margin-top:5px;line-height:1.5}.girl-career__note{color:#cbd5e1}
      .girl-career__empty{padding:14px 0 2px;color:var(--text-sub);font-size:12px;line-height:1.6}
      @media(max-width:768px){.girl-career{margin-top:14px}.girl-career summary{padding:14px}.girl-career__content{padding:0 14px 14px}.girl-career__item{grid-template-columns:1fr;gap:6px}.girl-career__period{font-size:11px}}
    `;
    document.head.appendChild(style);
  };

  const injectCareer = async () => {
    injectStyles();
    const profile = document.getElementById('profile-container');
    const hero = profile?.querySelector('.profile-hero-card');
    if (!profile || !hero || profile.style.display === 'none') return;

    const realname = profile.querySelector('.profile-name-row h1')?.textContent?.trim() || '';
    const nickname = [...profile.querySelectorAll('.profile-name-row span')].map(el => el.textContent?.trim()).find(Boolean) || '';
    if (!realname) return;

    const identity = `${realname}|${nickname}`;
    const existing = profile.querySelector('.girl-career');
    if (existing?.dataset.identity === identity) return;
    existing?.remove();

    const rows = (window.dbGirls || []).filter(g => normalize(g.realname) === normalize(realname) && (!nickname || normalize(g.nickname) === normalize(nickname)));
    const teams = [...new Set(rows.filter(window.isActiveGirl).map(g => g.team).filter(Boolean))];
    let sports = [];
    if (Array.isArray(window.dbGirls)) {
      const rows = window.dbGirls.filter(g => normalize(g.realname) === normalize(realname) || (nickname && normalize(g.nickname) === normalize(nickname)));
      sports = [...new Set(rows.map(g => (g.sport || '').trim()).filter(Boolean))];
    }

    const allRecords = await loadCareerData();
    const history = allRecords.filter(record => recordMatches(record, realname, nickname));
    // Preserve departed memberships even while the optional curated history is empty.
    rows.filter(g => !window.isActiveGirl(g) && g.team).forEach(g => {
      if (!history.some(record => normalize(record.squad || record.team) === normalize(g.team))) {
        history.push({ squad: g.team, sport: g.sport, status: 'former', note: g.note || g['備註'] || '' });
      }
    });
    // Navigation can change while the history request is pending.
    if (!hero.isConnected || profile.querySelector('.girl-career')) return;

    const details = document.createElement('details');
    details.className = 'girl-career';
    details.dataset.identity = identity;
    details.innerHTML = `
      <summary>
        <span>📋 CAREER 個人經歷</span>
        <span class="girl-career__hint">點擊查看</span>
      </summary>
      <div class="girl-career__content">
        <div class="girl-career__intro">此區保留女孩曾效力或合作過的啦啦隊／球隊紀錄；主頁仍只呈現目前身分。</div>
        ${makeHistoryRows(history, teams)}
        ${history.length ? '' : makeCurrentRows(teams, sports)}
        ${history.length || teams.length ? '' : '<div class="girl-career__empty">目前尚未建立個人經歷資料。</div>'}
        ${history.length === 0 && teams.length ? '<div class="girl-career__empty">目前僅有現役資料；歷史經歷可後續由 <code>data/girl-careers.json</code> 補登，不會影響主頁現役名單。</div>' : ''}
      </div>`;

    hero.insertAdjacentElement('afterend', details);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCareer, { once: true });
  else injectCareer();
  new MutationObserver(() => { injectCareer(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
