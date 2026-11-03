const { test } = require('node:test');
const assert = require('node:assert');

const load = () => import('../public/js/crew-utils.js');

test('normalizeEmail trims and lowercases', async () => {
  const { normalizeEmail } = await load();
  assert.strictEqual(normalizeEmail('  Mia.Lee@Gmail.COM '), 'mia.lee@gmail.com');
  assert.strictEqual(normalizeEmail(null), '');
});

test('EMAIL_RE accepts emails and rejects junk', async () => {
  const { EMAIL_RE } = await load();
  assert.ok(EMAIL_RE.test('a@b.co'));
  assert.ok(EMAIL_RE.test('first.last+disney@gmail.com'));
  for (const bad of ['', 'nope', 'a@b', '@b.com', 'a b@c.com', 'a@b/c.com', 'a@@b.com']) {
    assert.ok(!EMAIL_RE.test(bad), bad);
  }
});

test('relTime buckets', async () => {
  const { relTime } = await load();
  const now = new Date('2026-11-03T12:00:00Z');
  assert.strictEqual(relTime(new Date(now - 10e3), now), 'just now');
  assert.strictEqual(relTime(new Date(now - 5 * 60e3), now), '5m ago');
  assert.strictEqual(relTime(new Date(now - 3 * 3600e3), now), '3h ago');
  assert.strictEqual(relTime(new Date(now - 2 * 86400e3), now), '2d ago');
});

test('initials and colorFor are stable', async () => {
  const { initials, colorFor } = await load();
  assert.strictEqual(initials('Mia Lee'), 'ML');
  assert.strictEqual(initials('max@example.com'), 'MC');
  assert.strictEqual(initials(''), '?');
  assert.strictEqual(colorFor('Mia'), colorFor('Mia'));
});

test('share and search links round-trip the item name', async () => {
  const { shareHref, itemSearchHref } = await load();
  const href = shareHref('dl::r::Tiki Juice Bar::Dole Whip', 'Dole Whip', 'Tiki Juice Bar');
  const u = new URL(href, 'https://x.test');
  assert.strictEqual(u.pathname, '/crew.html');
  assert.strictEqual(u.searchParams.get('label'), 'Dole Whip @ Tiki Juice Bar');
  assert.strictEqual(itemSearchHref(u.searchParams.get('label')), '/?q=Dole%20Whip');
});
