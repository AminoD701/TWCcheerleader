(() => {
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let deferredPrompt = null;
  let refreshing = false;
  let updateAccepted = false;
  let registrationRef = null;

  const removeStandaloneFloatingShortcuts = () => {
    if (!isStandalone()) return;

    document.getElementById('app-daily-shortcut')?.remove();
    document.getElementById('gacha-history-floating')?.remove();
    document.querySelectorAll('.floating-boba-btn').forEach(el => el.remove());

    const legacyGacha = document.getElementById('gacha-btn-wrapper');
    if (legacyGacha) legacyGacha.style.setProperty('display', 'none', 'important');

    document.querySelectorAll('button,a').forEach(el => {
      if (el.closest('#navigation-hub')) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/今日一抽|每日一抽/.test(text)) el.remove();
    });
  };

  if (isStandalone()) {
    const emergencyStyle = document.createElement('style');
    emergencyStyle.id = 'standalone-legacy-shortcut-blocker';
    emergencyStyle.textContent = '#app-daily-shortcut,#gacha-history-floating,.floating-boba-btn,#gacha-btn-wrapper{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}';
    document.documentElement.appendChild(emergencyStyle);
    removeStandaloneFloatingShortcuts();
  }

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
    document.body.appendChild(btn);
  };

  const checkForUpdate = async () => {
    if (!registrationRef) return;
    try {
      await registrationRef.update();
      offerUpdate(registrationRef.waiting);
    } catch (error) {
      console.warn('PWA update check failed:', error);
    }
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
        registrationRef = registration;
        offerUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') offerUpdate(registration.waiting || installing);
          });
        });
        checkForUpdate();
      }).catch(err => console.warn('Service worker registration failed:', err));
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
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
      position: 'fixed', right: '16px', bottom: '18px', zIndex: '99998',
      border: '1px solid rgba(255,255,255,.3)', borderRadius: '999px',
      padding: '11px 16px', background: '#111418', color: '#fff',
      fontWeight: '800', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,.35)', cursor: 'pointer'
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

  const loadScriptOnce = (src, dataName) => {
    if (document.querySelector(`script[data-${dataName}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset[dataName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = '1';
    document.head.appendChild(script);
  };

  const enhanceStandaloneMore = () => {
    if (!isStandalone()) return;
    const hub = document.getElementById('navigation-hub');
    const grid = hub?.querySelector('.navigation-hub__grid');
    if (!hub || !grid || document.body.dataset.appMode !== 'more') return;
    if (!grid.querySelector('[data-more-daily-draw]')) {
      const daily = document.createElement('a');
      daily.href = '?mode=more';
      daily.dataset.moreDailyDraw = '1';
      daily.innerHTML = '<strong>✨ 今日一抽</strong><small>查看今天的幸運女孩。</small>';
      daily.addEventListener('click', event => {
        event.preventDefault();
        if (typeof window.showDailyGachaResult === 'function') window.showDailyGachaResult();
        else alert('今日一抽功能正在載入，請稍後再試一次。');
      });
      grid.appendChild(daily);
    }
  };

  const refreshStandaloneUi = () => {
    removeStandaloneFloatingShortcuts();
    enhanceStandaloneMore();
  };

  loadScriptOnce('./src/app/game-app-enhancements.js?v=6', 'game-app-enhancements');
  loadScriptOnce('./src/app/gacha-history.js?v=2', 'gacha-history');

  window.addEventListener('load', () => {
    updateHomeMarquee();
    if (!isStandalone()) createInstallButton();
    refreshStandaloneUi();
    if (isStandalone()) {
      const observer = new MutationObserver(refreshStandaloneUi);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      setInterval(removeStandaloneFloatingShortcuts, 500);
    }
  });
})();
