(() => {
  const DAILY_KEY = 'twc_daily_gacha_result_v1';
  const HISTORY_KEY = 'twc_daily_gacha_history_v1';
  const MAX_HISTORY = 180;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; }
    catch { return fallback; }
  };

  const readHistory = () => {
    const value = readJson(HISTORY_KEY, []);
    return Array.isArray(value) ? value : [];
  };

  const saveHistory = history => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  };

  const syncCurrentIntoHistory = () => {
    const current = readJson(DAILY_KEY, null);
    if (!current?.date || !current?.name) return false;
    const history = readHistory();
    const sameDate = history.findIndex(item => item?.date === current.date);
    if (sameDate >= 0) {
      history[sameDate] = {...history[sameDate], ...current};
    } else {
      history.unshift(current);
    }
    history.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    saveHistory(history);
    return true;
  };

  const closeHistory = () => document.getElementById('gacha-history-modal')?.remove();

  const showHistory = () => {
    syncCurrentIntoHistory();
    const history = readHistory();
    closeHistory();
    const modal = document.createElement('div');
    modal.id = 'gacha-history-modal';
    modal.innerHTML = `
      <div class="gacha-history-backdrop" data-close-history></div>
      <section class="gacha-history-card" role="dialog" aria-modal="true" aria-label="每日一抽紀錄">
        <div class="gacha-history-head">
          <div><div class="gacha-history-kicker">DAILY GACHA ARCHIVE</div><h2>📚 我的抽卡紀錄</h2></div>
          <button type="button" class="gacha-history-close" data-close-history aria-label="關閉">×</button>
        </div>
        <div class="gacha-history-count">目前保存 ${history.length} 天紀錄</div>
        <div class="gacha-history-list">
          ${history.length ? history.map((item, index) => `
            <article class="gacha-history-item" data-history-index="${index}">
              ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.style.display='none'">` : '<div class="gacha-history-placeholder">✨</div>'}
              <div class="gacha-history-info">
                <time>${esc(item.date || '')}</time>
                <strong>${esc(item.name || '幸運女孩')}</strong>
                <span>${esc(item.team || item.nickname || '每日一抽')}</span>
              </div>
              <button type="button" data-history-view="${index}">查看</button>
            </article>`).join('') : '<div class="gacha-history-empty">目前還沒有抽卡紀錄。從今天開始，每次每日一抽都會自動保留下來。</div>'}
        </div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-history]').forEach(el => el.addEventListener('click', closeHistory));
    modal.querySelectorAll('[data-history-view]').forEach(btn => btn.addEventListener('click', () => {
      const item = history[Number(btn.dataset.historyView)];
      if (!item) return;
      closeHistory();
      if (typeof window.showDailyGachaResult === 'function') {
        window.showDailyGachaResult(item, false);
      } else {
        alert(`${item.date}\n${item.name}${item.team ? `\n${item.team}` : ''}`);
      }
    }));
  };

  const installStyles = () => {
    if (document.getElementById('gacha-history-style')) return;
    const style = document.createElement('style');
    style.id = 'gacha-history-style';
    style.textContent = `
      #gacha-history-modal{position:fixed;inset:0;z-index:100002;display:grid;place-items:center;padding:16px}.gacha-history-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(8px)}.gacha-history-card{position:relative;width:min(94vw,560px);max-height:86vh;overflow:hidden;background:linear-gradient(155deg,#181c22,#090b0e);border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:20px;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.62)}.gacha-history-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.gacha-history-kicker{font-size:10px;font-weight:950;letter-spacing:1.4px;color:#f9a8d4}.gacha-history-head h2{margin:5px 0 0;font-size:24px}.gacha-history-close{border:0;background:transparent;color:#9ca3af;font-size:30px;line-height:1;cursor:pointer}.gacha-history-count{margin:10px 0 14px;color:#94a3b8;font-size:12px}.gacha-history-list{display:flex;flex-direction:column;gap:9px;max-height:62vh;overflow:auto;padding-right:3px}.gacha-history-item{display:flex;align-items:center;gap:12px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.025)}.gacha-history-item img,.gacha-history-placeholder{width:54px;height:68px;border-radius:11px;object-fit:cover;object-position:top;flex:0 0 auto}.gacha-history-placeholder{display:grid;place-items:center;background:#15191e;font-size:22px}.gacha-history-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.gacha-history-info time{font-size:10px;color:#94a3b8;font-weight:800}.gacha-history-info strong{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gacha-history-info span{font-size:11px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gacha-history-item>button{border:1px solid rgba(255,255,255,.14);background:#fff;color:#111;border-radius:999px;padding:7px 10px;font-weight:900;font-size:11px;cursor:pointer}.gacha-history-empty{padding:28px 15px;text-align:center;color:#94a3b8;border:1px dashed rgba(255,255,255,.1);border-radius:14px;line-height:1.7}`;
    document.head.appendChild(style);
  };

  window.showGachaHistory = showHistory;

  const init = () => {
    installStyles();
    syncCurrentIntoHistory();
    let lastDaily = localStorage.getItem(DAILY_KEY);
    setInterval(() => {
      const now = localStorage.getItem(DAILY_KEY);
      if (now !== lastDaily) {
        lastDaily = now;
        syncCurrentIntoHistory();
      }
    }, 1500);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();