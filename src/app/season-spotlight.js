const MATCH_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/pub?output=csv&gid=92509162';
const POSTSEASON_KEYWORDS = ['季後挑戰賽', '台灣大賽', '總冠軍賽'];
const state = { rows: [], postseason: [], stageRows: [], stage: '', next: null, latestFinal: null };

const normalizeHeader = value => String(value || '').trim().toLowerCase().replace(/[\s_]/g, '');

function parseCsvFallback(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(normalizeHeader);
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()])));
}

function parseDate(value) {
  const parts = String(value || '').trim().split(/[\/-]/).map(Number);
  if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  if (parts.length === 2) {
    const month = parts[0], day = parts[1];
    const now = new Date();
    const year = month >= 10 && now.getMonth() + 1 < 7 ? now.getFullYear() - 1 : now.getFullYear();
    return new Date(year, month - 1, day);
  }
  return null;
}

function matchDateTime(match) {
  const d = parseDate(match.date);
  if (!d) return null;
  const [h, m] = String(match.time || '00:00').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function isFinished(match) {
  return String(match.homescore || '').trim() !== '' && String(match.awayscore || '').trim() !== '';
}

function formatDate(match) {
  const d = parseDate(match.date);
  if (!d) return String(match.date || '');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;
}

function determineStage(postseason) {
  const taiwan = postseason.filter(match => /台灣大賽|總冠軍賽/.test(match.note || ''));
  if (taiwan.length) return { name: '台灣大賽', rows: taiwan };
  const challenge = postseason.filter(match => /季後挑戰賽/.test(match.note || ''));
  return { name: challenge.length ? '季後挑戰賽' : 'CPBL 季後賽', rows: challenge.length ? challenge : postseason };
}

function updateState(rows) {
  state.rows = rows;
  state.postseason = rows.filter(match => match.league === 'CPBL' && POSTSEASON_KEYWORDS.some(keyword => String(match.note || '').includes(keyword)));
  const stage = determineStage(state.postseason);
  state.stage = stage.name;
  state.stageRows = stage.rows.sort((a, b) => (matchDateTime(a)?.getTime() || 0) - (matchDateTime(b)?.getTime() || 0));
  const now = new Date();
  state.next = state.stageRows.find(match => {
    const dt = matchDateTime(match);
    return dt && !isFinished(match) && dt.getTime() >= now.getTime() - 4 * 60 * 60 * 1000;
  }) || null;
  state.latestFinal = [...state.stageRows].reverse().find(isFinished) || null;
}

async function loadRows() {
  const response = await fetch(`${MATCH_SHEET_URL}&t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`postseason sheet HTTP ${response.status}`);
  const text = await response.text();
  if (window.Papa) {
    return new Promise((resolve, reject) => {
      window.Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: normalizeHeader,
        complete: result => resolve(result.data || []),
        error: reject
      });
    });
  }
  return parseCsvFallback(text);
}

function goToPostseason() {
  if (typeof window.setMode === 'function') window.setMode('matches');
  window.setTimeout(() => {
    if (typeof window.showLeagueMatches === 'function') window.showLeagueMatches('CPBL');
  }, 80);
}

function teamsForStage() {
  const ordered = [];
  state.stageRows.forEach(match => {
    [match.awayteam, match.hometeam].forEach(team => {
      if (team && !ordered.includes(team)) ordered.push(team);
    });
  });
  return ordered.slice(0, 2);
}

function stageStatus() {
  if (!state.stageRows.length) return '';
  const now = new Date();
  const first = matchDateTime(state.stageRows[0]);
  const last = matchDateTime(state.stageRows[state.stageRows.length - 1]);
  if (first && now < first) return '即將開打';
  if (last && now.getTime() > last.getTime() + 6 * 60 * 60 * 1000 && state.stageRows.every(isFinished)) return '系列賽結束';
  return '火熱進行中';
}

function renderHero() {
  if (!state.stageRows.length) return;
  if (document.body?.dataset.appMode !== 'home') return;
  const main = document.getElementById('main-content');
  const marquee = main?.querySelector('.marquee-wrapper');
  if (!main || !marquee) return;

  let hero = document.getElementById('season-spotlight');
  if (!hero) {
    hero = document.createElement('section');
    hero.id = 'season-spotlight';
    hero.className = 'season-spotlight';
    marquee.insertAdjacentElement('afterend', hero);
  }

  const teams = teamsForStage();
  const next = state.next;
  const nextLine = next
    ? `下一戰｜${formatDate(next)} ${next.time || ''}｜${next.awayteam} @ ${next.hometeam}`
    : (state.latestFinal ? `最新戰況｜${state.latestFinal.awayteam} ${state.latestFinal.awayscore}：${state.latestFinal.homescore} ${state.latestFinal.hometeam}` : '完整賽程已公布');

  const nextMarkup = `
    <div class="season-spotlight__eyebrow"><span class="season-spotlight__live-dot"></span> 2026 CPBL POSTSEASON</div>
    <div class="season-spotlight__body">
      <div>
        <div class="season-spotlight__stage">${state.stage}</div>
        <div class="season-spotlight__teams">${teams.length >= 2 ? `${teams[0]} <span>VS</span> ${teams[1]}` : '中華職棒季後賽'}</div>
        <div class="season-spotlight__next">${nextLine}</div>
      </div>
      <div class="season-spotlight__actions">
        <span class="season-spotlight__status">${stageStatus()}</span>
        <button type="button" class="season-spotlight__button">查看季後賽賽程 <span>→</span></button>
      </div>
    </div>`;
  if (hero.dataset.renderKey !== nextMarkup) {
    hero.innerHTML = nextMarkup;
    hero.dataset.renderKey = nextMarkup;
  }
  hero.querySelector('button')?.addEventListener('click', goToPostseason);
  hero.addEventListener('click', event => {
    if (!event.target.closest('button')) goToPostseason();
  }, { once: true });
  syncHeroVisibility();
}

function renderMarquee() {
  if (document.body?.dataset.appMode !== 'home') return;
  const wrapper = document.querySelector('.marquee-wrapper');
  const content = wrapper?.querySelector('.marquee-content');
  if (!wrapper || !content) return;
  wrapper.classList.add('spotlight-marquee');
  wrapper.dataset.label = 'POSTSEASON';
  wrapper.title = '查看 CPBL 季後賽賽程';
  wrapper.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    goToPostseason();
  };

  const next = state.next;
  let message;
  if (state.stageRows.length && next) {
    message = `🔥 2026 CPBL POSTSEASON　｜　<strong>${state.stage}</strong>　｜　下一戰 <span class="marquee-highlight">${formatDate(next)} ${next.time || ''}</span>　${next.awayteam} @ ${next.hometeam}　｜　📍 ${next.venue || '場地待定'}　｜　點擊查看完整賽程`;
  } else if (state.stageRows.length && state.latestFinal) {
    message = `🏆 2026 CPBL POSTSEASON　｜　<strong>${state.stage}</strong>　｜　最新戰況 <span class="marquee-highlight">${state.latestFinal.awayteam} ${state.latestFinal.awayscore}：${state.latestFinal.homescore} ${state.latestFinal.hometeam}</span>　｜　點擊查看完整賽程`;
  } else {
    message = '🔥 2026 CPBL POSTSEASON　｜　<strong>季後賽焦點</strong>　｜　台灣大賽與季後賽最新戰況　｜　點擊查看完整賽程';
  }
  if (content.dataset.spotlightMessage !== message) {
    content.innerHTML = message;
    content.dataset.spotlightMessage = message;
  }
}

function decorateLeagueSelection() {
  const container = document.getElementById('matches-container');
  if (!container || !state.stageRows.length) return;
  const candidate = [...container.querySelectorAll('div[onclick]')].find(el => /showLeagueMatches\(['"]CPBL/.test(el.getAttribute('onclick') || ''));
  if (!candidate || candidate.querySelector('.season-league-badge')) return;
  candidate.classList.add('season-league-card');
  const badge = document.createElement('div');
  badge.className = 'season-league-badge';
  badge.textContent = 'POSTSEASON';
  candidate.appendChild(badge);
}

function injectMatchCenterBanner() {
  if (window.currentMatchLeague !== 'CPBL' || !state.stageRows.length) return;
  const container = document.getElementById('matches-container');
  if (!container || container.querySelector('.match-postseason-banner')) return;
  const next = state.next;
  const banner = document.createElement('div');
  banner.className = 'match-postseason-banner';
  banner.innerHTML = `
    <div>
      <span>2026 CPBL POSTSEASON</span>
      <strong>${state.stage} · ${stageStatus()}</strong>
      <small>${next ? `NEXT｜${formatDate(next)} ${next.time || ''}　${next.awayteam} @ ${next.hometeam}` : '查看完整季後賽戰況'}</small>
    </div>
    <div class="match-postseason-banner__mark">PLAY<br>OFFS</div>`;
  container.prepend(banner);

  const selected = Number(window.matchSelectedDateNum || 0);
  if (selected && state.stageRows.some(match => {
    const d = parseDate(match.date);
    return d && Number(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`) === selected;
  })) {
    container.querySelectorAll('.match-card').forEach(card => {
      card.classList.add('is-postseason');
      if (!card.querySelector('.match-postseason-ribbon')) {
        const ribbon = document.createElement('div');
        ribbon.className = 'match-postseason-ribbon';
        ribbon.textContent = state.stage === '台灣大賽' ? 'TAIWAN SERIES' : 'POSTSEASON';
        card.appendChild(ribbon);
      }
    });
  }
}

