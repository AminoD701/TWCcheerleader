(() => {
  const TEAM_LEAGUE={
    'Uni-Girls':'CPBL','Rakuten Girls':'CPBL','Dragon Beauties':'CPBL',
    'Aqua Mermaids':'TPBL','Formosa Sexy':'TPBL','Muse Girls':'TPBL','Taishin Wonders':'TPBL','Leopard Girls':'TPBL','New Taipei Queens':'TPBL',
    'Pilots Crew':'PLG','Youngkey Girls':'PLG',
    'Tokki Cutie':'TPVL','Peach Girls':'TPVL','Little Witches':'TPVL','Si-ster':'TPVL'
  };
  const CPBL_TEAMS=new Set(['Passion Sisters','Fubon Angels','Wing Stars','Uni-Girls','Rakuten Girls','Dragon Beauties']);
  const TPBL_TEAMS=new Set(['Aqua Mermaids','Formosa Sexy','Passion Sisters','Muse Girls','Taishin Wonders','Leopard Girls','New Taipei Queens']);
  const PLG_TEAMS=new Set(['Pilots Crew','Youngkey Girls','Wing Stars','Fubon Angels']);
  const TPVL_TEAMS=new Set(['Tokki Cutie','Peach Girls','Little Witches','Wing Stars','Si-ster']);
  const HISTORICAL_TEAMS=new Set(['Little Witches']);
  const isFormer=g=>HISTORICAL_TEAMS.has(String(g?.team||'').trim())||Boolean(String(g?.departure_season||g?.departureseason||g?.departureSeason||g?.['離隊賽季']||'').trim())||/(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/.test(String(g?.note||''));
  const uid=g=>String(g?.uid||`${String(g?.realname||'').trim()}|${String(g?.nickname||'').trim()}`).trim();
  const noteText=g=>String(g?.note||g?.['備註']||g?.備註||'').trim();
  const cleanedNote=g=>noteText(g)
    .replace(/(合作夥伴|合作)/g,'')
    .replace(/^[,\s、，]+|[,\s、，]+$/g,'')
    .trim();
  const isTrainee=g=>/(練習生|培訓生)/.test(cleanedNote(g));
  const isNewMember=g=>/(新成員|新加入|新人)/.test(cleanedNote(g));
  const isStatsEligible=g=>{
    if(isFormer(g)) return false;
    if(String(g?.sport||'').trim()==='其他') return false;
    const note=cleanedNote(g);
    return !note || isTrainee(g) || isNewMember(g);
  };
  const leagueFor=g=>{
    const team=String(g.team||'').trim(),sport=String(g.sport||'');
    if(team==='Passion Sisters') return sport.includes('籃')?'TPBL':'CPBL';
    if(team==='Fubon Angels') return sport.includes('籃')?'PLG':'CPBL';
    if(team==='Wing Stars') return sport.includes('排')?'TPVL':sport.includes('籃')?'PLG':'CPBL';
    if(CPBL_TEAMS.has(team) && sport.includes('棒')) return 'CPBL';
    if(TPBL_TEAMS.has(team) && sport.includes('籃')) return 'TPBL';
    if(PLG_TEAMS.has(team) && sport.includes('籃')) return 'PLG';
    if(TPVL_TEAMS.has(team) && sport.includes('排')) return 'TPVL';
    return TEAM_LEAGUE[team] || '';
  };
  const normalizeNat=value=>String(value||'').trim().replace(/\s+/g,'');
  const nationalityCategory=g=>{
    const n=normalizeNat(g?.nat);
    if(!n || ['未知','-','—'].includes(n)) return 'unknown';
    if(n.includes('混血')) return 'mixed';
    if(/韓國|韓籍/.test(n)) return 'korean';
    if(/日本|日籍/.test(n)) return 'japanese';
    if(/馬來西亞|馬籍/.test(n)) return 'malaysian';
    if(/臺灣|台灣|臺籍|台籍/.test(n)) return 'local';
    return 'otherForeign';
  };
  const foreign=g=>['korean','japanese','mixed','malaysian','otherForeign'].includes(nationalityCategory(g));
  const displayName=g=>{
    if(['korean','japanese'].includes(nationalityCategory(g))){
      const real=String(g?.realname||'').trim();
      if(real) return real;
    }
    return String(g?.nickname||g?.realname||'未命名').trim();
  };
  const h=g=>{
    const raw=String(g.height||'').match(/\d+(?:\.\d+)?/);
    const n=raw?Number(raw[0]):NaN;
    return Number.isFinite(n)?n:null;
  };
  const zodiac=g=>String(g.zodiac||'')
    .trim()
    .replace(/座$/,'')
    .replace('魔羯','摩羯')
    .replace('白羊','牡羊');

  function activePeople(){
    const map=new Map();
    (Array.isArray(window.dbGirls)?window.dbGirls:[]).filter(isStatsEligible).forEach(g=>{
      const key=uid(g);if(!key)return;
      if(!map.has(key))map.set(key,{girl:g,rows:[]});
      const person=map.get(key);
      person.rows.push(g);
      if(['korean','japanese'].includes(nationalityCategory(g)) && String(g?.realname||'').trim()) person.girl=g;
    });
    return [...map.values()];
  }

  function matches(person,filters){
    const rows=person.rows;
    if(filters.league!=='all'&&!rows.some(r=>leagueFor(r)===filters.league))return false;
    if(filters.nat==='foreign'&&!rows.some(foreign))return false;
    if(filters.nat==='local'&&!rows.some(r=>nationalityCategory(r)==='local'))return false;
    if(['korean','japanese','mixed','malaysian','otherForeign'].includes(filters.nat)
      && !rows.some(r=>nationalityCategory(r)===filters.nat)) return false;
    const heights=rows.map(h).filter(x=>x!=null);
    if(filters.height&&!(heights.some(x=>x>=filters.height)))return false;
    if(filters.zodiac!=='all'&&!rows.some(r=>zodiac(r)===filters.zodiac))return false;
    return true;
  }

  function render(){
    const root=document.getElementById('datalab-container');if(!root)return;
    if(document.body?.dataset.appMode!=='datalab'){
      root.style.display='none';
      return;
    }
    const people=activePeople();
    if(!people.length){root.innerHTML='<div class="datalab-empty">女孩資料仍在載入中。</div>';return;}
    const count=(f={})=>people.filter(p=>matches(p,{league:'all',nat:'all',height:0,zodiac:'all',...f})).length;
    const natBreakdown = filters => ({
      foreign: count({...filters,nat:'foreign'}),
      korean: count({...filters,nat:'korean'}),
      japanese: count({...filters,nat:'japanese'}),
      mixed: count({...filters,nat:'mixed'}),
      malaysian: count({...filters,nat:'malaysian'}),
      otherForeign: count({...filters,nat:'otherForeign'})
    });
    const leagueRows=['CPBL','TPBL','PLG','TPVL'].map(l=>({
      league:l,
      total:count({league:l}),
      ...natBreakdown({league:l})
    }));
    const allNat = {
      local: count({nat:'local'}),
      ...natBreakdown({})
    };
    const zodiacCounts=['牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯','水瓶','雙魚'].map(z=>({z,count:count({zodiac:z})})).sort((a,b)=>b.count-a.count);
    const topZodiac=zodiacCounts[0] || {z:'—',count:0};
    const heightKnown=people.flatMap(p=>p.rows.map(h)).filter(x=>x!=null);
    const avgHeight=heightKnown.length ? (heightKnown.reduce((sum,x)=>sum+x,0)/heightKnown.length).toFixed(1) : '—';
    root.innerHTML=`
      <section class="datalab">
        <div class="datalab-hero"><div><span>CHEER ECOSYSTEM</span><h1>啦啦隊生態數據</h1><p>統計納入現役正式啦啦隊女孩、練習生／培訓生與新成員；排除應援團長、吉祥物及其他特殊身分，也不納入「其他」球種分類。</p></div><div class="datalab-total"><strong>${people.length}</strong><small>統計女孩</small></div></div>
        <div class="datalab-kpis">
          <div><small>外籍女孩</small><strong>${allNat.foreign}</strong><span>位</span></div>
          <div><small>最多星座</small><strong>${topZodiac.z}</strong><span>${topZodiac.count} 位</span></div>
          <div><small>平均身高</small><strong>${avgHeight}</strong><span>${avgHeight==='—'?'':'cm'}</span></div>
          <div><small>身高 160+</small><strong>${count({height:160})}</strong><span>位</span></div>
        </div>
        <section class="datalab-panel datalab-nationality">
          <div class="datalab-section-title"><div><span>NATIONALITY</span><strong>現役國籍結構</strong></div></div>
          <div class="datalab-nationality-grid">
            <div><small>台籍</small><strong>${allNat.local}</strong><span>位</span></div>
            <div class="is-total"><small>外籍總計</small><strong>${allNat.foreign}</strong><span>位</span></div>
            <div><small>韓籍</small><strong>${allNat.korean}</strong><span>位</span></div>
            <div><small>日籍</small><strong>${allNat.japanese}</strong><span>位</span></div>
            <div><small>混血</small><strong>${allNat.mixed}</strong><span>位</span></div>
            <div><small>馬來西亞籍</small><strong>${allNat.malaysian}</strong><span>位</span></div>
            <div><small>其他外籍</small><strong>${allNat.otherForeign}</strong><span>位</span></div>
          </div>
        </section>
        <div class="datalab-two">
          <section class="datalab-panel"><div class="datalab-section-title"><div><span>LEAGUE</span><strong>聯盟現役分布</strong></div></div>
            <div class="datalab-table datalab-league-table">${leagueRows.map(r=>`
              <div class="datalab-league-row">
                <div class="datalab-league-row__main"><b>${r.league}</b><span>${r.total} 位</span><small>外籍總計 ${r.foreign}</small></div>
                <div class="datalab-league-row__nat">
                  <span>韓 ${r.korean}</span><span>日 ${r.japanese}</span><span>混血 ${r.mixed}</span><span>馬 ${r.malaysian}</span><span>其他 ${r.otherForeign}</span>
                </div>
              </div>`).join('')}</div>
          </section>
          <section class="datalab-panel"><div class="datalab-section-title"><div><span>ZODIAC</span><strong>星座排行</strong></div><small>最多：${topZodiac.z} ${topZodiac.count} 位</small></div><div class="datalab-table datalab-zodiac-table">${zodiacCounts.map((r,i)=>`<div class="${i===0?'is-top':''}"><b>${i===0?'TOP 1 · ':''}${r.z}</b><span>${r.count} 位</span></div>`).join('')}</div></section>
        </div>
        <section class="datalab-query">
          <div class="datalab-section-title"><div><span>QUERY</span><strong>條件查詢</strong></div><div id="datalab-result-count">—</div></div>
          <p class="datalab-query-hint">想找特定條件的女孩時再使用這裡；上方總覽維持完整統計母體，不會因查詢條件改變。</p>
          <div class="datalab-filters">
            <label>聯盟<select id="dl-league"><option value="all">全部聯盟</option><option>CPBL</option><option>TPBL</option><option>PLG</option><option>TPVL</option></select></label>
            <label>國籍<select id="dl-nat">
              <option value="all">全部國籍</option>
              <option value="local">台籍</option>
              <option value="foreign">外籍（總計）</option>
              <option value="korean">韓籍</option>
              <option value="japanese">日籍</option>
              <option value="mixed">混血</option>
              <option value="malaysian">馬來西亞籍</option>
              <option value="otherForeign">其他外籍</option>
            </select></label>
            <label>最低身高<input id="dl-height" type="number" min="0" max="200" placeholder="例如 160"></label>
            <label>星座<select id="dl-zodiac"><option value="all">全部星座</option>${['牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯','水瓶','雙魚'].map(z=>`<option>${z}</option>`).join('')}</select></label>
          </div>
          <div id="datalab-result-list" class="datalab-result-list"></div>
        </section>
      </section>`;
    const controls=['dl-league','dl-nat','dl-height','dl-zodiac'].map(id=>root.querySelector('#'+id));
    const update=()=>{
      const filters={league:controls[0].value,nat:controls[1].value,height:Number(controls[2].value||0),zodiac:controls[3].value};
      const result=people.filter(p=>matches(p,filters));
      root.querySelector('#datalab-result-count').innerHTML=`<strong>${result.length}</strong><small> 位符合</small>`;
      root.querySelector('#datalab-result-list').innerHTML=result.slice(0,60).map(p=>{
        const g=p.girl,name=displayName(g);
        const leagues=[...new Set(p.rows.map(leagueFor).filter(Boolean))].join('／');
        return `<button data-dl-uid="${uid(g)}"><strong>${name}</strong><small>${leagues||g.team||''} · ${g.nat||'國籍未填'}${h(g)!=null?' · '+h(g)+'cm':''}${zodiac(g)?' · '+zodiac(g)+'座':''}</small></button>`;
      }).join('')+(result.length>60?'<div class="datalab-more">結果超過 60 位，請再增加條件縮小範圍。</div>':'');
    };
    controls.forEach(x=>x.addEventListener('input',update));update();
    root.querySelector('#datalab-result-list').addEventListener('click',e=>{
      const btn=e.target.closest('[data-dl-uid]');if(!btn)return;
      const p=people.find(x=>uid(x.girl)===btn.dataset.dlUid);
      if(p?.girl&&typeof window.openProfile==='function')window.openProfile(p.girl);
    });
  }

  function style(){
    if(document.getElementById('datalab-style'))return;
    const s=document.createElement('style');s.id='datalab-style';s.textContent=`
      #datalab-container{display:none!important;width:100%;max-width:1180px;margin:20px auto 70px;padding:0 16px;box-sizing:border-box}body[data-app-mode="datalab"] #datalab-container{display:block!important}body:not([data-app-mode="datalab"]) #datalab-container{display:none!important}.datalab{color:#fff}.datalab-hero{display:flex;justify-content:space-between;align-items:end;gap:24px;padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:radial-gradient(circle at 90% 0,rgba(34,197,94,.14),transparent 35%),#10141a}.datalab-hero span,.datalab-section-title span{font:900 10px/1 var(--sport-font);letter-spacing:1.8px;color:#86efac}.datalab-hero h1{margin:7px 0 8px;font-size:clamp(28px,5vw,44px)}.datalab-hero p{max-width:680px;margin:0;color:#94a3b8;line-height:1.7}.datalab-total{text-align:center}.datalab-total strong{display:block;font:950 42px/1 var(--sport-font)}.datalab-total small{color:#94a3b8}.datalab-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 18px}.datalab-kpis>div{padding:17px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:linear-gradient(180deg,#141a20,#10151a)}.datalab-kpis small{display:block;color:#94a3b8;font-weight:800}.datalab-kpis strong{display:inline-block;margin-top:8px;font:950 34px/1 var(--sport-font)}.datalab-kpis span{margin-left:5px;color:#94a3b8;font-size:12px}.datalab-query,.datalab-panel{padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:#101419}.datalab-query{margin-top:12px}.datalab-query-hint{margin:-4px 0 14px;color:#7f8b98;font-size:11px;line-height:1.6}.datalab-section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:14px}.datalab-section-title strong{display:block;margin-top:4px;font-size:18px}.datalab-section-title>div:last-child strong{display:inline;font-size:26px}.datalab-section-title small{color:#94a3b8}.datalab-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.datalab-filters label{color:#94a3b8;font-size:11px;font-weight:900}.datalab-filters select,.datalab-filters input{width:100%;min-height:44px;margin-top:6px;padding:0 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#0b0e12;color:#fff;box-sizing:border-box}.datalab-result-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-top:14px}.datalab-result-list button{padding:10px 11px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#151a20;color:#fff;text-align:left}.datalab-result-list strong,.datalab-result-list small{display:block}.datalab-result-list small{margin-top:4px;color:#94a3b8;font-size:10px;line-height:1.4}.datalab-more{grid-column:1/-1;color:#94a3b8;font-size:12px;text-align:center;padding:10px}.datalab-nationality{margin-bottom:12px}.datalab-nationality-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.datalab-nationality-grid>div{padding:14px 10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#13181f;text-align:center}.datalab-nationality-grid>div.is-total{border-color:rgba(134,239,172,.35);background:rgba(134,239,172,.06)}.datalab-nationality-grid small{display:block;color:#94a3b8;font-size:10px;font-weight:850;white-space:nowrap}.datalab-nationality-grid strong{display:inline-block;margin-top:7px;font:950 25px/1 var(--sport-font)}.datalab-nationality-grid span{margin-left:4px;color:#94a3b8;font-size:10px}
      .datalab-two{display:grid;grid-template-columns:1.3fr .7fr;gap:12px;margin-top:12px}.datalab-table{display:grid;gap:7px}.datalab-table>div{padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.08)}.datalab-table small{color:#86efac}.datalab-zodiac-table>div.is-top{padding:11px 12px;border:1px solid rgba(134,239,172,.22);border-radius:11px;background:rgba(134,239,172,.05)}.datalab-zodiac-table>div.is-top b{color:#bbf7d0}.datalab-league-row__main{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center}.datalab-league-row__nat{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.datalab-league-row__nat span{padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.05);color:#9ca7b5;font-size:10px;font-weight:800}
      @media(max-width:900px){.datalab-nationality-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:760px){.datalab-hero{flex-direction:column;align-items:flex-start}.datalab-kpis{grid-template-columns:1fr 1fr}.datalab-filters{grid-template-columns:1fr 1fr}.datalab-two{grid-template-columns:1fr}.datalab-result-list{grid-template-columns:1fr 1fr}.datalab-nationality-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.datalab-league-row__main{grid-template-columns:1fr auto}.datalab-league-row__main small{grid-column:1/-1}}
    `;document.head.appendChild(s);
  }
  function boot(){style();if(document.body?.dataset.appMode==='datalab')render();}
  window.renderDataLab=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  let tries=0;const timer=setInterval(()=>{tries++;if((window.dbGirls||[]).length){if(document.body?.dataset.appMode==='datalab')render();clearInterval(timer);}else if(tries>80)clearInterval(timer);},250);
})();
