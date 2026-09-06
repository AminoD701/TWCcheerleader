(() => {
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let deferredPrompt = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed:', err));
    });
  }

  const createInstallButton = () => {
    if (document.getElementById('pwa-install-btn') || isStandalone()) return;
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.type = 'button';
    btn.textContent = '安裝 APP';
    btn.setAttribute('aria-label', '安裝台灣啦啦隊資料庫 APP');
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '18px',
      zIndex: '99998',
      border: '1px solid rgba(255,255,255,.3)',
      borderRadius: '999px',
      padding: '11px 16px',
      background: '#111418',
      color: '#fff',
      fontWeight: '800',
      fontSize: '14px',
      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
      cursor: 'pointer'
    });
    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        btn.remove();
        return;
      }
      const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      alert(isiOS
        ? 'iPhone / iPad：請點 Safari 下方「分享」→「加入主畫面」，即可像 APP 一樣使用。'
        : '請使用瀏覽器選單中的「安裝應用程式」或「加入主畫面」。');
    });
    document.body.appendChild(btn);
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    createInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('pwa-install-btn')?.remove();
  });

  window.addEventListener('load', () => {
    if (!isStandalone()) createInstallButton();
  });
})();
