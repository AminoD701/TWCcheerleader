(() => {
  const formerPattern = /(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/;

  function isFormer(girl) {
    const season = String(girl?.departureseason || girl?.departure_season || girl?.['離隊賽季'] || '').trim();
    if (season) return true;
    return formerPattern.test(String(girl?.note || '').trim());
  }

  function personKey(girl) {
    return String(girl?.uid || `${String(girl?.realname || '').trim()}|${String(girl?.nickname || '').trim()}`).trim();
  }

  function legacyState() {
    try { return window.CheerLegacyState?.snapshot?.() || {}; }
    catch (_) { return {}; }
  }

  function currentFilters() {
    const state = legacyState();
    return {
      sport: String(state.currentSport || '全部').trim(),
      team: String(state.currentTeam || '全部啦啦隊').trim(),
      search: String(document.getElementById('searchInput')?.value || '').trim(),
      role: String(document.getElementById('roleFilter')?.value || 'all').trim(),
      nat: String(document.getElementById('natFilter')?.value || 'all').trim(),
      zodiac: String(document.getElementById('zodiacFilter')?.value || 'all').trim()
    };
  }

  function matchesFilters(girl, filters = currentFilters()) {
    if (isFormer(girl)) return false;
    if (filters.sport && filters.sport !== '全部' && !String(girl?.sport || '').includes(filters.sport)) return false;
    if (filters.team && filters.team !== '全部啦啦隊' && String(girl?.team || '').trim() !== filters.team) return false;

    const haystack = `${String(girl?.nickname || '')} ${String(girl?.realname || '')}`.toLowerCase();
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;

    const nat = String(girl?.nat || '');
    if (filters.nat === '臺灣' && !/(臺灣|台灣|臺籍|台籍)/.test(nat)) return false;
    if (filters.nat === '其他' && /(臺灣|台灣|臺籍|台籍|韓國|韓籍|日本|日籍)/.test(nat)) return false;
    if (!['all','臺灣','其他'].includes(filters.nat) && filters.nat && !nat.includes(filters.nat)) return false;

    const zodiac = String(girl?.zodiac || '').trim().replace('魔羯','摩羯').replace('白羊','牡羊');
    if (filters.zodiac !== 'all' && filters.zodiac && zodiac !== filters.zodiac) return false;

    if (filters.role !== 'all') {
      const note = String(girl?.note || '').replace(/(合作夥伴|合作)/g,'').trim();
      const trainee = /練習生|培訓/.test(note);
      const mascot = /吉祥物/.test(note);
      const special = Boolean(note) && !trainee && !mascot && !formerPattern.test(note);
      if (filters.role === 'cheerleader' && (trainee || mascot || special)) return false;
      if (filters.role === 'special' && !(trainee || mascot || special)) return false;
    }
    return true;
  }

  function matchedActiveCount() {
    const seen = new Set();
    (Array.isArray(window.dbGirls) ? window.dbGirls : []).forEach(girl => {
      if (!matchesFilters(girl)) return;
      const key = personKey(girl);
      if (key) seen.add(key);
    });
    return seen.size;
  }

  function filterLabels() {
    const filters = currentFilters();
    const labels = [];
    if (filters.sport && filters.sport !== '全部') labels.push(filters.sport);
    if (filters.team && filters.team !== '全部啦啦隊') labels.push(filters.team);
    if (filters.search) labels.push(`搜尋：${filters.search}`);
    if (filters.nat && filters.nat !== 'all') labels.push(filters.nat === '臺灣' ? '台籍' : filters.nat);
    if (filters.zodiac && filters.zodiac !== 'all') labels.push(filters.zodiac);
    if (filters.role && filters.role !== 'all') labels.push(filters.role === 'cheerleader' ? '一般啦啦隊' : '特殊身分');
    return labels;
  }

  function activeCount() {
    const seen = new Set();
    (Array.isArray(window.dbGirls) ? window.dbGirls : []).forEach(girl => {
      if (isFormer(girl)) return;
      const key = personKey(girl);
      if (key) seen.add(key);
    });
    return seen.size;
  }

  function girlForCard(card) {
    const onclick = card.getAttribute('onclick') || '';
    const match = onclick.match(/openProfile\(['"]([^'"]+)['"]\)/);
    const id = match?.[1];
    if (!id) return null;
    const rows = Array.isArray(window.dbGirls) ? window.dbGirls : [];
    return rows.find(g => personKey(g) === id || String(g?.uid || '').trim() === id) || null;
  }

  function nationalityLabel(nat) {
    const value = String(nat || '').trim();
    if (!value) return '';
    if (value.includes('混血')) return '混血';
    if (/韓國|韓籍/.test(value)) return '韓籍';
    if (/日本|日籍/.test(value)) return '日籍';
    if (/馬來西亞|馬籍/.test(value)) return '馬來西亞籍';
    if (/臺灣|台灣|臺籍|台籍/.test(value)) return '台籍';
    return value.length <= 8 ? value : '外籍';
  }

  function roleLabel(girl) {
    const note = String(girl?.note || '').replace(/(合作夥伴|合作)/g,'').trim();
    if (/吉祥物/.test(note)) return '吉祥物';
    if (/練習生|培訓/.test(note)) return '練習生';
    if (note && !formerPattern.test(note)) return note.length <= 8 ? note : '特殊身分';
    return '';
  }

  function installStyles() {
    if (document.getElementById('girls-roster-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'girls-roster-polish-style';
    style.textContent = `
      .girls-roster-toolbar{display:none}
      body[data-app-mode="girls"] .girls-roster-toolbar{
        width:min(100% - 32px,1160px);
        margin:6px auto 2px;
        padding:0 2px 12px;
        display:flex;
        align-items:end;
        justify-content:space-between;
        gap:16px;
        border-bottom:1px solid rgba(255,255,255,.07);
      }
      .girls-roster-toolbar__eyebrow{
        color:#7dd3fc;
        font:900 9px/1 var(--sport-font);
        letter-spacing:1.8px;
        margin-bottom:6px;
      }
      .girls-roster-toolbar__title{
        display:flex;
        align-items:baseline;
        gap:9px;
        color:#fff;
      }
      .girls-roster-toolbar__title strong{font-size:21px}
      .girls-roster-toolbar__title span{color:#8f9aa8;font-size:11px;font-weight:800}
      .girls-roster-toolbar__filters{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
      .girls-roster-filter-pill{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.035);color:#aeb8c5;font-size:10px;font-weight:850}
      .girls-roster-filter-pill--empty{color:#697481}
      .girls-roster-toolbar__tabs{display:flex;gap:6px}
      .girls-roster-tab{
        min-height:36px;
        padding:0 12px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:999px;
        background:#11161c;
        color:#9aa5b2;
        font-size:11px;
        font-weight:900;
        cursor:pointer;
      }
      .girls-roster-tab.is-active{
        color:#fff;
        border-color:rgba(125,211,252,.35);
        background:rgba(125,211,252,.07);
      }

      body[data-app-mode="girls"] #grid-container{
        grid-template-columns:repeat(auto-fill,minmax(255px,1fr))!important;
        gap:18px!important;
        margin-top:18px!important;
      }
      body[data-app-mode="girls"] #grid-container>.card{
        border:1px solid rgba(255,255,255,.085)!important;
        border-bottom:3px solid var(--team-accent,#fff)!important;
        border-radius:15px!important;
        background:#11161c!important;
        box-shadow:0 10px 26px rgba(0,0,0,.25)!important;
        overflow:hidden!important;
        transform:none!important;
      }
      body[data-app-mode="girls"] #grid-container>.card:hover{
        transform:translateY(-3px)!important;
        box-shadow:0 16px 36px rgba(0,0,0,.34)!important;
        border-color:rgba(255,255,255,.16)!important;
        border-bottom-color:var(--team-accent,#fff)!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .photo-area{
        height:auto!important;
        aspect-ratio:4/5!important;
        border-bottom:1px solid rgba(255,255,255,.07)!important;
        background:#0a0d11!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .photo-area img{
        object-position:top center!important;
      }
      body[data-app-mode="girls"] #grid-container>.card:hover .photo-area img{
        transform:scale(1.025)!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .info-section{
        padding:14px 15px 15px!important;
        background:linear-gradient(180deg,#151a20,#11151a)!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .header-info{
        margin-bottom:9px!important;
        padding-bottom:9px!important;
        border-bottom:1px solid rgba(255,255,255,.07)!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .nickname{
        font-size:20px!important;
        line-height:1.1!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .realname{
        margin-top:5px!important;
        font-size:11px!important;
        letter-spacing:.5px!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .number{
        padding:3px 7px!important;
        border-width:1px!important;
        border-radius:7px!important;
        box-shadow:none!important;
        transform:none!important;
        font-size:13px!important;
        opacity:.8;
      }
      body[data-app-mode="girls"] #grid-container>.card .data-grid{
        gap:0!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .data-row{
        padding:0!important;
        border:0!important;
        font-size:11px!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .data-label{
        display:none!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .team-tags-wrapper{
        justify-content:flex-start!important;
        margin-left:0!important;
        gap:5px!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .team-tag-mini{
        padding:4px 7px!important;
        border-radius:999px!important;
        font-size:10px!important;
        background:rgba(255,255,255,.035)!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .stats-grid{
        display:none!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .ig-link{
        margin-left:3px!important;
        filter:none!important;
        opacity:.72!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .ig-icon{
        width:18px!important;
        height:18px!important;
      }
      body[data-app-mode="girls"] #grid-container>.card .fav-btn{
        width:34px!important;
        height:34px!important;
        top:11px!important;
        right:11px!important;
        box-shadow:0 5px 14px rgba(0,0,0,.28)!important;
        border:1px solid rgba(255,255,255,.15)!important;
      }
      .girls-card-badges{
        position:absolute;
        left:10px;
        bottom:10px;
        z-index:24;
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        max-width:calc(100% - 20px);
      }
      .girls-card-badge{
        padding:5px 8px;
        border-radius:999px;
        background:rgba(6,9,13,.78);
        backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,.14);
        color:#f3f6f9;
        font-size:9px;
        font-weight:900;
        letter-spacing:.25px;
        box-shadow:0 4px 12px rgba(0,0,0,.2);
      }
      .girls-card-badge--role{color:#dbeafe}
      body[data-app-mode="girls"] .photo-note-tag{
        display:none!important;
      }

      @media(max-width:767px){
        body[data-app-mode="girls"] .girls-roster-toolbar{
          width:calc(100% - 20px);
          margin-top:4px;
          padding-bottom:10px;
          align-items:flex-start;
          flex-direction:column;
          gap:9px;
        }
        .girls-roster-toolbar__title strong{font-size:19px}
        .girls-roster-toolbar__filters{margin-top:7px;gap:4px}
        .girls-roster-filter-pill{font-size:9px;min-height:22px;padding:0 7px}
        .girls-roster-toolbar__tabs{width:100%}
        .girls-roster-tab{flex:1;min-height:40px}
        body[data-app-mode="girls"] #grid-container{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:9px!important;
          padding-left:10px!important;
          padding-right:10px!important;
          margin-top:12px!important;
        }
        body[data-app-mode="girls"] #grid-container>.card .info-section{
          padding:10px 10px 11px!important;
        }
        body[data-app-mode="girls"] #grid-container>.card .nickname{
          font-size:16px!important;
        }
        body[data-app-mode="girls"] #grid-container>.card .realname{
          font-size:10px!important;
        }
        body[data-app-mode="girls"] #grid-container>.card .number{
          font-size:10px!important;
          padding:2px 5px!important;
        }
        body[data-app-mode="girls"] #grid-container>.card .team-tag-mini{
          font-size:9px!important;
          padding:3px 6px!important;
        }
        .girls-card-badges{left:7px;bottom:7px;gap:4px}
        .girls-card-badge{font-size:8px;padding:4px 6px}
        body[data-app-mode="girls"] #grid-container>.card .sport-tags{
          top:9px!important;left:9px!important;transform:scale(.84);transform-origin:left top;
        }
        body[data-app-mode="girls"] #grid-container>.card .fav-btn{
          width:30px!important;height:30px!important;top:8px!important;right:8px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureToolbar() {
    const grid = document.getElementById('grid-container');
    if (!grid) return null;
    let toolbar = document.getElementById('girls-roster-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('section');
      toolbar.id = 'girls-roster-toolbar';
      toolbar.className = 'girls-roster-toolbar';
      grid.insertAdjacentElement('beforebegin', toolbar);
      toolbar.addEventListener('click', event => {
        const btn = event.target.closest('[data-girls-view]');
        if (!btn) return;
        if (btn.dataset.girlsView === 'archive') window.setMode?.('archive');
      });
    }
    const shown = [...grid.querySelectorAll(':scope > .card')].filter(card => card.style.display !== 'none').length;
    const total = activeCount();
    const matched = matchedActiveCount();
    const labels = filterLabels();
    const signature = `${shown}|${matched}|${total}|${labels.join('~')}`;
    if (toolbar.dataset.signature !== signature) {
      toolbar.dataset.signature = signature;
      const resultText = labels.length
        ? `目前顯示 ${shown} 位 · 符合篩選 ${matched} 位 · 現役總數 ${total} 位`
        : `目前顯示 ${shown} 位 · 資料庫現役 ${total} 位`;
      toolbar.innerHTML = `
        <div>
          <div class="girls-roster-toolbar__eyebrow">CHEERLEADER ROSTER</div>
          <div class="girls-roster-toolbar__title"><strong>現役女孩</strong><span>${resultText}</span></div>
          <div class="girls-roster-toolbar__filters">
            ${labels.length
              ? labels.map(label => `<span class="girls-roster-filter-pill">${label.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</span>`).join('')
              : '<span class="girls-roster-filter-pill girls-roster-filter-pill--empty">目前顯示全部現役成員</span>'}
          </div>
        </div>
        <div class="girls-roster-toolbar__tabs">
          <button type="button" class="girls-roster-tab is-active" data-girls-view="active">現役女孩</button>
          <button type="button" class="girls-roster-tab" data-girls-view="archive">歷屆成員</button>
        </div>
      `;
    }
    return toolbar;
  }

  function decorateCards() {
    const grid = document.getElementById('grid-container');
    if (!grid || document.body?.dataset.appMode !== 'girls') return;
    grid.querySelectorAll(':scope > .card').forEach(card => {
      card.classList.add('girls-card-refined');
      const photo = card.querySelector('.photo-area');
      if (!photo || photo.querySelector('.girls-card-badges')) return;
      const girl = girlForCard(card);
      if (!girl) return;
      const nat = nationalityLabel(girl.nat);
      const role = roleLabel(girl);
      if (!nat && !role) return;
      const badges = document.createElement('div');
      badges.className = 'girls-card-badges';
      badges.innerHTML = [
        nat ? `<span class="girls-card-badge">${nat}</span>` : '',
        role ? `<span class="girls-card-badge girls-card-badge--role">${role}</span>` : ''
      ].join('');
      photo.appendChild(badges);
    });
  }

  function sync() {
    installStyles();
    const toolbar = document.getElementById('girls-roster-toolbar');
    if (document.body?.dataset.appMode !== 'girls') {
      if (toolbar) toolbar.style.display = 'none';
      return;
    }
    const legacyFormer = document.getElementById('former-roster');
    if (legacyFormer) {
      legacyFormer.hidden = true;
      legacyFormer.open = false;
    }
    ensureToolbar();
    if (toolbar) toolbar.style.display = '';
    decorateCards();
  }

  function wrapRender() {
    for (const name of ['renderGirls','renderContent']) {
      const original = window[name];
      if (typeof original !== 'function' || original.__girlsRosterPolish) continue;
      const wrapped = function(...args) {
        const result = original.apply(this,args);
        requestAnimationFrame(sync);
        return result;
      };
      wrapped.__girlsRosterPolish = true;
      window[name] = wrapped;
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    wrapRender();
    if (document.body?.dataset.appMode === 'girls') sync();
    if (attempts > 80) clearInterval(timer);
  },100);

  const observer = new MutationObserver(() => {
    if (document.body?.dataset.appMode === 'girls') requestAnimationFrame(sync);
  });
  observer.observe(document.body,{attributes:true,attributeFilter:['data-app-mode']});
  const main = document.getElementById('main-content');
  if (main) observer.observe(main,{childList:true,subtree:true});

  window.refreshGirlsRosterPolish = sync;
})();
