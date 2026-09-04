(function(){
 const accounts={
  'silbi_house':{host:'全州喜比食堂',type:'一日店長'},
  'goddess._.meet':{host:'女神來見面',type:'粉絲見面活動'},
  'hhpuppy_studio':{host:'心碎小狗',type:'粉絲互動簽名合照活動'},
  'jcl700912':{host:'板橋第一家卡店',type:'一日店長'}
 };
 let manualJson=null;
 const val=(n)=>document.querySelector('[name="'+n+'"]');
 const clean=(s)=>String(s||'').replace(/\s+/g,'').trim();
 function dateNorm(s){
  let m=String(s||'').match(/(20\d{2})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})/);
  if(!m){m=String(s||'').match(/(\d{1,2})月(\d{1,2})日/);if(m)return new Date().getFullYear()+'/'+String(m[1]).padStart(2,'0')+'/'+String(m[2]).padStart(2,'0')}
  return m?m[1]+'/'+String(m[2]).padStart(2,'0')+'/'+String(m[3]).padStart(2,'0'):'';
 }
 function accountFor(url,txt){
  const u=String(url||'').toLowerCase(); const all=u+' '+txt;
  return Object.keys(accounts).find(a=>all.includes(a))||'';
 }
 function specific(a,t){
  let m,d='',time='',girls='',venue='',address='';
  if(a==='silbi_house'){
   m=t.match(/活動時間\s*[:：]\s*(20\d{2})\s*[\/.／\-]\s*(\d{1,2})\s*[\/.／\-]\s*(\d{1,2})/); d=m?m[1]+'/'+String(m[2]).padStart(2,'0')+'/'+String(m[3]).padStart(2,'0'):dateNorm(t.match(/(\d{1,2})月(\d{1,2})日\s*女神降臨/)?.[0]);
   girls=t.match(/特別邀請\s*(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@/)?.[1]||'';
   const loc=t.match(/活動地點\s*[:：]\s*([^\n(（]+)\s*[（(]([^）)]+)[）)]/);venue=loc?.[1]?.trim()||'全州喜比食堂';address=clean(loc?.[2]||'');
   const ss=[];['第一場','第二場'].forEach(x=>{const q=t.match(new RegExp(x+'\\s*(下午|上午|晚上)?\\s*(\\d{1,2}):(\\d{2})'));if(q){let h=+q[2]+((q[1]==='下午'||q[1]==='晚上')&&+q[2]<12?12:0);ss.push(String(h).padStart(2,'0')+':'+q[3])}});time=ss.join(' / ');
  } else if(a==='goddess._.meet'){
   m=t.match(/活動時間\s*[:：]\s*(20\d{2})\s*[\/.／\-]\s*(\d{1,2})\s*[\/.／\-]\s*(\d{1,2})/);d=m?m[1]+'/'+String(m[2]).padStart(2,'0')+'/'+String(m[3]).padStart(2,'0'):'';
   let g=t.match(/跟\s*([^\s，,。！!\n]{2,12})\s*(?:還有|和|與|\+|➕|＆|&)\s*([^\s，,。！!\n]{2,12})\s*一起/)||t.match(/([\u3400-\u9fff]{2,6})\s*(?:\+|➕|＆|&)\s*([\u3400-\u9fff]{2,6})/);girls=g?g[1]+'、'+g[2]:'';
   let loc=t.match(/活動地點\s*[:：]\s*([^\n]+)/);venue=loc?loc[1].trim():'';let tail=loc?t.slice(loc.index+loc[0].length):'';address=clean(tail.match(/[（(]([^）)\n]+)[）)]/)?.[1]||'');
   time=[...t.matchAll(/(?<!\d)(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})(?!\d)/g)].slice(0,2).map(x=>x[1]+'-'+x[2]).join(' / ');
  } else if(a==='hhpuppy_studio'){
   m=t.match(/[【\[]\s*(20\d{2})\s*[\/.／\-]\s*(\d{1,2})\s*[\/.／\-]\s*(\d{1,2})[^】\]]*[】\]]/);d=m?m[1]+'/'+String(m[2]).padStart(2,'0')+'/'+String(m[3]).padStart(2,'0'):'';
   girls=t.match(/心碎療癒師[^\n]{0,16}?女神\s*[「『"“]([^」』"”]{2,16})[」』"”]/)?.[1]||'';let q=t.match(/[】\]]\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})/);time=q?q[1]+'-'+q[2]:'';venue='心碎小狗';address=clean(t.match(/活動地址\s*[:：]\s*(?:\n\s*)?([^\n]+)/)?.[1]||'');
  } else if(a==='jcl700912'){
   m=t.match(/(20\d{2})\s*[\/.／\-]\s*(\d{1,2})\s*[\/.／\-]\s*(\d{1,2})/);d=m?m[1]+'/'+String(m[2]).padStart(2,'0')+'/'+String(m[3]).padStart(2,'0'):'';
   girls=t.match(/特別邀請\s+([^\s，,。！!\n]{2,16})\s+擔任一日店長/)?.[1]||'';let ss=[...t.matchAll(/第[一二]場\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})/g)];time=ss.slice(0,2).map(x=>x[1]+'-'+x[2]).join(' / ');let pm=t.match(/PM\s*(\d{1,2})\s*點\s*[~～-]\s*(\d{1,2})\s*點/i);if(!time&&pm)time=String(+pm[1]+12).padStart(2,'0')+':00-'+String(+pm[2]+12).padStart(2,'0')+':00';address=clean(t.match(/活動地址\s*[:：]\s*(?:\n\s*)?([^\n（(]+)/)?.[1]||'');venue='板橋第一家卡店';
  }
  return {date:d,time:time||'TBA',girls,venue,address};
 }
 function generic(t){
  const date=dateNorm(t), tm=[...t.matchAll(/(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})/g)].slice(0,2).map(x=>x[1]+'-'+x[2]).join(' / ')||((t.match(/\d{1,2}:\d{2}/)||[])[0]||'TBA');
  const place=t.match(/(?:活動地點|活動場地|地點|場地)\s*[:：]\s*([^\n]+)/)?.[1]?.trim()||'';
  const address=clean(t.match(/(?:活動地址|地址)\s*[:：]\s*(?:\n\s*)?([^\n]+)/)?.[1]||'');
  const host=t.match(/(?:主辦單位|主辦方|主辦|店家)\s*[:：]\s*([^\n]+)/)?.[1]?.trim()||'';
  let girls=''; if(Array.isArray(window.dbGirls)){const hits=[];window.dbGirls.forEach(g=>{const names=[g.realname,g.nickname,g.alias,g.ig,g.handle].filter(Boolean);if(names.some(n=>t.includes(n)))hits.push(g.realname||g.nickname)});girls=[...new Set(hits)].join('、')}
  return {date,time:tm,girls,host,venue:place,address};
 }
 window.openManualEventModal=function(){document.getElementById('manual-event-overlay').classList.add('active');document.body.classList.add('no-scroll')};
 window.closeManualEventModal=function(){document.getElementById('manual-event-overlay').classList.remove('active');document.body.classList.remove('no-scroll')};
 window.parseManualEvent=async function(){
  const url=document.getElementById('manual-source-url').value.trim(), text=document.getElementById('manual-caption').value;
  if(!text.trim()){alert('請先貼上完整貼文文案');return}
  const a=accountFor(url,text), s=a?specific(a,text):generic(text), cfg=accounts[a]||{};
  const eventname=a?(cfg.host+'｜'+cfg.type):(text.split(/\n/).find(x=>x.trim())||'公開活動');
  const data={eventname,date:s.date,time:s.time,girls:s.girls,host:s.host||cfg.host||'',organizer:cfg.host||s.host||'',venue:s.venue||'',address:s.address||'',activity_type:cfg.type||'活動',img:'',link:url,note:'',_caption:text};
  try{const r=await fetch(url,{mode:'cors'});const h=await r.text();const q=h.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)/i);if(q)data.img=q[1]}catch(e){}
  Object.keys(data).forEach(k=>{if(val(k))val(k).value=data[k]});
  if(val('host')&&!val('host').value)val('host').value=cfg.host||s.host||''; if(val('eventname'))val('eventname').value=eventname;
  document.getElementById('manual-input-stage').style.display='none';document.getElementById('manual-event-form').style.display='block';document.getElementById('manual-event-preview').style.display='grid';window.refreshManualPreview();
  if(!data.img)document.getElementById('manual-preview-text').insertAdjacentHTML('beforeend','<p style="color:#ffb74d">無法自動取得貼文圖片，請貼上圖片網址或留空。</p>');
 };
 window.refreshManualPreview=function(){const f=document.getElementById('manual-event-form');const d={};new FormData(f).forEach((v,k)=>d[k]=v);document.getElementById('manual-preview-image').src=d.img||'';document.getElementById('manual-preview-text').innerHTML='<b>'+[d.date,d.eventname].filter(Boolean).join('｜')+'</b><br>女孩：'+(d.girls||'未填')+'<br>主辦：'+(d.host||'未填')+'<br>時間：'+(d.time||'TBA')+'<br>地點：'+(d.venue||'未填')};
 window.generateManualEventJson=function(){const f=document.getElementById('manual-event-form'),d={};new FormData(f).forEach((v,k)=>d[k]=v);const date=(d.date||'').replace(/\D/g,'');d.id='manual-'+(date||'event')+'-'+Math.random().toString(36).slice(2,7);d.manual=true;delete d._caption;manualJson=d;document.getElementById('manual-event-json').textContent=JSON.stringify(d,null,2);document.getElementById('manual-event-output').style.display='block'};
 window.copyManualEventJson=function(){if(manualJson)navigator.clipboard.writeText(JSON.stringify(manualJson,null,2)).then(()=>alert('JSON 已複製'))};
 window.downloadManualEventJson=function(){if(!manualJson)return;const blob=new Blob([JSON.stringify(manualJson,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='manual-event-'+(manualJson.date||'event').replace(/\//g,'-')+'.json';a.click();URL.revokeObjectURL(a.href)};
})();