function wrapRenderer(name, after) {
  const original = window[name];
  if (typeof original !== 'function' || original.__seasonSpotlightWrapped) return;
  const wrapped = function(...args) {
    const result = original.apply(this, args);
    window.requestAnimationFrame(after);
    return result;
  };
  wrapped.__seasonSpotlightWrapped = true;
  window[name] = wrapped;
}

function installHooks() {
  wrapRenderer('renderMatchesSelection', decorateLeagueSelection);
  wrapRenderer('renderMatchCalendar', injectMatchCenterBanner);
  const selection = document.getElementById('matches-container');
  if (selection?.style.display !== 'none') {
    decorateLeagueSelection();
    injectMatchCenterBanner();
  }
}

function syncHeroVisibility() {
  const hero = document.getElementById('season-spotlight');
  const wrapper = document.querySelector('.marquee-wrapper');
  const mode = document.body.dataset.appMode || new URL(location.href).searchParams.get('mode') || 'home';
  if (hero) hero.hidden = mode !== 'home';
  if (wrapper?.classList.contains('spotlight-marquee')) wrapper.hidden = mode !== 'home';
}

function watchNavigation() {
  const observer = new MutationObserver(() => {
    syncHeroVisibility();
    installHooks();
    if (document.body?.dataset.appMode === 'home') renderMarquee();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-app-mode'] });

  const content = document.querySelector('.marquee-wrapper .marquee-content');
  if (content) {
    const contentObserver = new MutationObserver(() => {
      if (document.body?.dataset.appMode !== 'home') return;
      const text = (content.textContent || '').trim();
      if (!/CPBL|POSTSEASON|季後賽|台灣大賽/.test(text)) requestAnimationFrame(renderMarquee);
    });
    contentObserver.observe(content, { childList: true, subtree: true, characterData: true });
  }
}

async function boot() {
  watchNavigation();
  renderMarquee();
  try {
    const rows = await loadRows();
    updateState(rows);
    renderMarquee();
    if (!state.stageRows.length) return;
    renderHero();
    installHooks();
    window.setInterval(async () => {
      try {
        updateState(await loadRows());
        renderMarquee();
        renderHero();
        installHooks();
      } catch (error) {
        console.warn('Season Spotlight refresh failed.', error);
      }
    }, 15 * 60 * 1000);
  } catch (error) {
    console.warn('Season Spotlight unavailable.', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
