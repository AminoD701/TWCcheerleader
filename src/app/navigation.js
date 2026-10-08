import { NAV_ITEMS, parentForMode } from './navigation-config.js';
import './girls-mobile-filters.js?v=9';

const stateByMode = new Map();
const safeSession = {
  get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch (_) { /* navigation still works */ } }
};
let currentMode = new URL(location.href).searchParams.get('mode') || safeSession.get('cheer_current_tab') || 'home';
let keyboardOpen = false;
let legacySetMode;
let legacySelectScheduleTeam;
let legacyBackToScheduleSelection;
let legacyOpenProfile;
let legacyCloseProfile;
let legacyRenderTeamThemesHub;
let scheduleSelection = null;
let themeSelection = null;
let profileReturnState = null;

const ROUTE_OWNERS = Object.freeze({
  'home-container': ['home'],
  'grid-container': ['girls'],
  'event-container': ['events'],
  'schedule-container': ['schedule'],
  'news-container': ['news','themes'],
  'matches-container': ['matches'],
  'games-container': ['games'],
  'passport-container': ['passport'],
  'minigame-container': ['minigame'],
  'dreamteam-container': ['dreamteam'],
  'agency-container': ['agency'],
  'feedback-container': ['feedback'],
  'vote-container': ['vote'],
  'allstar-container': ['allstar'],
  'archive-container': ['archive'],
  'datalab-container': ['datalab'],
  'navigation-hub': ['my','more']
});

function modeOwnsContainer(mode, id) {
  return (ROUTE_OWNERS[id] || []).includes(mode);
}

function enforceRouteIsolation(mode = document.body?.dataset.appMode || currentMode) {
  Object.keys(ROUTE_OWNERS).forEach(id => {
    const el = document.getElementById(id);
    if (!el || modeOwnsContainer(mode, id)) return;
    if (el.style.display !== 'none') el.style.display = 'none';
  });
}

function installRouteIsolationObserver() {
  if (document.body?.dataset.routeIsolationInstalled === '1') return;
  document.body.dataset.routeIsolationInstalled = '1';

  const observer = new MutationObserver(mutations => {
    const mode = document.body?.dataset.appMode || currentMode;
    for (const mutation of mutations) {
      const target = mutation.target;
      if (!(target instanceof HTMLElement) || !ROUTE_OWNERS[target.id]) continue;
      if (!modeOwnsContainer(mode, target.id) && target.style.display !== 'none') {
        target.style.display = 'none';
      }
    }
  });

  Object.keys(ROUTE_OWNERS).forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ['style'] });
  });
}

function link(item) {
  return `<a class="primary-nav__item" data-mode="${item.mode}" href="?mode=${item.mode}" aria-label="${item.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg><span>${item.label}</span></a>`;
}

function renderNavigation() {
  const nav = document.createElement('nav');
  nav.id = 'primary-navigation';
  nav.className = 'primary-nav';
  nav.setAttribute('aria-label', '主要功能');
  nav.innerHTML = NAV_ITEMS.map(link).join('');
  nav.addEventListener('click', event => {
    const anchor = event.target.closest('[data-mode]');
    if (!anchor) return;
    event.preventDefault();
    navigate(anchor.dataset.mode);
  });
  document.body.append(nav);
  const brand = document.querySelector('.site-header-brand');
  if (brand && !brand.dataset.homeBound) {
    brand.dataset.homeBound = '1';
    brand.setAttribute('role','link');
    brand.setAttribute('tabindex','0');
    brand.setAttribute('title','回首頁');
    brand.addEventListener('click', () => navigate('home'));
    brand.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate('home');
      }
    });
  }
  renderSectionSwitcher();
}

function renderSectionSwitcher() {
  const switcher = document.createElement('div');
  switcher.id = 'schedule-section-switcher';
  switcher.className = 'section-switcher';
  switcher.setAttribute('aria-label', '班表類型');
  switcher.innerHTML = '<a href="?mode=schedule" data-mode="schedule">應援班表</a><a href="?mode=matches" data-mode="matches">比賽賽程</a>';
  switcher.addEventListener('click', event => {
    const anchor = event.target.closest('[data-mode]');
    if (!anchor) return;
    event.preventDefault();
    navigate(anchor.dataset.mode);
  });
  document.querySelector('#main-content').prepend(switcher);
}

function ensureHub() {
  let hub = document.querySelector('#navigation-hub');
  if (!hub) {
    hub = document.createElement('section');
    hub.id = 'navigation-hub';
    hub.className = 'navigation-hub';
    document.querySelector('#main-content').append(hub);
  }
  return hub;
}

