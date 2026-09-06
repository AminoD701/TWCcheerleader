const MOBILE_MAX = 767;
const SPORTS = ['全部', '棒球', '籃球', '排球', '其他'];
const SPORT_LABEL = { '全部': '全部球種', '棒球': '棒球', '籃球': '籃球', '排球': '排球', '其他': '其他' };
let favoritesOnly = false;
let observer;
let routeObserver;
let savedDisplayLimit = null;
let sheetOwnsScrollLock = false;
let favoritesRenderInFlight = false;

function isMobile() { return matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches; }
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
    @media (max-width:767px){
      body[data-app-mode="girls"] #sub-nav-sports,body[data-app-mode="girls"] #team-dropdown-wrapper{display:none!important}
      body[data-app-mode="girls"] .girls-mobile-filterbar{display:block;position:sticky;top:0;z-index:90;margin:0 -2px 12px;padding:10px 2px 8px;background:linear-gradient(180deg,rgba(10,12,16,.98),rgba(10,12,16,.92));backdrop-filter:blur(12px)}
      .girls-mobile-filterbar__row{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:0 2px}.girls-mobile-filterbar__row::-webkit-scrollbar{display:none}
      .girls-filter-chip{min-height:48px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:#151920;color:#fff;font-weight:900;white-space:nowrap;font-size:14px}
      .girls-filter-chip.active{border-color:var(--accent,#ff4757);box-shadow:0 0 0 1px var(--accent,#ff4757) inset}
      .girls-mobile-filterbar__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 4px 0;font-size:12px;color:var(--text-sub,#97a0ad);font-weight:800}
      .girls-filter-clear{min-height:48px;border:0;background:transparent;color:#fff;text-decoration:underline;font-weight:900;padding:0 8px}
      .girls-filter-sheet{position:fixed;inset:0;z-index:240;background:rgba(0,0,0,.56);align-items:flex-end}
      .girls-filter-sheet.open{display:flex}
      .girls-filter-sheet__panel{width:100%;max-height:min(72vh,620px);overflow:auto;background:#11151b;border-radius:22px 22px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -16px 50px rgba(0,0,0,.5)}
      .girls-filter-sheet__handle{width:44px;height:5px;border-radius:999px;background:#59616d;margin:2px auto 12px}
      .girls-filter-sheet__title{font-size:18px;font-weight:950;margin:0 0 12px}.girls-filter-sheet__search{width:100%;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0b0e12;color:#fff;padding:0 14px;font-size:16px;margin-bottom:10px;box-sizing:border-box}
      .girls-filter-sheet__list{display:grid;gap:8px}.girls-filter-option{min-height:50px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#171c23;color:#fff;padding:0 14px;text-align:left;font-weight:900;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .girls-filter-option.active{border-color:var(--accent,#ff4757)}
      .girls-filter-option small{color:var(--text-sub,#97a0ad);font-size:12px}
      body.keyboard-open .girls-mobile-filterbar{position:static}
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

function restoreDisplayLimit({ rerender = false } = {}) {
  if (savedDisplayLimit == null) return;
  const next = savedDisplayLimit;
  savedDisplayLimit = null;
  if (window.currentDisplayLimit !== next) {
    window.currentDisplayLimit = next;
    if (rerender && onGirlsRoute()) window.renderContent?.(true);
  }
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
    restoreDisplayLimit();
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

function teamButtons() { return [...document.querySelectorAll('#team-menu .dropdown-item')].filter(btn => !btn.disabled); }
function teamName(btn) { return (btn.querySelector('span')?.textContent || btn.textContent || '').trim(); }
function chooseTeam(name) {
  const btn = teamButtons().find(b => teamName(b) === name || (name === '全部啦啦隊' && teamName(b).includes('全部')));
  if (btn) btn.click();
  setTimeout(syncUI, 0);
}

function teamCounts() {
  const counts = new Map();
  allCards().forEach(card => {
    const names = [...card.querySelectorAll('.team-tag-mini')].map(el => el.textContent.trim()).filter(Boolean);
    new Set(names).forEach(name => counts.set(name, (counts.get(name) || 0) + 1));
  });
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
  search.hidden = type === 'sport' || state.currentSport === '全部';
  search.value = '';

  const render = () => {
    const q = search.value.trim().toLowerCase();
    if (type === 'sport') {
      list.innerHTML = SPORTS.map(s => `<button class="girls-filter-option ${state.currentSport === s ? 'active' : ''}" data-sport="${s}"><span>${SPORT_LABEL[s]}</span></button>`).join('');
      return;
    }
    if (!state.currentSport || state.currentSport === '全部') {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:#aaa;line-height:1.7">請先選擇球種，再挑選該球種的隊伍。</div>';
      return;
    }
    const counts = teamCounts();
    const names = ['全部啦啦隊', ...teamButtons().map(teamName).filter(n => n && !n.includes('全部'))];
    list.innerHTML = [...new Set(names)]
      .filter(n => !q || n.toLowerCase().includes(q))
      .map(n => `<button class="girls-filter-option ${state.currentTeam === n ? 'active' : ''}" data-team="${n}"><span>${n}</span>${n === '全部啦啦隊' ? '' : `<small>${counts.get(n) || 0} 位</small>`}</button>`)
      .join('') || '<div style="padding:24px;text-align:center;color:#888">找不到隊伍</div>';
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
      chooseTeam(team.dataset.team); closeSheet();
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

function syncUI() {
  const bar = document.getElementById('girls-mobile-filterbar');
  if (!bar) return;
  if (!isMobile() || !onGirlsRoute()) {
    closeSheet();
    clearMobileHiddenCards();
    restoreDisplayLimit();
    return;
  }
  const state = legacyState();
  const sport = bar.querySelector('[data-open="sport"]');
  const team = bar.querySelector('[data-open="team"]');
  const fav = bar.querySelector('[data-favorites]');
  sport.textContent = `球種：${SPORT_LABEL[state.currentSport] || state.currentSport || '全部球種'}`;
  team.textContent = state.currentSport === '全部' ? '隊伍：先選球種' : `隊伍：${state.currentTeam || '全部啦啦隊'}`;
  sport.classList.toggle('active', state.currentSport && state.currentSport !== '全部');
  team.classList.toggle('active', state.currentTeam && state.currentTeam !== '全部啦啦隊');
  fav.classList.toggle('active', favoritesOnly);
  applyFavorites();
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
  bar.innerHTML = `<div class="girls-mobile-filterbar__row"><button class="girls-filter-chip" data-open="sport">球種：全部球種</button><button class="girls-filter-chip" data-open="team">隊伍：先選球種</button><button class="girls-filter-chip" data-favorites>♥ 我的最愛</button></div><div class="girls-mobile-filterbar__meta"><span id="girls-mobile-filter-count">目前顯示 0 位女孩</span><button class="girls-filter-clear" data-clear>清除篩選</button></div>`;
  grid.parentNode.insertBefore(bar, grid);
  bar.onclick = event => {
    const open = event.target.closest('[data-open]');
    if (open) return openSheet(open.dataset.open);
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
  syncUI();
}

window.addEventListener('DOMContentLoaded', () => {
  installStyles();
  ensureUI();
  matchMedia(`(max-width: ${MOBILE_MAX}px)`).addEventListener?.('change', syncUI);
});
