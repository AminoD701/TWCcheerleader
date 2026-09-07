(() => {
  const DATA_URL = './data/girl-careers.json?v=2';
  let careerDataPromise = null;
  const inFlightIdentities = new Set();
  let renderScheduled = false;
  let profileObserver = null;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const formerPattern = /已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員/;
  const getNote = record => String(record?.note || record?.['備註'] || record?.備註 || '').trim();
  const isFormer = record => {
    const status = normalize(record?.status);
    return formerPattern.test(getNote(record)) || ['former', 'ended', 'departed', 'inactive', '離隊', '已離隊'].includes(status);
  };

  window.cheerGirlStatus = window.cheerGirlStatus || {};
  window.cheerGirlStatus.isFormer = isFormer;
  window.cheerGirlStatus.isActive = record => !isFormer(record);
  window.cheerGirlStatus.getNote = getNote;

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
    return keys.includes(normalize(realname)) || (nickname && keys.includes(normalize(nickname)));
  };

  const formatPeriod = record => {
    const start = record.start || record.startYear || record.from || '';
    const end = record.end || record.endYear || record.to || '';
    if (start && end) return `${esc(start)}－${esc(end)}`;
    if (start && !end && !isFormer(record)) return `${esc(start)}－現在`;
    if (start) return `${esc(start)}`;
    if (!start && end) return `－${esc(end)}`;
    return isFormer(record) ? '歷史紀錄' : '現在';
  };

  const makeHistoryRows = records => records.map(record => {
    const squad = record.squad || record.team || record.group || '未註記團隊';
    const sportsTeam = record.sportsTeam || record.club || record.organization || '';
    const sport = record.sport || '';
    const ended = Boolean(record.end || record.endYear || record.to || isFormer(record));
    const badge = ended ? '已離隊' : '現役';
    const note = getNote(record);
    return `
      <div class="girl-career__item">
        <div class="girl-career__period">${formatPeriod(record)}</div>
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

  const makeCurrentRows = rows => {
    const seen = new Set();
    return rows.filter(row => !isFormer(row)).map(row => {
      const team = String(row.team || '').trim();
      if (!team || seen.has(team)) return '';
      seen.add(team);
      const sport = String(row.sport || '').trim();
      return `
        <div class="girl-career__item">
          <div class="girl-career__period">現在</div>
          <div class="girl-career__body">
            <div class="girl-career__title-row">
              <strong>${esc(team)}</strong>
              <span class="girl-career__badge is-current">現役</span>
            </div>
            ${sport ? `<div class="girl-career__meta">${esc(sport)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  };

  const makeFormerRowsFromMainData = rows => {
    const seen = new Set();
    return rows.filter(isFormer).map(row => {
      const team = String(row.team || '').trim();
      if (!team || seen.has(team)) return '';
      seen.add(team);
      const sport = String(row.sport || '').trim();
      const note = getNote(row);
      return `
        <div class="girl-career__item">
          <div class="girl-career__period">歷史紀錄</div>
          <div class="girl-career__body">
            <div class="girl-career__title-row">
              <strong>${esc(team)}</strong>
              <span class="girl-career__badge is-former">已離隊</span>
            </div>
            ${sport ? `<div class="girl-career__meta">${esc(sport)}</div>` : ''}
            ${note ? `<div class="girl-career__note">${esc(note)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  };

  const annotateProfileTeamTags = rows => {
    const profile = document.getElementById('profile-container');
    if (!profile) return;
    const byTeam = new Map();
    rows.forEach(row => {
      const team = String(row.team || '').trim();
      if (!team) return;
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push(row);
    });

    profile.querySelectorAll('.profile-team-tag').forEach(tag => {
      const raw = tag.dataset.originalTeam || tag.textContent?.trim() || '';
      if (!tag.dataset.originalTeam) tag.dataset.originalTeam = raw.replace(/^前\s+/, '');
      const team = tag.dataset.originalTeam;
      const teamRows = byTeam.get(team) || [];
      const hasActive = teamRows.some(row => !isFormer(row));
      const hasOnlyFormer = teamRows.length > 0 && !hasActive;

      // Current-profile tags should only show current teams. Former teams live exclusively
      // in the career/history section below the profile.
      if (hasOnlyFormer) {
        tag.hidden = true;
        tag.setAttribute('aria-hidden', 'true');
        tag.classList.add('is-former-team');
        return;
      }

      tag.hidden = false;
      tag.removeAttribute('aria-hidden');
      tag.classList.remove('is-former-team');
      if (tag.textContent !== team) tag.textContent = team;
      if (tag.title) tag.title = '';
    });
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
      .profile-team-tag.is-former-team{display:none!important}
      @media(max-width:768px){.girl-career{margin-top:14px}.girl-career summary{padding:14px}.girl-career__content{padding:0 14px 14px}.girl-career__item{grid-template-columns:1fr;gap:6px}.girl-career__period{font-size:11px}}
    `;
    document.head.appendChild(style);
  };

  const getProfileIdentity = profile => {
    const realname = profile?.querySelector('.profile-name-row h1')?.textContent?.trim() || '';
    const nickname = [...(profile?.querySelectorAll('.profile-name-row span') || [])].map(el => el.textContent?.trim()).find(Boolean) || '';
    return { realname, nickname, identity: realname ? `${realname}|${nickname}` : '' };
  };

  const injectCareer = async () => {
    injectStyles();
    const profile = document.getElementById('profile-container');
    const hero = profile?.querySelector('.profile-hero-card');
    if (!profile || !hero || profile.style.display === 'none') return;

    const { realname, nickname, identity } = getProfileIdentity(profile);
    if (!identity) return;

    const existing = profile.querySelector('.girl-career');
    if (existing?.dataset.identity === identity) return;
    if (inFlightIdentities.has(identity)) return;
    existing?.remove();

    let mainRows = [];
    if (Array.isArray(window.dbGirls)) {
      mainRows = window.dbGirls.filter(g => normalize(g.realname) === normalize(realname) || (nickname && normalize(g.nickname) === normalize(nickname)));
    }
    annotateProfileTeamTags(mainRows);

    inFlightIdentities.add(identity);
    try {
      const allRecords = await loadCareerData();

      const currentProfile = document.getElementById('profile-container');
      const currentHero = currentProfile?.querySelector('.profile-hero-card');
      const currentIdentity = getProfileIdentity(currentProfile).identity;
      if (!currentProfile || !currentHero || currentProfile.style.display === 'none' || currentIdentity !== identity) return;

      const nowExisting = currentProfile.querySelector('.girl-career');
      if (nowExisting?.dataset.identity === identity) return;
      nowExisting?.remove();

      const history = allRecords.filter(record => recordMatches(record, realname, nickname));
      const activeRows = mainRows.filter(row => !isFormer(row));
      const formerRows = mainRows.filter(isFormer);

      const details = document.createElement('details');
      details.className = 'girl-career';
      details.dataset.identity = identity;
      details.innerHTML = `
        <summary>
          <span>📋 個人經歷</span>
          <span class="girl-career__hint">點擊查看</span>
        </summary>
        <div class="girl-career__content">
          <div class="girl-career__intro">現役狀態以女孩主資料的備註／status 判斷；「已離隊、離隊、退隊、不續約、已卸任、前成員」不再列為現役，但歷史資料仍保留。</div>
          ${makeCurrentRows(activeRows)}
          ${makeHistoryRows(history)}
          ${history.length ? '' : makeFormerRowsFromMainData(formerRows)}
          ${activeRows.length || history.length || formerRows.length ? '' : '<div class="girl-career__empty">目前尚未建立個人經歷資料。</div>'}
          ${!activeRows.length && (history.length || formerRows.length) ? '<div class="girl-career__empty">目前無現役所屬隊伍。</div>' : ''}
        </div>`;

      currentHero.insertAdjacentElement('afterend', details);
    } finally {
      inFlightIdentities.delete(identity);
    }
  };

  const scheduleInjectCareer = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      injectCareer();
    });
  };

  const startProfileObserver = () => {
    if (profileObserver) return true;
    const profile = document.getElementById('profile-container');
    if (!profile) return false;

    profileObserver = new MutationObserver(() => scheduleInjectCareer());
    profileObserver.observe(profile, { childList: true, subtree: true });
    scheduleInjectCareer();
    return true;
  };

  const boot = () => {
    injectStyles();
    if (startProfileObserver()) return;

    const bootObserver = new MutationObserver(() => {
      if (startProfileObserver()) bootObserver.disconnect();
    });
    bootObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
