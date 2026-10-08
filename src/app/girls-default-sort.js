(() => {
  const TAIWAN_RE = /(臺灣|台灣|台籍|臺籍|Taiwan)/i;
  const KOREA_RE = /(韓國|韓籍|Korea|Korean)/i;
  const JAPAN_RE = /(日本|日籍|Japan|Japanese)/i;
  const TRAINEE_RE = /(練習生|培訓生|培訓)/;
  const LEADER_RE = /(應援團長|團長)/;
  const MASCOT_RE = /(吉祥物|mascot)/i;
  const NEW_MEMBER_RE = /(新成員|新加入|新人)/;
  const FORMER_RE = /(已離隊|離隊|已退隊|退隊|不續約|已卸任|前成員)/;

  const noteText = girl => String(girl?.note || girl?.['備註'] || girl?.備註 || '').trim();
  const cleanedNote = girl => noteText(girl)
    .replace(/(合作夥伴|合作)/g, '')
    .replace(/^[,\s、，]+|[,\s、，]+$/g, '')
    .trim();

  function departureSeason(girl) {
    return String(girl?.departure_season || girl?.departureseason || girl?.departureSeason || girl?.['離隊賽季'] || '').trim();
  }

  function isFormer(girl) {
    const status = String(girl?.status || '').trim().toLowerCase();
    return Boolean(departureSeason(girl))
      || FORMER_RE.test(noteText(girl))
      || ['former', 'ended', 'departed', 'inactive', '離隊', '已離隊'].includes(status);
  }

  function categoryRank(girl) {
    const note = cleanedNote(girl);

    // 身分類別固定排在一般啦啦隊女孩之後。
    if (TRAINEE_RE.test(note)) return 4;
    if (LEADER_RE.test(note)) return 5;
    if (MASCOT_RE.test(note)) return 6;

    // 「新成員」仍屬一般啦啦隊女孩，依國籍排序，不視為特殊身分。
    const hasSpecialRole = Boolean(note) && !NEW_MEMBER_RE.test(note);
    if (hasSpecialRole) return 7;

    const nationality = String(girl?.nat || girl?.['國籍'] || girl?.國籍 || '').trim();
    if (KOREA_RE.test(nationality)) return 0;
    if (JAPAN_RE.test(nationality)) return 1;
    if (nationality && !TAIWAN_RE.test(nationality)) return 2;
    return 3;
  }

  function sortGirls(girls) {
    if (!Array.isArray(girls) || girls.length === 0) return false;

    const ordered = girls
      .map((girl, index) => ({ girl, index, rank: categoryRank(girl) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(item => item.girl);

    girls.splice(0, girls.length, ...ordered);
    return true;
  }

  function installRenderGuard() {
    const current = window.renderContent;
    if (typeof current !== 'function' || current.__activeGirlsOnly) return false;

    const wrapped = function(...args) {
      const allGirls = window.dbGirls;
      if (!Array.isArray(allGirls) || document.body?.dataset.appMode !== 'girls') {
        return current.apply(this, args);
      }

      window.dbGirls = allGirls.filter(girl => !isFormer(girl));
      try {
        return current.apply(this, args);
      } finally {
        window.dbGirls = allGirls;
      }
    };

    wrapped.__activeGirlsOnly = true;
    wrapped.__originalRenderContent = current;
    window.renderContent = wrapped;
    return true;
  }

  function applyDefaultSort() {
    const girls = window.dbGirls;
    if (!Array.isArray(girls) || girls.length === 0) return false;

    sortGirls(girls);
    installRenderGuard();

    if (document.body?.dataset.appMode === 'girls' && typeof window.renderContent === 'function') {
      setTimeout(() => window.renderContent(true), 0);
    }
    return true;
  }

  window.CheerGirlsDefaultSort = Object.freeze({
    categoryRank,
    sortGirls,
    isFormer,
    departureSeason,
    applyDefaultSort
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const ready = applyDefaultSort();
    installRenderGuard();
    if ((ready && window.renderContent?.__activeGirlsOnly) || attempts >= 120) clearInterval(timer);
  }, 150);

  window.addEventListener('load', () => {
    installRenderGuard();
    applyDefaultSort();
  }, { once: true });
})();
