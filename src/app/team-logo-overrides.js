(() => {
  const teams = [
    {
      names: ['ACE VIVA', 'Ace Viva', 'Ace VIVA'],
      logo: './images/ace_viva_logo.jpg?v=20260907b'
    },
    {
      names: ['Si-ster', 'Si-ster 可莉女孩', 'SiSter', 'SI-STER'],
      logo: './images/sister_logo.jpg?v=20260907b'
    }
  ];

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const findTeam = text => teams.find(team => team.names.some(name => normalize(name) === normalize(text)));

  const logoFor = team => {
    const img = document.createElement('img');
    img.src = team.logo;
    img.alt = `${team.names[0]} logo`;
    img.loading = 'lazy';
    img.dataset.teamLogoOverride = '1';
    return img;
  };

  const injectDropdownLogo = el => {
    if (el.querySelector('[data-team-logo-override]')) return;
    const label = el.querySelector('span')?.textContent || el.textContent;
    const team = findTeam(label);
    if (!team) return;
    el.prepend(logoFor(team));
  };

  const injectScheduleLogo = el => {
    if (el.querySelector('[data-team-logo-override]')) return;
    const label = el.querySelector('span')?.textContent || el.textContent;
    const team = findTeam(label);
    if (!team) return;
    el.prepend(logoFor(team));
  };

  const injectTabLogo = el => {
    if (el.querySelector('[data-team-logo-override]')) return;
    const team = findTeam(el.textContent);
    if (!team) return;
    const img = logoFor(team);
    img.className = 'tab-logo';
    el.prepend(img);
  };

  const injectMatchLogo = box => {
    const nameEl = box.querySelector('.match-team-name');
    const team = findTeam(nameEl?.textContent);
    if (!team || box.querySelector('[data-team-logo-override]')) return;
    box.querySelector('.match-no-logo')?.remove();
    const img = logoFor(team);
    img.className = 'match-team-logo';
    box.insertBefore(img, nameEl || box.firstChild);
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
