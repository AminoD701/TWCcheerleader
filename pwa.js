(() => {
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let deferredPrompt = null;
  let refreshing = false;
  let updateAccepted = false;

  const showInstallGuide = async () => {
    if (isStandalone()) {
      alert('你已經使用 APP 模式開啟台灣啦啦隊資料庫了！目前手機版 APP 仍在測試中，若遇到顯示或更新問題歡迎回報。');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      document.getElementById('pwa-install-btn')?.remove();
      return;
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(isiOS
      ? '📱 手機 APP 測試中\n\n【iPhone / iPad 安裝方式】\n1. 請使用 Safari 開啟本站\n2. 點下方「分享」按鈕\n3. 選擇「加入主畫面」\n4. 點「加入」即可像一般 APP 一樣從桌面開啟\n\n目前為測試版本，網站更新後會持續同步。'
      : '📱 手機 APP 測試中\n\n【Android 安裝方式】\n1. 建議使用 Chrome 開啟本站\n2. 點右上角選單\n3. 選擇「安裝應用程式」或「加入主畫面」\n4. 完成後即可像一般 APP 一樣從桌面開啟\n\n若畫面上有「安裝 APP」按鈕，也可以直接點擊安裝。');
  };

  const updateHomeMarquee = () => {
    const marquee = document.querySelector('.marquee-wrapper');
    const content = marquee?.querySelector('.marquee-content');
    if (!marquee || !content) return;

    marquee.removeAttribute('onclick');
    marquee.title = '點擊查看手機 APP 安裝教學';
    marquee.style.cursor = 'pointer';
    content.innerHTML = '📱【手機 APP 測試中】台灣啦啦隊資料庫現在可以安裝到手機桌面！ <span class="marquee-highlight">iPhone：Safari 分享 → 加入主畫面</span> ｜ Android：Chrome 選單 → 安裝應用程式。點擊這裡查看安裝教學。';
    marquee.addEventListener('click', showInstallGuide);
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(registration => {
        const offerUpdate = worker => {
          if (!worker || !navigator.serviceWorker.controller || document.getElementById('pwa-update-btn')) return;
          const btn = document.createElement('button');
          btn.id = 'pwa-update-btn';
          btn.type = 'button';
          btn.textContent = '有新版本，點此更新';
          btn.className = 'pwa-update-btn';
          btn.onclick = () => {
            updateAccepted = true;
            btn.disabled = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          };
          document.body.append(btn);
        };
        offerUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') offerUpdate(registration.waiting || installing);
          });
        });
      }).catch(err => console.warn('Service worker registration failed:', err));
    });
  }

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (refreshing || !updateAccepted) return;
    refreshing = true;
    location.reload();
  });

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
    btn.addEventListener('click', showInstallGuide);
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

  const loadGameEnhancements = () => {
    if (document.querySelector('script[data-game-app-enhancements]')) return;
    const script = document.createElement('script');
    script.src = './src/app/game-app-enhancements.js?v=2';
    script.defer = true;
    script.dataset.gameAppEnhancements = '1';
    document.head.appendChild(script);
  };

  // pwa.js is itself deferred, so load the game module now. Loading it only from
  // window.load was too late: the module then registered its own load handler after
  // that event had already fired, so Daily Gacha never initialized.
  loadGameEnhancements();

  window.addEventListener('load', () => {
    updateHomeMarquee();
    if (!isStandalone()) createInstallButton();
  });
})();
