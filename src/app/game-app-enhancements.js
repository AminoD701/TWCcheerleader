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
      #app-daily-gacha-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px}.app-gacha-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.app-gacha-card{position:relative;width:min(92vw,390px);background:linear-gradient(155deg,#181c22,#090b0e);border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:28px 22px 22px;text-align:center;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.62)}.app-gacha-close{position:absolute;right:13px;top:10px;border:0;background:transparent;color:#9ca3af;font-size:30px;cursor:pointer}.app-gacha-kicker{font-size:12px;font-weight:900;letter-spacing:1.4px;color:#f9a8d4}.app-gacha-card h2{margin:7px 0 16px;font-size:25px}.app-gacha-photo{width:180px;height:220px;object-fit:cover;object-position:top;border-radius:18px;border:2px solid rgba(255,255,255,.18);box-shadow:0 12px 30px rgba(0,0,0,.4)}.app-gacha-name{font-size:30px;font-weight:950;margin-top:16px}.app-gacha-nickname,.app-gacha-team{color:#cbd5e1;font-weight:800;margin-top:4px}.app-gacha-card p{font-size:13px;line-height:1.6;color:#94a3b8;margin:15px 0}.app-gacha-primary{border:0;border-radius:999px;background:#fff;color:#090b0e;font-weight:950;padding:12px 18px;cursor:pointer}
      .game-ux-toolbar{position:sticky;top:8px;z-index:90;display:flex;gap:8px;align-items:center;margin:8px 0 18px;padding:10px;background:rgba(9,11,14,.92);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08);border-radius:16px}.game-ux-toolbar button,.game-ux-toolbar a{flex:1;display:flex;justify-content:center;align-items:center;text-decoration:none;border:1px solid rgba(255,255,255,.12);background:#15191e;color:#fff;border-radius:12px;padding:11px 12px;font-weight:900;cursor:pointer}
      .game-hub{margin:4px 0 24px;color:#fff}.game-hub__head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:16px}.game-hub__head h2{font-size:26px;margin:0 0 5px;font-weight:950}.game-hub__head p{margin:0;color:#94a3b8;font-size:13px;line-height:1.6}.game-hub__badge{white-space:nowrap;padding:7px 11px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.04);font-size:11px;font-weight:900;color:#cbd5e1}.game-hub__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.game-mode-card{position:relative;min-height:218px;padding:20px;border-radius:22px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(150deg,#171b20,#0b0d10);box-shadow:0 12px 32px rgba(0,0,0,.22);overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:#fff;cursor:pointer;transition:.2s transform,.2s border-color,.2s box-shadow}.game-mode-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.22);box-shadow:0 16px 40px rgba(0,0,0,.34)}.game-mode-card::after{content:'';position:absolute;width:130px;height:130px;border-radius:50%;right:-48px;top:-48px;background:radial-gradient(circle,rgba(255,255,255,.12),transparent 70%);pointer-events:none}.game-mode-card__icon{font-size:34px;line-height:1;margin-bottom:17px}.game-mode-card__eyebrow{font-size:10px;letter-spacing:1.2px;font-weight:950;color:#94a3b8;margin-bottom:5px}.game-mode-card__title{font-size:21px;font-weight:950;margin-bottom:7px}.game-mode-card__desc{font-size:12px;line-height:1.6;color:#a8b2c1;flex:1}.game-mode-card__status{margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:8px}.game-mode-card__status span:first-child{font-size:11px;font-weight:900;color:#dbeafe}.game-mode-card__go{padding:7px 10px;border-radius:999px;background:#fff;color:#111;font-size:11px;font-weight:950}.game-mode-card--daily{background:linear-gradient(145deg,rgba(244,114,182,.18),rgba(15,23,42,.96))}.game-mode-card--mini{background:linear-gradient(145deg,rgba(56,189,248,.15),rgba(15,23,42,.96))}.game-mode-card--dream{background:linear-gradient(145deg,rgba(250,204,21,.13),rgba(15,23,42,.96))}.game-mode-card__girl{display:flex;align-items:center;gap:9px;margin-top:10px}.game-mode-card__girl img{width:42px;height:52px;border-radius:10px;object-fit:cover;object-position:top}.game-mode-card__girl strong{display:block;font-size:15px}.game-mode-card__girl small{display:block;color:#cbd5e1;margin-top:2px}.game-hub__tip{margin-top:13px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);font-size:12px;color:#94a3b8}.game-hub__tip strong{color:#fff}.game-hub-divider{height:1px;background:rgba(255,255,255,.08);margin:24px 0 18px}.game-hub-divider-label{font-size:11px;color:#64748b;font-weight:900;letter-spacing:1px;margin-bottom:10px}
      @media(max-width:760px){.game-hub__grid{grid-template-columns:1fr}.game-mode-card{min-height:178px}.game-hub__head{align-items:start}.game-hub__badge{display:none}.game-ux-toolbar{top:6px}.app-gacha-photo{width:160px;height:200px}}
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
    const hub = document.createElement('section');
    hub.className = 'game-hub';
    hub.dataset.gameEnhancementHome = '1';
    const dailyStatus = result ? `${esc(result.name)}｜今天已抽` : '開啟 APP 後自動抽取';
    hub.innerHTML = `
      <div class="game-hub__head">
        <div><h2>🎮 遊戲中心</h2><p>先選一個模式再開始。遊戲進行中隨時都能返回這裡重新選擇或調整設定。</p></div>
        <div class="game-hub__badge">GAME HUB</div>
      </div>
      <div class="game-hub__grid">
        <button type="button" class="game-mode-card game-mode-card--daily" data-show-daily>
          <div class="game-mode-card__icon">✨</div>
          <div class="game-mode-card__eyebrow">DAILY GACHA</div>
          <div class="game-mode-card__title">每日一抽</div>
          <div class="game-mode-card__desc">APP 每天第一次開啟時自動抽出一位今日幸運女孩，同一天不會重抽。</div>
          ${result ? `<div class="game-mode-card__girl">${result.image ? `<img src="${esc(result.image)}" alt="${esc(result.name)}" onerror="this.remove()">` : ''}<div><strong>${esc(result.name)}</strong><small>${esc(result.team || '今日幸運女孩')}</small></div></div>` : ''}
          <div class="game-mode-card__status"><span>${dailyStatus}</span><span class="game-mode-card__go">查看結果</span></div>
        </button>
        <a class="game-mode-card game-mode-card--mini" href="?mode=minigame">
          <div class="game-mode-card__icon">⚡</div>
          <div class="game-mode-card__eyebrow">QUICK GAME</div>
          <div class="game-mode-card__title">小遊戲</div>
          <div class="game-mode-card__desc">快速進入互動玩法。進入後可以再選條件與玩法，不需要離開整個網站。</div>
          <div class="game-mode-card__status"><span>適合快速玩一局</span><span class="game-mode-card__go">開始遊戲</span></div>
        </a>
        <a class="game-mode-card game-mode-card--dream" href="?mode=dreamteam">
          <div class="game-mode-card__icon">🏆</div>
          <div class="game-mode-card__eyebrow">DREAM TEAM</div>
          <div class="game-mode-card__title">夢幻隊伍</div>
          <div class="game-mode-card__desc">組出你心中的理想啦啦隊陣容，想換規則或重新選人時可以隨時返回調整。</div>
          <div class="game-mode-card__status"><span>自由組隊與調整</span><span class="game-mode-card__go">建立隊伍</span></div>
        </a>
      </div>
      <div class="game-hub__tip"><strong>操作提示：</strong>不管進入小遊戲還是夢幻隊伍，上方都會保留「返回遊戲首頁／重新選擇模式」。</div>
      <div class="game-hub-divider"></div><div class="game-hub-divider-label">其他既有遊戲內容</div>`;
    root.prepend(hub);
    hub.querySelector('[data-show-daily]')?.addEventListener('click', () => showDailyResult(result));
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
