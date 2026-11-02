// Live ride status helpers for the Ride Heights page. Pure functions, no DOM.
// Loaded as a plain <script> in the browser (exposes window.Rides) and
// required directly by the Node tests.
(function(root) {
  const PARKS = {
    '7340550b-c14d-4def-80bb-acdb51d49a66': 'dl',
    '832fcd51-ea19-4e77-85c7-75d5843b127c': 'dca',
  };
  // When one ride maps to several API entities (Pixar Pal-A-Round's two
  // sides), the "most open" one wins.
  const RANK = { OPERATING: 0, DOWN: 1, CLOSED: 2, REFURBISHMENT: 3 };
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const byName = (a, b) => a.name.localeCompare(b.name);

  // ThemeParks.wiki liveData -> [{ id, name, park, status }]
  function normalizeRides(liveData) {
    return (liveData || [])
      .filter(x => x && x.entityType === 'ATTRACTION' && PARKS[x.parkId] && x.id && x.name)
      .map(x => ({ id: x.id, name: x.name, park: PARKS[x.parkId], status: x.status || null }));
  }

  function statusFor(ids, byId) {
    let best = null;
    (ids || []).forEach(id => {
      const r = byId.get(id);
      if (r && r.status in RANK && (best === null || RANK[r.status] < RANK[best])) best = r.status;
    });
    return best;
  }

  // Merges live refurbishment status with hand-kept notes (refurbs.json).
  // rides === null means live data failed to load: every note without a
  // future start date is shown as current, since nothing can be ruled stale.
  function refurbList(rides, meta, today) {
    const notes = (meta && Array.isArray(meta.refurbs)) ? meta.refurbs.filter(n => n && n.id && n.name) : [];
    const isUpcoming = (n) => isDate(n.starts) && n.starts > today;
    const byId = new Map((rides || []).map(r => [r.id, r]));
    const entry = (n, live) => ({
      id: n ? n.id : live.id,
      name: live ? live.name : n.name,
      park: live ? live.park : null,
      expectedReopen: (n && n.expectedReopen) || null,
      note: (n && n.note) || null,
      url: (n && n.url) || null,
      starts: (n && isDate(n.starts)) ? n.starts : null,
    });

    const upcoming = notes.filter(isUpcoming).map(n => entry(n, byId.get(n.id) || null));
    let current;
    if (rides === null) {
      current = notes.filter(n => !isUpcoming(n)).map(n => entry(n, null));
    } else {
      current = rides
        .filter(r => r.status === 'REFURBISHMENT')
        .map(r => entry(notes.find(n => n.id === r.id && !isUpcoming(n)) || null, r));
    }
    return { current: current.sort(byName), upcoming: upcoming.sort(byName) };
  }

  function downList(rides) {
    return (rides || []).filter(r => r.status === 'DOWN').sort(byName);
  }

  const api = { normalizeRides, statusFor, refurbList, downList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rides = api;
})(this);
