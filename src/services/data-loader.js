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

  async function load(key, request) {
    try {
      const data = await request();
      if (!Array.isArray(data)) throw new TypeError(`${key} did not return an array`);
      try { storage()?.setItem(`cheer_data_${key}`, JSON.stringify({ updatedAt: Date.now(), data })); }
      catch (error) { console.warn(`Could not persist ${key}; using downloaded data.`, error); }
      return data;
    } catch (error) {
      const previous = read(key);
      if (previous) {
        console.warn(`Could not refresh ${key}; using last successful data.`, error);
        return previous;
      }
      throw error;
    }
  }

  global.CheerData = Object.freeze({ load, read });
})(window);