function moreEntryHtml(entry) {
  if (entry.external) {
    return `<a href="${entry.external}" target="_blank" rel="noopener noreferrer"><strong>${entry.title}</strong>${entry.note ? `<small>${entry.note}</small>` : ''}</a>`;
  }
  if (entry.action) {
    return `<a href="?mode=more" data-hub-action="${entry.action}"><strong>${entry.title}</strong>${entry.note ? `<small>${entry.note}</small>` : ''}</a>`;
  }
  return `<a href="?mode=${entry.target}" data-hub-mode="${entry.target}"><strong>${entry.title}</strong>${entry.note ? `<small>${entry.note}</small>` : ''}</a>`;
}

function showHub(mode) {
  legacySetMode(mode === 'my' ? 'passport' : 'games');
  document.querySelectorAll('#main-content > div:not(#schedule-section-switcher)').forEach(el => { el.style.display = 'none'; });
  const hub = ensureHub();
  const groups = mode === 'my'
    ? [
        {
          label: 'MY SPACE',
          title: '我的收藏與行程',
          entries: [
            { target: 'passport', title: '追星護照', note: '收藏、個人行程與本命球隊偏好皆保留在這台裝置。' },
            { target: 'girls', title: '收藏女孩', note: '回到女孩圖鑑查看與管理收藏。' },
            { target: 'events', title: '個人行程', note: '前往公開行程查看已加入的活動。' }
          ]
        }
      ]
    : [
        {
          label: 'DISCOVER',
          title: '資料與情報',
          entries: [
            { target: 'news', title: '最新情報', note: '查看近期啦啦隊新聞與網站整理情報。' },
            { target: 'archive', title: '歷屆成員', note: '依離隊賽季回顧歷屆女孩。' },
            { target: 'datalab', title: '生態數據', note: '查看聯盟、國籍、身高與星座分布。' },
            { target: 'themes', title: '主題日', note: '查看球隊主題日與特殊活動。' },
            { target: 'agency', title: '經紀資訊', note: '整理女孩與經紀公司的公開資訊。' }
          ]
        },
        {
          label: 'PLAY',
          title: '互動玩法',
          entries: [
            { target: 'games', title: '遊戲中心', note: '進入網站互動玩法。' },
            { action: 'gacha-history', title: '今日一抽紀錄', note: '查看每天抽到的幸運女孩。' },
            { target: 'vote', title: '應援投票', note: '參加網站期間限定應援活動。' }
          ]
        },
        {
          label: 'SITE',
          title: '網站工具',
          entries: [
            { target: 'feedback', title: '意見回饋', note: '回報資料問題或提出功能建議。' },
            { external: 'https://dinosaur071.bobaboba.me', title: '請我喝珍奶', note: '支持網站持續整理與維護。' }
          ]
        }
      ];
  hub.innerHTML = `
    <div class="navigation-hub__hero">
      <span>${mode === 'my' ? 'PERSONAL' : 'EXPLORE'}</span>
      <h1>${mode === 'my' ? '我的' : '更多功能'}</h1>
      <p>${mode === 'my' ? '收藏、行程與個人偏好集中在這裡。' : '把比較少用、但值得保留的功能整理成清楚分類。'}</p>
    </div>
    <div class="navigation-hub__sections">
      ${groups.map(group => `
        <section class="navigation-hub__section">
          <div class="navigation-hub__section-head"><span>${group.label}</span><strong>${group.title}</strong></div>
          <div class="navigation-hub__grid">${group.entries.map(moreEntryHtml).join('')}</div>
        </section>
      `).join('')}
    </div>`;
  hub.style.display = 'block';
  hub.onclick = event => {
    const action = event.target.closest('[data-hub-action]');
    if (action) {
      event.preventDefault();
      if (action.dataset.hubAction === 'gacha-history') {
        if (typeof window.showGachaHistory === 'function') window.showGachaHistory();
        else alert('抽卡紀錄功能正在載入，請稍後再試一次。');
      }
      return;
    }
    const a = event.target.closest('[data-hub-mode]');
    if (a) {
      event.preventDefault();
      navigate(a.dataset.hubMode);
    }
  };
}

function hideCustomPanels(exceptMode = '') {
  const archive = document.getElementById('archive-container');
  const datalab = document.getElementById('datalab-container');
  if (archive && exceptMode !== 'archive') archive.style.display = 'none';
  if (datalab && exceptMode !== 'datalab') datalab.style.display = 'none';
}

