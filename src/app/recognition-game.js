(() => {
  'use strict';
  const hub = () => document.getElementById('games-container');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle = items => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
  const storage = {
    get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}},
    set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
  };
  const key = 'twc-recognition-best-v1';
  let game = null;
  function pool() {
    const rows = window.CheerHomeData?.snapshot?.().girls || [];
    const unique = new Map();
    for(const g of rows) {
      const name=String(g.nickname || g.realname || g.name || g.姓名 || '').trim();
      const img=String(g.img || '').trim();
      const uid=String(g.uid || name).trim();
      if (!name || !img) continue;
      if (!unique.has(uid) || (!unique.get(uid).team && g.team)) unique.set(uid,{uid,name,img,team:String(g.team||'').trim(),sport:String(g.sport||'').trim()});
    }
    // Avoid multiple choices sharing the same displayed name.
    return Array.from(new Map([...unique.values()].map(g=>[g.name,g])).values());
  }
  function style(){
    if(document.getElementById('recognition-style')) return;
    const tag=document.createElement('style'); tag.id='recognition-style';
    tag.textContent=`
      .recognition-entry{flex:1 1 280px;max-width:320px;min-height:176px;border:1px solid #65538f;border-bottom:5px solid #a78bfa;border-radius:18px;background:linear-gradient(145deg,#252038,#11141c);color:white;text-align:center;padding:24px 18px;cursor:pointer;font:inherit}
      .recognition-entry strong{display:block;font-size:23px;margin:7px 0}.recognition-entry small{font-size:13px;color:#c6b8e6}
      #recognition-app{box-sizing:border-box;width:min(100%,600px);margin:0 auto;padding:4px 0 42px;color:#f5f5f5;text-align:center}
      #recognition-app *{box-sizing:border-box}
      .recognition-panel{padding:clamp(16px,4vw,28px);border-radius:20px;background:#181d26;border:1px solid #363c48}
      .recognition-app-title{font-size:clamp(24px,5vw,32px);font-weight:900;margin:6px 0 12px}
      .recognition-muted{color:#b8c0d1;font-size:14px;line-height:1.7;margin-bottom:18px}
      .recognition-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
      .recognition-btn{min-height:52px;padding:12px 14px;border:1px solid #525b6d;border-radius:13px;background:#252c39;color:#fff;font:700 16px/1.4 inherit;cursor:pointer;overflow-wrap:anywhere}
      .recognition-btn.primary{background:#7152cc;border-color:#8b70dd}.recognition-btn:disabled{opacity:.7;cursor:default}
      .recognition-btn.correct{background:#135a42;border-color:#27b481}.recognition-btn.wrong{background:#6d3038;border-color:#f17b88}
      .recognition-photo{display:block;width:100%;max-height:390px;aspect-ratio:4/3;object-fit:contain;background:#0e1117;border-radius:16px;margin:14px auto 16px}
      .recognition-progress{height:7px;border-radius:20px;overflow:hidden;background:#323948;margin:12px 0 18px}.recognition-progress span{display:block;height:100%;background:#a78bfa}
      .recognition-result{margin:14px 0;padding:14px;border-radius:12px;background:#272e39;line-height:1.7;font-size:14px}
      .recognition-meta{display:flex;justify-content:space-between;gap:8px;color:#cbd5e1;font-size:13px;font-weight:750}
      .recognition-back{display:block;margin:0 0 16px;padding:9px 0;background:transparent;color:#c5b5fa;border:0;font:700 14px inherit;cursor:pointer}
      @media(max-width:380px){.recognition-actions{gap:8px}.recognition-btn{font-size:15px;padding:10px 7px}}
    `;
    document.head.append(tag);
  }
  function mount(){
    const root=hub(); if(!root || root.querySelector('#recognition-app, .recognition-entry')) return;
    const cards=root.querySelector('div[style*="flex-wrap"]'); if(!cards) return;
    const button=document.createElement('button'); button.type='button';button.className='recognition-entry';
    button.innerHTML='<span style="font-size:43px" aria-hidden="true">🧠</span><strong>啦啦隊認人王</strong><small>看照片猜名字，測試你的應援眼力</small>';
    button.addEventListener('click',open);cards.append(button);
  }
  function frame(html){
    const root=hub();if(!root)return;
    root.style.display='flex';root.style.flexDirection='column';root.style.alignItems='stretch';
    root.innerHTML='<section id="recognition-app" aria-label="啦啦隊認人王"><button class="recognition-back" type="button">← 返回遊戲中心</button>'+html+'</section>';
    root.querySelector('.recognition-back').addEventListener('click',back);
  }
  function back(){game=null;window.renderGamesHub?.();mount();}
  function open(){
    style();game=null;
    const n=pool().length;
    frame('<div class="recognition-panel"><div class="recognition-app-title">🧠 啦啦隊認人王</div><p class="recognition-muted">看照片選出正確姓名，每題四選一。答錯也能認識新女孩！<br>所有題目使用網站女孩圖鑑資料。</p><p class="recognition-muted">目前可出題女孩：'+n+' 位</p><div class="recognition-actions"><button class="recognition-btn primary" data-start="quick">⚡ 20 題快賽</button><button class="recognition-btn" data-start="endless">♾️ 無限挑戰</button></div><p class="recognition-muted" style="margin-top:16px">無限挑戰答錯 3 題結束；每輪不重複出題。</p></div>');
    hub().querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.start)));
  }
  window.openRecognitionGame = open;
  function start(mode){
    const all=shuffle(pool());
    if(all.length<4){frame('<div class="recognition-panel">女孩圖鑑正在載入，請稍候再試。<div class="recognition-actions"><button class="recognition-btn primary" id="retry-recognition">重新載入</button></div></div>');document.getElementById('retry-recognition').onclick=open;return;}
    game={mode,all,limit:mode==='quick'?Math.min(20,all.length):all.length,index:0,correct:0,wrong:0,locked:false};
    renderQuestion();
  }
  function choices(target){
    const same=shuffle(game.all.filter(x=>x.uid!==target.uid && x.name!==target.name && x.team && x.team===target.team));
    const used=new Set([target.name]);const picked=[];
    for(const item of [...same,...shuffle(game.all.filter(x=>x.uid!==target.uid))]){
      if(used.has(item.name))continue;
      used.add(item.name);picked.push(item);if(picked.length===3)break;
    }
    return shuffle([target,...picked]);
  }
  function renderQuestion(){
    if(!game)return;
    if(game.index>=game.limit || (game.mode==='endless' && game.wrong>=3)){finish();return;}
    game.locked=false;
    const person=game.all[game.index],answers=choices(person);
    const total=game.mode==='quick'?game.limit:'題庫 '+game.limit;
    frame('<div class="recognition-panel"><div class="recognition-meta"><span>'+esc(game.mode==='quick'?'快速認人賽':'無限認人挑戰')+'</span><span>第 '+(game.index+1)+' / '+total+' 題</span></div><div class="recognition-progress"><span style="width:'+100*game.index/game.limit+'%"></span></div><div class="recognition-meta"><span>✓ 答對 '+game.correct+'</span><span>✕ 答錯 '+game.wrong+(game.mode==='endless'?' / 3':'')+'</span></div><img class="recognition-photo" alt="請猜猜照片中女孩的名字" src="'+esc(person.img)+'"><p style="font-weight:800;margin:8px 0">這位女孩是誰？</p><div class="recognition-actions">'+answers.map((g,i)=>'<button type="button" class="recognition-btn" data-choice="'+i+'">'+esc(g.name)+'</button>').join('')+'</div><div id="recognition-feedback" aria-live="polite"></div></div>');
    const image=hub().querySelector('.recognition-photo');
    image.addEventListener('error',()=>{
      if(!game||game.locked)return;
      game.all.splice(game.index,1);game.limit=Math.min(game.limit,game.all.length);
      if(game.all.length<4){finish();return;}renderQuestion();
    },{once:true});
    hub().querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{
      if(!game||game.locked)return;
      game.locked=true;
      const chosen=answers[Number(button.dataset.choice)],ok=chosen.uid===person.uid;
      if(ok)game.correct++;else game.wrong++;
      hub().querySelectorAll('[data-choice]').forEach(b=>{
        b.disabled=true;const item=answers[Number(b.dataset.choice)];
        if(item.uid===person.uid)b.classList.add('correct');
        else if(item.uid===chosen.uid)b.classList.add('wrong');
      });
      const end=game.index+1>=game.limit||(game.mode==='endless'&&game.wrong>=3);
      const feedback=hub().querySelector('#recognition-feedback');
      feedback.innerHTML='<div class="recognition-result">'+(ok?'✅ 答對了！':'❌ 答錯了！')+' 正確答案：<strong>'+esc(person.name)+'</strong>'+(person.team?'<div>球隊：'+esc(person.team)+'</div>':'')+'</div><button class="recognition-btn primary" type="button" id="recognition-next">'+(end?'查看成績':'下一題 →')+'</button>';
      hub().querySelector('#recognition-next').addEventListener('click',()=>{game.index++;renderQuestion();},{once:true});
    }));
  }
  function finish(){
    if(!game)return;
    const answered=game.index,percentage=answered?Math.round(game.correct/answered*100):0;
    const label=percentage>=90?'啦啦隊人肉資料庫':percentage>=75?'專業應援粉':percentage>=50?'認人實習生':'應援新鮮人';
    const previous=storage.get(key)||{};
    const best=Math.max(Number(previous[game.mode])||0,game.correct);
    storage.set(key,{...previous,[game.mode]:best});
    const share='TWCcheerleader 啦啦隊認人王\n'+(game.mode==='quick'?'20 題快賽':'無限挑戰')+'：'+game.correct+'/'+answered+' 題\n正確率 '+percentage+'%｜'+label;
    frame('<div class="recognition-panel"><div style="font-size:48px">🏆</div><div class="recognition-app-title">'+esc(label)+'</div><p class="recognition-muted">'+(game.mode==='quick'?'快速認人賽':'無限認人挑戰')+' 挑戰完成</p><div style="font-size:42px;font-weight:900">'+game.correct+' / '+answered+'</div><p class="recognition-muted">正確率 '+percentage+'% · 本機最高答對 '+best+' 題</p><div class="recognition-actions"><button class="recognition-btn primary" id="recognition-again">再玩一次</button><button class="recognition-btn" id="recognition-share">分享成績</button></div><p class="recognition-muted" style="margin-top:15px">成績僅儲存在目前裝置，尚未開放全站排行榜。</p></div>');
    document.getElementById('recognition-again').onclick=open;
    document.getElementById('recognition-share').onclick=async()=>{
      try{if(navigator.share){await navigator.share({title:'啦啦隊認人王',text:share,url:location.href});return;}
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(share);alert('成績已複製！');return;}}
      catch(e){if(e.name==='AbortError')return;}
      window.prompt('複製你的成績：',share);
    };
    game=null;
  }
  function observe(){
    style();const root=hub();if(!root)return;
    const observer=new MutationObserver(()=>{if(!root.querySelector('#recognition-app'))mount();});
    observer.observe(root,{childList:true,subtree:false});
    mount();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
