const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeRides, statusFor, refurbList, downList } = require('../public/js/rides.js');

const DL = '7340550b-c14d-4def-80bb-acdb51d49a66';
const DCA = '832fcd51-ea19-4e77-85c7-75d5843b127c';

const live = [
  { id: 'a1', name: 'Big Thunder Mountain Railroad', entityType: 'ATTRACTION', parkId: DL, status: 'OPERATING', queue: { STANDBY: { waitTime: 40 } } },
  { id: 'a2', name: '"it\'s a small world"', entityType: 'ATTRACTION', parkId: DL, status: 'REFURBISHMENT' },
  { id: 'a3', name: 'Grizzly River Run', entityType: 'ATTRACTION', parkId: DCA, status: 'DOWN' },
  { id: 'a4', name: 'Pixar Pal-A-Round – Swinging', entityType: 'ATTRACTION', parkId: DCA, status: 'CLOSED' },
  { id: 'a5', name: 'Pixar Pal-A-Round – Non-Swinging', entityType: 'ATTRACTION', parkId: DCA, status: 'OPERATING' },
  { id: 'a6', name: 'Monorail', entityType: 'ATTRACTION', parkId: DL, status: 'DOWN' },
  { id: 'r1', name: 'Cafe Orleans', entityType: 'RESTAURANT', parkId: DL, status: 'OPERATING' },
  { id: 'x1', name: 'Mystery Ride', entityType: 'ATTRACTION', parkId: 'somewhere-else', status: 'OPERATING' },
];

