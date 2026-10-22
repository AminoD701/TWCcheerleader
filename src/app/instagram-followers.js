(() => {
  const DATA_URL = './data/instagram-followers.json';
  let followerData = null;
  let sortMode = 'default';

  const usernameFromIg = value => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('@')) return raw.slice(1).toLowerCase();
    try {
      const url = new URL(raw, location.href);
      if (!url.hostname.includes('instagram.com')) return '';
      return (url.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
    } catch (_) { return ''; }
  };

  const personKey = girl => String(girl?.uid || (String(girl?.realname || '').trim() + '|' + String(girl?.nickname || '').trim())).trim();

  function girlForCard(card) {
    const match = (card.getAttribute('onclick') || '').match(/openProfile\(['"]([^'"]+)['"]\)/);
    const id = match && match[1];
    if (!id) return null;
    return (Array.isArray(window.dbGirls) ? window.dbGirls : []).find(g => personKey(g) === id || String(g?.uid || '').trim() === id) || null;
  }

  function followersFor(girl) {
    const username = usernameFromIg(girl?.ig);
    const value = username && followerData?.profiles?.[username]?.followers;
    return Number.isFinite(value) ? value : null;
  }

  function formatCount(value) {
    return Number.isFinite(value) ? new Intl.NumberFormat('zh-TW').format(value) : '';
  }

  function installStyles() {
    if (document.getElementById('ig-followers-style')) return;
    const style = document.createElement('style');
    style.id = 'ig-followers-style';
    style.textContent =
      '.ig-followers-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07);font-size:11px}' +
      '.ig-followers-label{color:#8f9aa8;font-weight:800}.ig-followers-value{color:#fff;font-weight:950}.ig-followers-value small{color:#ff6a8b;font-size:9px;margin-left:3px}' +
      '.ig-ranking{width:min(100% - 32px,1160px);margin:10px auto 0;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(17,22,28,.82)}' +
      '.ig-ranking-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.ig-ranking-title{font-size:12px;font-weight:950;color:#fff}.ig-ranking-updated{font-size:9px;color:#7f8a98}' +
      '.ig-ranking-list{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}.ig-ranking-item{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:7px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:#0d1116;color:#dbe4ee;font-size:10px;font-weight:850;cursor:pointer}.ig-ranking-rank{color:#ff6a8b;font-weight:950}' +
      '.ig-sort-btn{border:1px solid rgba(255,255,255,.12);background:#11161c;color:#9aa5b2;border-radius:999px;min-height:36px;padding:0 11px;font-size:10px;font-weight:900;cursor:pointer}.ig-sort-btn.is-active{color:#fff;border-color:rgba(255,106,139,.45);background:rgba(255,106,139,.08)}' +
      '@media(max-width:767px){.ig-ranking{width:calc(100% - 20px);padding:10px}.ig-followers-row{font-size:10px;margin-top:8px;padding-top:7px}}';
    document.head.appendChild(style);
  }

  function decorateCards() {
    if (document.body?.dataset.appMode !== 'girls' || !followerData) return;
    document.querySelectorAll('#grid-container > .card').forEach(card => {
      const girl = girlForCard(card);
      if (!girl) return;
      const count = followersFor(girl);
      let row = card.querySelector('.ig-followers-row');
      if (!Number.isFinite(count)) {
        if (row) row.remove();
        delete card.dataset.igFollowers;
        return;
      }
      if (!row) {
        row = document.createElement('div');
        row.className = 'ig-followers-row';
        card.querySelector('.info-section')?.appendChild(row);
      }
      row.innerHTML = '<span class="ig-followers-label">Instagram</span><span class="ig-followers-value">' + formatCount(count) + ' <small>followers</small></span>';
      card.dataset.igFollowers = String(count);
    });
  }

  function applySort() {
    const grid = document.getElementById('grid-container');
    if (!grid) return;
    if (sortMode !== 'followers') {
      window.renderContent?.();
      return;
    }
    const cards = Array.from(grid.querySelectorAll(':scope > .card'));
    const sorted = cards.slice().sort((a,b) => (Number(b.dataset.igFollowers) || -1) - (Number(a.dataset.igFollowers) || -1));
    if (cards.every((card,index) => card === sorted[index])) return;
    sorted.forEach(card => grid.appendChild(card));
  }

  function ensureRanking() {
    if (document.body?.dataset.appMode !== 'girls' || !Array.isArray(followerData?.ranking) || followerData.ranking.length === 0) return;
    const toolbar = document.getElementById('girls-roster-toolbar');
    if (!toolbar) return;

    if (!toolbar.querySelector('.ig-sort-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ig-sort-btn';
      btn.textContent = 'IG 追蹤排序';
      btn.addEventListener('click', () => {
        sortMode = sortMode === 'followers' ? 'default' : 'followers';
        btn.classList.toggle('is-active', sortMode === 'followers');
        btn.textContent = sortMode === 'followers' ? '✓ IG 追蹤排序' : 'IG 追蹤排序';
        applySort();
      });
      (toolbar.querySelector('.girls-roster-toolbar__tabs') || toolbar).appendChild(btn);
    }

    let box = document.getElementById('ig-followers-ranking');
    if (!box) {
      box = document.createElement('section');
      box.id = 'ig-followers-ranking';
      box.className = 'ig-ranking';
      toolbar.insertAdjacentElement('afterend', box);
    }

    const head = document.createElement('div');
    head.className = 'ig-ranking-head';
    head.innerHTML = '<div class="ig-ranking-title">📈 IG 人氣榜 TOP 10</div><div class="ig-ranking-updated">每日更新 · ' + String(followerData.updatedAt || '').slice(0,10) + '</div>';

    const list = document.createElement('div');
    list.className = 'ig-ranking-list';
    followerData.ranking.slice(0,10).forEach((item,index) => {
      const girl = (Array.isArray(window.dbGirls) ? window.dbGirls : []).find(g => usernameFromIg(g?.ig) === item.username);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ig-ranking-item';
      const name = item.nickname || item.realName || item.username;
      btn.innerHTML = '<span class="ig-ranking-rank">#' + (index + 1) + '</span><span>' + name + '</span><strong>' + formatCount(item.followers) + '</strong>';
      if (girl) btn.addEventListener('click', () => window.openProfile?.(personKey(girl)));
      list.appendChild(btn);
    });

    const signature = followerData.updatedAt + '|' + followerData.ranking.slice(0,10).map(item => item.username + ':' + item.followers).join(',');
    if (box.dataset.signature !== signature) {
      box.dataset.signature = signature;
      box.replaceChildren(head, list);
    }
  }

  function sync() {
    installStyles();
    if (document.body?.dataset.appMode !== 'girls') {
      document.getElementById('ig-followers-ranking')?.remove();
      return;
    }
    decorateCards();
    ensureRanking();
    if (sortMode === 'followers') applySort();
  }

  function boot() {
    fetch(DATA_URL + '?t=' + Date.now(), {cache:'no-store'})
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        followerData = data;
        window.instagramFollowerData = data;
        sync();
      })
      .catch(err => console.warn('Instagram follower data unavailable', err));

    new MutationObserver(() => requestAnimationFrame(sync)).observe(document.body, {
      attributes:true, attributeFilter:['data-app-mode']
    });
    const attachGridObserver = () => {
      const grid = document.getElementById('grid-container');
      if (!grid || grid.dataset.igFollowerObserver === '1') return;
      grid.dataset.igFollowerObserver = '1';
      new MutationObserver(() => requestAnimationFrame(sync)).observe(grid, {childList:true});
    };
    attachGridObserver();
    setTimeout(() => { attachGridObserver(); sync(); }, 400);
    setTimeout(() => { attachGridObserver(); sync(); }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();