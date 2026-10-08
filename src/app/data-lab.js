(() => {
  const TEAM_LEAGUE={
    'Uni-Girls':'CPBL','Rakuten Girls':'CPBL','Dragon Beauties':'CPBL',
    'Aqua Mermaids':'TPBL','Formosa Sexy':'TPBL','Muse Girls':'TPBL','Taishin Wonders':'TPBL','Leopard Girls':'TPBL','New Taipei Queens':'TPBL',
    'Pilots Crew':'PLG','Youngkey Girls':'PLG','Tokki Cutie':'TPVL','Peach Girls':'TPVL','Little Witches':'TPVL','Si-ster':'TPVL'
  };
  const isFormer=g=>Boolean(String(g?.departureseason||g?.departure_season||g?.['離隊賽季']||'').trim())||/(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/.test(String(g?.note||''));
  const uid=g=>String(g?.uid||g?.realname||g?.nickname||'').trim();
  const leagueFor=g=>{
    const team=String(g.team||'').trim(),sport=String(g.sport||'');
    if(TEAM_LEAGUE[team])return TEAM_LEAGUE[team];
    if(team.includes('Passion Sisters'))return sport.includes('籃')?'TPBL':'CPBL';
    if(team.includes('Fubon Angels'))return sport.includes('籃')?'PLG':'CPBL';
    if(team.includes('Wing Stars'))return sport.includes('排')?'TPVL':sport.includes('籃')?'PLG':'CPBL';
    if(sport.includes('棒'))return 'CPBL';
    return '';
  };
  const foreign=g=>{const n=String(g.nat||'').trim();return Boolean(n)&&!/(臺灣|台灣)/.test(n)&&n!=='未知'&&n!=='-';};
  const h=g=>{const n=parseFloat(String(g.height||'').replace(/[^d.]/g,''));return Number.isFinite(n)?n:null;};
  const zodiac=g=>String(g.zodiac||'').trim().replace('魔羯','摩羯').replace('白羊','牡羊');

  function activePeople(){
    const map=new Map();
    (Array.isArray(window.dbGirls)?window.dbGirls:[]).filter(g=>!isFormer(g)).forEach(g=>{
      const key=uid(g);if(!key)return;
      if(!map.has(key))map.set(key,{girl:g,rows:[]});
      map.get(key).rows.push(g);
    });
    return [...map.values()];
  }

  function matches(person,filters){
    const rows=person.rows;
    if(filters.league!=='all'&&!rows.some(r=>leagueFor(r)===filters.league))return false;
    if(filters.nat==='foreign'&&!rows.some(foreign))return false;
    if(filters.nat==='local'&&!rows.some(r=>!foreign(r)))return false;
    const heights=rows.map(h).filter(x=>x!=null);
    if(filters.height&&!(heights.some(x=>x>=filters.height)))return false;
    if(filters.zodiac!=='all'&&!rows.some(r=>zodiac(r)===filters.zodiac))return false;
    return true;
  }

  function render(){
    const root=document.getElementById('datalab-container');if(!root)return;
    const people=activePeople();
    if(!people.length){root.innerHTML='<div class="datalab-empty">女孩資料仍在載入中。</div>';return;}
    const count=(f={})=>people.filter(p=>matches(p,{league:'all',nat:'all',height:0,zodiac:'all',...f})).length;
    const leagueRows=['CPBL','TPBL','PLG','TPVL'].map(l=>({league:l,total:count({league:l}),foreign:count({league:l,nat:'foreign'})}));
    const zodiacCounts=['牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯','水瓶','雙魚'].map(z=>({z,count:count({zodiac:z})})).sort((a,b)=>b.count-a.count);
    root.innerHTML=`
      <section class="datalab">
        <div class="datalab-hero"><div><span>CHEER ECOSYSTEM</span><h1>啦啦隊生態數據</h1><p>所有數字直接依目前現役女孩資料即時計算，快速掌握聯盟、國籍、身高與星座分布。</p></div><div class="datalab-total"><strong>${people.length}</strong><small>現役女孩</small></div></div>
        <div class="datalab-kpis">
          <div><small>CPBL 外籍</small><strong>${count({league:'CPBL',nat:'foreign'})}</strong><span>位</span></div>
          <div><small>TPBL 外籍</small><strong>${count({league:'TPBL',nat:'foreign'})}</strong><span>位</span></div>
          <div><small>身高 160+</small><strong>${count({height:160})}</strong><span>位</span></div>
          <div><small>巨蟹座</small><strong>${count({zodiac:'巨蟹'})}</strong><span>位</span></div>
        </div>
        <section class="datalab-query">
          <div class="datalab-section-title"><div><span>QUERY</span><strong>條件查詢</strong></div><div id="datalab-result-count">—</div></div>
          <div class="datalab-filters">
            <label>聯盟<select id="dl-league"><option value="all">全部聯盟</option><option>CPBL</option><option>TPBL</option><option>PLG</option><option>TPVL</option></select></label>
            <label>國籍<select id="dl-nat"><option value="all">全部</option><option value="local">台籍</option><option value="foreign">外籍</option></select></label>
            <label>最低身高<input id="dl-height" type="number" min="0" max="200" placeholder="例如 160"></label>
            <label>星座<select id="dl-zodiac"><option value="all">全部星座</option>${['牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯','水瓶','雙魚'].map(z=>`<option>${z}</option>`).join('')}</select></label>
          </div>
          <div id="datalab-result-list" class="datalab-result-list"></div>
        </section>
        <div class="datalab-two">
          <section class="datalab-panel"><div class="datalab-section-title"><div><span>LEAGUE</span><strong>聯盟現役分布</strong></div></div><div class="datalab-table">${leagueRows.map(r=>`<div><b>${r.league}</b><span>${r.total} 位</span><small>外籍 ${r.foreign}</small></div>`).join('')}</div></section>
          <section class="datalab-panel"><div class="datalab-section-title"><div><span>ZODIAC</span><strong>星座排行</strong></div></div><div class="datalab-table">${zodiacCounts.map(r=>`<div><b>${r.z}</b><span>${r.count} 位</span></div>`).join('')}</div></section>
        </div>
      </section>`;
    const controls=['dl-league','dl-nat','dl-height','dl-zodiac'].map(id=>root.querySelector('#'+id));
    const update=()=>{
      const filters={league:controls[0].value,nat:controls[1].value,height:Number(controls[2].value||0),zodiac:controls[3].value};
      const result=people.filter(p=>matches(p,filters));
      root.querySelector('#datalab-result-count').innerHTML=`<strong>${result.length}</strong><small> 位符合</small>`;
      root.querySelector('#datalab-result-list').innerHTML=result.slice(0,60).map(p=>{
        const g=p.girl,name=g.nickname||g.realname||'未命名';
        const leagues=[...new Set(p.rows.map(leagueFor).filter(Boolean))].join('／');
        return `<button data-dl-uid="${uid(g)}"><strong>${name}</strong><small>${leagues||g.team||''} · ${g.nat||'國籍未填'}${h(g)?' · '+h(g)+'cm':''}${zodiac(g)?' · '+zodiac(g)+'座':''}</small></button>`;
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
      #datalab-container{display:none;width:100%;max-width:1180px;margin:20px auto 70px;padding:0 16px;box-sizing:border-box}body[data-app-mode="datalab"] #datalab-container{display:block}.datalab{color:#fff}.datalab-hero{display:flex;justify-content:space-between;align-items:end;gap:24px;padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:radial-gradient(circle at 90% 0,rgba(34,197,94,.14),transparent 35%),#10141a}.datalab-hero span,.datalab-section-title span{font:900 10px/1 var(--sport-font);letter-spacing:1.8px;color:#86efac}.datalab-hero h1{margin:7px 0 8px;font-size:clamp(28px,5vw,44px)}.datalab-hero p{max-width:680px;margin:0;color:#94a3b8;line-height:1.7}.datalab-total{text-align:center}.datalab-total strong{display:block;font:950 42px/1 var(--sport-font)}.datalab-total small{color:#94a3b8}.datalab-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 18px}.datalab-kpis>div{padding:17px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:#12171d}.datalab-kpis small{display:block;color:#94a3b8;font-weight:800}.datalab-kpis strong{display:inline-block;margin-top:8px;font:950 34px/1 var(--sport-font)}.datalab-kpis span{margin-left:5px;color:#94a3b8;font-size:12px}.datalab-query,.datalab-panel{padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:#101419}.datalab-section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:14px}.datalab-section-title strong{display:block;margin-top:4px;font-size:18px}.datalab-section-title>div:last-child strong{display:inline;font-size:26px}.datalab-section-title small{color:#94a3b8}.datalab-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.datalab-filters label{color:#94a3b8;font-size:11px;font-weight:900}.datalab-filters select,.datalab-filters input{width:100%;min-height:44px;margin-top:6px;padding:0 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#0b0e12;color:#fff;box-sizing:border-box}.datalab-result-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-top:14px}.datalab-result-list button{padding:10px 11px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#151a20;color:#fff;text-align:left}.datalab-result-list strong,.datalab-result-list small{display:block}.datalab-result-list small{margin-top:4px;color:#94a3b8;font-size:10px;line-height:1.4}.datalab-more{grid-column:1/-1;color:#94a3b8;font-size:12px;text-align:center;padding:10px}.datalab-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.datalab-table{display:grid;gap:7px}.datalab-table>div{display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.08)}.datalab-table small{color:#86efac}
      @media(max-width:760px){.datalab-hero{flex-direction:column;align-items:flex-start}.datalab-kpis{grid-template-columns:1fr 1fr}.datalab-filters{grid-template-columns:1fr 1fr}.datalab-two{grid-template-columns:1fr}.datalab-result-list{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }
  function boot(){style();if(document.body?.dataset.appMode==='datalab')render();}
  window.renderDataLab=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  let tries=0;const timer=setInterval(()=>{tries++;if((window.dbGirls||[]).length){if(document.body?.dataset.appMode==='datalab')render();clearInterval(timer);}else if(tries>80)clearInterval(timer);},250);
})();
