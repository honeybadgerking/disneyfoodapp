const { test } = require('node:test');
const assert = require('node:assert');
const { mapLinkFor } = require('../public/js/map-links.js');

const COORDS = {
  'Cafe Orleans': [33.8113, -117.9212],
  'Napa Rose — Grand Californian Hotel': [33.8087, -117.9216],
};

test('known restaurant gets an exact Google Maps pin', () => {
  const link = mapLinkFor('Cafe Orleans', { coords: COORDS, apple: false });
  assert.strictEqual(link.exact, true);
  assert.strictEqual(link.href, 'https://www.google.com/maps/search/?api=1&query=33.8113%2C-117.9212');
});

test('known restaurant gets an exact Apple Maps pin labeled with its name', () => {
  const link = mapLinkFor('Cafe Orleans', { coords: COORDS, apple: true });
  assert.strictEqual(link.exact, true);
  assert.strictEqual(link.href, 'https://maps.apple.com/?ll=33.8113,-117.9212&q=Cafe%20Orleans');
});

test('Apple pin label drops the hotel suffix', () => {
  const link = mapLinkFor('Napa Rose — Grand Californian Hotel', { coords: COORDS, apple: true });
  assert.match(link.href, /&q=Napa%20Rose$/);
});

test('unknown restaurant falls back to a search near the resort', () => {
  const g = mapLinkFor('Earl of Sandwich', { coords: COORDS, apple: false });
  assert.strictEqual(g.exact, false);
  assert.strictEqual(g.href, 'https://www.google.com/maps/search/?api=1&query=Earl%20of%20Sandwich%2C%20Anaheim%2C%20CA');
  const a = mapLinkFor('Earl of Sandwich', { coords: COORDS, apple: true });
  assert.strictEqual(a.href, 'https://maps.apple.com/?q=Earl%20of%20Sandwich&sll=33.8100,-117.9190');
});

test('search uses the first of several listed places, keeping the hotel as context', () => {
  const g = mapLinkFor('GCH Craftsman Grill — Grand Californian Hotel / Pool Bar', { coords: COORDS, apple: false });
  assert.match(g.href, /query=GCH%20Craftsman%20Grill%2C%20Grand%20Californian%20Hotel%2C%20Anaheim/);
});

test('"X near Y" carts search for the landmark', () => {
  const g = mapLinkFor('Churros near Sleeping Beauty Castle / Town Square', { coords: COORDS, apple: false });
  assert.match(g.href, /query=Sleeping%20Beauty%20Castle%2C%20Anaheim/);
});

test('park-wide carts get no map link', () => {
  for (const loc of ['Various carts throughout the park', 'Various pretzel carts', 'Outdoor Vending', '', null]) {
    assert.strictEqual(mapLinkFor(loc, { coords: COORDS, apple: false }), null, String(loc));
  }
});

test('the generated coordinates table only has pins inside the resort', () => {
  const coords = require('../public/js/map-coords.js');
  const entries = Object.entries(coords);
  assert.ok(entries.length >= 60, 'expected 60+ exact pins, got ' + entries.length);
  for (const [loc, [lat, lng]] of entries) {
    assert.ok(lat > 33.800 && lat < 33.818 && lng > -117.930 && lng < -117.910, loc + ' is outside the resort');
  }
});
