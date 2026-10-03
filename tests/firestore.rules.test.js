// Security rules tests for firestore.rules. Run with `npm test`, which starts
// the Firestore emulator, runs this file, and shuts the emulator down.
const { test, before, after, beforeEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} = require('firebase/firestore');

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-disneyfoodapp',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

// Exactly what the app's saveState() writes.
const validPayload = () => ({
  done: ['dl::r::Tiki Juice Bar::Dole Whip'],
  deleted: [],
  flagged: ['dca::h::Cozy Cone::Churro'],
  dates: { 'dl::r::Tiki Juice Bar::Dole Whip': '2026-10-02' },
  holidayMode: false,
  updatedAt: serverTimestamp(),
});

// The app always saves with merge: true.
const save = (db, uid, data) => setDoc(doc(db, 'users', uid), data, { merge: true });

async function seed(uid, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

test('a user can save and read their own checklist', async () => {
  await assertSucceeds(save(alice(), 'alice', validPayload()));
  await assertSucceeds(getDoc(doc(alice(), 'users', 'alice')));
});

test("a user cannot read someone else's checklist", async () => {
  await seed('bob', { done: [] });
  await assertFails(getDoc(doc(alice(), 'users', 'bob')));
});

test("a user cannot write someone else's checklist", async () => {
  await assertFails(save(alice(), 'bob', validPayload()));
});

test('signed-out visitors cannot read or write', async () => {
  await seed('alice', { done: [] });
  await assertFails(getDoc(doc(anon(), 'users', 'alice')));
  await assertFails(save(anon(), 'alice', validPayload()));
});

test('fields the app never saves are rejected', async () => {
  await assertFails(save(alice(), 'alice', { ...validPayload(), isAdmin: true }));
});

test('wrong types are rejected', async () => {
  await assertFails(save(alice(), 'alice', { done: 'not-a-list' }));
  await assertFails(save(alice(), 'alice', { dates: ['not', 'a', 'map'] }));
  await assertFails(save(alice(), 'alice', { holidayMode: 'yes' }));
  await assertFails(save(alice(), 'alice', { updatedAt: new Date('2001-01-01') }));
});

test('oversized lists are rejected', async () => {
  const huge = Array.from({ length: 5001 }, (_, i) => 'key' + i);
  await assertFails(save(alice(), 'alice', { done: huge }));
});

test('a document with a leftover legacy field can still be saved', async () => {
  await seed('alice', { done: [], legacyThing: 'from an old version' });
  await assertSucceeds(save(alice(), 'alice', validPayload()));
});

test('a user can delete their own checklist but not anyone else\'s', async () => {
  await seed('alice', { done: [] });
  await seed('bob', { done: [] });
  await assertFails(deleteDoc(doc(alice(), 'users', 'bob')));
  await assertSucceeds(deleteDoc(doc(alice(), 'users', 'alice')));
});

test('other collections are closed', async () => {
  await assertFails(setDoc(doc(alice(), 'menu', 'x'), { a: 1 }));
  await assertFails(getDoc(doc(alice(), 'menu', 'x')));
  await assertFails(setDoc(doc(alice(), 'users', 'alice', 'private', 'x'), { a: 1 }));
});

test('updateDoc with valid fields works', async () => {
  await seed('alice', { done: [] });
  await assertSucceeds(updateDoc(doc(alice(), 'users', 'alice'), { holidayMode: true }));
});
