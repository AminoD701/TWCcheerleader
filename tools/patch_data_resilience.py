from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

old = '''        async function fetchCSV(url, timeoutMs = 7000) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, {
                    cache: 'no-store',
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (!response.ok) throw new Error(`CSV HTTP ${response.status}`);
                const csvText = await response.text();
                return await new Promise((resolve, reject) => {
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        transformHeader: h => h.trim().toLowerCase().replace(/[\\s_]/g, ""),
                        complete: res => resolve(res.data || []),
                        error: err => reject(err)
                    });
                });
            } finally {
                clearTimeout(timer);
            }
        }'''

new = '''        // DATA_LAST_KNOWN_GOOD_V1
        // Every Google Sheet dataset keeps its own last successful snapshot.
        // A transient timeout, empty response or parser failure must never erase
        // already-visible site data (especially the Girls directory).
        async function fetchCSV(url, timeoutMs = 7000) {
            const cacheIdMatch = String(url).match(/[?&]gid=(\\d+)/i);
            const cacheId = cacheIdMatch ? cacheIdMatch[1] : btoa(unescape(encodeURIComponent(String(url).split('&t=')[0]))).slice(0, 48);
            const lkgKey = `twc_sheet_lkg_v1_${cacheId}`;
            const readLastKnownGood = () => {
                try {
                    const saved = JSON.parse(localStorage.getItem(lkgKey) || 'null');
                    return Array.isArray(saved) && saved.length ? saved : null;
                } catch (_) {
                    return null;
                }
            };
            const saveLastKnownGood = rows => {
                if (!Array.isArray(rows) || !rows.length) return;
                try { localStorage.setItem(lkgKey, JSON.stringify(rows)); } catch (_) {}
            };

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, {
                    cache: 'no-store',
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (!response.ok) throw new Error(`CSV HTTP ${response.status}`);
                const csvText = await response.text();
                const rows = await new Promise((resolve, reject) => {
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        transformHeader: h => h.trim().toLowerCase().replace(/[\\s_]/g, ""),
                        complete: res => resolve(res.data || []),
                        error: err => reject(err)
                    });
                });

                // An unexpectedly empty feed is treated as a failed refresh when a
                // previous valid snapshot exists. This prevents whole sections from
                // flashing to zero records because Sheets briefly returned no rows.
                if (!Array.isArray(rows) || rows.length === 0) {
                    const fallback = readLastKnownGood();
                    if (fallback) {
                        console.warn('Empty Sheet refresh; preserving last-known-good dataset.', cacheId);
                        return fallback;
                    }
                    return [];
                }

                saveLastKnownGood(rows);
                return rows;
            } catch (error) {
                const fallback = readLastKnownGood();
                if (fallback) {
                    console.warn('Sheet refresh failed; preserving last-known-good dataset.', cacheId, error);
                    return fallback;
                }
                throw error;
            } finally {
                clearTimeout(timer);
            }
        }'''

if '// DATA_LAST_KNOWN_GOOD_V1' not in text:
    if old not in text:
        raise SystemExit('Current fetchCSV implementation was not found; refusing unsafe patch.')
    text = text.replace(old, new, 1)

if text != original:
    path.write_text(text, encoding='utf-8')
    print('Installed last-known-good protection for all Google Sheet datasets.')
else:
    print('Data resilience protection already installed.')
