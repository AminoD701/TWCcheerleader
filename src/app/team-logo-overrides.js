(() => {
  // Roster/filter labels use cheer squad names, but visual marks beside them
  // intentionally show the SPORTS TEAM logo.
  const squads = [
    {
      names: ['ACE VIVA', 'Ace Viva', 'Ace VIVA'],
      teamName: '臺中連莊 Win+Streak',
      logo: 'https://storage.googleapis.com/p-xc-m/event/419/squads/c45ab61917b75ee85815bf0d1431b0ebe5bb523b6395705ad65a2540c674a24a?q=100&w=256%25'
    },
    {
      names: ['Si-ster', 'Si-ster 可莉女孩', 'Si-ster 可利女孩', 'SiSter', 'SI-STER', '可利工程師', '可利工程師 Si-ster'],
      teamName: '可利工程師',
      logo: './images/koli_engineer_logo_transparent.svg?v=1'
    }
  ];

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const findSquad = text => squads.find(squad => squad.names.some(name => normalize(name) === normalize(text)));

  const applyLogo = (el, squad, className = '', beforeNode = null) => {
    let img = el.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      if (beforeNode) el.insertBefore(img, beforeNode);
      else el.prepend(img);
    }

    const resolvedSrc = new URL(squad.logo, document.baseURI).href;
    if (img.dataset.teamLogoResolved === squad.teamName && img.src === resolvedSrc) return;

    img.dataset.teamLogoOverride = '1';
    img.dataset.teamLogoResolved = squad.teamName;
    img.src = squad.logo;
    img.alt = `${squad.teamName} logo`;
    img.loading = 'lazy';
    img.style.removeProperty('display');
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    img.style.background = 'transparent';
    if (className) img.className = className;
    img.onerror = () => {
      img.style.display = 'none';
      console.warn('Team logo failed to load:', squad.teamName, squad.logo);
    };
  };

  const injectDropdownLogo = el => {
    const label = el.querySelector('span')?.textContent || el.textContent;
    const squad = findSquad(label);
    if (squad) applyLogo(el, squad);
  };

  const injectScheduleLogo = el => {
    const label = el.querySelector('span')?.textContent || el.textContent;
    const squad = findSquad(label);
    if (squad) applyLogo(el, squad);
  };

  const injectTabLogo = el => {
    const squad = findSquad(el.textContent);
    if (squad) applyLogo(el, squad, 'tab-logo');
  };

  const injectMatchLogo = box => {
    const nameEl = box.querySelector('.match-team-name');
    const squad = findSquad(nameEl?.textContent);
    if (!squad) return;
    box.querySelector('.match-no-logo')?.remove();
    applyLogo(box, squad, 'match-team-logo', nameEl || box.firstChild);
  };

  const apply = () => {
    document.querySelectorAll('.dropdown-item').forEach(injectDropdownLogo);
    document.querySelectorAll('.schedule-team-btn').forEach(injectScheduleLogo);
    document.querySelectorAll('.tab-btn').forEach(injectTabLogo);
    document.querySelectorAll('.match-team-box').forEach(injectMatchLogo);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
})();
