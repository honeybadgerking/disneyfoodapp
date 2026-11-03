const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'outside.json'), 'utf8'));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

test('outside.json has regions and events', () => {
  assert.ok(data.regions && Object.keys(data.regions).length >= 2);
  assert.ok(Array.isArray(data.events) && data.events.length > 0);
});

test('every event id is unique and URL-safe (ids become Firestore keys)', () => {
  const ids = data.events.map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate id');
  ids.forEach((id) => assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id));
});

test('every event has the fields the page renders', () => {
  data.events.forEach((e) => {
    ['id', 'r', 'n', 'u', 'k', 'c', 'a', 'd'].forEach((k) => assert.ok(typeof e[k] === 'string' && e[k].length > 0, `${e.id}: missing ${k}`));
    assert.ok(data.regions[e.r], `${e.id}: unknown region ${e.r}`);
    assert.strictEqual(typeof e.free, 'boolean', `${e.id}: free must be boolean`);
    if (!e.free) assert.ok(e.p, `${e.id}: ticketed events need a price note`);
    assert.match(e.u, /^https:\/\//, `${e.id}: url must be https`);
  });
});

test('start and end dates are valid ISO dates in order, or both null', () => {
  data.events.forEach((e) => {
    if (e.s === null) { assert.strictEqual(e.e, null, `${e.id}: end without start`); return; }
    assert.match(e.s, ISO, e.id);
    assert.match(e.e, ISO, e.id);
    assert.ok(!Number.isNaN(Date.parse(e.s)) && !Number.isNaN(Date.parse(e.e)), `${e.id}: unparseable date`);
    assert.ok(e.s <= e.e, `${e.id}: starts after it ends`);
  });
});

test('ids cannot collide with food checklist keys', () => {
  // Food keys look like "dl::r::Loc::Name"; ours are prefixed "outside::" / "outside-note::".
  data.events.forEach((e) => assert.ok(!e.id.includes('::')));
});
