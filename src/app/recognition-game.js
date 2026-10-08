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
  let lastResults = [];
  let nextTimer = null;
  const clearNext = () => { if(nextTimer){clearTimeout(nextTimer);nextTimer=null;} };
  function pool() {
    const rows = window.CheerHomeData?.snapshot?.().girls || [];
    const unique = new Map();
    for(const g of rows) {
      const note=String(g.note || g['備註'] || g.備註 || '').replace(/合作夥伴|合作/g,'').trim();
      const role=String(g.role || g.position || g.identity || '').trim();
      if (/(團長|應援團長|吉祥物|主持人|主持|MC|DJ|總監|領隊|經理|教練|舞監|工作人員|球員|隊長級管理)/i.test(note+' '+role)) continue;
      if (note && !/(練習生|培訓生|正式成員|現役|已離隊|離隊|退隊|前成員)/.test(note)) continue;
      const nat=String(g.nat || g.nationality || '').trim();
      const foreign=/韓|韓國|日本|日籍|Korea|Japan/i.test(nat);
      const real=String(g.realname || g.name || g.姓名 || '').trim();
      const nick=String(g.nickname || '').trim();
      const isReadable = value => /[\u3400-\u9fff]/u.test(value) && !/[\uac00-\ud7af\u3040-\u30ff]/u.test(value);
      const name=foreign ? (isReadable(real) ? real : (isReadable(nick) ? nick : '')) : (nick || real);
      const img=String(g.img || '').trim();
      const uid=String(g.uid || name).trim();
      if (!name || !img || /[\uac00-\ud7af\u3040-\u30ff]/u.test(name)) continue;
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
      .recognition-photo{display:block;width:100%;height:clamp(210px,42vh,370px);object-fit:contain;background:#0e1117;border-radius:12px;margin:10px auto 12px}
      .recognition-progress{height:7px;border-radius:20px;overflow:hidden;background:#323948;margin:12px 0 18px}.recognition-progress span{display:block;height:100%;background:#a78bfa}
      .recognition-result{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#272e39;line-height:1.5;font-size:13px}
      #recognition-app .recognition-panel{padding:clamp(12px,3vw,22px)}#recognition-app .recognition-actions{margin-top:10px}#recognition-app [data-choice]{min-height:49px}#recognition-feedback{min-height:0}#recognition-app .recognition-answer-status{margin:10px 0 0;font-weight:750;color:#c5b0fa;font-size:13px} .recognition-meta{display:flex;justify-content:space-between;gap:8px;color:#cbd5e1;font-size:13px;font-weight:750}
      .recognition-back{display:block;margin:0 0 16px;padding:9px 0;background:transparent;color:#c5b5fa;border:0;font:700 14px inherit;cursor:pointer}
      .recognition-share-preview{text-align:left;border:1px solid #41495b;border-radius:18px;padding:clamp(22px,5vw,38px);background:linear-gradient(145deg,#1a1d28,#11151c);color:#f6f6fa}.recognition-share-kicker{font-size:10px;letter-spacing:1.6px;color:#bba6ee;font-weight:800}.recognition-share-heading{font-size:clamp(23px,5vw,30px);font-weight:850;margin-top:16px}.recognition-share-label{font-size:clamp(24px,5vw,34px);font-weight:900;color:#c8b6fa;margin:22px 0 5px}.recognition-share-score{font-size:clamp(64px,16vw,98px);font-weight:900;line-height:1.22;letter-spacing:-3px}.recognition-share-score span{font-size:.45em;color:#99a2b5}.recognition-share-preview p{color:#c1c7d2;line-height:1.7;font-size:14px;margin:8px 0 25px}.recognition-share-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid #39404d;padding-top:18px}.recognition-share-stats div{display:flex;flex-direction:column;gap:6px}.recognition-share-stats small{color:#9ba5b7}.recognition-share-stats strong{font-size:27px}.recognition-share-category{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.recognition-share-category span{font-size:12px;border:1px solid #454b5a;border-radius:7px;padding:8px;color:#d6d9e4}.recognition-share-footer{font-size:10px;letter-spacing:1px;color:#8e97a8;border-top:1px solid #39404d;margin-top:25px;padding-top:16px}\n      .recognition-share-preview{position:relative;overflow:hidden;max-width:560px;margin:0 auto;min-height:570px;border:1px solid #615574!important;border-radius:12px!important;background:radial-gradient(circle at 93% 6%,rgba(120,91,173,.16),transparent 42%),linear-gradient(160deg,#171a22,#0c0f15)!important}.recognition-share-preview:after{content:'RQ';position:absolute;top:6px;right:18px;font:italic 800 100px Georgia,serif;color:rgba(176,147,242,.075);pointer-events:none}.recognition-share-label{margin-top:30px!important;font-size:clamp(28px,7vw,40px)!important}.recognition-share-score{font-family:Georgia,serif;font-size:clamp(82px,20vw,125px)!important;color:#d0c0f4!important;letter-spacing:-5px!important}.recognition-share-score span{font-family:Georgia,serif;font-weight:400}.recognition-share-stats{margin-top:28px}.recognition-share-category{border-top:1px solid #343b49;padding-top:20px}.recognition-share-preview .recognition-share-footer{margin-top:28px} @media(max-width:380px){.recognition-actions{gap:8px}.recognition-btn{font-size:15px;padding:10px 7px}}

      .recognition-share-preview{isolation:isolate;position:relative;overflow:hidden;min-height:585px}
      .recognition-share-preview>.recognition-silhouette{position:absolute;z-index:-1;right:-42px;bottom:30px;width:56%;height:auto;color:#a993d8;opacity:.12;pointer-events:none}
      .recognition-share-preview>.recognition-share-kicker,.recognition-share-preview>.recognition-share-heading,.recognition-share-preview>.recognition-share-label,.recognition-share-preview>.recognition-share-score,.recognition-share-preview>p,.recognition-share-preview>.recognition-share-stats,.recognition-share-preview>.recognition-share-category,.recognition-share-preview>.recognition-share-footer{position:relative;z-index:1}
    `;
    document.head.append(tag);
  }
  function mount(){
    const root=hub(); if(!root || root.querySelector('#recognition-app, .recognition-entry, .twc-games-home')) return;
    const cards=root.querySelector('div[style*="flex-wrap"]'); if(!cards) return;
    const button=document.createElement('button'); button.type='button';button.className='recognition-entry';
    button.innerHTML='<span style="font-size:33px" aria-hidden="true">RQ</span><strong>啦啦隊認人王</strong><small>看照片猜名字，測試你的應援眼力</small>';
    button.addEventListener('click',open);cards.append(button);
  }
  function frame(html){
    const root=hub();if(!root)return;
    root.style.display='flex';root.style.flexDirection='column';root.style.alignItems='stretch';
    root.innerHTML='<section id="recognition-app" aria-label="啦啦隊認人王"><button class="recognition-back" type="button">← 返回遊戲中心</button>'+html+'</section>';
    root.querySelector('.recognition-back').addEventListener('click',back);
  }
  function back(){clearNext();game=null;window.renderGamesHub?.();mount();}
  function open(){
    clearNext();style();game=null;lastResults=[];
    const n=pool().length;
    frame('<div class="recognition-panel"><div class="recognition-app-title">啦啦隊認人王</div><p class="recognition-muted">看照片選出正確姓名，每題四選一。答錯也能認識新女孩！<br>所有題目使用網站女孩圖鑑資料。</p><p class="recognition-muted">目前可出題女孩：'+n+' 位</p><div class="recognition-actions"><button class="recognition-btn primary" data-start="quick">20 題快賽</button><button class="recognition-btn" data-start="endless">無限挑戰</button></div><p class="recognition-muted" style="margin-top:16px">無限挑戰答錯 3 題結束；每輪不重複出題。</p></div>');
    hub().querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.start)));
  }
  window.openRecognitionGame = open;
  function start(mode){
    clearNext();const all=shuffle(pool());
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
    const previousRect=hub()?.querySelector('#recognition-app')?.getBoundingClientRect();
    if(previousRect && (previousRect.top < -80 || previousRect.top > window.innerHeight-100)) hub()?.scrollIntoView({block:'start',behavior:'instant'});
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
      lastResults.push({person,ok,answer:chosen.name});
      hub().querySelectorAll('[data-choice]').forEach(b=>{
        b.disabled=true;const item=answers[Number(b.dataset.choice)];
        if(item.uid===person.uid)b.classList.add('correct');
        else if(item.uid===chosen.uid)b.classList.add('wrong');
      });
      const end=game.index+1>=game.limit||(game.mode==='endless'&&game.wrong>=3);
      const feedback=hub().querySelector('#recognition-feedback');
      feedback.innerHTML='<div class="recognition-answer-status" role="status">'+(ok?'答對了':'答錯了，正確答案：'+esc(person.name))+' · '+(end?'即將顯示成績':'自動進入下一題')+'</div>';
      const expectedGame=game;
      clearNext();
      nextTimer=setTimeout(()=>{nextTimer=null;if(game!==expectedGame)return;game.index++;renderQuestion();},ok?680:1050);
    }));
  }
  function groupStats(results) {
    const groups=new Map();
    for(const r of results) {
      const sport=r.person.sport || '';
      const cat=/棒球|CPBL/i.test(sport)?'棒球':/籃球|TPBL|PLG/i.test(sport)?'籃球':/排球|TPVL/i.test(sport)?'排球':'其他';
      const v=groups.get(cat)||{correct:0,total:0};
      v.total++;if(r.ok)v.correct++;groups.set(cat,v);
    }
    return [...groups.entries()].map(([name,value])=>({name,...value}));
  }
  function drawCheerSilhouette(c,x,y,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle='rgba(169,147,216,0.13)';
    c.beginPath();c.moveTo(106,27);c.bezierCurveTo(83,28,68,43,67,67);c.bezierCurveTo(66,83,74,97,83,105);c.lineTo(79,122);c.bezierCurveTo(48,126,28,147,21,180);c.lineTo(2,306);c.lineTo(218,306);c.lineTo(198,180);c.bezierCurveTo(191,147,169,126,138,122);c.lineTo(135,104);c.bezierCurveTo(147,94,153,79,151,62);c.bezierCurveTo(149,39,133,26,106,27);c.closePath();c.fill();
    c.beginPath();c.moveTo(127,35);c.bezierCurveTo(152,34,170,49,172,73);c.bezierCurveTo(174,91,186,108,201,121);c.bezierCurveTo(179,120,166,111,157,99);c.closePath();c.fill();
    c.beginPath();c.moveTo(75,49);c.bezierCurveTo(51,67,47,99,33,120);c.bezierCurveTo(56,117,74,105,82,88);c.closePath();c.fill();c.restore();
  }
  async function shareCard(result) {
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
    const c=canvas.getContext('2d');if(!c)throw new Error('圖片生成失敗');
    const font='system-ui,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    const background=c.createLinearGradient(0,0,1080,1350);
    background.addColorStop(0,'#171b25');background.addColorStop(1,'#0c1016');c.fillStyle=background;c.fillRect(0,0,1080,1350);
    drawCheerSilhouette(c,560,300,2.35);
    c.strokeStyle='#384050';c.lineWidth=2;c.strokeRect(50,50,980,1250);
    c.fillStyle='#ae9add';c.font='700 29px '+font;c.fillText('TWC CHEERLEADER  /  RECOGNITION QUIZ',100,138);
    c.fillStyle='#ffffff';c.font='800 70px '+font;c.fillText('啦啦隊認人王',100,248);
    c.fillStyle='#bca9ed';c.font='800 52px '+font;c.fillText(result.label,100,349);
    c.fillStyle='#748095';c.fillRect(100,393,880,2);
    c.fillStyle='#a89be7';c.font='700 30px '+font;c.fillText('YOUR SCORE',100,466);
    c.fillStyle='#ffffff';c.font='800 170px '+font;c.fillText(String(result.correct),100,664);
    const offset=c.measureText(String(result.correct)).width;
    c.font='600 85px '+font;c.fillStyle='#8e99ae';c.fillText(' / '+result.answered,108+offset,654);
    c.fillStyle='#e2e5ed';c.font='500 32px '+font;c.fillText(result.praise,100,743);
    c.fillStyle='#303744';c.fillRect(100,792,880,2);
    c.font='600 28px '+font;c.fillStyle='#a3adbd';c.fillText('正確率',100,854);c.fillText('本機最高',570,854);
    c.font='800 66px '+font;c.fillStyle='#fff';c.fillText(result.percentage+'%',100,934);c.fillText(result.best+' 題',570,934);
    c.fillStyle='#a9b0bd';c.font='600 27px '+font;c.fillText('各領域成績',100,1013);
    result.stats.slice(0,3).forEach((group,i)=>{
      const x=100+i*300,y=1062;
      c.fillStyle='#222936';c.fillRect(x,y,275,105);
      c.fillStyle='#c8d0df';c.font='600 25px '+font;c.fillText(group.name,x+18,y+38);
      c.fillStyle='#fff';c.font='700 34px '+font;c.fillText(group.correct+'/'+group.total,x+18,y+85);
      c.fillStyle='#a78bfa';c.fillRect(x+125,y+74,Math.round(128*group.correct/group.total),7);
    });
    c.fillStyle='#838d9f';c.font='500 26px '+font;c.fillText('你能認出幾位啦啦隊女孩？',100,1240);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(new File([b],'TWC-recognition-result.png',{type:'image/png'})):reject(new Error('無法輸出圖片')),'image/png'));
  }
  async function shareResult(result,button) {
    button.disabled=true;const original=button.textContent;button.textContent='產生分享圖片中…';
    try {
      const file=await shareCard(result);
      if(navigator.canShare?.({files:[file]}) && navigator.share) {
        try{await navigator.share({files:[file],title:'啦啦隊認人王',text:'我的認人王成績'});return;}
        catch(e){if(e.name==='AbortError')return;}
      }
      const url=URL.createObjectURL(file);
      const link=document.createElement('a');link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
    } catch(e) {alert('分享圖片產生失敗，請稍後再試。');}
    finally {button.disabled=false;button.textContent=original;}
  }
  function finish(){
    clearNext();if(!game)return;
    const answered=lastResults.length,percentage=answered?Math.round(game.correct/answered*100):0;
    const label=percentage>=90?'人肉應援資料庫':percentage>=75?'資深認人高手':percentage>=50?'應援識人達人':'應援新星';
    const praise=percentage>=90?'這種辨識力，已經不是普通粉絲等級。':percentage>=75?'對女孩名單這麼熟，實力真的不簡單。':percentage>=50?'你的認人實力正在穩定進步。':'下一次，你一定能認出更多女孩。';
    const previous=storage.get(key)||{};
    const best=Math.max(Number(previous[game.mode])||0,game.correct);
    storage.set(key,{...previous,[game.mode]:best});
    const stats=groupStats(lastResults);
    const result={correct:game.correct,answered,percentage,label,praise,best,stats,mode:game.mode};
    frame('<div class="recognition-share-preview"><svg class="recognition-silhouette" viewBox="0 0 220 320" fill="none" aria-hidden="true"><path fill="currentColor" d="M106 27c-23 1-38 16-39 40-1 16 7 30 16 38l-4 17c-31 4-51 25-58 58L2 306h216l-20-126c-7-33-29-54-60-58l-3-18c12-10 18-25 16-42-2-23-18-36-45-35Z"/><path fill="currentColor" d="M127 35c25-1 43 14 45 38 2 18 14 35 29 48-22-1-35-10-44-22l-8-25-22-39ZM75 49C51 67 47 99 33 120c23-3 41-15 49-32l-7-39Z"/></svg><div class="recognition-share-kicker">TWC CHEERLEADER / RECOGNITION QUIZ</div><div class="recognition-share-heading">啦啦隊認人王</div><div class="recognition-share-label">'+esc(label)+'</div><div class="recognition-share-score">'+game.correct+' <span>/ '+answered+'</span></div><p>'+esc(praise)+'</p><div class="recognition-share-stats"><div><small>正確率</small><strong>'+percentage+'%</strong></div><div><small>本機最佳</small><strong>'+best+' 題</strong></div></div><div class="recognition-share-category">'+stats.map(g=>'<span>'+esc(g.name)+'　'+g.correct+'/'+g.total+'</span>').join('')+'</div><div class="recognition-share-footer">TWC CHEERLEADER · 你能認出幾位女孩？</div></div><div class="recognition-actions"><button class="recognition-btn primary" id="recognition-share">產生分享圖片</button><button class="recognition-btn" id="recognition-again">再挑戰一次</button><button class="recognition-btn" id="recognition-wrong">查看錯題</button><button class="recognition-btn" id="recognition-home">返回遊戲中心</button></div>');
    document.getElementById('recognition-again').onclick=open;
    document.getElementById('recognition-home').onclick=back;
    document.getElementById('recognition-share').onclick=e=>shareResult(result,e.currentTarget);
    document.getElementById('recognition-wrong').onclick=()=>{
      const wrong=lastResults.filter(x=>!x.ok);
      frame('<div class="recognition-panel"><h2 class="recognition-app-title">錯題回顧</h2>'+(wrong.length?wrong.map(x=>'<p class="recognition-result">你的答案：'+esc(x.answer)+'<br>正確答案：<strong>'+esc(x.person.name)+'</strong></p>').join(''):'<p>全部答對，太厲害了！</p>')+'</div>');
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
