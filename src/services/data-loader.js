(function exposeDataLoader(global) {
  function storage() {
    try { return global.localStorage; } catch (_) { return null; }
  }

  function read(key) {
    try {
      const value = JSON.parse(storage()?.getItem(`cheer_data_${key}`));
      return value && Array.isArray(value.data) ? value.data : null;
    } catch (_) { return null; }
  }

  function isAvailabilityFailure(error) {
    if (!error) return false;
    const name = String(error.name || '');
    const message = String(error.message || error);

    if (name === 'AbortError' || name === 'TimeoutError' || name === 'NetworkError') return true;
    return /signal is aborted|\babort(?:ed)?\b|time(?:d)?\s*out|network(?:error)?|failed to fetch|fetch failed|load failed|HTTP\s+\d{3}/i.test(message);
  }

  async function load(key, request) {
    try {
      const data = await request();
      if (!Array.isArray(data)) {
        const error = new TypeError(`${key} did not return an array`);
        error.name = 'DataFormatError';
        throw error;
      }
      try { storage()?.setItem(`cheer_data_${key}`, JSON.stringify({ updatedAt: Date.now(), data })); }
      catch (error) { console.warn(`Could not persist ${key}; using downloaded data.`, error); }
      return data;
    } catch (error) {
      if (!isAvailabilityFailure(error)) {
        // Parsing, validation and unexpected programming errors must remain visible,
        // even when a previous valid payload exists.
        throw error;
      }

      const previous = read(key);
      if (previous) {
        console.warn(`Could not refresh ${key}; using last successful data.`, error);
        return previous;
      }

      console.warn(`Could not load ${key}; continuing with an empty dataset.`, error);
      return [];
    }
  }

  global.CheerData = Object.freeze({ load, read });
})(window);
