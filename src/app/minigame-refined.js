(() => {
  let locked = false;
  let runStats = { picks: 0, championPicks: new Map(), startSize: 0 };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const stripEmoji = value => String(value || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s{2,}/g, ' ').trim();

  function installStyles() {
    if (document.getElementById('minigame-refined-style')) return;
    const style = document.createElement('style');
    style.id = 'minigame-refined-style';
    style.textContent = `
      body[data-app-mode="minigame"] #minigame-container{max-width:1080px!important;margin:0 auto!important;padding:10px 16px 50px!important;box-sizing:border-box}
      .mg-refined-kicker{text-align:center;font:900 11px/1 var(--sport-font);letter-spacing:2.2px;color:#9ca3af;margin-bottom:8px}
      .mg-refined-sub{text-align:center;color:#9ca3af;font-size:13px;font-weight:700;line-height:1.6;margin:4px auto 20px;max-width:560px}
      .mg-refined-progress{width:min(100%,720px);margin:0 auto 22px}
      .mg-refined-progress__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#cbd5e1;font-size:12px;font-weight:900;margin-bottom:8px}
      .mg-refined-progress__track{height:7px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}
      .mg-refined-progress__fill{height:100%;width:0;background:linear-gradient(90deg,#8b5cf6,#e879f9);border-radius:999px;transition:width .35s ease}
      body[data-app-mode="minigame"] .dt-setup-card{border:1px solid rgba(168,85,247,.4)!important;border-radius:22px!important;background:radial-gradient(circle at 85% 0,rgba(168,85,247,.14),transparent 34%),linear-gradient(145deg,#151922,#0b0d12)!important;padding:24px!important;box-shadow:0 22px 60px rgba(0,0,0,.34)!important}
      body[data-app-mode="minigame"] .dt-setup-label{font-size:12px!important;letter-spacing:1.4px!important;color:#c4b5fd!important;margin-top:16px!important}
      body[data-app-mode="minigame"] .dt-setup-select{min-height:52px!important;border-radius:12px!important;border:1px solid rgba(255,255,255,.14)!important;background:#10141a!important;color:#fff!important;font-weight:850!important}
      body[data-app-mode="minigame"] .enter-btn{border-radius:13px!important;box-shadow:none!important;min-height:52px!important;background:linear-gradient(135deg,#7c3aed,#c026d3)!important;transition:transform .18s ease,filter .18s ease!important}
      body[data-app-mode="minigame"] .enter-btn:hover{transform:translateY(-2px)!important;filter:brightness(1.08)}
      body[data-app-mode="minigame"] .vs-container{display:grid!important;grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr)!important;align-items:center!important;gap:14px!important;width:min(100%,940px)!important;margin:0 auto!important}
      body[data-app-mode="minigame"] .vs-card{position:relative!important;overflow:hidden!important;border-radius:24px!important;border:1px solid rgba(255,255,255,.13)!important;background:#0c0f14!important;box-shadow:0 18px 50px rgba(0,0,0,.38)!important;cursor:pointer!important;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease,opacity .32s ease,filter .32s ease!important;min-width:0}
      body[data-app-mode="minigame"] .vs-card::before{content:'CHOOSE';position:absolute;z-index:3;top:13px;left:13px;padding:6px 9px;border-radius:999px;background:rgba(0,0,0,.56);backdrop-filter:blur(8px);color:#fff;font:900 9px/1 var(--sport-font);letter-spacing:1.4px;border:1px solid rgba(255,255,255,.15)}
      body[data-app-mode="minigame"] .vs-card:hover{transform:translateY(-6px) scale(1.008)!important;border-color:var(--team-accent,#fff)!important;box-shadow:0 24px 65px rgba(0,0,0,.5),0 0 0 1px var(--team-accent,#fff)!important}
      body[data-app-mode="minigame"] .vs-card img{width:100%!important;height:auto!important;aspect-ratio:4/5!important;object-fit:cover!important;object-position:top center!important;display:block!important}
      body[data-app-mode="minigame"] .vs-info{position:absolute!important;inset:auto 0 0!important;padding:60px 18px 18px!important;background:linear-gradient(transparent,rgba(3,5,8,.96))!important}
      body[data-app-mode="minigame"] .vs-name{font-size:clamp(22px,3.5vw,34px)!important;font-weight:950!important;text-align:center!important;color:#fff!important;text-shadow:0 3px 12px rgba(0,0,0,.8)}
      body[data-app-mode="minigame"] .vs-badge{position:relative!important;z-index:5!important;width:64px!important;height:64px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:linear-gradient(145deg,#181c24,#090b0f)!important;border:1px solid rgba(255,255,255,.18)!important;color:#fff!important;font:950 20px/1 var(--sport-font)!important;box-shadow:0 10px 30px rgba(0,0,0,.45)!important}
      body[data-app-mode="minigame"] .vs-card.is-picked{transform:scale(1.025)!important;border-color:var(--team-accent,#fff)!important;box-shadow:0 0 0 2px var(--team-accent,#fff),0 25px 70px rgba(0,0,0,.5)!important}
      body[data-app-mode="minigame"] .vs-card.is-picked::after{content:'✓ YOUR PICK';position:absolute;z-index:6;right:13px;top:13px;padding:7px 10px;border-radius:999px;background:var(--team-accent,#fff);color:#080a0d;font:950 9px/1 var(--sport-font);letter-spacing:1px}
      body[data-app-mode="minigame"] .vs-card.is-lost{opacity:.28!important;filter:grayscale(.7)!important;transform:scale(.97)!important}
      .mg-refined-final-badge{display:inline-flex;align-items:center;gap:7px;margin:0 auto 16px;padding:8px 12px;border-radius:999px;background:rgba(250,204,21,.09);border:1px solid rgba(250,204,21,.28);color:#fde68a;font:900 11px/1 var(--sport-font);letter-spacing:1.3px}
      .mg-refined-stats{width:min(100%,450px);margin:18px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .mg-refined-stat{padding:13px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.025);text-align:center}
      .mg-refined-stat strong{display:block;color:#fff;font:950 20px/1 var(--sport-font);margin-bottom:5px}.mg-refined-stat span{color:#94a3b8;font-size:11px;font-weight:800}
      @media(max-width:720px){
        body[data-app-mode="minigame"] #minigame-container{padding:6px 10px 36px!important}
        body[data-app-mode="minigame"] .vs-container{grid-template-columns:1fr 44px 1fr!important;gap:6px!important}
        body[data-app-mode="minigame"] .vs-badge{width:42px!important;height:42px!important;font-size:13px!important}
        body[data-app-mode="minigame"] .vs-card{border-radius:16px!important}
        body[data-app-mode="minigame"] .vs-card::before{top:8px;left:8px;padding:5px 7px;font-size:7px}
        body[data-app-mode="minigame"] .vs-info{padding:45px 7px 11px!important}
        body[data-app-mode="minigame"] .vs-name{font-size:clamp(16px,5vw,24px)!important}
        body[data-app-mode="minigame"] .vs-card.is-picked::after{right:7px;top:7px;font-size:7px;padding:5px 6px}
      }
    `;
    document.head.appendChild(style);
  }

  function routeIsMinigame() {
    return document.body?.dataset.appMode === 'minigame' || new URLSearchParams(location.search).get('mode') === 'minigame';
  }

  function decorateStart() {
    if (!routeIsMinigame()) return;
    const root = document.getElementById('minigame-container');
    if (!root || root.querySelector('.mg-refined-kicker')) return;
    const title = root.querySelector('.game-title');
    if (title) {
      title.textContent = '殘酷二選一';
      title.insertAdjacentHTML('beforebegin','<div class="mg-refined-kicker">ULTIMATE CHOICE</div>');
      title.insertAdjacentHTML('afterend','<div class="mg-refined-sub">沒有安全答案。一路選到最後，看看誰才是你的絕對本命。</div>');
    }
    const type = document.getElementById('mg-setup-type');
    const size = document.getElementById('mg-setup-round');
    [type,size].forEach(select => {
      [...(select?.options || [])].forEach(option => { option.textContent = stripEmoji(option.textContent); });
    });
    const update = () => {
      const n = Number(size?.value || 32);
      const btn = root.querySelector('.enter-btn');
      if (btn) btn.textContent = `開始 ${n} 強對決 · 共 ${Math.max(1,n-1)} 次選擇`;
    };
    size?.addEventListener('change', update);
    update();
  }

  function matchNumbers() {
    const root = document.getElementById('minigame-container');
    const txt = root?.textContent || '';
    const match = txt.match(/MATCH\s+(\d+)\s*\/\s*(\d+)/i);
    const roundMatch = txt.match(/(\d+)\s*強/);
    return {
      current: match ? Number(match[1]) : 1,
      total: match ? Number(match[2]) : 1,
      round: roundMatch ? Number(roundMatch[1]) : 2
    };
  }

  function decorateMatch() {
    if (!routeIsMinigame()) return;
    const root = document.getElementById('minigame-container');
    const vs = root?.querySelector('.vs-container');
    if (!root || !vs || root.querySelector('.mg-refined-progress')) return;

    const title = root.querySelector('.game-title');
    if (title) {
      title.textContent = stripEmoji(title.textContent);
      title.style.textShadow = 'none';
    }
    const { current,total,round } = matchNumbers();
    const progress = Math.max(0,Math.min(100,((current-1)/Math.max(total,1))*100));
    const bar = document.createElement('div');
    bar.className = 'mg-refined-progress';
    bar.innerHTML = `
      <div class="mg-refined-progress__meta"><span>${round===2?'FINAL':round+' 強'} · 第 ${current} 場</span><span>本輪剩 ${Math.max(0,total-current+1)} 場</span></div>
      <div class="mg-refined-progress__track"><div class="mg-refined-progress__fill" style="width:${progress}%"></div></div>`;
    vs.insertAdjacentElement('beforebegin',bar);

    const cards=[...vs.querySelectorAll('.vs-card')];
    cards.forEach((card,index)=>{
      card.dataset.choice=index===0?'A':'B';
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-label',`選擇 ${card.querySelector('.vs-name')?.textContent?.trim()||'女孩'}`);
      card.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();window.pickMinigameWinner?.(card.dataset.choice);}
      });
    });
  }

  function decorateWinner() {
    if (!routeIsMinigame()) return;
    const root=document.getElementById('minigame-container');
    if(!root||root.querySelector('.mg-refined-final-badge')) return;
    const title=root.querySelector('.game-title');
    if (title) {
      title.textContent = stripEmoji(title.textContent);
      title.style.textShadow = 'none';
      title.insertAdjacentHTML('afterend','<div style="text-align:center"><span class="mg-refined-final-badge">YOUR CHAMPION</span></div>');
    }
    const champion = window.currentMgMatch
      ? [window.currentMgMatch.A,window.currentMgMatch.B].find(g=>g && root.textContent.includes(g.nickname||g.realname||'')) : null;
    const championKey=champion?.uid||champion?.realname||'';
    const championPicks=runStats.championPicks.get(championKey)||0;
    const stats=document.createElement('div');
    stats.className='mg-refined-stats';
    stats.innerHTML=`
      <div class="mg-refined-stat"><strong>${runStats.picks}</strong><span>本局總選擇</span></div>
      <div class="mg-refined-stat"><strong>${championPicks||'—'}</strong><span>冠軍被你選中的次數</span></div>`;
    const winner=root.querySelector('.winner-card');
    winner?.insertAdjacentElement('afterend',stats);
  }

  function wrapFunctions() {
    if (typeof window.renderMinigameStart === 'function' && !window.renderMinigameStart.__refined) {
      const original=window.renderMinigameStart;
      const wrapped=function(...args){locked=false;runStats={picks:0,championPicks:new Map(),startSize:0};const r=original.apply(this,args);requestAnimationFrame(decorateStart);return r;};
      wrapped.__refined=true;window.renderMinigameStart=wrapped;
    }

    if (typeof window.startMinigame === 'function' && !window.startMinigame.__refined) {
      const original=window.startMinigame;
      const wrapped=function(...args){runStats.startSize=Number(document.getElementById('mg-setup-round')?.value||0);const r=original.apply(this,args);requestAnimationFrame(decorateMatch);return r;};
      wrapped.__refined=true;window.startMinigame=wrapped;
    }

    if (typeof window.renderMinigameMatch === 'function' && !window.renderMinigameMatch.__refined) {
      const original=window.renderMinigameMatch;
      const wrapped=function(...args){const r=original.apply(this,args);requestAnimationFrame(decorateMatch);return r;};
      wrapped.__refined=true;window.renderMinigameMatch=wrapped;
    }

    if (typeof window.pickMinigameWinner === 'function' && !window.pickMinigameWinner.__refined) {
      const original=window.pickMinigameWinner;
      const wrapped=function(choice,...args){
        if(locked)return;
        locked=true;
        const match=window.currentMgMatch;
        const winner=choice==='A'?match?.A:match?.B;
        const key=winner?.uid||winner?.realname||winner?.nickname||'';
        runStats.picks+=1;
        if(key)runStats.championPicks.set(key,(runStats.championPicks.get(key)||0)+1);

        const root=document.getElementById('minigame-container');
        const cards=[...(root?.querySelectorAll('.vs-card')||[])];
        const picked=choice==='A'?cards[0]:cards[1];
        const lost=choice==='A'?cards[1]:cards[0];
        picked?.classList.add('is-picked');
        lost?.classList.add('is-lost');
        cards.forEach(card=>card.style.pointerEvents='none');

        window.setTimeout(()=>{
          const r=original.call(this,choice,...args);
          locked=false;
          requestAnimationFrame(()=>{decorateMatch();decorateWinner();});
          return r;
        },360);
      };
      wrapped.__refined=true;window.pickMinigameWinner=wrapped;
    }

    if (typeof window.renderMinigameWinner === 'function' && !window.renderMinigameWinner.__refined) {
      const original=window.renderMinigameWinner;
      const wrapped=function(...args){const r=original.apply(this,args);requestAnimationFrame(decorateWinner);return r;};
      wrapped.__refined=true;window.renderMinigameWinner=wrapped;
    }
  }

  function boot(){
    installStyles();
    wrapFunctions();
    if(routeIsMinigame()){decorateStart();decorateMatch();decorateWinner();}
  }

  let attempts=0;
  const timer=setInterval(()=>{attempts+=1;boot();if((window.renderMinigameStart?.__refined&&window.pickMinigameWinner?.__refined)||attempts>80)clearInterval(timer);},100);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
