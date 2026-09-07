(() => {
  const teams = [
    {
      names: ['ACE VIVA', 'Ace Viva', 'Ace VIVA'],
      logo: './images/ace_viva_logo_inline.svg?v=1'
    },
    {
      names: ['Si-ster', 'Si-ster 可莉女孩', 'SiSter', 'SI-STER'],
      logo: './images/sister_logo.jpg?v=20260907b'
    }
  ];

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const findTeam = text => teams.find(team => team.names.some(name => normalize(name) === normalize(text)));

  const applyLogo = (el, team, className = '', beforeNode = null) => {
    let img = el.querySelector('img[data-team-logo-override]');
    if (!img) {
      img = document.createElement('img');
      img.dataset.teamLogoOverride = '1';
      if (beforeNode) el.insertBefore(img, beforeNode);
      else el.prepend(img);
    }
    img.src = team.logo;
    img.alt = `${team.names[0]} logo`;
    img.loading = 'lazy';
    if (className) img.className = className;
    img.onerror = () => {
      img.style.display = 'none';
    };
  };

  const injectDropdownLogo = el => {
    const label = el.querySelector('span')?.textContent || el.textContent;
    const team = findTeam(label);
    if (!team) return;
    applyLogo(el, team);
  };

  const injectScheduleLogo = el => {
    const label = el.querySelector('span')?.textContent || el.textContent;
    const team = findTeam(label);
    if (!team) return;
    applyLogo(el, team);
  };

  const injectTabLogo = el => {
    const team = findTeam(el.textContent);
    if (!team) return;
    applyLogo(el, team, 'tab-logo');
  };

  const injectMatchLogo = box => {
    const nameEl = box.querySelector('.match-team-name');
    const team = findTeam(nameEl?.textContent);
    if (!team) return;
    box.querySelector('.match-no-logo')?.remove();
    applyLogo(box, team, 'match-team-logo', nameEl || box.firstChild);
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
