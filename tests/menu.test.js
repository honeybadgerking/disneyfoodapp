// Checks public/menu.json, the "Full Menu" data loaded by the food list.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const menu = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'menu.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('menu.json is well-formed', () => {
  assert.match(menu.updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(menu.dl) && menu.dl.length > 100, 'expected a full Disneyland Park menu');
  for (const it of menu.dl) {
    assert.ok(it.name && it.loc && it.land && it.desc, JSON.stringify(it));
    assert.ok(['food', 'snack', 'drink'].includes(it.type), it.name);
    assert.match(it.url, /^https:\/\/disneyland\.disney\.go\.com\//, it.name);
    if ('price' in it) assert.ok(typeof it.price === 'number' && it.price > 0 && it.price < 200, it.name);
  }
});

test('menu items are unique per location', () => {
  const seen = new Set();
  for (const it of menu.dl) {
    const k = it.loc + '::' + it.name;
    assert.ok(!seen.has(k), 'duplicate ' + k);
    seen.add(k);
  }
});

test('menu has no seasonal or limited-time items', () => {
  const seasonal = /(?<!jolly )holiday|christmas|halloween|pumpkin|peppermint|gingerbread|yule|fall |spooky|frightful/i;
  for (const it of menu.dl) assert.ok(!seasonal.test(it.name), it.name);
});

test('menu does not repeat items already on the regular list at the same spot', () => {
  const regular = new Set();
  const re = /\{ name: "((?:[^"\\]|\\.)*)", loc: "((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(html))) regular.add(m[2] + '::' + m[1]);
  for (const it of menu.dl) assert.ok(!regular.has(it.loc + '::' + it.name), 'already listed: ' + it.name);
});
