const MOBILE_MAX = 900;
const SPORTS = ['全部', '棒球', '籃球', '排球', '其他'];
const SPORT_LABEL = { '全部': '全部球種', '棒球': '棒球', '籃球': '籃球', '排球': '排球', '其他': '其他' };
let favoritesOnly = false;
let observer;
let routeObserver;
let savedDisplayLimit = null;
let sheetOwnsScrollLock = false;
let favoritesRenderInFlight = false;
let formerRosterObserver;

function isStandalone() { return matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
// iOS home-screen apps can report a desktop-like layout viewport: do not hide their filters.
document.documentElement.classList.toggle('cheer-app-standalone', isStandalone());
function isMobile() { return isStandalone() || matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches; }
function legacyState() { try { return window.CheerLegacyState?.snapshot?.() || {}; } catch (_) { return {}; } }
function allCards() { return [...document.querySelectorAll('#grid-container > .card')]; }
function visibleCards() { return allCards().filter(card => card.style.display !== 'none'); }
function onGirlsRoute() { return document.body.dataset.appMode === 'girls'; }

function installStyles() {
  if (document.getElementById('girls-mobile-filter-styles')) return;
  const style = document.createElement('style');
  style.id = 'girls-mobile-filter-styles';
  style.textContent = `
    .girls-mobile-filterbar,.girls-filter-sheet{display:none}
    @media (max-width:900px){
      body[data-app-mode="girls"] #sub-nav-sports,body[data-app-mode="girls"] #team-dropdown-wrapper{display:none!important}
      body[data-app-mode="girls"] .girls-mobile-filterbar{display:block;position:sticky;top:0;z-index:90;margin:0 -2px 12px;padding:10px 2px 8px;background:linear-gradient(180deg,rgba(10,12,16,.98),rgba(10,12,16,.92));backdrop-filter:blur(12px)}
      .girls-mobile-filterbar__selectors{display:grid;gap:8px;padding:0 2px}
      .girls-mobile-select-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .girls-mobile-select{display:flex;flex-direction:column;gap:5px;min-width:0}
      .girls-mobile-select>span{padding-left:3px;color:#97a0ad;font-size:10px;font-weight:900;letter-spacing:.6px}
      .girls-mobile-select select{width:100%;min-height:48px;border-radius:13px;border:1px solid rgba(255,255,255,.16);background:#151920;color:#fff;padding:0 38px 0 13px;font-size:14px;font-weight:900;outline:none}
      .girls-mobile-select select:focus{border-color:var(--accent,#ff4757);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#ff4757) 22%,transparent)}
      .girls-filter-chip{min-height:48px;padding:0 14px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:#151920;color:#fff;font-weight:900;white-space:nowrap;font-size:13px}
      .girls-filter-chip.active{border-color:var(--accent,#ff4757);box-shadow:0 0 0 1px var(--accent,#ff4757) inset}
      .girls-mobile-filterbar__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 4px 0;font-size:12px;color:var(--text-sub,#97a0ad);font-weight:800}
      .girls-filter-clear{min-height:48px;border:0;background:transparent;color:#fff;text-decoration:underline;font-weight:900;padding:0 8px}
      .girls-filter-sheet{position:fixed;inset:0;z-index:240;background:rgba(0,0,0,.56);align-items:flex-end}
      .girls-filter-sheet.open{display:flex}
      .girls-filter-sheet__panel{width:100%;max-height:min(72vh,620px);overflow:auto;background:#11151b;border-radius:22px 22px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -16px 50px rgba(0,0,0,.5)}
      .girls-filter-sheet__handle{width:44px;height:5px;border-radius:999px;background:#59616d;margin:2px auto 12px}
      .girls-filter-sheet__title{font-size:18px;font-weight:950;margin:0 0 12px}.girls-filter-sheet__search{width:100%;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0b0e12;color:#fff;padding:0 14px;font-size:16px;margin-bottom:10px;box-sizing:border-box}
      .girls-filter-sheet__list{display:grid;gap:8px}.girls-filter-option{min-height:54px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#171c23;color:#fff;padding:0 14px;text-align:left;font-weight:900;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .girls-filter-option.active{border-color:var(--accent,#ff4757)}
      .girls-filter-option small{color:var(--text-sub,#97a0ad);font-size:12px}
      body.keyboard-open .girls-mobile-filterbar{position:static}
    }
    /* iOS installed PWA: show selectors regardless of CSS viewport width. */
    html.cheer-app-standalone body[data-app-mode="girls"] #sub-nav-sports,
    html.cheer-app-standalone body[data-app-mode="girls"] #team-dropdown-wrapper{display:none!important}
    html.cheer-app-standalone body[data-app-mode="girls"] #girls-mobile-filterbar{display:block!important;position:relative!important;z-index:90;margin:12px 0;padding:12px 0;background:#0b0d11}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-filterbar__selectors{display:grid;gap:8px;padding:0 2px}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-select-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-select{display:flex;flex-direction:column;gap:5px;min-width:0}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-select>span{color:#b1bbc9;font-size:12px;font-weight:900}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-select select{box-sizing:border-box;display:block;width:100%;min-height:48px;border-radius:12px;border:1px solid #4d5665;background:#171c24;color:white;padding:0 10px;font-size:16px}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-filter-chip{min-height:48px;padding:0 12px;border-radius:12px;border:1px solid #4d5665;background:#171c24;color:#fff;font-size:13px;font-weight:900}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-filterbar__meta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px;color:#b1bbc9;font-size:12px}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-filter-clear{min-height:44px;background:transparent;border:0;color:#fff;text-decoration:underline}

    /* Compact mobile roster toolbar: sport and team side by side. */
    @media(max-width:900px){body[data-app-mode="girls"] .girls-mobile-filterbar__selectors{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr) auto;align-items:end;gap:6px;padding:0}body[data-app-mode="girls"] .girls-mobile-select-row{display:contents}body[data-app-mode="girls"] .girls-mobile-select>span{font-size:11px}body[data-app-mode="girls"] .girls-mobile-select select{min-height:39px;height:39px;padding:0 22px 0 7px;font-size:13px;border-radius:9px}body[data-app-mode="girls"] .girls-filter-chip{min-height:39px;height:39px;padding:0 8px;font-size:12px;border-radius:9px}body[data-app-mode="girls"] .girls-mobile-filterbar__meta{padding:2px 0 0;font-size:11px}body[data-app-mode="girls"] .girls-filter-clear{min-height:30px;padding:0 3px;font-size:11px}}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-filterbar__selectors{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr) auto;align-items:end;gap:6px;padding:0}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-select-row{display:contents}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-select select{height:39px;min-height:39px;padding:0 22px 0 7px;font-size:13px;border-radius:9px}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-filter-chip{height:39px;min-height:39px;padding:0 8px;font-size:12px;border-radius:9px}
    html.cheer-app-standalone body[data-app-mode="girls"] .girls-mobile-filterbar__meta{padding:2px 0 0;font-size:11px}
    .former-roster{margin:18px 0 6px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.025);overflow:hidden}
    .former-roster[hidden]{display:none!important}
    .former-roster summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;font-weight:900;color:#fff}
    .former-roster summary::-webkit-details-marker{display:none}.former-roster summary::after{content:'＋';font-size:18px}.former-roster[open] summary::after{content:'−'}
    .former-roster__hint{font-size:12px;color:var(--text-sub,#97a0ad);font-weight:700}
    .former-roster__body{border-top:1px solid rgba(255,255,255,.08);padding:10px 14px 14px}
    .former-roster__intro{font-size:12px;color:var(--text-sub,#97a0ad);line-height:1.6;margin:2px 0 10px}
    .former-roster__season{margin-top:14px}.former-roster__season:first-of-type{margin-top:8px}.former-roster__season-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;padding:8px 2px;border-bottom:1px dashed rgba(255,255,255,.10)}.former-roster__season-title strong{color:#fff;font-size:13px}.former-roster__season-title span{font-size:11px;color:var(--text-sub,#97a0ad);font-weight:800}
    .former-roster__team-group{margin:10px 0 16px}.former-roster__team-title{margin-bottom:7px;color:var(--event-accent,#fff);font-size:12px;font-weight:900;letter-spacing:.4px}
    .former-roster__list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
    .former-roster__item{display:flex;min-width:0;overflow:hidden;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:#151920;color:#fff;padding:0;text-align:left;cursor:pointer}
    .former-roster__photo{position:relative;width:100%;aspect-ratio:4/5;overflow:hidden;background:linear-gradient(145deg,#0b0e12,#171c23)}
    .former-roster__photo::before{content:'NO PHOTO';position:absolute;inset:0;display:grid;place-items:center;color:#59616d;font:900 10px/1 var(--sport-font);letter-spacing:1.2px}
    .former-roster__photo img{position:relative;z-index:1;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 18%;background:#0b0e12}
    .former-roster__meta{min-height:62px;padding:9px 10px}
    .former-roster__item strong{display:block;font-size:14px}.former-roster__item small{display:block;margin-top:4px;color:var(--text-sub,#97a0ad);font-size:11px;line-height:1.4}
    @media(max-width:900px){.former-roster{margin-top:12px}.former-roster__list{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.former-roster__meta{min-height:58px;padding:8px}.former-roster__item strong{font-size:13px}}
    }`;
  document.head.append(style);
}

function clearMobileHiddenCards() {
  allCards().forEach(card => {
    if (card.dataset.mobileFavHidden === '1') {
      card.style.display = '';
      delete card.dataset.mobileFavHidden;
    }
  });
}

function restoreDisplayLimit({ rerender = false, keepBaseline = false } = {}) {
  if (savedDisplayLimit == null) return false;
  const next = savedDisplayLimit;
  if (!keepBaseline) savedDisplayLimit = null;
  const changed = window.currentDisplayLimit !== next;
  window.currentDisplayLimit = next;
  if (changed && rerender && onGirlsRoute()) window.renderContent?.(true);
  return changed;
}

function beforeRouteSnapshot(mode) {
  if (mode !== 'girls' || !favoritesOnly || savedDisplayLimit == null) return;
  clearMobileHiddenCards();
  restoreDisplayLimit({ keepBaseline: true });
}

function ensureExpandedFavoritesRender() {
  if (!favoritesOnly || !isMobile() || !onGirlsRoute() || favoritesRenderInFlight) return false;
  if (savedDisplayLimit == null) savedDisplayLimit = window.currentDisplayLimit || 24;
  if ((window.currentDisplayLimit || 24) >= 9999) return false;
  favoritesRenderInFlight = true;
  window.currentDisplayLimit = 9999;
  window.renderContent?.(true);
  favoritesRenderInFlight = false;
  return true;
}

function applyFavorites() {
  if (!isMobile() || !onGirlsRoute()) {
    clearMobileHiddenCards();
    updateMeta();
    return;
  }
  if (favoritesOnly) {
    if (ensureExpandedFavoritesRender()) return;
    allCards().forEach(card => {
      const fav = card.querySelector('.fav-btn.active');
      if (!fav) {
        card.style.display = 'none';
        card.dataset.mobileFavHidden = '1';
      } else if (card.dataset.mobileFavHidden === '1') {
        card.style.display = '';
        delete card.dataset.mobileFavHidden;
      }
    });
  } else {
    clearMobileHiddenCards();
  }
  updateMeta();
}

function isHistoricalTeamName(name) { return window.CheerGirlsDefaultSort?.historicalTeams?.has?.(String(name || '').trim()) || String(name || '').trim() === 'Little Witches'; }
function teamButtons() { return [...document.querySelectorAll('#team-menu .dropdown-item')].filter(btn => !btn.disabled && !isHistoricalTeamName(teamName(btn))); }
function teamName(btn) { return (btn.querySelector('span')?.textContent || btn.textContent || '').trim(); }
function chooseTeam(name, sport = '') {
  if (typeof window.setGirlTeamFilter === 'function') {
    window.setGirlTeamFilter(name, sport || legacyState().currentSport || '全部');
    setTimeout(syncUI, 0);
    return;
  }
  const btn = teamButtons().find(b => teamName(b) === name || (name === '全部啦啦隊' && teamName(b).includes('全部')));
  if (btn) btn.click();
  setTimeout(syncUI, 0);
}

function favoriteIds() {
  try {
    const values = window.CheerStorage?.readArray?.('cheer_favorites') || JSON.parse(localStorage.getItem('cheer_favorites') || '[]');
    return new Set(Array.isArray(values) ? values : []);
  } catch (_) { return new Set(); }
}

function formerGirlsForTeam(team, state) {
  const girls = Array.isArray(window.dbGirls) ? window.dbGirls : [];
  const isFormer = girl => {
    if (isHistoricalTeamName(girl?.team)) return true;
    const departureSeason = String(girl?.departureseason || girl?.departure_season || girl?.['離隊賽季'] || '').trim();
    if (departureSeason) return true;
    if (window.CheerGirlsDefaultSort?.isFormer?.(girl)) return true;
    if (window.cheerGirlStatus?.isFormer?.(girl)) return true;
    const note = String(girl?.note || girl?.['備註'] || girl?.備註 || '').trim();
    const status = String(girl?.status || '').trim().toLowerCase();
    return /(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/.test(note)
      || ['former','ended','departed','inactive','離隊','已離隊'].includes(status);
  };
  const allTeams = !team || team === '全部啦啦隊';
  const seen = new Set();
  return girls.filter(girl => {
    if (!isFormer(girl)) return false;
    const girlTeam = (girl.team || '').trim();
    if (!allTeams && girlTeam !== team) return false;
    if (state.currentSport && state.currentSport !== '全部' && !(girl.sport || '').includes(state.currentSport)) return false;
    const uid = girl.uid || `${(girl.realname || '').trim()}|${(girl.nickname || '').trim()}`;
    const key = allTeams ? `${uid}\u0000${girlTeam}` : uid;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensureFormerRoster() {
  const grid = document.getElementById('grid-container');
  if (!grid) return null;
  let panel = document.getElementById('former-roster');
  if (panel) return panel;
  panel = document.createElement('details');
  panel.id = 'former-roster';
  panel.className = 'former-roster';
  panel.hidden = true;
  grid.insertAdjacentElement('beforebegin', panel);
  panel.addEventListener('click', event => {
    const btn = event.target.closest('[data-former-index]');
    if (!btn) return;
    const state = legacyState();
    const rows = formerGirlsForTeam(state.currentTeam, state);
    const girl = rows[Number(btn.dataset.formerIndex)];
    if (girl && typeof window.openProfile === 'function') window.openProfile(girl);
  });
  return panel;
}

function renderFormerRoster() {
  const panel = ensureFormerRoster();
  if (!panel || !onGirlsRoute()) {
    if (panel) {
      panel.hidden = true;
      panel.open = false;
    }
    return;
  }

  const state = legacyState();
  const team = state.currentTeam || '全部啦啦隊';
  const rows = formerGirlsForTeam(team, state);
  if (!rows.length) {
    panel.hidden = true;
    panel.open = false;
    return;
  }

  panel.hidden = false;
  const bySeason = new Map();
  rows.forEach((girl, index) => {
    const season = String(girl.departureseason || girl.departure_season || girl['離隊賽季'] || '').trim() || '未註記';
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push({ girl, index });
  });

  const seasonOrder = [...bySeason.keys()].sort((a, b) => {
    if (a === '未註記') return 1;
    if (b === '未註記') return -1;
    return Number(b) - Number(a);
  });

  const allTeams = team === '全部啦啦隊';
  const seasonHtml = seasonOrder.map(season => {
    const items = bySeason.get(season) || [];
    const title = season === '未註記' ? '其他歷屆成員' : `${season} 賽季離隊成員`;

    let body = '';
    if (allTeams) {
      const byTeam = new Map();
      items.forEach(item => {
        const formerTeam = (item.girl.team || '').trim() || '未註記球隊';
        if (!byTeam.has(formerTeam)) byTeam.set(formerTeam, []);
        byTeam.get(formerTeam).push(item);
      });
      body = [...byTeam.entries()].sort(([a],[b]) => a.localeCompare(b,'zh-Hant')).map(([formerTeam, teamItems]) => `
        <div class="former-roster__team-group">
          <div class="former-roster__team-title">${formerTeam}</div>
          <div class="former-roster__list">${teamItems.map(({ girl, index }) => formerItemHtml(girl, index, season)).join('')}</div>
        </div>`).join('');
    } else {
      body = `<div class="former-roster__list">${items.map(({ girl, index }) => formerItemHtml(girl, index, season)).join('')}</div>`;
    }

    return `
      <section class="former-roster__season">
        <div class="former-roster__season-title"><strong>${title}</strong><span>${items.length} 筆</span></div>
        ${body}
      </section>`;
  }).join('');

  panel.innerHTML = `
    <summary>
      <span>${allTeams ? '歷屆成員資料庫' : '歷屆成員'}</span>
      <span class="former-roster__hint">${rows.length} 筆離隊紀錄</span>
    </summary>
    <div class="former-roster__body">
      <div class="former-roster__intro">${allTeams
        ? '這裡保留所有歷屆成員，即使目前已沒有任何現役隊伍，仍可開啟女孩個人頁查看過往資料。'
        : `這裡依賽季整理曾效力 ${team} 的離隊成員；目前成員仍以上方女孩名單為準。`}</div>
      ${seasonHtml}
    </div>`;
}

function formerItemHtml(girl, index, season) {
  const name = (girl.nickname || girl.realname || '未命名成員').trim();
  const realname = (girl.realname || '').trim();
  const note = String(girl.note || girl['備註'] || girl.備註 || '').trim();
  const seasonLabel = season === '未註記' ? '已離隊' : `${season} 賽季離隊`;
  const detail = [realname && realname !== name ? realname : '', seasonLabel, note && note !== '已離隊' ? note : ''].filter(Boolean).join(' · ');
  const image = String(girl.img || '').trim();
  const imageUrl = image && window.getCdnUrl ? window.getCdnUrl(image) : image;
  return `<button type="button" class="former-roster__item" data-former-index="${index}">
    <span class="former-roster__photo">${imageUrl ? `<img src="${imageUrl}" alt="${name}" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>
    <span class="former-roster__meta"><strong>${name}</strong><small>${detail}</small></span>
  </button>`;
}

function matchesSharedGirlFilters(girl, state) {
  if (window.CheerGirlsDefaultSort?.isFormer?.(girl) || window.cheerGirlStatus?.isFormer?.(girl)) return false;
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const role = document.getElementById('roleFilter')?.value || 'all';
  const nat = document.getElementById('natFilter')?.value || 'all';
  const zodiac = document.getElementById('zodiacFilter')?.value || 'all';
  if (state.currentSport && state.currentSport !== '全部' && !(girl.sport || '').includes(state.currentSport)) return false;
  if (search && !(girl.nickname || '').toLowerCase().includes(search) && !(girl.realname || '').toLowerCase().includes(search)) return false;
  const nStr = girl.nat || '';
  if (nat === '臺灣' && !(nStr.includes('臺') || nStr.includes('台'))) return false;
  if (nat === '其他' && (nStr.includes('臺灣') || nStr.includes('台灣') || nStr.includes('韓國') || nStr.includes('日本'))) return false;
  if (!['all', '臺灣', '其他'].includes(nat) && !nStr.includes(nat)) return false;
  const cz = (girl.zodiac || '').trim().replace('魔羯', '摩羯').replace('白羊', '牡羊');
  if (zodiac !== 'all' && cz !== zodiac) return false;
  if (role !== 'all') {
    const note = (girl.note || girl['備註'] || girl.備註 || '').trim();
    const clean = note.replace(/(合作夥伴|合作)/g, '').replace(/^[,\s、，]+|[,\s、，]+$/g, '').trim();
    const special = clean !== '' && !clean.includes('練習生') && !clean.includes('培訓生');
    if (role === 'cheerleader' && special) return false;
    if (role === 'special' && !special) return false;
  }
  return true;
}

function activeTeamOptions() {
  const girls = Array.isArray(window.dbGirls) ? window.dbGirls : [];
  const favs = favoritesOnly ? favoriteIds() : null;
  const byKey = new Map();

  girls.forEach(girl => {
    if (isHistoricalTeamName(girl?.team)) return;
    if (window.CheerGirlsDefaultSort?.isFormer?.(girl) || window.cheerGirlStatus?.isFormer?.(girl) || girl?.__isFormer) return;

    const team = String(girl?.team || '').trim();
    const sport = String(girl?.sport || '').trim();
    if (!team || !sport) return;

    const uid = girl.uid || `${(girl.realname || '').trim()}|${(girl.nickname || '').trim()}`;
    if (favs && !favs.has(uid)) return;

    const key = `${sport}\u0000${team}`;
    if (!byKey.has(key)) byKey.set(key, { team, sport, ids: new Set() });
    byKey.get(key).ids.add(uid);
  });

  const order = new Map(['棒球','籃球','排球','其他'].map((sport, index) => [sport,index]));
  return [...byKey.values()]
    .map(item => ({ team:item.team, sport:item.sport, count:item.ids.size }))
    .sort((a,b)=>(order.get(a.sport) ?? 99)-(order.get(b.sport) ?? 99)
      || a.team.localeCompare(b.team,'zh-Hant'));
}

function teamCounts(state) {
  const counts = new Map();
  activeTeamOptions()
    .filter(item => !state.currentSport || state.currentSport === '全部' || item.sport.includes(state.currentSport))
    .forEach(item => counts.set(item.team, (counts.get(item.team) || 0) + item.count));
  return counts;
}

function openSheet(type) {
  if (!isMobile() || !onGirlsRoute()) return;
  const sheet = document.getElementById('girls-filter-sheet');
  const title = sheet.querySelector('.girls-filter-sheet__title');
  const search = sheet.querySelector('.girls-filter-sheet__search');
  const list = sheet.querySelector('.girls-filter-sheet__list');
  const state = legacyState();
  title.textContent = type === 'sport' ? '選擇球種' : '選擇隊伍';
  search.hidden = type === 'sport';
  search.value = '';

  const render = () => {
    const q = search.value.trim().toLowerCase();
    if (type === 'sport') {
      list.innerHTML = SPORTS.map(s => `<button class="girls-filter-option ${state.currentSport === s ? 'active' : ''}" data-sport="${s}"><span>${SPORT_LABEL[s]}</span></button>`).join('');
      return;
    }
    const options = activeTeamOptions()
      .filter(item => !q || item.team.toLowerCase().includes(q) || item.sport.toLowerCase().includes(q));
    const currentSport = state.currentSport || '全部';
    const resetActive = state.currentTeam === '全部啦啦隊';
    list.innerHTML = `
      <button class="girls-filter-option ${resetActive ? 'active' : ''}" data-team="全部啦啦隊" data-team-sport="${currentSport}">
        <span>全部啦啦隊</span><small>${currentSport === '全部' ? '全部球種' : currentSport}</small>
      </button>
      ${options.map(item => `<button class="girls-filter-option ${state.currentTeam === item.team && state.currentSport === item.sport ? 'active' : ''}" data-team="${item.team}" data-team-sport="${item.sport}">
        <span>${item.team}</span><small>${item.sport} · ${item.count} 位</small>
      </button>`).join('')}
    ` || '<div style="padding:24px;text-align:center;color:#888">找不到隊伍</div>';
  };
  render();
  search.oninput = render;
  list.onclick = event => {
    const sport = event.target.closest('[data-sport]');
    const team = event.target.closest('[data-team]');
    if (sport) {
      const legacyBtn = [...document.querySelectorAll('#sub-nav-sports .sub-btn')].find(b => b.textContent.includes(sport.dataset.sport));
      window.setSport?.(sport.dataset.sport, legacyBtn || null);
      closeSheet(); setTimeout(syncUI, 0);
    } else if (team) {
      chooseTeam(team.dataset.team, team.dataset.teamSport || ''); closeSheet();
    }
  };
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  sheetOwnsScrollLock = !document.body.classList.contains('no-scroll');
  document.body.classList.add('no-scroll');
}

function closeSheet() {
  const sheet = document.getElementById('girls-filter-sheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  if (sheetOwnsScrollLock) document.body.classList.remove('no-scroll');
  sheetOwnsScrollLock = false;
}

function updateMeta() {
  const meta = document.getElementById('girls-mobile-filter-count');
  if (!meta) return;
  if (!isMobile() || !onGirlsRoute()) { meta.textContent = ''; return; }
  const shown = visibleCards().length;
  meta.textContent = favoritesOnly ? `目前顯示 ${shown} 位收藏女孩` : `目前顯示 ${shown} 位女孩`;
}

function leaveMobileMode() {
  if (!favoritesOnly) { restoreDisplayLimit({ rerender: true }); return; }
  favoritesOnly = false;
  clearMobileHiddenCards();
  restoreDisplayLimit({ rerender: true });
}

function syncUI() {
  const bar = document.getElementById('girls-mobile-filterbar');
  if (!bar) return;
  if (!onGirlsRoute()) {
    closeSheet();
    clearMobileHiddenCards();
    const former = document.getElementById('former-roster');
    if (former) {
      former.hidden = true;
      former.open = false;
    }
    if (savedDisplayLimit != null) restoreDisplayLimit({ keepBaseline: favoritesOnly });
    return;
  }
  if (!isMobile()) {
    closeSheet();
    leaveMobileMode();
    renderFormerRoster();
    return;
  }
  const state = legacyState();
  const sportSelect = bar.querySelector('#girls-mobile-sport-select');
  const teamSelect = bar.querySelector('#girls-mobile-team-select');
  const fav = bar.querySelector('[data-favorites]');

  if (sportSelect) {
    sportSelect.value = state.currentSport || '全部';
  }

  if (teamSelect) {
    const options = activeTeamOptions();
    const currentKey = state.currentTeam && state.currentTeam !== '全部啦啦隊'
      ? `${state.currentSport || ''}\u0000${state.currentTeam}`
      : '';
    const previousKey = teamSelect.value;

    teamSelect.innerHTML = '<option value="">全部現役隊伍</option>' + options.map(item => {
      const key = `${item.sport}\u0000${item.team}`;
      return `<option value="${key}">${item.team}</option>`;
    }).join('');

    if (currentKey && [...teamSelect.options].some(option => option.value === currentKey)) {
      teamSelect.value = currentKey;
    } else if (!currentKey) {
      teamSelect.value = '';
    } else if ([...teamSelect.options].some(option => option.value === previousKey)) {
      teamSelect.value = previousKey;
    }
  }

  fav.classList.toggle('active', favoritesOnly);
  applyFavorites();
  renderFormerRoster();
}

function toggleFavorites() {
  favoritesOnly = !favoritesOnly;
  if (favoritesOnly) {
    if (savedDisplayLimit == null) savedDisplayLimit = window.currentDisplayLimit || 24;
    window.currentDisplayLimit = 9999;
    window.renderContent?.(true);
  } else {
    clearMobileHiddenCards();
    restoreDisplayLimit({ rerender: true });
  }
  setTimeout(syncUI, 0);
}

function clearFilters() {
  favoritesOnly = false;
  clearMobileHiddenCards();
  restoreDisplayLimit();
  const btn = [...document.querySelectorAll('#sub-nav-sports .sub-btn')].find(b => b.textContent.includes('全部'));
  window.setSport?.('全部', btn || null);
  const search = document.getElementById('searchInput');
  if (search) {
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  }
  setTimeout(syncUI, 0);
}

function ensureUI() {
  const grid = document.getElementById('grid-container');
  if (!grid || document.getElementById('girls-mobile-filterbar')) return;
  const bar = document.createElement('section');
  bar.id = 'girls-mobile-filterbar';
  bar.className = 'girls-mobile-filterbar';
  bar.innerHTML = `
    <div class="girls-mobile-filterbar__selectors">
      <label class="girls-mobile-select">
        <span>隊伍</span>
        <select id="girls-mobile-team-select" aria-label="依隊伍篩選女孩">
          <option value="">全部現役隊伍</option>
        </select>
      </label>
      <div class="girls-mobile-select-row">
        <label class="girls-mobile-select">
          <span>球種</span>
          <select id="girls-mobile-sport-select" aria-label="依球種篩選女孩">
            ${SPORTS.map(s => `<option value="${s}">${SPORT_LABEL[s]}</option>`).join('')}
          </select>
        </label>
        <button class="girls-filter-chip" data-favorites type="button" aria-label="只顯示我的最愛">♥ 收藏</button>
      </div>
    </div>
    <div class="girls-mobile-filterbar__meta"><span id="girls-mobile-filter-count">目前顯示 0 位女孩</span><button class="girls-filter-clear" data-clear type="button">清除篩選</button></div>`;
  grid.parentNode.insertBefore(bar, grid);

  const teamSelect = bar.querySelector('#girls-mobile-team-select');
  const sportSelect = bar.querySelector('#girls-mobile-sport-select');

  teamSelect?.addEventListener('change', () => {
    if (!teamSelect.value) {
      const state = legacyState();
      chooseTeam('全部啦啦隊', state.currentSport || '全部');
      return;
    }
    const [sport, team] = teamSelect.value.split('\u0000');
    chooseTeam(team, sport);
  });

  sportSelect?.addEventListener('change', () => {
    const sport = sportSelect.value || '全部';
    const legacyBtn = [...document.querySelectorAll('#sub-nav-sports .sub-btn')]
      .find(btn => sport === '全部' ? btn.textContent.includes('全部') : btn.textContent.includes(sport));
    window.setSport?.(sport, legacyBtn || null);
    requestAnimationFrame(syncUI);
  });

  bar.onclick = event => {
    if (event.target.closest('[data-favorites]')) return toggleFavorites();
    if (event.target.closest('[data-clear]')) return clearFilters();
  };

  const sheet = document.createElement('div');
  sheet.id = 'girls-filter-sheet';
  sheet.className = 'girls-filter-sheet';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = `<div class="girls-filter-sheet__panel" role="dialog" aria-modal="true"><div class="girls-filter-sheet__handle"></div><h2 class="girls-filter-sheet__title"></h2><input class="girls-filter-sheet__search" type="search" placeholder="搜尋隊伍…" autocomplete="off"><div class="girls-filter-sheet__list"></div></div>`;
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  document.body.append(sheet);

  observer = new MutationObserver(() => { if (onGirlsRoute()) syncUI(); });
  observer.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  routeObserver = new MutationObserver(syncUI);
  routeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-app-mode'] });
  formerRosterObserver = new MutationObserver(() => { if (onGirlsRoute()) renderFormerRoster(); });
  formerRosterObserver.observe(grid, { childList: true, subtree: false });
  syncUI();
}

window.CheerGirlsMobileFilters = Object.freeze({ beforeRouteSnapshot });
window.addEventListener('popstate', () => beforeRouteSnapshot(document.body.dataset.appMode));
document.addEventListener('click', event => {
  if (event.target.closest?.('[data-mode],[data-hub-mode]')) beforeRouteSnapshot(document.body.dataset.appMode);
}, true);
function bootMobileGirlsFilters() {
  installStyles();
  ensureUI();
  syncUI();

  matchMedia(`(max-width: ${MOBILE_MAX}px)`).addEventListener?.('change', () => {
    ensureUI();
    syncUI();
  });

  let attempts = 0;
  const retry = setInterval(() => {
    attempts += 1;
    ensureUI();
    if (document.getElementById('girls-mobile-filterbar') || attempts >= 24) {
      clearInterval(retry);
      syncUI();
    }
  }, 250);

  setTimeout(() => {
    const routedSetMode = window.setMode;
    if (typeof routedSetMode === 'function' && !routedSetMode.__girlsMobileWrapped) {
      const wrapped = (mode, ...args) => {
        if (mode !== document.body.dataset.appMode) beforeRouteSnapshot(document.body.dataset.appMode);
        const result = routedSetMode(mode, ...args);
        requestAnimationFrame(() => {
          ensureUI();
          syncUI();
        });
        return result;
      };
      wrapped.__girlsMobileWrapped = true;
      window.setMode = wrapped;
    }
  }, 0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootMobileGirlsFilters, { once:true });
} else {
  bootMobileGirlsFilters();
}

window.addEventListener('load', () => {
  ensureUI();
  syncUI();
}, { once:true });
