import { NAV_ITEMS, parentForMode } from './navigation-config.js';

const stateByMode = new Map();
const safeSession = {
  get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch (_) { /* navigation still works */ } }
};
let currentMode = new URL(location.href).searchParams.get('mode') || safeSession.get('cheer_current_tab') || 'news';
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

function showHub(mode) {
  legacySetMode(mode === 'my' ? 'passport' : 'games');
  document.querySelectorAll('#main-content > div:not(#schedule-section-switcher)').forEach(el => { el.style.display = 'none'; });
  const hub = ensureHub();
  const entries = mode === 'my'
    ? [['passport', '追星護照', '收藏、個人行程與本命球隊偏好皆保留在這台裝置。'], ['girls', '收藏女孩', '前往女孩圖鑑管理收藏。'], ['events', '個人行程', '前往公開行程加入或移除個人行程。']]
    : [['news', '最新消息'], ['games', '遊戲與夢幻隊伍'], ['vote', '應援投票'], ['themes', '主題日'], ['agency', '經紀資訊'], ['feedback', '意見回饋']];
  hub.innerHTML = `<h1>${mode === 'my' ? '我的' : '更多功能'}</h1><div class="navigation-hub__grid">${entries.map(([target, title, note]) => `<a href="?mode=${target}" data-hub-mode="${target}"><strong>${title}</strong>${note ? `<small>${note}</small>` : ''}</a>`).join('')}</div>`;
  hub.style.display = 'block';
  hub.onclick = event => { const a = event.target.closest('[data-hub-mode]'); if (a) { event.preventDefault(); navigate(a.dataset.hubMode); } };
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
  requestAnimationFrame(() => scrollTo(0, y));
  setTimeout(() => scrollTo(0, y), 380);
}

function applyMode(mode) {
  currentMode = mode;
  const urlBeforeLegacy = new URL(location.href);
  const hub = document.querySelector('#navigation-hub');
  if (hub) { hub.hidden = mode !== 'my' && mode !== 'more'; hub.style.display = hub.hidden ? 'none' : 'block'; }
  if (mode === 'my' || mode === 'more') showHub(mode);
  else legacySetMode(mode);
  const canonical = new URL(urlBeforeLegacy);
  canonical.searchParams.set('mode', mode);
  window.history.replaceState({ mode }, '', canonical);
  safeSession.set('cheer_current_tab', mode);
  const switcher = document.querySelector('#schedule-section-switcher');
  if (switcher) switcher.hidden = !['schedule', 'matches'].includes(mode);
  document.querySelectorAll('[data-mode]').forEach(el => {
    const active = el.closest('.primary-nav') ? el.dataset.mode === parentForMode(mode) : el.dataset.mode === mode;
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute?.('aria-current');
  });
  document.body.dataset.appMode = mode;
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
  const nextMode = new URL(location.href).searchParams.get('mode') || 'news';
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
  applyMode(currentMode);
});
