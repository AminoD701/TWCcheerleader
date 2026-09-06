(function exposeSafeStorage(global) {
  function preserveCorruptValue(key, raw, storage) {
    if (!raw) return;
    const backupKey = `${key}__recovery__${Date.now()}`;
    try { storage.setItem(backupKey, raw); } catch (_) { /* storage may be unavailable */ }
  }

  function getStorage(storage) {
    if (storage) return storage;
    try { return global.localStorage; } catch (_) { return null; }
  }

  function validItem(key, item) {
    if (key === 'cheer_my_schedules') return Boolean(item && typeof item === 'object' && typeof item.id === 'string');
    if (key === 'cheer_favorites') return typeof item === 'string' && item.length > 0;
    return item !== null && item !== undefined;
  }

  function readArray(key, storage) {
    storage = getStorage(storage);
    if (!storage) return [];
    let raw;
    try { raw = storage.getItem(key); } catch (_) { return []; }
    if (raw === null) return [];
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) return value.filter(item => validItem(key, item));
    } catch (_) { /* preserve below */ }
    preserveCorruptValue(key, raw, storage);
    return [];
  }

  global.CheerStorage = Object.freeze({ readArray, preserveCorruptValue });
})(window);
