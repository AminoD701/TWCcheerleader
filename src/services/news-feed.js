(function (global) {
  const KEY = 'cheer_auto_news_snapshot_v1';
  let snapshot = null;
  try { snapshot = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}

  async function fetchItems(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`auto-news HTTP ${response.status}`);
    const raw = await response.text();
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new TypeError('auto-news must be an array');
    let meta = null;
    try {
      const res = await fetch('./data/auto-news-meta.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`metadata HTTP ${res.status}`);
      const candidate = await res.json();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
      // Never show a newer sidecar timestamp next to an older cached feed.
      if (hash === candidate.sha256 && Number.isFinite(Date.parse(candidate.updatedAt))) meta = candidate;
    } catch (error) { console.warn('News metadata unavailable:', error); }
    snapshot = { items, meta };
    try { localStorage.setItem(KEY, JSON.stringify(snapshot)); } catch (_) {}
    return items;
  }

  function renderStatus(container) {
    queueMicrotask(() => {
      container.querySelector('[data-news-updated]')?.remove();
      const el = document.createElement('p');
      el.dataset.newsUpdated = '1';
      el.style.cssText = 'width:100%;grid-column:1/-1;font-size:12px;color:#94a3b8;line-height:1.6;overflow-wrap:anywhere';
      const current = global.CheerData.read('auto-news');
      const meta = JSON.stringify(current) === JSON.stringify(snapshot?.items) ? snapshot?.meta : null;
      const stamp = meta ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(meta.updatedAt)) : '尚無可驗證時間';
      el.textContent = `自動新聞資料最後更新：${stamp}（台灣時間）${navigator.onLine === false ? ' · 離線資料' : ''}${meta?.status === 'partial' ? ' · 部分來源暫時無法更新' : ''}`;
      container.prepend(el);
    });
  }
  global.CheerNews = Object.freeze({ fetchItems, renderStatus });
})(window);