function showCustomMode(mode) {
  hideCustomPanels(mode);
  document.querySelectorAll('#main-content > div:not(#schedule-section-switcher)').forEach(el => { el.style.display = 'none'; });
  document.querySelectorAll('#main-content > section').forEach(el => { el.style.display = 'none'; });

  const panelId = mode === 'home' ? 'home-container' : mode === 'archive' ? 'archive-container' : 'datalab-container';
  let panel = document.getElementById(panelId);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = panelId;
    document.getElementById('main-content')?.appendChild(panel);
  }
  panel.style.display = 'block';

  if (mode === 'home') {
    panel.innerHTML ||= '<div style="padding:40px;text-align:center;color:#94a3b8">首頁資料載入中…</div>';
    window.renderHomeOverview?.();
  } else if (mode === 'archive') {
    panel.innerHTML ||= '<div style="padding:40px;text-align:center;color:#94a3b8">歷屆成員資料載入中…</div>';
    window.renderFormerArchive?.();
  } else if (mode === 'datalab') {
    panel.innerHTML ||= '<div style="padding:40px;text-align:center;color:#94a3b8">生態數據載入中…</div>';
    window.renderDataLab?.();
  }
}

function restoreModeState(mode) {
  const saved = stateByMode.get(mode);
  if (!saved) return saved;
  if (mode === 'my' || mode === 'more') return saved;

  if (saved.legacy && window.CheerLegacyState?.restore) {
    window.CheerLegacyState.restore(saved.legacy);
  }

  const restored = new Set();
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const key = el.id || el.name;
    if (!key || !Object.hasOwn(saved.controls, key)) return;
    el.value = saved.controls[key];
    restored.add(el);
  });
  Object.entries(saved.controls).forEach(([key, value]) => {
    const el = document.querySelector(`#${key}`);
    if (el && 'value' in el) {
      el.value = value;
      restored.add(el);
    }
  });

  restored.forEach(el => {
    if (typeof el.dispatchEvent !== 'function') return;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    if (el.tagName !== 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  if (!window.CheerLegacyState?.restore && mode === 'schedule' && saved.legacy?.scheduleSelection && legacySelectScheduleTeam) {
    const { team, sport } = saved.legacy.scheduleSelection;
    scheduleSelection = { team, sport };
    legacySelectScheduleTeam(team, sport);
  } else if (mode === 'matches' && saved.legacy?.currentMatchLeague && saved.legacy.currentMatchLeague !== '全部' && typeof window.renderMatchCalendar === 'function') {
    window.renderMatchCalendar(true);
  } else if (mode === 'themes' && saved.legacy?.themeSelection && legacyRenderTeamThemesHub) {
    themeSelection = saved.legacy.themeSelection;
    legacyRenderTeamThemesHub(themeSelection);
  } else if (window.CheerLegacyState?.restore && typeof window.renderContent === 'function') {
    window.renderContent(true);
  }
  return saved;
}

function restoreSavedScroll(saved) {
  const y = saved?.scroll || 0;
  requestAnimationFrame(() => {
    if (Math.abs((globalThis.scrollY || 0) - y) > 2) scrollTo(0, y);
  });
}

function applyMode(mode) {
  currentMode = mode;
  document.body.dataset.appMode = mode;
  const eventContainer = document.getElementById('event-container');
  if (eventContainer && mode !== 'events') eventContainer.style.display = 'none';
  hideCustomPanels(mode);
  const urlBeforeLegacy = new URL(location.href);
  const hub = document.querySelector('#navigation-hub');
  if (hub) { hub.hidden = mode !== 'my' && mode !== 'more'; hub.style.display = hub.hidden ? 'none' : 'block'; }
  if (mode === 'my' || mode === 'more') showHub(mode);
  else if (mode === 'home' || mode === 'archive' || mode === 'datalab') showCustomMode(mode);
  else legacySetMode(mode);
  enforceRouteIsolation(mode);
  if (mode === 'events') {
    requestAnimationFrame(() => {
      if (document.body?.dataset.appMode === 'events' && typeof window.renderEvents === 'function') window.renderEvents();
    });
  }
  const canonical = new URL(urlBeforeLegacy);
  canonical.searchParams.set('mode', mode);
  window.history.replaceState({ mode }, '', canonical);
  safeSession.set('cheer_current_tab', mode);
  const switcher = document.querySelector('#schedule-section-switcher');
  if (switcher) switcher.hidden = !['schedule', 'matches'].includes(mode);
  document.querySelectorAll('[data-mode]').forEach(el => {
    const active = el.closest('.primary-nav') ? (mode !== 'home' && el.dataset.mode === parentForMode(mode)) : el.dataset.mode === mode;
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute?.('aria-current');
  });
  const saved = restoreModeState(mode);
  restoreSavedScroll(saved);
}

function rememberMode(mode) {
  const controls = {};
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const key = el.id || el.name;
    if (key) controls[key] = el.value;
  });
  ['searchInput', 'team-filter', 'sport-filter', 'news-category-filter'].forEach(key => {
    const el = document.querySelector(`#${key}`);
    if (el && 'value' in el) controls[key] = el.value;
  });

  let legacy = {};
  if (window.CheerLegacyState?.snapshot) {
    try { legacy = window.CheerLegacyState.snapshot() || {}; } catch (_) { legacy = {}; }
  } else if (mode === 'schedule' && scheduleSelection) {
    legacy = { scheduleSelection: { ...scheduleSelection } };
  }
  if (mode === 'themes' && themeSelection) legacy.themeSelection = themeSelection;
  stateByMode.set(mode, { scroll: globalThis.scrollY || 0, controls, legacy });
}