test('normalizeRides keeps attractions in the two parks with id, name, park, status', () => {
  const rides = normalizeRides(live);
  assert.deepStrictEqual(rides.map(r => r.id).sort(), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  assert.deepStrictEqual(rides.find(r => r.id === 'a1'), { id: 'a1', name: 'Big Thunder Mountain Railroad', park: 'dl', status: 'OPERATING' });
  assert.strictEqual(rides.find(r => r.id === 'a3').park, 'dca');
});

test('normalizeRides tolerates missing or malformed input', () => {
  assert.deepStrictEqual(normalizeRides(null), []);
  assert.deepStrictEqual(normalizeRides([{ entityType: 'ATTRACTION', parkId: DL }]), []);
});

test('statusFor picks the best status across a ride\'s ids, and null when none are live', () => {
  const byId = new Map(normalizeRides(live).map(r => [r.id, r]));
  assert.strictEqual(statusFor(['a4', 'a5'], byId), 'OPERATING');
  assert.strictEqual(statusFor(['a4'], byId), 'CLOSED');
  assert.strictEqual(statusFor(['a2'], byId), 'REFURBISHMENT');
  assert.strictEqual(statusFor(['nope'], byId), null);
  assert.strictEqual(statusFor([], byId), null);
  assert.strictEqual(statusFor(undefined, byId), null);
});

const meta = {
  refurbs: [
    { id: 'a2', name: '"it\'s a small world"', expectedReopen: 'Nov. 13, 2026', note: 'Holiday conversion', url: 'https://example.com/a' },
    { id: 'a1', name: 'Big Thunder Mountain Railroad', expectedReopen: 'Spring 2026', note: 'Old note' },
    { id: 'a1', name: 'Big Thunder Mountain Railroad', starts: '2027-01-06', expectedReopen: 'Summer 2027', note: 'Track work' },
    { id: 'a3', name: 'Grizzly River Run', starts: 'soon', note: 'Bad date' },
    { id: 'gone', name: 'Old Ride', expectedReopen: 'TBD' },
  ],
};
const TODAY = '2026-11-02';

test('a live refurb merges with its note', () => {
  const { current } = refurbList(normalizeRides(live), meta, TODAY);
  const sw = current.find(r => r.id === 'a2');
  assert.strictEqual(sw.expectedReopen, 'Nov. 13, 2026');
  assert.strictEqual(sw.note, 'Holiday conversion');
  assert.strictEqual(sw.url, 'https://example.com/a');
  assert.strictEqual(sw.park, 'dl');
});

test('a live refurb with no note gets nulls (page shows the default text)', () => {
  const { current } = refurbList(normalizeRides(live), { refurbs: [] }, TODAY);
  const sw = current.find(r => r.id === 'a2');
  assert.strictEqual(sw.expectedReopen, null);
  assert.strictEqual(sw.note, null);
});

test('a stale note for a reopened ride is hidden; a future closure is upcoming', () => {
  const { current, upcoming } = refurbList(normalizeRides(live), meta, TODAY);
  assert.ok(!current.some(r => r.note === 'Old note'));
  assert.deepStrictEqual(upcoming.map(r => r.note), ['Track work']);
  assert.strictEqual(upcoming[0].starts, '2027-01-06');
});

test('a malformed starts date never throws and is not treated as upcoming', () => {
  const { current, upcoming } = refurbList(normalizeRides(live), meta, TODAY);
  assert.ok(!upcoming.some(r => r.note === 'Bad date'));
  assert.ok(!current.some(r => r.note === 'Bad date')); // Grizzly is DOWN, not in refurb
});

test('a note for a ride the API no longer lists is hidden when live data loaded', () => {
  const { current } = refurbList(normalizeRides(live), meta, TODAY);
  assert.ok(!current.some(r => r.id === 'gone'));
});

test('with the API down, notes without a future start show as current with park null', () => {
  const { current, upcoming } = refurbList(null, meta, TODAY);
  assert.deepStrictEqual(current.map(r => r.id).sort(), ['a1', 'a2', 'a3', 'gone']);
  assert.ok(current.every(r => r.park === null));
  assert.deepStrictEqual(upcoming.map(r => r.note), ['Track work']);
});

test('refurbList tolerates missing notes file and sorts by name', () => {
  const { current, upcoming } = refurbList(normalizeRides(live), null, TODAY);
  assert.deepStrictEqual(current.map(r => r.id), ['a2']);
  assert.deepStrictEqual(upcoming, []);
  const many = refurbList(null, meta, TODAY).current.map(r => r.name);
  assert.deepStrictEqual(many, [...many].sort((a, b) => a.localeCompare(b)));
});

test('downList returns only DOWN rides, sorted by name', () => {
  assert.deepStrictEqual(downList(normalizeRides(live)).map(r => r.name), ['Grizzly River Run', 'Monorail']);
  assert.deepStrictEqual(downList(null), []);
});

test('rides.json: every ride has distinct API ids, none shared, no closed A Bug\'s Land rides', () => {
  const data = require('../public/rides.json');
  const seen = new Map();
  for (const park of data.parks) {
    for (const r of park.rides) {
      assert.ok(Array.isArray(r.ids) && r.ids.length > 0, r.name + ' has no ids');
      assert.strictEqual(new Set(r.ids).size, r.ids.length, r.name + ' repeats an id');
      for (const id of r.ids) {
        assert.ok(typeof id === 'string' && id.length > 0, r.name + ' has a bad id');
        assert.ok(!seen.has(id), id + ' used by both ' + seen.get(id) + ' and ' + r.name);
        seen.set(id, r.name);
      }
      assert.notStrictEqual(r.land, "A Bug's Land", r.name + ' is in A Bug\'s Land, which closed in 2018');
    }
  }
});

test('refurbs.json is well-formed', () => {
  const data = require('../public/refurbs.json');
  assert.match(data.updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(data.refurbs));
  for (const r of data.refurbs) {
    assert.strictEqual(typeof r.id, 'string');
    assert.strictEqual(typeof r.name, 'string');
    if (r.url != null) assert.match(r.url, /^https:\/\//);
    if (r.starts != null) assert.match(r.starts, /^\d{4}-\d{2}-\d{2}$/);
  }
});
