(() => {
  const STYLE_ID = 'events-archive-calendar-style';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .events-archive{width:100%;max-width:1200px;margin:42px auto 0;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:linear-gradient(145deg,#15191e,#0d0f12);overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.36)}
      .events-archive summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 20px;color:#fff;font-weight:900}
      .events-archive summary::-webkit-details-marker{display:none}
      .events-archive summary::after{content:'＋';font-size:20px;color:var(--event-accent)}
      .events-archive[open] summary::after{content:'−'}
      .events-archive__summary-main{display:flex;flex-direction:column;gap:3px}
      .events-archive__summary-main strong{font-family:var(--sport-font);font-size:17px;letter-spacing:1.3px}
      .events-archive__summary-main small,.events-archive__count{color:var(--text-sub);font-size:12px;font-weight:700}
      .events-archive__body{border-top:1px solid rgba(255,255,255,.07);padding:18px}
      .events-archive__toolbar{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:10px;max-width:520px;margin:0 auto 15px}
      .events-archive__nav{height:42px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#11161d;color:#fff;cursor:pointer;font-size:18px;font-weight:900}
      .events-archive__nav:disabled{opacity:.25;cursor:default}
      .events-archive__month{text-align:center;color:#fff;font-family:var(--sport-font);font-size:20px;font-weight:900;letter-spacing:2px}
      .events-archive__calendar{max-width:520px;margin:0 auto;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
      .events-archive__weekday{text-align:center;color:#6f7a89;font:900 10px/1 var(--sport-font);padding:5px 0 7px}
      .events-archive__day{position:relative;aspect-ratio:1;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:rgba(255,255,255,.025);color:#6f7a89;font:800 13px/1 var(--sport-font);display:flex;align-items:center;justify-content:center}
      button.events-archive__day{cursor:pointer;color:#fff;border-color:rgba(255,255,255,.14);background:#151b22}
      button.events-archive__day:hover,button.events-archive__day.is-selected{border-color:var(--event-accent);box-shadow:0 0 0 1px var(--event-accent) inset;background:color-mix(in srgb,var(--event-accent) 10%,#151b22)}
      .events-archive__dot{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:var(--event-accent);box-shadow:0 0 7px var(--event-accent)}
      .events-archive__badge{position:absolute;top:4px;right:5px;min-width:15px;height:15px;border-radius:999px;background:rgba(255,255,255,.12);color:#dce4ed;font:900 9px/15px var(--sport-font)}
      .events-archive__help{max-width:520px;margin:12px auto 0;text-align:center;color:var(--text-sub);font-size:12px;line-height:1.6}
      .events-archive__preview{margin-top:20px}
      .events-archive__preview:empty{display:none}
      .events-archive__preview .event-date-card{margin:0!important}
      @media(max-width:768px){
        .events-archive{margin-top:25px;border-radius:12px}
        .events-archive summary{padding:14px}
        .events-archive__summary-main strong{font-size:15px}.events-archive__count{font-size:10px}
        .events-archive__body{padding:14px 10px 16px}
        .events-archive__calendar{gap:4px}
        .events-archive__day{border-radius:7px;font-size:12px}
        .events-archive__dot{bottom:4px}
        .events-archive__badge{top:3px;right:3px}
      }
    `;
    document.head.appendChild(style);
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

  function monthKey(item) {
    return item.year * 100 + item.month;
  }

  function decorate() {
    installStyles();
    const container = document.getElementById('event-container');
    if (!container) return;

    container.querySelector('.events-archive')?.remove();

    const cards = [...container.querySelectorAll('.event-date-card.expired')];
    if (!cards.length) {
      container.querySelector('.event-section-divider')?.remove();
      return;
    }

    const records = cards.map(card => {
      const date = cardDate(card);
      return date ? { card, ...date } : null;
    }).filter(Boolean);

    if (!records.length) return;

    const legacyDivider = container.querySelector('.event-section-divider');
    const legacyGrid = cards[0]?.closest('.event-grid');
    legacyDivider?.remove();
    if (legacyGrid) legacyGrid.remove();

    const byDate = new Map();
    records.forEach(record => {
      if (!byDate.has(record.num)) byDate.set(record.num, []);
      byDate.get(record.num).push(record);
    });

    const monthKeys = [...new Set(records.map(monthKey))].sort((a,b) => b-a);
    let monthIndex = 0;
    let selectedNum = null;

    const details = document.createElement('details');
    details.className = 'events-archive';
    details.innerHTML = `
      <summary>
        <span class="events-archive__summary-main">
          <strong>過往行程 ARCHIVE</strong>
          <small>以行事曆瀏覽已結束的公開行程</small>
        </span>
        <span class="events-archive__count">${byDate.size} 個日期</span>
      </summary>
      <div class="events-archive__body">
        <div class="events-archive__toolbar">
          <button type="button" class="events-archive__nav" data-archive-next aria-label="較新的月份">‹</button>
          <div class="events-archive__month"></div>
          <button type="button" class="events-archive__nav" data-archive-prev aria-label="較舊的月份">›</button>
        </div>
        <div class="events-archive__calendar"></div>
        <div class="events-archive__help">有亮點的日期代表曾有公開行程，點選日期即可展開當日紀錄。</div>
        <div class="events-archive__preview"></div>
      </div>`;

    const monthLabel = details.querySelector('.events-archive__month');
    const calendar = details.querySelector('.events-archive__calendar');
    const preview = details.querySelector('.events-archive__preview');
    const newerBtn = details.querySelector('[data-archive-next]');
    const olderBtn = details.querySelector('[data-archive-prev]');

    function renderPreview(num) {
      preview.innerHTML = '';
      const rows = byDate.get(num) || [];
      rows.forEach(({card}) => preview.appendChild(card));
      selectedNum = num;
      calendar.querySelectorAll('[data-date-num]').forEach(btn => {
        btn.classList.toggle('is-selected', Number(btn.dataset.dateNum) === num);
      });
      preview.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }

    function renderMonth() {
      const key = monthKeys[monthIndex];
      const year = Math.floor(key / 100);
      const month = key % 100;
      monthLabel.textContent = `${year} / ${String(month).padStart(2,'0')}`;
      newerBtn.disabled = monthIndex === 0;
      olderBtn.disabled = monthIndex === monthKeys.length - 1;

      const firstDay = new Date(year, month - 1, 1).getDay();
      const days = new Date(year, month, 0).getDate();
      const weekdays = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
      let html = weekdays.map(day => `<div class="events-archive__weekday">${day}</div>`).join('');
      for (let i=0;i<firstDay;i+=1) html += '<div></div>';
      for (let day=1;day<=days;day+=1) {
        const num = year*10000+month*100+day;
        const count = (byDate.get(num) || []).length;
        if (count) {
          html += `<button type="button" class="events-archive__day${selectedNum===num?' is-selected':''}" data-date-num="${num}">${day}<span class="events-archive__dot"></span>${count>1?`<span class="events-archive__badge">${count}</span>`:''}</button>`;
        } else {
          html += `<div class="events-archive__day">${day}</div>`;
        }
      }
      calendar.innerHTML = html;
    }

    newerBtn.addEventListener('click', () => {
      if (monthIndex > 0) { monthIndex -= 1; selectedNum = null; preview.innerHTML = ''; renderMonth(); }
    });
    olderBtn.addEventListener('click', () => {
      if (monthIndex < monthKeys.length - 1) { monthIndex += 1; selectedNum = null; preview.innerHTML = ''; renderMonth(); }
    });
    calendar.addEventListener('click', event => {
      const day = event.target.closest('[data-date-num]');
      if (day) renderPreview(Number(day.dataset.dateNum));
    });
    details.addEventListener('toggle', () => {
      if (details.open) renderMonth();
    });

    container.appendChild(details);
  }

  function install() {
    const original = window.renderEvents;
    if (typeof original !== 'function' || original.__archiveCalendarWrapped) return false;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      requestAnimationFrame(decorate);
      return result;
    };
    wrapped.__archiveCalendarWrapped = true;
    wrapped.__originalRenderEvents = original;
    window.renderEvents = wrapped;
    if (document.body?.dataset.appMode === 'events') requestAnimationFrame(decorate);
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 80) clearInterval(timer);
  }, 100);
  window.addEventListener('load', () => { install(); if (document.body?.dataset.appMode === 'events') requestAnimationFrame(decorate); }, { once:true });
})();