function navigate(mode, { history = true } = {}) {
  if (mode === currentMode) {
    rememberMode(mode);

    // Interactive game pages keep their in-progress DOM/state when background
    // data initialization calls setMode(currentMode) again.
    if (mode === 'minigame' || mode === 'dreamteam') {
      const root = document.getElementById(mode === 'minigame' ? 'minigame-container' : 'dreamteam-container');
      if (root && root.childElementCount > 0 && root.textContent.trim()) return;
    }

    applyMode(mode);
    return;
  }
  rememberMode(currentMode);
  const url = new URL(location.href);
  url.searchParams.set('mode', mode);
  if (history) window.history.pushState({ mode }, '', url);
  applyMode(mode);
}

window.addEventListener('popstate', () => {
  const nextMode = new URL(location.href).searchParams.get('mode') || 'home';
  if (nextMode !== currentMode) rememberMode(currentMode);
  applyMode(nextMode);
});

function updateKeyboardState() {
  if (!window.visualViewport) return;
  keyboardOpen = innerHeight - visualViewport.height > 180;
  document.body.classList.toggle('keyboard-open', keyboardOpen);
}

window.addEventListener('DOMContentLoaded', () => {
  legacySetMode = window.setMode;
  legacySelectScheduleTeam = window.selectScheduleTeam;
  legacyBackToScheduleSelection = window.backToScheduleSelection;
  legacyOpenProfile = window.openProfile;
  legacyCloseProfile = window.closeProfile;
  legacyRenderTeamThemesHub = window.renderTeamThemesHub;

  document.querySelector('.floating-boba-btn')?.remove();

  if (legacySelectScheduleTeam) {
    window.selectScheduleTeam = (team, sport) => {
      scheduleSelection = { team, sport };
      return legacySelectScheduleTeam(team, sport);
    };
  }
  if (legacyBackToScheduleSelection) {
    window.backToScheduleSelection = () => {
      scheduleSelection = null;
      return legacyBackToScheduleSelection();
    };
  }
  if (legacyOpenProfile) {
    window.openProfile = (...args) => {
      rememberMode(currentMode);
      profileReturnState = { mode: currentMode, scroll: stateByMode.get(currentMode)?.scroll ?? (globalThis.scrollY || 0) };
      return legacyOpenProfile(...args);
    };
  }
  if (legacyCloseProfile) {
    window.closeProfile = (...args) => {
      const result = legacyCloseProfile(...args);
      if (profileReturnState) {
        const saved = stateByMode.get(profileReturnState.mode);
        if (saved) saved.scroll = profileReturnState.scroll;
        restoreSavedScroll(saved || profileReturnState);
        profileReturnState = null;
      }
      return result;
    };
  }
  if (legacyRenderTeamThemesHub) {
    window.renderTeamThemesHub = selectedTeam => {
      themeSelection = selectedTeam || null;
      return legacyRenderTeamThemesHub(selectedTeam);
    };
  }

  window.setMode = mode => navigate(mode);
  window.visualViewport?.addEventListener('resize', updateKeyboardState);
  renderNavigation();
  installRouteIsolationObserver();
  applyMode(currentMode);
});