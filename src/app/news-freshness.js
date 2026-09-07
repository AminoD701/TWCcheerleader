(() => {
  const META_URL = './data/auto-news-meta.json';
  let meta = null;
  let loading = null;
  let renderQueued = false;

  const loadMeta = () => {
    if (!loading) {
      loading = fetch(`${META_URL}?t=${Date.now()}`, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : Promise.reject(new Error(`news meta ${response.status}`)))
        .then(data => {
          meta = data && typeof data === 'object' ? data : null;
          return meta;
        })
        .catch(error => {
          console.warn('News refresh metadata unavailable:', error);
          return null;
        })
        .finally(() => { loading = null; });
    }
    return loading;
  };

  const formatTaipei = value => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date).replace(/\//g, '/');
  };

  const latestAutoDateFallback = () => {
    if (!Array.isArray(window.dbNews)) return '';
    const dates = window.dbNews
      .filter(item => item && (item.auto === true || String(item.id || '').startsWith('auto-')))
      .map(item => String(item.date || '').trim())
      .filter(Boolean)
      .sort()
      .reverse();
    return dates[0] || '';
  };

  const ensureStyle = () => {
    if (document.getElementById('news-freshness-style')) return;
    const style = document.createElement('style');
    style.id = 'news-freshness-style';
    style.textContent = `
      .news-freshness{width:100%;max-width:1100px;margin:0 auto 10px;padding:0 16px;display:flex;justify-content:flex-end;align-items:center;gap:8px;color:var(--text-sub);font-size:11px;font-weight:700;letter-spacing:.4px}
      .news-freshness__dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.55)}
      .news-freshness.is-fallback .news-freshness__dot{background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,.45)}
      @media(max-width:768px){.news-freshness{justify-content:center;padding:0 12px;margin-bottom:8px;text-align:center}}
    `;
    document.head.appendChild(style);
  };

  const setBar = (bar, fallback, html) => {
    bar.classList.toggle('is-fallback', fallback);
    if (bar.innerHTML !== html) bar.innerHTML = html;
  };

  const render = async () => {
    const container = document.getElementById('news-container');
    if (!container || container.style.display === 'none') return;
    ensureStyle();

    let bar = container.querySelector('.news-freshness');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'news-freshness';
      container.prepend(bar);
    }

    const data = meta || await loadMeta();
    const generated = formatTaipei(data?.updatedAt);
    const latestItem = data?.latestItemDate || latestAutoDateFallback();
    const count = generated && Number.isFinite(Number(data?.itemCount)) ? Number(data.itemCount) : null;

    if (generated) {
      setBar(bar, false, `<span class="news-freshness__dot" aria-hidden="true"></span><span>自動情報最後更新：${generated}${count !== null ? ` · ${count} 則` : ''}</span>`);
    } else if (latestItem) {
      setBar(bar, true, `<span class="news-freshness__dot" aria-hidden="true"></span><span>最新自動情報時間：${latestItem} · 更新紀錄將於下一次爬蟲執行後顯示</span>`);
    } else {
      setBar(bar, true, '<span class="news-freshness__dot" aria-hidden="true"></span><span>自動情報更新時間暫時無法取得</span>');
    }
  };

  const scheduleRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
  else scheduleRender();

  new MutationObserver(scheduleRender).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      meta = null;
      loadMeta().then(scheduleRender);
    }
  });
})();
