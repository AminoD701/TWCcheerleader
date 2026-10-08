(() => {
  const icons = {
    girls: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
    data: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 19h22"/>',
    match: '<circle cx="12" cy="12" r="9"/><path d="M8 4l2 4h4l2-4M5 15l4-1 2 4M19 15l-4-1-2 4"/>',
    events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    archive: '<path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/>',
    games: '<path d="M8 9h8a5 5 0 0 1 4.5 7.2l-1.2 2.4a2.2 2.2 0 0 1-3.6.5L14 17h-4l-1.7 2.1a2.2 2.2 0 0 1-3.6-.5l-1.2-2.4A5 5 0 0 1 8 9z"/><path d="M7 13h4M9 11v4M16 12v.01M18 14v.01"/>',
    news: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>'
  };

  const isFormer = girl => {
    const season = String(girl?.departureseason || girl?.departure_season || girl?.['離隊賽季'] || '').trim();
    const note = String(girl?.note || '').trim();
    return Boolean(season) || /(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/.test(note);
  };

  const personKey = girl => String(girl?.uid || `${String(girl?.realname || '').trim()}|${String(girl?.nickname || '').trim()}`).trim();

  function activePeople() {
    const map = new Map();
    (Array.isArray(window.dbGirls) ? window.dbGirls : []).filter(g => !isFormer(g)).forEach(g => {
      const key = personKey(g);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    });
    return [...map.values()];
  }

  function isForeign(rows) {
    return rows.some(g => {
      const nat = String(g?.nat || '').trim();
      if (!nat || ['未知','-','—'].includes(nat)) return false;
      if (nat.includes('混血')) return true;
      return !/(臺灣|台灣|臺籍|台籍)/.test(nat);
    });
  }

  function latestNewsLabel() {
    const rows = Array.isArray(window.dbNews) ? window.dbNews : [];
    if (!rows.length) return '載入中';
    const latest = rows.map(n => String(n.date || '').trim()).filter(Boolean).sort().reverse()[0];
    return latest || '持續更新';
  }

  function icon(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.news}</svg>`;
  }

  function installStyles() {
    if (document.getElementById('home-dashboard-style')) return;
    const style = document.createElement('style');
    style.id = 'home-dashboard-style';
    style.textContent = `
      #home-dashboard{display:none;width:min(100% - 30px,1100px);margin:0 auto 30px;color:#fff}
      body[data-app-mode="news"] #home-dashboard{display:block}
      .home-dashboard__intro{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:4px 0 14px}
      .home-dashboard__intro span,.home-dashboard__section-head span{display:block;color:#7dd3fc;font:900 9px/1 var(--sport-font);letter-spacing:2px;margin-bottom:6px}
      .home-dashboard__intro h1{margin:0;font-size:clamp(23px,4vw,32px);line-height:1.15}
      .home-dashboard__intro p{margin:7px 0 0;color:#94a3b8;font-size:12px;line-height:1.65}
      .home-dashboard__live{white-space:nowrap;padding:7px 10px;border:1px solid rgba(125,211,252,.18);border-radius:999px;background:rgba(125,211,252,.05);color:#bae6fd;font:850 10px/1 var(--sport-font);letter-spacing:.8px}
      .home-dashboard__stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
      .home-dashboard__stat{padding:14px 15px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025)}
      .home-dashboard__stat small{display:block;color:#8894a2;font-size:10px;font-weight:800;margin-bottom:6px}
      .home-dashboard__stat strong{font:950 23px/1 var(--sport-font);color:#fff}.home-dashboard__stat em{font-style:normal;color:#82909e;font-size:10px;margin-left:5px}
      .home-dashboard__primary{display:grid;grid-template-columns:1.15fr .85fr;gap:10px;margin-bottom:20px}
      .home-dashboard__feature{position:relative;overflow:hidden;min-height:128px;padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:17px;background:linear-gradient(145deg,#151b22,#0c1015);color:#fff;text-decoration:none;display:flex;flex-direction:column;justify-content:flex-end}
      .home-dashboard__feature:first-child{background:radial-gradient(circle at 85% 5%,rgba(56,189,248,.15),transparent 34%),linear-gradient(145deg,#151b22,#0c1015)}
      .home-dashboard__feature svg{position:absolute;right:18px;top:17px;width:27px;height:27px;fill:none;stroke:#94a3b8;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
      .home-dashboard__feature span{color:#7dd3fc;font:900 9px/1 var(--sport-font);letter-spacing:1.5px}
      .home-dashboard__feature strong{font-size:20px;margin:7px 0 5px}.home-dashboard__feature small{max-width:430px;color:#8f9aa8;line-height:1.55}
      .home-dashboard__section-head{display:flex;align-items:end;justify-content:space-between;gap:10px;margin:0 0 10px}
      .home-dashboard__section-head strong{font-size:16px}.home-dashboard__section-head small{color:#788492;font-size:10px}
      .home-dashboard__quick{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:24px}
      .home-dashboard__quick a{min-height:95px;padding:14px;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:#11161c;color:#fff;text-decoration:none;transition:transform .16s ease,border-color .16s ease,background .16s ease}
      .home-dashboard__quick a:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.16);background:#151b22}
      .home-dashboard__quick svg{width:20px;height:20px;margin-bottom:13px;fill:none;stroke:#9ca3af;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .home-dashboard__quick strong{display:block;font-size:13px}.home-dashboard__quick small{display:block;margin-top:5px;color:#7f8b98;font-size:10px;line-height:1.45}
      .home-dashboard__news-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin:4px 0 10px;padding-top:3px}
      .home-dashboard__news-head span{display:block;color:#7dd3fc;font:900 9px/1 var(--sport-font);letter-spacing:2px;margin-bottom:5px}.home-dashboard__news-head strong{font-size:18px}.home-dashboard__news-head small{color:#7e8a97;font-size:10px}
      body[data-app-mode="news"] #news-container{margin-top:0!important}
      @media(max-width:760px){
        #home-dashboard{width:calc(100% - 20px);margin-bottom:22px}
        .home-dashboard__intro{align-items:flex-start;flex-direction:column;gap:9px}
        .home-dashboard__stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .home-dashboard__stat{padding:12px 9px}.home-dashboard__stat strong{font-size:19px}.home-dashboard__stat em{display:block;margin:3px 0 0}
        .home-dashboard__primary{grid-template-columns:1fr}.home-dashboard__feature{min-height:112px;padding:16px}
        .home-dashboard__quick{grid-template-columns:repeat(2,1fr);gap:7px}.home-dashboard__quick a{min-height:88px;padding:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function navigate(mode) {
    if (typeof window.setMode === 'function') window.setMode(mode);
  }

  function render() {
    installStyles();
    const main = document.getElementById('main-content');
    const news = document.getElementById('news-container');
    if (!main || !news) return;

    let root = document.getElementById('home-dashboard');
    if (!root) {
      root = document.createElement('section');
      root.id = 'home-dashboard';
    }

    const people = activePeople();
    const foreign = people.filter(isForeign).length;
    const newsCount = Array.isArray(window.dbNews) ? window.dbNews.length : 0;
    const signature = `${people.length}|${foreign}|${newsCount}|${latestNewsLabel()}`;
    if (root.dataset.signature !== signature) {
      root.dataset.signature = signature;
      root.innerHTML = `
        <div class="home-dashboard__intro">
          <div><span>CHEERLEADER DASHBOARD</span><h1>今天想看什麼？</h1><p>從女孩資料、公開行程到比賽與生態數據，快速找到你現在最需要的內容。</p></div>
          <div class="home-dashboard__live">LIVE DATABASE</div>
        </div>
        <div class="home-dashboard__stats">
          <div class="home-dashboard__stat"><small>現役女孩資料</small><strong>${people.length || '—'}</strong><em>人</em></div>
          <div class="home-dashboard__stat"><small>現役外籍</small><strong>${people.length ? foreign : '—'}</strong><em>人</em></div>
          <div class="home-dashboard__stat"><small>最新情報</small><strong>${newsCount || '—'}</strong><em>則資料</em></div>
        </div>
        <div class="home-dashboard__primary">
          <a href="?mode=events" data-home-mode="events" class="home-dashboard__feature">
            ${icon('events')}<span>UPCOMING</span><strong>近期公開行程</strong><small>先看最近有哪些公開活動、見面會與應援機會。</small>
          </a>
          <a href="?mode=matches" data-home-mode="matches" class="home-dashboard__feature">
            ${icon('match')}<span>GAME DAY</span><strong>比賽中心</strong><small>查看 CPBL、TPBL、PLG、TPVL 賽程。</small>
          </a>
        </div>
        <div class="home-dashboard__section-head"><div><span>EXPLORE</span><strong>快速探索</strong></div><small>資料直接連動網站現有功能</small></div>
        <div class="home-dashboard__quick">
          <a href="?mode=girls" data-home-mode="girls">${icon('girls')}<strong>女孩圖鑑</strong><small>搜尋現役啦啦隊女孩</small></a>
          <a href="?mode=datalab" data-home-mode="datalab">${icon('data')}<strong>生態數據</strong><small>國籍、身高、星座與聯盟分析</small></a>
          <a href="?mode=archive" data-home-mode="archive">${icon('archive')}<strong>歷屆成員</strong><small>依離隊賽季回顧歷屆女孩</small></a>
          <a href="?mode=games" data-home-mode="games">${icon('games')}<strong>遊戲中心</strong><small>殘酷二選一與夢幻陣容</small></a>
        </div>
        <div class="home-dashboard__news-head"><div><span>LATEST INTEL</span><strong>最新情報</strong></div><small>最新資料：${latestNewsLabel()}</small></div>
      `;
    }

    const spotlight = document.getElementById('season-spotlight');
    const marquee = main.querySelector('.marquee-wrapper');
    const anchor = spotlight && !spotlight.hidden ? spotlight : marquee;
    if (anchor) anchor.insertAdjacentElement('afterend', root);
    else news.insertAdjacentElement('beforebegin', root);

    if (!root.dataset.bound) {
      root.dataset.bound = '1';
      root.addEventListener('click', event => {
        const link = event.target.closest('[data-home-mode]');
        if (!link) return;
        event.preventDefault();
        navigate(link.dataset.homeMode);
      });
    }
  }

  function sync() {
    if (document.body?.dataset.appMode === 'news') render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, {once:true});
  else sync();

  window.addEventListener('load', sync, {once:true});
  const observer = new MutationObserver(() => requestAnimationFrame(sync));
  observer.observe(document.body, {attributes:true, attributeFilter:['data-app-mode']});

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (document.body?.dataset.appMode === 'news') render();
    if ((Array.isArray(window.dbGirls) && window.dbGirls.length && Array.isArray(window.dbNews)) || attempts > 60) clearInterval(timer);
  }, 500);

  window.renderHomeDashboard = render;
})();
