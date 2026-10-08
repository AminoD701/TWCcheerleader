(() => {
  function installStyles() {
    if (document.getElementById('news-page-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'news-page-polish-style';
    style.textContent = `
      body[data-app-mode="news"] #news-container{
        max-width:1100px!important;
        margin:0 auto 64px!important;
        padding:0 16px!important;
        gap:20px!important;
      }
      .news-editorial-heading{
        width:min(100% - 30px,1100px);
        margin:0 auto 16px;
        display:flex;
        align-items:end;
        justify-content:space-between;
        gap:18px;
      }
      .news-editorial-heading__eyebrow{
        color:#7dd3fc;
        font:900 9px/1 var(--sport-font);
        letter-spacing:2px;
        margin-bottom:6px;
      }
      .news-editorial-heading h1{
        margin:0;
        color:#fff;
        font-size:clamp(24px,4vw,34px);
        line-height:1.15;
        letter-spacing:.2px;
      }
      .news-editorial-heading p{
        margin:7px 0 0;
        color:#8f9aa8;
        font-size:12px;
        line-height:1.65;
      }
      .news-editorial-heading__meta{
        white-space:nowrap;
        color:#82909d;
        font:800 10px/1 var(--sport-font);
        letter-spacing:.8px;
      }

      body[data-app-mode="news"] .hero-carousel-container{
        margin-bottom:22px!important;
      }
      body[data-app-mode="news"] .news-hero-card{
        border:1px solid rgba(255,255,255,.09)!important;
        border-radius:16px!important;
        box-shadow:0 16px 42px rgba(0,0,0,.32)!important;
        background:#0c1015!important;
      }
      body[data-app-mode="news"] .hero-text-content{
        padding:22px!important;
        background:linear-gradient(to bottom,rgba(5,8,12,.06) 0%,rgba(5,8,12,.70) 44%,rgba(5,8,12,.96) 100%)!important;
      }
      body[data-app-mode="news"] .hero-nav-btn{
        width:40px!important;
        height:40px!important;
        border-width:1px!important;
        background:rgba(7,10,14,.72)!important;
        box-shadow:none!important;
      }

      body[data-app-mode="news"] .news-card{
        height:196px!important;
        margin-bottom:14px!important;
        border:1px solid rgba(255,255,255,.085)!important;
        border-radius:14px!important;
        background:linear-gradient(145deg,#151a20,#101419)!important;
        box-shadow:0 10px 28px rgba(0,0,0,.24)!important;
        transition:transform .16s ease,border-color .16s ease,background .16s ease!important;
      }
      body[data-app-mode="news"] .news-card:hover{
        transform:translateY(-2px)!important;
        border-color:rgba(255,255,255,.16)!important;
        box-shadow:0 16px 36px rgba(0,0,0,.34)!important;
      }
      body[data-app-mode="news"] .news-img-wrap{
        width:285px!important;
        border-right:1px solid rgba(255,255,255,.08)!important;
        background:#0b0f13!important;
      }
      body[data-app-mode="news"] .news-card:hover .news-img-wrap img{
        transform:scale(1.025)!important;
      }
      body[data-app-mode="news"] .news-info-wrap{
        padding:20px 24px!important;
      }
      body[data-app-mode="news"] .news-header-meta{
        gap:8px!important;
      }
      body[data-app-mode="news"] .news-date{
        font-size:12px!important;
        color:#8793a0!important;
      }
      body[data-app-mode="news"] .news-tag{
        font-size:10px!important;
        padding:4px 8px!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.035)!important;
        letter-spacing:.7px!important;
      }
      body[data-app-mode="news"] .news-title-text{
        margin-top:8px!important;
        white-space:normal!important;
        display:-webkit-box!important;
        -webkit-line-clamp:2!important;
        -webkit-box-orient:vertical!important;
        overflow:hidden!important;
        font-size:21px!important;
        line-height:1.35!important;
      }
      body[data-app-mode="news"] .news-summary-text{
        margin-top:8px!important;
        font-size:13px!important;
        line-height:1.6!important;
        color:#939eaa!important;
      }
      body[data-app-mode="news"] .news-click-prompt{
        margin-top:10px!important;
        font-size:10px!important;
        letter-spacing:1.2px!important;
        opacity:.8;
      }
      body[data-app-mode="news"] .news-card:hover .news-click-prompt{
        transform:translateX(3px)!important;
      }

      body[data-app-mode="news"] #news-filter-dropdowns{
        max-width:1100px!important;
        padding:0 16px!important;
      }

      @media(min-width:769px){
        body[data-app-mode="news"] .news-hero-card{
          aspect-ratio:16/7!important;
          max-height:420px!important;
        }
      }

      @media(max-width:768px){
        .news-editorial-heading{
          width:calc(100% - 20px);
          margin-bottom:12px;
          align-items:flex-start;
          flex-direction:column;
          gap:6px;
        }
        .news-editorial-heading h1{font-size:25px}
        .news-editorial-heading p{font-size:11px}
        .news-editorial-heading__meta{font-size:9px}
        body[data-app-mode="news"] #news-container{
          padding:0 10px!important;
          margin-bottom:44px!important;
        }
        body[data-app-mode="news"] .news-hero-card{
          flex:0 0 94%!important;
          border-radius:14px!important;
        }
        body[data-app-mode="news"] .hero-text-content{
          padding:14px 14px 17px!important;
        }
        body[data-app-mode="news"] .news-card{
          height:auto!important;
          border-radius:13px!important;
          margin-bottom:10px!important;
        }
        body[data-app-mode="news"] .news-img-wrap{
          width:100%!important;
          height:190px!important;
          border-right:0!important;
          border-bottom:1px solid rgba(255,255,255,.08)!important;
        }
        body[data-app-mode="news"] .news-info-wrap{
          padding:13px 14px 14px!important;
          gap:7px!important;
        }
        body[data-app-mode="news"] .news-title-text{
          font-size:17px!important;
          margin-top:3px!important;
        }
        body[data-app-mode="news"] .news-summary-text{
          display:-webkit-box!important;
          -webkit-line-clamp:2!important;
          font-size:12px!important;
          margin-top:5px!important;
        }
        body[data-app-mode="news"] .news-click-prompt{
          margin-top:5px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function latestLabel() {
    const rows = Array.isArray(window.dbNews) ? window.dbNews : [];
    const dates = rows.map(row => String(row?.date || '').trim()).filter(Boolean).sort().reverse();
    return dates[0] || '持續更新';
  }

  function ensureHeading() {
    if (document.body?.dataset.appMode !== 'news') return;
    const container = document.getElementById('news-container');
    if (!container) return;

    let heading = document.getElementById('news-editorial-heading');
    if (!heading) {
      heading = document.createElement('section');
      heading.id = 'news-editorial-heading';
      heading.className = 'news-editorial-heading';
      container.insertAdjacentElement('beforebegin', heading);
    }
    heading.innerHTML = `
      <div>
        <div class="news-editorial-heading__eyebrow">DAILY INTEL</div>
        <h1>每日情報</h1>
        <p>聚焦啦啦隊、球賽與應援動態，依最新時間排序。</p>
      </div>
      <div class="news-editorial-heading__meta">每小時更新 · 最新 ${latestLabel()}</div>
    `;
  }

  function sync() {
    installStyles();
    ensureHeading();
    const heading = document.getElementById('news-editorial-heading');
    if (heading) heading.style.display = document.body?.dataset.appMode === 'news' ? 'flex' : 'none';
  }

  function wrapRender() {
    const original = window.renderNewsHub;
    if (typeof original !== 'function' || original.__newsPagePolish) return;
    const wrapped = function(...args) {
      const result = original.apply(this,args);
      requestAnimationFrame(sync);
      return result;
    };
    wrapped.__newsPagePolish = true;
    window.renderNewsHub = wrapped;
  }

  if(document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', sync, {once:true});
  } else {
    sync();
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    wrapRender();
    sync();
    if(window.renderNewsHub?.__newsPagePolish || attempts > 80) clearInterval(timer);
  },100);

  const observer = new MutationObserver(sync);
  observer.observe(document.body,{attributes:true,attributeFilter:['data-app-mode']});
})();
