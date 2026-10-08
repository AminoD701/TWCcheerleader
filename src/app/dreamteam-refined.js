(() => {
  const stripEmoji = value => String(value || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const typeMeta = {
    original: { eyebrow: 'CLASSIC FIVE', title: '經典應援五人組', desc: '用五個不同定位組成你的核心應援陣容。' },
    baseball: { eyebrow: 'BASEBALL TEN', title: '棒球戰術陣容', desc: '十人完整站位，用棒球守備概念排出你的夢幻隊伍。' },
    basketball: { eyebrow: 'BASKETBALL FIVE', title: '籃球先發五人', desc: '五個位置各司其職，打造你的場上先發陣容。' },
    volleyball: { eyebrow: 'VOLLEYBALL SIX', title: '排球六人陣容', desc: '依前後排與角色配置完成六人戰術板。' }
  };

  const ruleMeta = {
    free: { eyebrow: 'FREE DRAFT', title: '跨隊自由選秀', desc: '不限制球隊，從現役資料庫自由組出你的理想名單。' },
    same: { eyebrow: 'TEAM ONLY', title: '單一球隊專屬', desc: '只從指定球隊選人，看看你最理想的隊內配置。' }
  };

  function installStyles() {
    if (document.getElementById('dreamteam-refined-style')) return;
    const style = document.createElement('style');
    style.id = 'dreamteam-refined-style';
    style.textContent = `
      body[data-app-mode="dreamteam"] #dreamteam-container{max-width:1080px!important;margin:0 auto!important;padding:10px 16px 56px!important;box-sizing:border-box}
      .dt-refined-kicker{text-align:center;color:#fbbf24;font:900 10px/1 var(--sport-font);letter-spacing:2.2px;margin-bottom:8px}
      .dt-refined-sub{text-align:center;color:#94a3b8;font-size:13px;line-height:1.65;max-width:620px;margin:0 auto 20px}
      .dt-refined-setup{display:grid;gap:18px}
      .dt-refined-section{padding:18px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:linear-gradient(145deg,#141920,#0d1015)}
      .dt-refined-section__head{margin-bottom:11px}.dt-refined-section__head span{display:block;color:#fbbf24;font:900 9px/1 var(--sport-font);letter-spacing:1.7px;margin-bottom:5px}.dt-refined-section__head strong{font-size:16px;color:#fff}
      .dt-refined-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .dt-refined-choice{border:1px solid rgba(255,255,255,.10);border-radius:14px;background:#11161c;color:#fff;padding:14px;text-align:left;cursor:pointer;transition:.18s ease}
      .dt-refined-choice:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.24)}
      .dt-refined-choice.is-active{border-color:#fbbf24;box-shadow:0 0 0 1px #fbbf24 inset;background:rgba(251,191,36,.07)}
      .dt-refined-choice span{display:block;color:#9ca3af;font:900 9px/1 var(--sport-font);letter-spacing:1.4px}
      .dt-refined-choice strong{display:block;margin:6px 0 5px;font-size:15px}.dt-refined-choice small{display:block;color:#85909e;line-height:1.5;font-size:11px}
      .dt-refined-team-select{margin-top:10px}.dt-refined-team-select select{width:100%;min-height:48px;padding:0 12px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:#0c1015;color:#fff;font-weight:850}
      .dt-refined-create{width:100%;min-height:52px;margin-top:3px;border:0;border-radius:13px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#171106;font-weight:950;cursor:pointer;letter-spacing:.3px}
      .dt-refined-status{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:0 auto 18px;padding:13px 15px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:#10151b}
      .dt-refined-status__main span{display:block;color:#94a3b8;font:900 9px/1 var(--sport-font);letter-spacing:1.4px}.dt-refined-status__main strong{display:block;color:#fff;font-size:16px;margin-top:4px}
      .dt-refined-status__count{text-align:right}.dt-refined-status__count strong{display:block;color:#fbbf24;font:950 24px/1 var(--sport-font)}.dt-refined-status__count small{color:#94a3b8;font-size:10px}
      .dt-refined-progress{height:5px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:9px}.dt-refined-progress>i{display:block;height:100%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:999px}
      body[data-app-mode="dreamteam"] .dt-setup-card{max-width:760px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:22px!important;background:radial-gradient(circle at 92% 0,rgba(245,158,11,.10),transparent 32%),#0d1116!important;padding:22px!important;box-shadow:0 22px 70px rgba(0,0,0,.32)!important}
      body[data-app-mode="dreamteam"] .dt-setup-card>.dt-setup-label,
      body[data-app-mode="dreamteam"] .dt-setup-card>#dt-setup-type,
      body[data-app-mode="dreamteam"] .dt-setup-card>#dt-setup-rule,
      body[data-app-mode="dreamteam"] .dt-setup-card>.enter-btn{display:none!important}
      body[data-app-mode="dreamteam"] .dt-empty-icon,
      body[data-app-mode="dreamteam"] .dt-token-empty{font-size:0!important}
      body[data-app-mode="dreamteam"] .dt-empty-icon::before,
      body[data-app-mode="dreamteam"] .dt-token-empty::before{content:'+';font:300 32px/1 var(--sport-font);color:#7f8a99}
      body[data-app-mode="dreamteam"] .dt-slot{border-radius:18px!important;overflow:hidden!important;transition:transform .18s ease,border-color .18s ease!important}
      body[data-app-mode="dreamteam"] .dt-slot:hover{transform:translateY(-3px)}
      body[data-app-mode="dreamteam"] .dt-role-badge{letter-spacing:.5px!important;font-size:10px!important}
      body[data-app-mode="dreamteam"] .dt-name{font-weight:950!important}
      body[data-app-mode="dreamteam"] .dt-tactical-board{border-radius:22px!important;overflow:hidden!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 24px 70px rgba(0,0,0,.4)!important}
      body[data-app-mode="dreamteam"] .dt-token-img-wrap{box-shadow:0 8px 24px rgba(0,0,0,.35)!important}
      body[data-app-mode="dreamteam"] .dt-token-info{backdrop-filter:blur(7px)}
      body[data-app-mode="dreamteam"] .nav-btn{border-radius:11px!important;font-weight:900!important}
      body[data-app-mode="dreamteam"] .dt-modal-filters select,
      body[data-app-mode="dreamteam"] #dtSearchInput{border-radius:10px!important;border:1px solid rgba(255,255,255,.12)!important;background:#0f141a!important}
      body[data-app-mode="dreamteam"] .dt-pick-card{border-radius:12px!important;overflow:hidden!important;border:1px solid rgba(255,255,255,.08)!important}
      @media(max-width:700px){.dt-refined-choice-grid{grid-template-columns:1fr}.dt-refined-status{align-items:flex-start}.dt-refined-status__count strong{font-size:21px}}
    `;
    document.head.appendChild(style);
  }

  function decorateSetup() {
    const root = document.getElementById('dreamteam-container');
    const card = root?.querySelector('.dt-setup-card');
    const typeSelect = document.getElementById('dt-setup-type');
    const ruleSelect = document.getElementById('dt-setup-rule');
    if (!root || !card || !typeSelect || !ruleSelect || card.querySelector('.dt-refined-setup')) return;

    const title = root.querySelector('.game-title');
    if (title) {
      title.textContent = '夢幻陣容';
      title.style.textShadow = 'none';
      title.insertAdjacentHTML('beforebegin','<div class="dt-refined-kicker">DREAM TEAM BUILDER</div>');
      title.insertAdjacentHTML('afterend','<div class="dt-refined-sub">從規則、球隊到每一個位置都由你決定。組出真正屬於你的應援夢幻隊。</div>');
    }

    const setup = document.createElement('div');
    setup.className = 'dt-refined-setup';
    setup.innerHTML = `
      <section class="dt-refined-section">
        <div class="dt-refined-section__head"><span>01 · FORMATION</span><strong>選擇陣容配置</strong></div>
        <div class="dt-refined-choice-grid" data-dt-type-grid>
          ${Object.entries(typeMeta).map(([key,meta])=>`
            <button type="button" class="dt-refined-choice ${typeSelect.value===key?'is-active':''}" data-dt-type="${key}">
              <span>${meta.eyebrow}</span><strong>${meta.title}</strong><small>${meta.desc}</small>
            </button>`).join('')}
        </div>
      </section>
      <section class="dt-refined-section">
        <div class="dt-refined-section__head"><span>02 · DRAFT RULE</span><strong>設定招募規則</strong></div>
        <div class="dt-refined-choice-grid" data-dt-rule-grid>
          ${Object.entries(ruleMeta).map(([key,meta])=>`
            <button type="button" class="dt-refined-choice ${ruleSelect.value===key?'is-active':''}" data-dt-rule="${key}">
              <span>${meta.eyebrow}</span><strong>${meta.title}</strong><small>${meta.desc}</small>
            </button>`).join('')}
        </div>
        <div class="dt-refined-team-select" data-dt-team-wrap hidden>
          <select data-dt-team-select></select>
        </div>
      </section>
      <button type="button" class="dt-refined-create">建立夢幻陣容</button>`;
    card.appendChild(setup);

    const legacyTeam = document.getElementById('dt-setup-team');
    const teamWrap = setup.querySelector('[data-dt-team-wrap]');
    const teamSelect = setup.querySelector('[data-dt-team-select]');
    if (legacyTeam && teamSelect) {
      teamSelect.innerHTML = legacyTeam.innerHTML;
      teamSelect.value = legacyTeam.value;
      teamSelect.addEventListener('change', () => { legacyTeam.value = teamSelect.value; });
    }

    const syncRuleUI = () => {
      setup.querySelectorAll('[data-dt-rule]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.dtRule === ruleSelect.value));
      if (teamWrap) teamWrap.hidden = ruleSelect.value !== 'same';
      const legacyBox = document.getElementById('dt-setup-team-box');
      if (legacyBox) legacyBox.style.display = 'none';
    };

    setup.querySelector('[data-dt-type-grid]')?.addEventListener('click', event => {
      const btn = event.target.closest('[data-dt-type]');
      if (!btn) return;
      typeSelect.value = btn.dataset.dtType;
      setup.querySelectorAll('[data-dt-type]').forEach(x => x.classList.toggle('is-active', x === btn));
    });

    setup.querySelector('[data-dt-rule-grid]')?.addEventListener('click', event => {
      const btn = event.target.closest('[data-dt-rule]');
      if (!btn) return;
      ruleSelect.value = btn.dataset.dtRule;
      ruleSelect.dispatchEvent(new Event('change', { bubbles:true }));
      syncRuleUI();
    });

    setup.querySelector('.dt-refined-create')?.addEventListener('click', () => {
      if (legacyTeam && teamSelect) legacyTeam.value = teamSelect.value;
      window.initDreamTeam?.();
    });
    syncRuleUI();
  }

  function decorateActive() {
    const root = document.getElementById('dreamteam-container');
    if (!root || root.querySelector('.dt-refined-status')) return;
    const slots = [...root.querySelectorAll('.dt-slot,.dt-token')];
    if (!slots.length) return;

    const filled = slots.filter(slot => slot.querySelector('img')).length;
    const total = slots.length;
    const title = root.querySelector('.game-title');
    if (title) {
      title.textContent = stripEmoji(title.textContent);
      title.style.textShadow = 'none';
    }

    const status = document.createElement('div');
    status.className = 'dt-refined-status';
    status.innerHTML = `
      <div class="dt-refined-status__main">
        <span>ROSTER STATUS</span>
        <strong>${filled === total ? '陣容已完成，可以檢視成果' : `還差 ${total-filled} 個位置完成編制`}</strong>
        <div class="dt-refined-progress"><i style="width:${total?Math.round(filled/total*100):0}%"></i></div>
      </div>
      <div class="dt-refined-status__count"><strong>${filled}/${total}</strong><small>已選位置</small></div>`;
    const board = root.querySelector('.dt-slots-grid,.dt-tactical-board');
    board?.insertAdjacentElement('beforebegin', status);

    root.querySelectorAll('button,.nav-btn').forEach(btn => {
      const txt = stripEmoji(btn.textContent);
      if (/完成編制/.test(txt)) btn.textContent = '完成編制 · 檢視成果';
      else if (/完成佈陣/.test(txt)) btn.textContent = '完成佈陣 · 檢視戰術板';
      else if (/重新設定賽制/.test(txt)) btn.textContent = '重新設定';
      else if (/返回修改/.test(txt)) btn.textContent = '返回修改';
      else if (/重建/.test(txt)) btn.textContent = '重新建立';
      else if (txt) btn.textContent = txt;
    });

    root.querySelectorAll('.dt-empty-icon,.dt-token-empty').forEach(el => { el.textContent = ''; });
  }

  function decorateSelector() {
    const modal = document.getElementById('modal-dynamic-content');
    if (!modal) return;
    const search = modal.querySelector('#dtSearchInput');
    if (search) search.placeholder = '搜尋姓名或綽號';
    modal.querySelectorAll('div').forEach(div => {
      if (div.children.length) return;
      const txt = div.textContent.trim();
      if (/滑動可收起鍵盤/.test(txt)) div.textContent = '向下滑動可收起鍵盤';
      if (/已鎖定招募/.test(txt)) div.textContent = stripEmoji(txt);
    });
  }

  function decorate() {
    installStyles();
    if (document.body?.dataset.appMode !== 'dreamteam') return;
    decorateSetup();
    decorateActive();
    decorateSelector();
  }

  function wrap(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__dreamteamRefined) return;
    const wrapped = function(...args) {
      const result = original.apply(this,args);
      requestAnimationFrame(decorate);
      return result;
    };
    wrapped.__dreamteamRefined = true;
    window[name] = wrapped;
  }

  function boot() {
    installStyles();
    wrap('renderDreamTeamStart');
    wrap('openDtSelector');
    wrap('pickDtGirl');
    if (document.body?.dataset.appMode === 'dreamteam') requestAnimationFrame(decorate);
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    boot();
    if((window.renderDreamTeamStart?.__dreamteamRefined && window.openDtSelector?.__dreamteamRefined)||tries>80) clearInterval(timer);
  },100);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
