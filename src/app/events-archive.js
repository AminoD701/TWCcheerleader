(() => {
  const STYLE_ID = 'events-calendar-style';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body:not([data-app-mode="events"]) #event-container{display:none!important}
      body[data-app-mode="events"] #event-container{display:flex!important}
      .events-quick,.events-calendar{width:100%;max-width:1200px;margin:0 auto;box-sizing:border-box}
      .events-quick__heading,.events-calendar__heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:0 0 14px;padding:0 2px}
      .events-quick__heading strong,.events-calendar__heading strong{font-family:var(--sport-font);font-size:18px;letter-spacing:1.5px;color:#fff}
      .events-quick__heading small,.events-calendar__heading small{color:var(--text-sub);font-size:12px;font-weight:700}
      .events-quick__list{display:flex;flex-direction:column;gap:25px}
      .events-calendar{margin-top:38px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:linear-gradient(145deg,#15191e,#0d0f12);overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.36)}
      .events-calendar__heading{margin:0;padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.07)}
      .events-calendar__body{padding:18px}
      .events-calendar__toolbar{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:10px;max-width:540px;margin:0 auto 15px}
      .events-calendar__nav{height:42px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#11161d;color:#fff;cursor:pointer;font-size:18px;font-weight:900}
      .events-calendar__nav:disabled{opacity:.25;cursor:default}
      .events-calendar__month{text-align:center;color:#fff;font-family:var(--sport-font);font-size:20px;font-weight:900;letter-spacing:2px}
      .events-calendar__grid{max-width:540px;margin:0 auto;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
      .events-calendar__weekday{text-align:center;color:#6f7a89;font:900 10px/1 var(--sport-font);padding:5px 0 7px}
      .events-calendar__day{position:relative;aspect-ratio:1;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:rgba(255,255,255,.025);color:#6f7a89;font:800 13px/1 var(--sport-font);display:flex;align-items:center;justify-content:center}
      button.events-calendar__day{cursor:pointer;color:#fff;border-color:rgba(255,255,255,.14);background:#151b22}
      button.events-calendar__day:hover,button.events-calendar__day.is-selected{border-color:var(--event-accent);box-shadow:0 0 0 1px var(--event-accent) inset;background:color-mix(in srgb,var(--event-accent) 10%,#151b22)}
      .events-calendar__day.is-past{color:#9aa4b1;background:#11151a}
      .events-calendar__day.is-upcoming{color:#fff}
      .events-calendar__day.is-today{box-shadow:0 0 0 1px rgba(255,255,255,.35) inset}
      .events-calendar__dot{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:var(--event-accent);box-shadow:0 0 7px var(--event-accent)}
      .events-calendar__badge{position:absolute;top:4px;right:5px;min-width:15px;height:15px;border-radius:999px;background:rgba(255,255,255,.12);color:#dce4ed;font:900 9px/15px var(--sport-font)}
      .events-calendar__legend{max-width:540px;margin:12px auto 0;text-align:center;color:var(--text-sub);font-size:12px;line-height:1.6}
      .events-calendar__preview{margin-top:20px;display:flex;flex-direction:column;gap:20px}
      .events-calendar__preview:empty{display:none}
      .events-calendar__preview .event-date-card{margin:0!important}
      .events-quick__empty{padding:24px;border:1px dashed rgba(255,255,255,.10);border-radius:12px;color:var(--text-sub);text-align:center;font-size:13px}
      @media(max-width:768px){
        .events-quick__heading,.events-calendar__heading{align-items:flex-start;flex-direction:column;gap:4px}
        .events-quick__heading strong,.events-calendar__heading strong{font-size:15px}
        .events-calendar{margin-top:25px;border-radius:12px}
        .events-calendar__heading{padding:14px}
        .events-calendar__body{padding:14px 10px 16px}
        .events-calendar__grid{gap:4px}
        .events-calendar__day{border-radius:7px;font-size:12px}
        .events-calendar__dot{bottom:4px}
        .events-calendar__badge{top:3px;right:3px}
      }
    `;
    document.head.appendChild(style);
  }

  function dateNum(d) {
    return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
  }

  function cardDate(card) {
    const header = card.querySelector('.event-date-header') || card;
    const text = (header.textContent || '').replace(/\s+/g, ' ');
    const md = text.match(/(\d{1,2})\/(\d{1,2})/);
    const year = text.match(/(20\d{2})/);
    if (!md) return null;
    const y = year ? Number(year[1]) : new Date().getFullYear();
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (!y || !m || !d) return null;
    return { year:y, month:m, day:d, num:y*10000+m*100+d };
  }

  function monthKey(item) { return item.year*100 + item.month; }

  function cloneCard(record) {
    const card = record.template.cloneNode(true);
    card.classList.toggle('expired', record.num < dateNum(new Date()));
    return card;
  }

  function decorate() {
    installStyles();
    const container = document.getElementById('event-container');
    if (!container || document.body?.dataset.appMode !== 'events') return;

    const sourceCards = [...container.querySelectorAll('.event-date-card')]
      .filter(card => !card.closest('.events-quick,.events-calendar'));

    // If the enhanced calendar already exists, a second observer/render tick must
    // not delete it just because the legacy source cards were already consumed.
    if (!sourceCards.length && container.querySelector('.events-calendar')) return;
    if (!sourceCards.length) return;

    const records = sourceCards.map(card => {
      const date = cardDate(card);
      return date ? { ...date, template:card.cloneNode(true) } : null;
    }).filter(Boolean);

    if (!records.length) return;

    container.querySelector('.events-quick')?.remove();
    container.querySelector('.events-calendar')?.remove();
    container.querySelectorAll('.event-grid,.event-section-divider').forEach(el => el.remove());

    const byDate = new Map();
    records.forEach(record => {
      if (!byDate.has(record.num)) byDate.set(record.num, []);
      byDate.get(record.num).push(record);
    });

    const today = new Date();
    today.setHours(0,0,0,0);
    const todayNum = dateNum(today);
    const day3 = new Date(today);
    day3.setDate(day3.getDate()+2);
    const quickEndNum = dateNum(day3);

    const quickRecords = [...byDate.entries()]
      .filter(([num]) => num >= todayNum && num <= quickEndNum)
      .sort((a,b) => a[0]-b[0]);

    const quick = document.createElement('section');
    quick.className = 'events-quick';
    quick.innerHTML = `
      <div class="events-quick__heading">
        <strong>接下來 3 天 QUICK VIEW</strong>
        <small>先看近期公開行程，完整日期可由下方月曆瀏覽</small>
      </div>
      <div class="events-quick__list"></div>`;
    const quickList = quick.querySelector('.events-quick__list');
    if (quickRecords.length) {
      quickRecords.forEach(([,rows]) => rows.forEach(record => quickList.appendChild(cloneCard(record))));
    } else {
      quickList.innerHTML = '<div class="events-quick__empty">接下來 3 天目前沒有公開行程，可使用下方月曆查看之後的安排。</div>';
    }

    const allMonthKeys = [...new Set(records.map(monthKey))].sort((a,b)=>a-b);
    const currentMonthKey = today.getFullYear()*100 + (today.getMonth()+1);
    let monthIndex = allMonthKeys.findIndex(key => key >= currentMonthKey);
    if (monthIndex < 0) monthIndex = allMonthKeys.length - 1;
    let selectedNum = null;

    const calendarSection = document.createElement('section');
    calendarSection.className = 'events-calendar';
    calendarSection.innerHTML = `
      <div class="events-calendar__heading">
        <strong>公開行程月曆 EVENTS CALENDAR</strong>
        <small>未來與過往行程都可依日期查看</small>
      </div>
      <div class="events-calendar__body">
        <div class="events-calendar__toolbar">
          <button type="button" class="events-calendar__nav" data-month-prev aria-label="上一個月份">‹</button>
          <div class="events-calendar__month"></div>
          <button type="button" class="events-calendar__nav" data-month-next aria-label="下一個月份">›</button>
        </div>
        <div class="events-calendar__grid"></div>
        <div class="events-calendar__legend">有亮點的日期代表有公開行程；灰色日期為過往紀錄。點選日期即可查看當日完整內容。</div>
        <div class="events-calendar__preview"></div>
      </div>`;

    const monthLabel=calendarSection.querySelector('.events-calendar__month');
    const grid=calendarSection.querySelector('.events-calendar__grid');
    const preview=calendarSection.querySelector('.events-calendar__preview');
    const prevBtn=calendarSection.querySelector('[data-month-prev]');
    const nextBtn=calendarSection.querySelector('[data-month-next]');

    function renderPreview(num) {
      preview.innerHTML='';
      (byDate.get(num)||[]).forEach(record=>preview.appendChild(cloneCard(record)));
      selectedNum=num;
      grid.querySelectorAll('[data-date-num]').forEach(btn=>btn.classList.toggle('is-selected',Number(btn.dataset.dateNum)===num));
      preview.scrollIntoView({behavior:'smooth',block:'nearest'});
    }

    function renderMonth() {
      const key=allMonthKeys[monthIndex];
      const year=Math.floor(key/100);
      const month=key%100;
      monthLabel.textContent=`${year} / ${String(month).padStart(2,'0')}`;
      prevBtn.disabled=monthIndex===0;
      nextBtn.disabled=monthIndex===allMonthKeys.length-1;

      const firstDay=new Date(year,month-1,1).getDay();
      const days=new Date(year,month,0).getDate();
      const weekdays=['SUN','MON','TUE','WED','THU','FRI','SAT'];
      let html=weekdays.map(day=>`<div class="events-calendar__weekday">${day}</div>`).join('');
      for(let i=0;i<firstDay;i+=1) html+='<div></div>';
      for(let day=1;day<=days;day+=1){
        const num=year*10000+month*100+day;
        const count=(byDate.get(num)||[]).length;
        if(count){
          const classes=['events-calendar__day',num<todayNum?'is-past':'is-upcoming',num===todayNum?'is-today':'',selectedNum===num?'is-selected':''].filter(Boolean).join(' ');
          html+=`<button type="button" class="${classes}" data-date-num="${num}">${day}<span class="events-calendar__dot"></span>${count>1?`<span class="events-calendar__badge">${count}</span>`:''}</button>`;
        }else{
          html+=`<div class="events-calendar__day">${day}</div>`;
        }
      }
      grid.innerHTML=html;
    }

    prevBtn.addEventListener('click',()=>{if(monthIndex>0){monthIndex-=1;selectedNum=null;preview.innerHTML='';renderMonth();}});
    nextBtn.addEventListener('click',()=>{if(monthIndex<allMonthKeys.length-1){monthIndex+=1;selectedNum=null;preview.innerHTML='';renderMonth();}});
    grid.addEventListener('click',event=>{const day=event.target.closest('[data-date-num]');if(day)renderPreview(Number(day.dataset.dateNum));});

    renderMonth();
    container.appendChild(quick);
    container.appendChild(calendarSection);
  }

  let routeRetryTimer = 0;

  function ensureEventsReady() {
    clearInterval(routeRetryTimer);
    if (document.body?.dataset.appMode !== 'events') return;

    let tries = 0;
    const attempt = () => {
      if (document.body?.dataset.appMode !== 'events') {
        clearInterval(routeRetryTimer);
        return;
      }
      const container = document.getElementById('event-container');
      const ready = Boolean(container?.querySelector('.events-calendar,.event-date-card'));
      if (ready) {
        requestAnimationFrame(decorate);
        clearInterval(routeRetryTimer);
        return;
      }
      if (typeof window.renderEvents === 'function') window.renderEvents();
      tries += 1;
      if (tries >= 24) clearInterval(routeRetryTimer);
    };

    attempt();
    if (tries < 24) routeRetryTimer = setInterval(attempt, 250);
  }

  function install() {
    const original=window.renderEvents;
    if(typeof original!=='function'||original.__eventsCalendarWrapped)return false;
    const wrapped=function(...args){const result=original.apply(this,args);requestAnimationFrame(decorate);return result;};
    wrapped.__eventsCalendarWrapped=true;
    wrapped.__originalRenderEvents=original;
    window.renderEvents=wrapped;
    if(document.body?.dataset.appMode==='events') requestAnimationFrame(ensureEventsReady);
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries+=1;if(install()||tries>80)clearInterval(timer);},100);
  const routeObserver=new MutationObserver(()=>{
    if(document.body?.dataset.appMode==='events') requestAnimationFrame(ensureEventsReady);
    else clearInterval(routeRetryTimer);
  });
  window.addEventListener('load',()=>{
    install();
    routeObserver.observe(document.body,{attributes:true,attributeFilter:['data-app-mode']});
    if(document.body?.dataset.appMode==='events') requestAnimationFrame(ensureEventsReady);
  },{once:true});
})();
