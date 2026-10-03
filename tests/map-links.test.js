const { test } = require('node:test');
const assert = require('node:assert');
const { mapLinkFor } = require('../public/js/map-links.js');

const COORDS = {
  'Cafe Orleans': [33.8113, -117.9212],
  'Napa Rose — Grand Californian Hotel': [33.8087, -117.9216],
};

test('known restaurant gets an exact Google Maps pin', () => {
  const link = mapLinkFor('Cafe Orleans', { coords: COORDS });
  assert.strictEqual(link.exact, true);
  assert.strictEqual(link.href, 'https://www.google.com/maps/search/?api=1&query=33.8113%2C-117.9212');
});

test('unknown restaurant falls back to a Google Maps search near the resort', () => {
  const link = mapLinkFor('Earl of Sandwich', { coords: COORDS });
  assert.strictEqual(link.exact, false);
  assert.strictEqual(link.href, 'https://www.google.com/maps/search/?api=1&query=Earl%20of%20Sandwich%2C%20Anaheim%2C%20CA');
});

test('every link is Google Maps, never Apple Maps', () => {
  for (const loc of ['Cafe Orleans', 'Napa Rose — Grand Californian Hotel', 'Earl of Sandwich']) {
    assert.match(mapLinkFor(loc, { coords: COORDS }).href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  }
});

test('search uses the first of several listed places, keeping the hotel as context', () => {
  const g = mapLinkFor('GCH Craftsman Grill — Grand Californian Hotel / Pool Bar', { coords: COORDS });
  assert.match(g.href, /query=GCH%20Craftsman%20Grill%2C%20Grand%20Californian%20Hotel%2C%20Anaheim/);
});

test('"X near Y" carts search for the landmark', () => {
  const g = mapLinkFor('Churros near Sleeping Beauty Castle / Town Square', { coords: COORDS });
  assert.match(g.href, /query=Sleeping%20Beauty%20Castle%2C%20Anaheim/);
});

test('park-wide carts get no map link', () => {
  for (const loc of ['Various carts throughout the park', 'Various pretzel carts', 'Outdoor Vending', '', null]) {
    assert.strictEqual(mapLinkFor(loc, { coords: COORDS }), null, String(loc));
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
