(() => {
  const isFormer = girl => {
    const season = String(girl?.departure_season || girl?.departureseason || girl?.departureSeason || girl?.['離隊賽季'] || '').trim();
    if (season) return true;
    const note = String(girl?.note || girl?.['備註'] || girl?.備註 || '').trim();
    const status = String(girl?.status || '').trim().toLowerCase();
    return /(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/.test(note)
      || ['former','ended','departed','inactive','離隊','已離隊'].includes(status);
  };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const identity = girl => String(girl?.uid || girl?.realname || girl?.nickname || '').trim();

  function ensureEntry() {
    const grid=document.getElementById('grid-container');
    if(!grid || document.getElementById('former-archive-entry')) return;
    const entry=document.createElement('section');
    entry.id='former-archive-entry';
    entry.className='former-archive-entry';
    entry.innerHTML=`
      <div>
        <span>HISTORY ARCHIVE</span>
        <strong>歷屆成員資料庫</strong>
        <small>依離隊賽季查看歷屆女孩，即使目前已無所屬隊伍，過往圖鑑資料仍完整保留。</small>
      </div>
      <button type="button">查看歷屆成員 <b>→</b></button>`;
    entry.querySelector('button').addEventListener('click',()=>window.setMode?.('archive'));
    const bar=document.getElementById('girls-mobile-filterbar');
    (bar || grid).insertAdjacentElement('beforebegin',entry);
  }

  function rows() {
    const girls=Array.isArray(window.dbGirls)?window.dbGirls:[];
    const map=new Map();
    girls.filter(isFormer).forEach(g=>{
      const key=identity(g);
      if(!key)return;
      if(!map.has(key)) map.set(key,{girl:g,seasons:new Set(),teams:new Set(),sports:new Set()});
      const item=map.get(key);
      const season=String(g.departure_season||g.departureseason||g.departureSeason||g['離隊賽季']||'').trim();
      if(season)item.seasons.add(season);
      if(g.team)item.teams.add(String(g.team).trim());
      if(g.sport)item.sports.add(String(g.sport).trim());
    });
    return [...map.values()];
  }

  function render() {
    const root=document.getElementById('archive-container');
    if(!root)return;
    const data=rows();
    if(!data.length){
      root.innerHTML='<div class="archive-empty">歷屆成員資料仍在載入中，請稍後再試。</div>';
      return;
    }
    const seasons=[...new Set(data.flatMap(x=>[...x.seasons]))].sort((a,b)=>Number(b)-Number(a));
    const groups=seasons.map(season=>({
      season,
      items:data.filter(x=>x.seasons.has(season)).sort((a,b)=>(a.girl.nickname||a.girl.realname||'').localeCompare(b.girl.nickname||b.girl.realname||'','zh-Hant'))
    }));
    root.innerHTML=`
      <section class="archive-page">
        <div class="archive-switchbar">
          <button type="button" data-archive-back>現役女孩</button>
          <button type="button" class="active">歷屆成員</button>
        </div>
        <div class="archive-hero">
          <div><span>CHEERLEADER HISTORY</span><h1>歷屆成員資料庫</h1><p>保留曾經出現在本站資料庫中的啦啦隊女孩。離隊後不會從網站消失，而是依離隊賽季轉入歷史資料。</p></div>
          <div class="archive-total"><strong>${data.length}</strong><small>歷屆女孩</small></div>
        </div>
        <div class="archive-tools">
          <label class="archive-search">
            <span>搜尋歷屆成員</span>
            <input type="search" id="archive-search-input" placeholder="輸入姓名或隊伍" autocomplete="off">
          </label>
          <div class="archive-search-result" id="archive-search-result">共 ${data.length} 位歷屆女孩</div>
        </div>
        <div class="archive-tabs">${seasons.map((s,i)=>`<button data-archive-season="${esc(s)}" class="${i===0?'active':''}">${esc(s)} 賽季</button>`).join('')}</div>
        <div class="archive-groups">
          ${groups.map((group,i)=>`
            <section class="archive-season" data-season-panel="${esc(group.season)}" ${i?'hidden':''}>
              <div class="archive-season__head"><strong>${esc(group.season)} 賽季離隊成員</strong><span>${group.items.length} 位</span></div>
              <div class="archive-grid">${group.items.map((item,index)=>{
                const g=item.girl;
                const name=g.nickname||g.realname||'未命名';
                const real=g.realname && g.realname!==name ? g.realname : '';
                return `<button class="archive-card" data-archive-index="${index}" data-archive-season-key="${esc(group.season)}">
                  <div class="archive-card__photo">${g.img?`<img src="${esc(window.getCdnUrl?window.getCdnUrl(g.img):g.img)}" alt="${esc(name)}" loading="lazy" decoding="async" onerror="this.remove()">`:''}</div>
                  <div class="archive-card__body"><strong>${esc(name)}</strong>${real?`<small>${esc(real)}</small>`:''}<span>${esc([...item.teams].join('／')||'過往成員')}</span></div>
                </button>`;
              }).join('')}</div>
            </section>`).join('')}
        </div>
      </section>`;
    root.querySelector('[data-archive-back]')?.addEventListener('click',()=>window.setMode?.('girls'));
    root.querySelector('.archive-tabs')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-archive-season]'); if(!btn)return;
      root.querySelectorAll('[data-archive-season]').forEach(x=>x.classList.toggle('active',x===btn));
      root.querySelectorAll('[data-season-panel]').forEach(panel=>{panel.hidden=panel.dataset.seasonPanel!==btn.dataset.archiveSeason;});
      applyArchiveSearch();
    });

    const searchInput=root.querySelector('#archive-search-input');
    const resultText=root.querySelector('#archive-search-result');
    const applyArchiveSearch=()=>{
      const q=String(searchInput?.value||'').trim().toLowerCase();
      const activeSeason=root.querySelector('[data-archive-season].active')?.dataset.archiveSeason;
      let visible=0;
      root.querySelectorAll('.archive-card').forEach(card=>{
        const panel=card.closest('[data-season-panel]');
        const inSeason=!activeSeason||panel?.dataset.seasonPanel===activeSeason;
        const text=(card.textContent||'').toLowerCase();
        const show=inSeason&&(!q||text.includes(q));
        card.hidden=!show;
        if(show)visible+=1;
      });
      root.querySelectorAll('[data-season-panel]').forEach(panel=>{
        panel.hidden=Boolean(activeSeason&&panel.dataset.seasonPanel!==activeSeason);
      });
      if(resultText)resultText.textContent=q ? `找到 ${visible} 位符合搜尋` : `本賽季顯示 ${visible} 位`;
    };
    searchInput?.addEventListener('input',applyArchiveSearch);
    applyArchiveSearch();
    root.addEventListener('click',e=>{
      const card=e.target.closest('.archive-card'); if(!card)return;
      const group=groups.find(g=>g.season===card.dataset.archiveSeasonKey);
      const item=group?.items[Number(card.dataset.archiveIndex)];
      if(item?.girl && typeof window.openProfile==='function') window.openProfile(item.girl);
    });
  }

  function style(){
    if(document.getElementById('former-archive-style'))return;
    const s=document.createElement('style');s.id='former-archive-style';s.textContent=`
      .former-archive-entry{display:none;max-width:1200px;margin:10px auto 18px;padding:18px 20px;border:1px solid rgba(255,255,255,.11);border-radius:16px;background:radial-gradient(circle at 90% 0,rgba(56,189,248,.12),transparent 34%),linear-gradient(145deg,#161b22,#0e1116);align-items:center;justify-content:space-between;gap:18px}
      body[data-app-mode="girls"] .former-archive-entry{display:none}.former-archive-entry>div{display:flex;flex-direction:column;gap:5px}.former-archive-entry span{font:900 10px/1 var(--sport-font);letter-spacing:1.8px;color:#7dd3fc}.former-archive-entry strong{font-size:20px;color:#fff}.former-archive-entry small{color:#94a3b8;line-height:1.55}.former-archive-entry button{white-space:nowrap;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:#fff;color:#101318;padding:11px 15px;font-weight:950;cursor:pointer}
      #archive-container{display:none;width:100%;max-width:1180px;margin:20px auto 70px;padding:0 16px;box-sizing:border-box}body[data-app-mode="archive"] #archive-container{display:block}
      .archive-switchbar{display:flex;justify-content:flex-end;gap:6px;margin:0 0 12px}.archive-switchbar button{min-height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.10);border-radius:999px;background:#11161c;color:#9aa5b2;font-size:11px;font-weight:900;cursor:pointer}.archive-switchbar button.active{color:#fff;border-color:rgba(125,211,252,.35);background:rgba(125,211,252,.07)}
      .archive-hero{display:flex;justify-content:space-between;align-items:end;gap:24px;padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:radial-gradient(circle at 90% 0,rgba(56,189,248,.15),transparent 35%),#10141a}.archive-hero span{font:900 11px/1 var(--sport-font);letter-spacing:2px;color:#7dd3fc}.archive-hero h1{margin:7px 0 8px;color:#fff;font-size:clamp(28px,5vw,44px)}.archive-hero p{margin:0;max-width:680px;color:#94a3b8;line-height:1.7}.archive-total{text-align:center;min-width:110px}.archive-total strong{display:block;font:950 42px/1 var(--sport-font);color:#fff}.archive-total small{color:#94a3b8}
      .archive-tools{display:flex;align-items:end;justify-content:space-between;gap:14px;margin:18px 0 10px}.archive-search{display:flex;flex-direction:column;gap:6px;min-width:min(100%,320px)}.archive-search span{color:#94a3b8;font-size:11px;font-weight:900}.archive-search input{height:42px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:#0d1116;color:#fff;padding:0 13px;outline:none}.archive-search input:focus{border-color:rgba(125,211,252,.5);box-shadow:0 0 0 3px rgba(125,211,252,.08)}.archive-search-result{color:#94a3b8;font-size:11px;font-weight:800;padding-bottom:4px}.archive-tabs{display:flex;gap:8px;overflow:auto;margin:10px 0 14px;padding-bottom:3px}.archive-tabs button{border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#12171d;color:#aab3bf;padding:9px 13px;font-weight:900;white-space:nowrap}.archive-tabs button.active{background:#fff;color:#111}.archive-season__head{display:flex;justify-content:space-between;align-items:center;margin:10px 0 12px;color:#fff}.archive-season__head span{color:#94a3b8;font-size:12px}.archive-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;align-items:stretch}.archive-card{display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:#12171d;color:#fff;text-align:left;padding:0;cursor:pointer}.archive-card__photo{position:relative;width:100%;aspect-ratio:4/5;flex:0 0 auto;overflow:hidden;background:linear-gradient(145deg,#0b0e12,#171c23)}.archive-card__photo::before{content:'NO PHOTO';position:absolute;inset:0;display:grid;place-items:center;color:#59616d;font:900 10px/1 var(--sport-font);letter-spacing:1.2px}.archive-card__photo img{position:relative;z-index:1;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 18%;background:#0b0e12}.archive-card__body{display:flex;flex:1;flex-direction:column;justify-content:flex-start;min-height:78px;padding:11px}.archive-card__body strong{display:block;font-size:16px}.archive-card__body small,.archive-card__body span{display:block;margin-top:3px;color:#94a3b8;font-size:11px;line-height:1.4}.archive-empty{padding:40px;text-align:center;color:#94a3b8}
      @media(max-width:700px){.former-archive-entry{margin:8px 10px 14px;padding:15px;align-items:flex-start}.former-archive-entry button{padding:9px 11px;font-size:12px}.former-archive-entry small{font-size:11px}.archive-hero{align-items:flex-start;flex-direction:column}.archive-tools{align-items:stretch;flex-direction:column;gap:7px}.archive-search{min-width:0}.archive-search-result{padding:0}.archive-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.archive-card__body{min-height:72px;padding:9px}.archive-card__body strong{font-size:14px}}
    `;document.head.appendChild(s);
  }

  function boot(){style();ensureEntry();if(document.body?.dataset.appMode==='archive')render();}
  window.renderFormerArchive=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  let tries=0;const timer=setInterval(()=>{tries++;ensureEntry();if((window.dbGirls||[]).length){if(document.body?.dataset.appMode==='archive')render();clearInterval(timer);}else if(tries>16)clearInterval(timer);},300);
})();
