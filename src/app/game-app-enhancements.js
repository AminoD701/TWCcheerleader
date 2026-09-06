(() => {
  const DAILY_KEY = 'twc_daily_gacha_result_v1';
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const todayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  const readDaily = () => {
    try { return JSON.parse(localStorage.getItem(DAILY_KEY) || 'null'); }
    catch { return null; }
  };

  const saveDaily = value => localStorage.setItem(DAILY_KEY, JSON.stringify(value));

  const usableGirls = () => (Array.isArray(window.dbGirls) ? window.dbGirls : []).filter(girl => {
    const name = (girl?.realname || girl?.nickname || '').trim();
    return name && !/^(未知|無|-)$/.test(name);
  });

  const pickDailyGirl = () => {
    const girls = usableGirls();
    if (!girls.length) return null;
    // Deterministic per device/day so reloads can never reroll the result.
    const seedText = `${todayKey()}|${localStorage.getItem('cheer_home_team') || ''}|${navigator.language || ''}`;
    let hash = 2166136261;
    for (let i = 0; i < seedText.length; i += 1) {
      hash ^= seedText.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const girl = girls[Math.abs(hash) % girls.length];
    return {
      date: todayKey(),
      uid: girl.uid || '',
      name: girl.realname || girl.nickname || '幸運女孩',
      nickname: girl.nickname && girl.nickname !== girl.realname ? girl.nickname : '',
      team: girl.team || girl.teams || girl.teamname || '',
      image: girl.img || girl.image || girl.photo || girl.pic || girl.imageurl || girl.imageUrl || '',
      createdAt: Date.now()
    };
  };

  const ensureDailyResult = () => {
    const current = readDaily();
    if (current?.date === todayKey()) return current;
    const next = pickDailyGirl();
    if (!next) return null;
    saveDaily(next);
    return next;
  };

  const closeModal = () => document.getElementById('app-daily-gacha-modal')?.remove();

  const showDailyResult = (result = ensureDailyResult(), auto = false) => {
    if (!result) return;
    closeModal();
    const modal = document.createElement('div');
    modal.id = 'app-daily-gacha-modal';
    modal.innerHTML = `
      <div class="app-gacha-backdrop" data-close-daily></div>
      <section class="app-gacha-card" role="dialog" aria-modal="true" aria-label="今日幸運女孩">
        <button class="app-gacha-close" type="button" data-close-daily aria-label="關閉">×</button>
        <div class="app-gacha-kicker">✨ APP 每日一抽</div>
        <h2>今日幸運女孩</h2>
        ${result.image ? `<img src="${esc(result.image)}" alt="${esc(result.name)}" class="app-gacha-photo" onerror="this.style.display='none'">` : ''}
        <div class="app-gacha-name">${esc(result.name)}</div>
        ${result.nickname ? `<div class="app-gacha-nickname">${esc(result.nickname)}</div>` : ''}
        ${result.team ? `<div class="app-gacha-team">${esc(result.team)}</div>` : ''}
        <p>${auto ? '今天第一次開啟 APP，已自動完成每日一抽。' : '這是你今天的抽卡結果，明天會自動更新。'}</p>
        <button class="app-gacha-primary" type="button" data-close-daily>收下今天的幸運 💖</button>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-daily]').forEach(el => el.addEventListener('click', closeModal));
  };

  const installStyles = () => {
    if (document.getElementById('game-app-enhancement-style')) return;
    const style = document.createElement('style');
    style.id = 'game-app-enhancement-style';
    style.textContent = `
      #app-daily-gacha-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px}.app-gacha-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.app-gacha-card{position:relative;width:min(92vw,390px);background:linear-gradient(155deg,#181c22,#090b0e);border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:28px 22px 22px;text-align:center;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.62)}.app-gacha-close{position:absolute;right:13px;top:10px;border:0;background:transparent;color:#9ca3af;font-size:30px;cursor:pointer}.app-gacha-kicker{font-size:12px;font-weight:900;letter-spacing:1.4px;color:#f9a8d4}.app-gacha-card h2{margin:7px 0 16px;font-size:25px}.app-gacha-photo{width:180px;height:220px;object-fit:cover;object-position:top;border-radius:18px;border:2px solid rgba(255,255,255,.18);box-shadow:0 12px 30px rgba(0,0,0,.4)}.app-gacha-name{font-size:30px;font-weight:950;margin-top:16px}.app-gacha-nickname,.app-gacha-team{color:#cbd5e1;font-weight:800;margin-top:4px}.app-gacha-card p{font-size:13px;line-height:1.6;color:#94a3b8;margin:15px 0}.app-gacha-primary,.game-ux-action{border:0;border-radius:999px;background:#fff;color:#090b0e;font-weight:950;padding:12px 18px;cursor:pointer}.game-ux-toolbar{position:sticky;top:8px;z-index:90;display:flex;gap:8px;align-items:center;margin:8px 0 18px;padding:10px;background:rgba(9,11,14,.9);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08);border-radius:16px}.game-ux-toolbar button,.game-ux-toolbar a{flex:1;display:flex;justify-content:center;align-items:center;text-decoration:none;border:1px solid rgba(255,255,255,.12);background:#15191e;color:#fff;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer}.game-daily-summary{margin:0 0 18px;padding:18px;border-radius:18px;background:linear-gradient(145deg,rgba(244,114,182,.13),rgba(56,189,248,.08));border:1px solid rgba(255,255,255,.1);color:#fff;display:flex;gap:15px;align-items:center}.game-daily-summary img{width:72px;height:88px;object-fit:cover;object-position:top;border-radius:12px}.game-daily-summary__body{flex:1;min-width:0}.game-daily-summary__label{font-size:11px;color:#f9a8d4;font-weight:900;letter-spacing:1px}.game-daily-summary__name{font-size:21px;font-weight:950;margin:3px 0}.game-daily-summary__body button{border:1px solid rgba(255,255,255,.14);background:#fff;color:#111;border-radius:999px;padding:8px 12px;font-weight:900;cursor:pointer}.game-mode-guide{margin:0 0 18px;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025);color:#cbd5e1}.game-mode-guide strong{display:block;color:#fff;font-size:16px;margin-bottom:5px}@media(max-width:600px){.game-ux-toolbar{top:6px}.game-daily-summary{padding:14px}.app-gacha-photo{width:160px;height:200px}}
    `;
    document.head.appendChild(style);
  };

  const mode = () => new URLSearchParams(location.search).get('mode') || '';

  const gameRoot = () => document.getElementById('games-container') || [...document.querySelectorAll('#main-content > div')].find(el => /遊樂互動|GAMES/i.test(el.textContent || ''));

  const enhanceGamesHome = () => {
    if (mode() !== 'games') return;
    const root = gameRoot();
    if (!root || root.querySelector('[data-game-enhancement-home]')) return;
    const result = ensureDailyResult();
    const wrap = document.createElement('div');
    wrap.dataset.gameEnhancementHome = '1';
    wrap.innerHTML = `
      ${result ? `<div class="game-daily-summary">
        ${result.image ? `<img src="${esc(result.image)}" alt="${esc(result.name)}" onerror="this.remove()">` : ''}
        <div class="game-daily-summary__body"><div class="game-daily-summary__label">TODAY'S GACHA</div><div class="game-daily-summary__name">${esc(result.name)}</div><div style="font-size:12px;color:#94a3b8;margin-bottom:8px">今天的每日一抽已完成</div><button type="button" data-show-daily>查看今日結果</button></div>
      </div>` : ''}
      <div class="game-mode-guide"><strong>🎮 選擇你想玩的模式</strong>先選遊戲，再進入設定；遊戲中隨時可以返回這裡重新選擇或調整模式。</div>`;
    root.prepend(wrap);
    wrap.querySelector('[data-show-daily]')?.addEventListener('click', () => showDailyResult(result));
  };

  const enhanceSubGame = () => {
    if (!['minigame', 'dreamteam'].includes(mode())) return;
    const root = gameRoot() || document.getElementById('main-content');
    if (!root || document.querySelector('[data-game-ux-toolbar]')) return;
    const bar = document.createElement('div');
    bar.className = 'game-ux-toolbar';
    bar.dataset.gameUxToolbar = '1';
    bar.innerHTML = `<a href="?mode=games">← 返回遊戲首頁</a><button type="button" data-adjust-mode>重新選擇模式</button>`;
    root.prepend(bar);
    bar.querySelector('[data-adjust-mode]').addEventListener('click', () => { location.href = '?mode=games'; });
  };

  const createDailyShortcut = () => {
    if (!isStandalone() || document.getElementById('app-daily-shortcut')) return;
    const btn = document.createElement('button');
    btn.id = 'app-daily-shortcut';
    btn.type = 'button';
    btn.textContent = '✨ 今日一抽';
    Object.assign(btn.style, {position:'fixed',left:'14px',bottom:'76px',zIndex:'9997',border:'1px solid rgba(255,255,255,.18)',borderRadius:'999px',padding:'9px 13px',background:'rgba(17,20,24,.94)',color:'#fff',fontWeight:'900',fontSize:'12px',boxShadow:'0 8px 24px rgba(0,0,0,.35)'});
    btn.addEventListener('click', () => showDailyResult());
    document.body.appendChild(btn);
  };

  const initDailyOnAppOpen = () => {
    if (!isStandalone()) return;
    const existing = readDaily();
    const wasDoneToday = existing?.date === todayKey();
    const tryRun = () => {
      if (!usableGirls().length) return false;
      const result = ensureDailyResult();
      if (result && !wasDoneToday) setTimeout(() => showDailyResult(result, true), 450);
      createDailyShortcut();
      enhanceGamesHome();
      return true;
    };
    if (tryRun()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tryRun() || tries >= 40) clearInterval(timer);
    }, 500);
  };

  const refreshEnhancements = () => {
    installStyles();
    enhanceGamesHome();
    enhanceSubGame();
    createDailyShortcut();
  };

  window.addEventListener('load', () => {
    installStyles();
    initDailyOnAppOpen();
    refreshEnhancements();
    const observer = new MutationObserver(refreshEnhancements);
    observer.observe(document.body, {childList:true, subtree:true});
    window.addEventListener('popstate', () => setTimeout(refreshEnhancements, 0));
  });
})();
