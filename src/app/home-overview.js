(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function snapshot() {
    try { return window.CheerHomeData?.snapshot?.() || {}; }
    catch (_) { return {}; }
  }

  function eventDateNum(event) {
    if (event?.safeDate?.num) return Number(event.safeDate.num);
    const raw = String(event?.date || '').trim();
    const m = raw.match(/(?:(20\d{2})[\/.-])?(\d{1,2})[\/.-](\d{1,2})/);
    if (!m) return 99999999;
    const now = new Date();
    const year = Number(m[1] || now.getFullYear());
    return year * 10000 + Number(m[2]) * 100 + Number(m[3]);
  }

  function todayNum() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function formatEventDate(event) {
    const date = event?.safeDate;
    if (date?.month && date?.day) return `${date.month}/${date.day}`;
    const raw = String(event?.date || '').trim();
    const m = raw.match(/(?:(20\d{2})[\/.-])?(\d{1,2})[\/.-](\d{1,2})/);
    return m ? `${Number(m[2])}/${Number(m[3])}` : raw || '日期待確認';
  }

  function newsTime(news) {
    const raw = news?.date || news?.published || news?.published_at || news?.time || '';
    const n = Date.parse(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function openMode(mode) {
    if (typeof window.setMode === 'function') window.setMode(mode);
  }

  let lastRenderKey = '';
  const promoEndsAt = new Date('2026-10-24T00:00:00+08:00').getTime();
  const promoActive = () => Date.now() < promoEndsAt;
  const noticeKey = 'twc_scumbag_challenge_intro_v1';

  function render() {
    const root = document.getElementById('home-container');
    if (!root) return;
    if (document.body?.dataset.appMode !== 'home') {
      root.style.display = 'none';
      return;
    }

    const data = snapshot();
    const girls = Array.isArray(data.girls) ? data.girls : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const news = Array.isArray(data.news) ? data.news : [];
    const today = todayNum();

    const upcoming = events
      .filter(item => eventDateNum(item) >= today)
      .sort((a,b) => eventDateNum(a) - eventDateNum(b))
      .slice(0,3);

    const latestNews = [...news]
      .sort((a,b) => newsTime(b) - newsTime(a))
      .slice(0,3);

    const renderKey = JSON.stringify({
      events: upcoming.map(item => [item.date, item.time, item.eventname, item.host]),
      news: latestNews.map(item => [item.id, item.date, item.title, item.tag, item.subtag])
    });
    if (renderKey === lastRenderKey && root.querySelector('.home-overview')) return;
    lastRenderKey = renderKey;

    root.innerHTML = `
      <section class="home-overview">
        <div class="home-overview__hero">
          <div>
            <span class="home-overview__eyebrow">TAIWAN CHEERLEADER DATABASE</span>
            <h1>今天想看什麼？</h1>
            <p>女孩名單、公開行程、賽事與最新情報集中在首頁；需要完整內容時再進入各功能頁。</p>
          </div>
          <div class="home-overview__hero-actions">
            <button type="button" data-home-mode="girls">女孩圖鑑</button>
            <button type="button" data-home-mode="events">公開行程</button>
          </div>
        </div>

        ${promoActive() ? `<button type="button" class="twc-vision-promo" data-home-vision aria-label="玩新遊戲 渣男鑑定所"><span class="twc-vision-promo__badge">NEW · PHOTO CHALLENGE</span><strong>你是純情派，還是海王級？</strong><span>「渣男鑑定所」新登場！看照片猜女孩，闖過四種關卡，測測你的渣男潛力。</span><span class="twc-vision-promo__action">立即挑戰 <span aria-hidden="true">↗</span></span></button>` : ''}
        <div class="home-overview__quick">
          <button type="button" data-home-mode="girls"><span>ROSTER</span><strong>女孩圖鑑</strong><small>查看現役與歷屆成員</small></button>
          <button type="button" data-home-mode="events"><span>EVENTS</span><strong>公開行程</strong><small>近期活動與完整月曆</small></button>
          <button type="button" data-home-mode="matches"><span>MATCHES</span><strong>賽事中心</strong><small>聯盟賽程與季後賽</small></button>
          <button type="button" data-home-mode="datalab"><span>DATA LAB</span><strong>生態數據</strong><small>聯盟、國籍與女孩分布</small></button>
        </div>

        <div class="home-overview__columns">
          <section class="home-overview__panel">
            <div class="home-overview__panel-head">
              <div><span>UPCOMING</span><strong>近期公開行程</strong></div>
              <button type="button" data-home-mode="events">查看全部 →</button>
            </div>
            <div class="home-overview__list">
              ${upcoming.length ? upcoming.map(item => `
                <button type="button" class="home-overview__row" data-home-mode="events">
                  <span class="home-overview__date">${esc(formatEventDate(item))}</span>
                  <span class="home-overview__row-copy">
                    <strong>${esc(item.eventname || item.host || '公開行程')}</strong>
                    <small>${esc([item.time, item.host].filter(Boolean).join(' · ') || '時間／主辦資訊待確認')}</small>
                  </span>
                </button>`).join('') : '<div class="home-overview__empty">目前沒有即將到來的公開行程。</div>'}
            </div>
          </section>

          <section class="home-overview__panel">
            <div class="home-overview__panel-head">
              <div><span>INTEL</span><strong>最新情報</strong></div>
              <button type="button" data-home-mode="news">查看全部 →</button>
            </div>
            <div class="home-overview__list">
              ${latestNews.length ? latestNews.map(item => `
                <button type="button" class="home-overview__row home-overview__row--news" data-home-mode="news">
                  <span class="home-overview__news-dot"></span>
                  <span class="home-overview__row-copy">
                    <strong>${esc(item.title || '最新情報')}</strong>
                    <small>${esc(item.tag || item.subtag || '啦啦隊情報')}</small>
                  </span>
                </button>`).join('') : '<div class="home-overview__empty">最新情報正在載入中。</div>'}
            </div>
          </section>
        </div>

        <div class="home-overview__footnote">資料會隨網站來源更新。完整篩選、月曆與明細請進入對應功能頁。</div>
      </section>`;

    root.querySelector('[data-home-vision]')?.addEventListener('click', () => openMode('games'));
    scheduleVisionNotice();
    root.querySelectorAll('[data-home-mode]').forEach(btn => {
      btn.addEventListener('click', () => openMode(btn.dataset.homeMode));
    });
  }

  function scheduleVisionNotice() {
    if(!promoActive() || document.body?.dataset.appMode !== 'home') return;
    try { if(localStorage.getItem(noticeKey)) return; } catch(_) {}
    if(document.getElementById('twc-vision-toast')) return;
    // Never overlay the landing screen or interfere with the initial load.
    if(document.getElementById('landing-page')?.getBoundingClientRect().height &&
       getComputedStyle(document.getElementById('landing-page')).display !== 'none') return;
    const toast=document.createElement('aside');
    toast.id='twc-vision-toast';
    toast.setAttribute('aria-label','新遊戲通知');
    toast.innerHTML='<div><small>新遊戲上線</small><strong>渣男鑑定所</strong><span>猜照片挑戰，認得越多越難解釋！</span></div><button type="button" data-play>去挑戰</button><button type="button" data-dismiss aria-label="關閉提醒">×</button>';
    document.body.appendChild(toast);
    const close=()=>{try{localStorage.setItem(noticeKey,'1')}catch(_){}toast.remove();};
    toast.querySelector('[data-dismiss]').onclick=close;
    toast.querySelector('[data-play]').onclick=()=>{close();openMode('games');};
  }
  function installVisionStyles(){
    if(document.getElementById('twc-vision-style'))return;
    const style=document.createElement('style');style.id='twc-vision-style';
    style.textContent=`
    .twc-vision-promo{display:flex;width:100%;margin:16px 0 18px;position:relative;flex-direction:column;align-items:flex-start;gap:8px;padding:18px 21px;border:1px solid rgba(167,139,250,.38);border-radius:14px;background:linear-gradient(110deg,#252034,#151a24 85%);color:#fff;text-align:left;font-family:inherit;cursor:pointer}
    .twc-vision-promo:hover{border-color:#bba5ed}.twc-vision-promo__badge{font-size:10px;letter-spacing:1.5px;color:#cab6fd;font-weight:800}.twc-vision-promo strong{font-size:20px;font-weight:850}.twc-vision-promo>span:not(.twc-vision-promo__badge):not(.twc-vision-promo__action){font-size:13px;line-height:1.6;color:#bac3d2}.twc-vision-promo__action{font-size:13px;font-weight:850;color:#d5c3ff}
    #twc-vision-toast{position:fixed;bottom:max(20px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:8000;display:flex;align-items:center;gap:12px;width:min(92vw,440px);padding:13px 14px;background:#202430;color:#fff;border:1px solid #645682;border-radius:15px;box-shadow:0 12px 38px #0008;font-family:inherit}
    #twc-vision-toast>div{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}#twc-vision-toast small{color:#bda6f5;font-size:10px}#twc-vision-toast strong{font-size:16px}#twc-vision-toast span{font-size:12px;color:#b9c1d0;line-height:1.4}
    #twc-vision-toast button{border:0;font:700 13px inherit;cursor:pointer;color:#fff;background:#7053a6;border-radius:9px;padding:10px;white-space:nowrap}#twc-vision-toast [data-dismiss]{color:#b8c0cf;background:transparent;padding:5px;font-size:22px}
    @media(max-width:540px){.twc-vision-promo{padding:15px}.twc-vision-promo strong{font-size:18px}#twc-vision-toast{bottom:max(74px,calc(env(safe-area-inset-bottom) + 64px));gap:8px}}
    `;
    document.head.appendChild(style);
  }
  function scheduleRender() {
    if (document.body?.dataset.appMode !== 'home') return;
    requestAnimationFrame(render);
  }

  function boot() {
    installVisionStyles();
    render();
    setTimeout(scheduleVisionNotice, 1800);
    setTimeout(scheduleVisionNotice, 4500);
    setTimeout(scheduleVisionNotice, 9000);
    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.body, { attributes:true, attributeFilter:['data-app-mode'] });

    // Data arrives asynchronously on first load. Retry a few times without
    // repainting the whole homepage every 250ms.
    [500, 1500, 3000, 6000].forEach(delay => {
      setTimeout(() => {
        if (document.body?.dataset.appMode === 'home') render();
      }, delay);
    });
  }

  window.renderHomeOverview = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
