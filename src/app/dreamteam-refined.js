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
      body[data-app-mode="dreamteam"] #dreamteam-container{width:100%!important;max-width:1080px!important;margin:0 auto!important;padding:10px 16px 56px!important;box-sizing:border-box;text-align:center}
      body[data-app-mode="dreamteam"] #dreamteam-container>.game-title{width:100%;text-align:center!important;margin-left:auto!important;margin-right:auto!important}
      body[data-app-mode="dreamteam"] #dreamteam-container>.dt-setup-card,
      body[data-app-mode="dreamteam"] #dreamteam-container>.dt-refined-status,
      body[data-app-mode="dreamteam"] #dreamteam-container>.dt-slots-grid,
      body[data-app-mode="dreamteam"] #dreamteam-container>.dt-tactical-board,
      body[data-app-mode="dreamteam"] #dreamteam-container>.dt-poster{margin-left:auto!important;margin-right:auto!important}
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
      body[data-app-mode="dreamteam"] .dt-setup-card{width:min(100%,760px)!important;max-width:760px!important;margin:0 auto 20px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:22px!important;background:radial-gradient(circle at 92% 0,rgba(245,158,11,.10),transparent 32%),#0d1116!important;padding:22px!important;box-shadow:0 22px 70px rgba(0,0,0,.32)!important}
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
      body[data-app-mode="dreamteam"] .dt-refined-selector-shell{height:100%!important;padding:0!important;background:#0b0f14!important}
      body[data-app-mode="dreamteam"] .dt-refined-selector-head{position:sticky;top:0;z-index:10;padding:16px 16px 12px;background:rgba(11,15,20,.96);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.08)}
      body[data-app-mode="dreamteam"] .dt-refined-selector-role{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:10px}
      body[data-app-mode="dreamteam"] .dt-refined-selector-role span{font:900 10px/1 var(--sport-font);letter-spacing:1.5px;color:#94a3b8}
      body[data-app-mode="dreamteam"] .dt-refined-selector-role strong{font-size:18px;color:#fff;text-align:left}
      body[data-app-mode="dreamteam"] .dt-modal-filters{display:grid!important;grid-template-columns:1fr 1fr;gap:8px!important;margin-bottom:8px!important}
      body[data-app-mode="dreamteam"] .dt-modal-filters select,
      body[data-app-mode="dreamteam"] #dtSearchInput{min-height:44px!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.12)!important;background:#11161c!important;color:#fff!important}
      body[data-app-mode="dreamteam"] #dt-selector-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;padding:14px 16px 26px!important}
      body[data-app-mode="dreamteam"] .dt-pick-card{border-radius:14px!important;overflow:hidden!important;border:1px solid rgba(255,255,255,.08)!important;background:#11161c!important;box-shadow:none!important;transition:transform .16s ease,border-color .16s ease!important}
      body[data-app-mode="dreamteam"] .dt-pick-card:hover{transform:translateY(-3px);border-color:var(--modal-accent,#fff)!important}
      body[data-app-mode="dreamteam"] .dt-pick-card>div:first-child{aspect-ratio:4/5!important;background:#0a0d11!important}
      body[data-app-mode="dreamteam"] .dt-pick-card>div:first-child img{object-position:top center!important}
      body[data-app-mode="dreamteam"] .dt-pick-name{padding:10px 9px!important;text-align:left!important;background:linear-gradient(180deg,#151a20,#101419)!important}
      body[data-app-mode="dreamteam"] .dt-pick-name>div:first-child{font-size:14px!important;font-weight:950!important;color:#fff!important}
      .dt-refined-pick-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.dt-refined-pick-meta span{padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.055);color:#8f9aa8;font-size:9px;font-weight:800}
      body[data-app-mode="dreamteam"] .dt-refined-poster-mode{max-width:900px!important}
      .dt-share-shell{width:min(100%,760px);margin:0 auto}
      .dt-share-note{margin:0 auto 12px;color:#94a3b8;font-size:12px;font-weight:750;text-align:center}
      body[data-app-mode="dreamteam"] .dt-poster{position:relative!important;width:min(100%,760px)!important;max-width:760px!important;padding:34px 28px 28px!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:24px!important;background:radial-gradient(circle at 85% 0,rgba(255,0,68,.12),transparent 30%),linear-gradient(155deg,#11161d,#090c10)!important;box-shadow:0 30px 80px rgba(0,0,0,.55)!important}
      body[data-app-mode="dreamteam"] .dt-poster-title{margin-top:5px!important;font-size:clamp(36px,7vw,62px)!important;line-height:.95!important;letter-spacing:-1px!important;text-shadow:none!important}
      body[data-app-mode="dreamteam"] .dt-poster-sub{margin:8px 0 22px!important;color:#9ca3af!important;font-size:13px!important;font-weight:850!important;letter-spacing:.4px}
      body[data-app-mode="dreamteam"] .dt-poster-grid{gap:10px!important}
      body[data-app-mode="dreamteam"] .dt-poster-item{overflow:hidden!important;border-radius:16px!important;border:1px solid rgba(255,255,255,.1)!important;background:#11161c!important;box-shadow:0 12px 28px rgba(0,0,0,.3)!important}
      body[data-app-mode="dreamteam"] .dt-poster-item img{aspect-ratio:4/5!important;object-fit:cover!important;object-position:top center!important}
      body[data-app-mode="dreamteam"] .dt-poster-info{background:linear-gradient(180deg,rgba(10,13,17,.82),#090c10)!important;padding:9px 7px 10px!important}
      .dt-refined-poster-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:6px;text-align:left}
      .dt-refined-poster-head span{font:900 9px/1 var(--sport-font);letter-spacing:2px;color:#9ca3af}.dt-refined-poster-head strong{display:block;margin-top:5px;color:#fff;font-size:17px}.dt-refined-poster-badge{padding:7px 9px;border:1px solid rgba(255,255,255,.13);border-radius:999px;color:#cbd5e1;font:900 9px/1 var(--sport-font);letter-spacing:1px;white-space:nowrap}
      .dt-refined-poster-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);color:#66717f;font:900 8px/1 var(--sport-font);letter-spacing:1.5px}
      body[data-app-mode="dreamteam"] .dt-tactical-board.dt-share-board{width:min(100%,720px)!important;max-width:720px!important;border-width:1px!important;border-radius:24px!important;box-shadow:0 30px 80px rgba(0,0,0,.58)!important}
      .dt-share-board .dt-refined-poster-head{position:absolute;z-index:20;left:18px;right:18px;top:16px;padding:12px 14px;border-radius:13px;background:rgba(5,8,11,.65);backdrop-filter:blur(10px)}
      .dt-share-board .dt-refined-poster-foot{position:absolute;z-index:20;left:18px;right:18px;bottom:14px;margin:0;padding:10px 12px;border:0;border-radius:10px;background:rgba(5,8,11,.62);backdrop-filter:blur(8px);color:#a1aab5}
      .dt-share-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin:18px auto 0}.dt-share-actions .nav-btn{min-width:130px}
      @media(max-width:900px){body[data-app-mode="dreamteam"] #dt-selector-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
      @media(max-width:700px){.dt-refined-choice-grid{grid-template-columns:1fr}.dt-refined-status{align-items:flex-start}.dt-refined-status__count strong{font-size:21px}
        body[data-app-mode="dreamteam"] #dreamteam-container{padding-left:10px!important;padding-right:10px!important}
        body[data-app-mode="dreamteam"] #dt-selector-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;padding:10px 10px 22px!important;gap:8px!important}
        body[data-app-mode="dreamteam"] .dt-refined-selector-head{padding:13px 10px 10px}
        body[data-app-mode="dreamteam"] .dt-modal-filters{grid-template-columns:1fr 1fr}
        body[data-app-mode="dreamteam"] .dt-poster{padding:24px 14px 20px!important;border-radius:18px!important}
        .dt-refined-poster-head{align-items:flex-start;flex-direction:column;gap:8px}
        .dt-refined-poster-foot{font-size:7px}
        .dt-share-board .dt-refined-poster-head{left:10px;right:10px;top:10px;padding:9px 10px}
        .dt-share-board .dt-refined-poster-foot{left:10px;right:10px;bottom:9px}
      }
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
    const shell = modal.firstElementChild;
    if (!shell || shell.dataset.refinedSelector === '1') return;
    shell.dataset.refinedSelector = '1';
    shell.classList.add('dt-refined-selector-shell');

    const search = modal.querySelector('#dtSearchInput');
    if (search) search.placeholder = '搜尋姓名或綽號';

    const headerArea = shell.firstElementChild;
    if (headerArea) {
      headerArea.classList.add('dt-refined-selector-head');
      const topRow = headerArea.firstElementChild;
      if (topRow) {
        const roleText = topRow.firstElementChild?.textContent?.trim() || '選擇女孩';
        topRow.className = 'dt-refined-selector-role';
        topRow.innerHTML = `<div><span>NOW DRAFTING</span><strong>${stripEmoji(roleText)}</strong></div><span>選擇一位女孩加入陣容</span>`;
      }
    }

    modal.querySelectorAll('.dt-pick-card').forEach(card => {
      const info = card.querySelector('.dt-pick-name');
      if (!info || info.querySelector('.dt-refined-pick-meta')) return;
      const team = String(card.dataset.team || '').trim().split(/\s{2,}/)[0];
      const sport = String(card.dataset.sport || '').trim().split(/\s+/)[0];
      const meta = document.createElement('div');
      meta.className = 'dt-refined-pick-meta';
      if (team) meta.insertAdjacentHTML('beforeend', `<span>${team}</span>`);
      if (sport) meta.insertAdjacentHTML('beforeend', `<span>${sport}</span>`);
      info.appendChild(meta);
    });
  }

  function decoratePoster() {
    const root = document.getElementById('dreamteam-container');
    if (!root) return;
    const poster = root.querySelector('.dt-poster');
    const board = root.querySelector('.dt-tactical-board .dt-watermark')?.closest('.dt-tactical-board');
    const target = poster || board;
    if (!target || target.dataset.refinedPoster === '1') return;

    target.dataset.refinedPoster = '1';
    root.classList.add('dt-refined-poster-mode');
    const subtitle = stripEmoji(root.querySelector('.dt-poster-sub,.dt-watermark-sub')?.textContent || '夢幻應援陣容');
    const titleText = poster ? 'MY DREAM TEAM' : 'TACTICAL DREAM TEAM';

    const head = document.createElement('div');
    head.className = 'dt-refined-poster-head';
    head.innerHTML = `<div><span>TAIWAN CHEERLEADER DATABASE</span><strong>${titleText}</strong></div><div class="dt-refined-poster-badge">${subtitle}</div>`;

    const foot = document.createElement('div');
    foot.className = 'dt-refined-poster-foot';
    foot.innerHTML = '<span>CHEERLEADER DB · TAIWAN</span><span>MY DREAM TEAM</span>';

    if (poster) {
      poster.prepend(head);
      poster.appendChild(foot);
    } else {
      board.classList.add('dt-share-board');
      board.prepend(head);
      board.appendChild(foot);
      board.querySelector('.dt-watermark')?.remove();
    }

    const title = root.querySelector('.game-title');
    if (title) {
      title.textContent = '夢幻陣容完成';
      title.style.textShadow = 'none';
    }
    [...root.children].forEach(child => {
      if (child === target || child === title || child.classList?.contains('game-ux-toolbar')) return;
      if (child.matches?.('.dt-refined-kicker,.dt-refined-sub,.dt-refined-status')) child.remove();
    });

    const textNodes = [...root.querySelectorAll(':scope > div')].filter(el => /截圖|隱藏介面|手機/.test(el.textContent || ''));
    textNodes.forEach(el => {
      el.className = 'dt-share-note';
      el.textContent = '成果卡已整理完成，可直接截圖分享。';
    });

    const actionWrap = [...root.querySelectorAll(':scope > div')].find(el => el.querySelector('.nav-btn'));
    if (actionWrap) actionWrap.classList.add('dt-share-actions');
  }

  function decorate() {
    installStyles();
    if (document.body?.dataset.appMode !== 'dreamteam') return;
    decorateSetup();
    decorateActive();
    decorateSelector();
    decoratePoster();
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
    wrap('generateDtPoster');
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
