function defaultStorage() {
  try { return globalThis.localStorage; } catch (_) { return null; }
}

export function readLastSuccessful(key, storage = defaultStorage()) {
  try {
    if (!storage) return null;
    const parsed = JSON.parse(storage.getItem(key));
    return parsed && parsed.status === 'success' ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function storeSuccessful(key, data, storage = defaultStorage(), now = Date.now()) {
  const record = { status: 'success', updatedAt: now, data };
  if (!storage) throw new Error('Storage unavailable');
  storage.setItem(key, JSON.stringify(record));
  return record;
}

export async function fetchWithLastSuccess(key, load, storage = defaultStorage()) {
  let data;
  try {
    data = await load();
  } catch (error) {
    const previous = readLastSuccessful(key, storage);
    if (previous) return { ...previous, stale: true, error };
    return { status: 'error', data: null, stale: false, error };
  }

  const result = { status: 'success', updatedAt: Date.now(), data, stale: false };
  try { return { ...storeSuccessful(key, data, storage, result.updatedAt), stale: false }; }
  catch (storageError) { return { ...result, storageError }; }
}
