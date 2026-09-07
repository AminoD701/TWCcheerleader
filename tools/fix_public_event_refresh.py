from pathlib import Path

path = Path("index.html")
text = path.read_text(encoding="utf-8")
original = text

# The public-events background refresh intentionally tolerates network errors, but
# the previous implementation converted failures to [] and then overwrote dbEvents
# with that empty result. Keep the last-known-good list unless a refresh actually
# returns at least one valid event.
old = '''                                dbEvents = [
                                    ...(Array.isArray(freshManualEvents) ? freshManualEvents.filter(e => e.eventname || e.girls) : []),
                                    ...(Array.isArray(freshSheetEvents) ? freshSheetEvents.filter(e => e.eventname || e.girls) : [])
                                ].filter(e => {
                                    const key = [e.date || '', e.time || '', e.host || '', e.eventname || '', e.girls || ''].join('|').trim().toLowerCase();
                                    if (!key || eventSeen.has(key)) return false;
                                    eventSeen.add(key);
                                    return true;
                                }).map(e => ({ ...e, safeDate: parseDateFlexible(e.date) })).filter(e => e.safeDate);'''

new = '''                                const refreshedEvents = [
                                    ...(Array.isArray(freshManualEvents) ? freshManualEvents.filter(e => e.eventname || e.girls) : []),
                                    ...(Array.isArray(freshSheetEvents) ? freshSheetEvents.filter(e => e.eventname || e.girls) : [])
                                ].filter(e => {
                                    const key = [e.date || '', e.time || '', e.host || '', e.eventname || '', e.girls || ''].join('|').trim().toLowerCase();
                                    if (!key || eventSeen.has(key)) return false;
                                    eventSeen.add(key);
                                    return true;
                                }).map(e => ({ ...e, safeDate: parseDateFlexible(e.date) })).filter(e => e.safeDate);
                                if (refreshedEvents.length > 0) {
                                    dbEvents = refreshedEvents;
                                    try {
                                        localStorage.setItem('tw_public_events_last_good', JSON.stringify(refreshedEvents.map(({safeDate, ...event}) => event)));
                                    } catch (_) {}
                                } else if (!Array.isArray(dbEvents) || dbEvents.length === 0) {
                                    try {
                                        const fallbackEvents = JSON.parse(localStorage.getItem('tw_public_events_last_good') || '[]');
                                        if (Array.isArray(fallbackEvents) && fallbackEvents.length > 0) {
                                            dbEvents = fallbackEvents.map(e => ({ ...e, safeDate: parseDateFlexible(e.date) })).filter(e => e.safeDate);
                                        }
                                    } catch (_) {}
                                }'''

if old in text:
    text = text.replace(old, new, 1)

# Also protect the initial network-load merge. If optional event feeds temporarily
# return no rows, recover the last-known-good event list instead of displaying zero.
needle = '''                dbEvents = [...manualEvents, ...sheetEvents]
                    .filter(e => {
                        const key = [e.date || '', e.time || '', e.host || '', e.eventname || '', e.girls || ''].join('|').trim().toLowerCase();
                        if (!key || eventSeen.has(key)) return false;
                        eventSeen.add(key);
                        return true;
                    })
                    .map(e => ({ ...e, safeDate: parseDateFlexible(e.date) }))
                    .filter(e => e.safeDate);'''
replacement = needle + '''
                if (dbEvents.length > 0) {
                    try {
                        localStorage.setItem('tw_public_events_last_good', JSON.stringify(dbEvents.map(({safeDate, ...event}) => event)));
                    } catch (_) {}
                } else {
                    try {
                        const fallbackEvents = JSON.parse(localStorage.getItem('tw_public_events_last_good') || '[]');
                        if (Array.isArray(fallbackEvents) && fallbackEvents.length > 0) {
                            dbEvents = fallbackEvents.map(e => ({ ...e, safeDate: parseDateFlexible(e.date) })).filter(e => e.safeDate);
                        }
                    } catch (_) {}
                }'''
if needle in text and "tw_public_events_last_good" not in text[text.find(needle):text.find(needle) + len(needle) + 1200]:
    text = text.replace(needle, replacement, 1)

if text != original:
    path.write_text(text, encoding="utf-8")
    print("Public event last-known-good fallback applied.")
else:
    print("No public event refresh block found or fix already applied.")
