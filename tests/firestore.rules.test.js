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

// ---- Crew: invite-only posts, likes and comments ----
const {
  collection, addDoc, getDocs, arrayUnion, arrayRemove,
} = require('firebase/firestore');

const as = (uid, email, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const admin = () => as('admin', 'Boss@Example.com');
const member = () => as('mia', 'mia@example.com');
const member2 = () => as('max', 'max@example.com');
const outsider = () => as('olly', 'olly@example.com');

async function seedCrew() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'admins', 'admin'), {});
    await setDoc(doc(f, 'invites', 'mia@example.com'), { email: 'mia@example.com' });
    await setDoc(doc(f, 'invites', 'max@example.com'), { email: 'max@example.com' });
  });
}

const newPost = (uid, extra = {}) => ({
  authorUid: uid, authorName: 'Mia', kind: 'tip', text: 'Get the churro early',
  likes: [], createdAt: serverTimestamp(), ...extra,
});

async function seedPost(id = 'p1', authorUid = 'mia', likes = []) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'posts', id), { ...newPost(authorUid), likes, createdAt: new Date() });
  });
}

test('only admins can invite, and the invite must be well-formed', async () => {
  await seedCrew();
  const invite = (email, by = 'admin') => ({ email, invitedBy: by, createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(admin(), 'invites', 'new@example.com'), { ...invite('new@example.com'), name: 'Newbie' }));
  await assertFails(setDoc(doc(member(), 'invites', 'pal@example.com'), invite('pal@example.com', 'mia')));
  await assertFails(setDoc(doc(outsider(), 'invites', 'olly2@example.com'), invite('olly2@example.com', 'olly')));
  await assertFails(setDoc(doc(admin(), 'invites', 'Caps@Example.com'), invite('Caps@Example.com')));
  await assertFails(setDoc(doc(admin(), 'invites', 'not-an-email'), invite('not-an-email')));
  await assertFails(setDoc(doc(admin(), 'invites', 'a@example.com'), invite('b@example.com')));
  await assertFails(setDoc(doc(admin(), 'invites', 'c@example.com'), { ...invite('c@example.com'), role: 'admin' }));
});

test('only admins can remove invites; nobody can grant admin', async () => {
  await seedCrew();
  await assertFails(deleteDoc(doc(member(), 'invites', 'max@example.com')));
  await assertSucceeds(deleteDoc(doc(admin(), 'invites', 'max@example.com')));
  await assertFails(setDoc(doc(member(), 'admins', 'mia'), {}));
  await assertFails(setDoc(doc(admin(), 'admins', 'mia'), {}));
});

test('members can see the roster; outsiders can only check their own invite', async () => {
  await seedCrew();
  await assertSucceeds(getDocs(collection(member(), 'invites')));
  await assertFails(getDocs(collection(outsider(), 'invites')));
  await assertSucceeds(getDoc(doc(outsider(), 'invites', 'olly@example.com')));
  await assertFails(getDoc(doc(outsider(), 'invites', 'mia@example.com')));
  await assertSucceeds(getDoc(doc(member(), 'admins', 'mia')));
  await assertFails(getDoc(doc(member(), 'admins', 'admin')));
});

test('invited members can post and read; outsiders and unverified emails cannot', async () => {
  await seedCrew();
  await assertSucceeds(addDoc(collection(member(), 'posts'), newPost('mia')));
  await assertSucceeds(addDoc(collection(admin(), 'posts'), newPost('admin')));
  await assertSucceeds(getDocs(collection(member(), 'posts')));
  await assertFails(addDoc(collection(outsider(), 'posts'), newPost('olly')));
  await assertFails(getDocs(collection(outsider(), 'posts')));
  await assertFails(addDoc(collection(as('mia', 'mia@example.com', false), 'posts'), newPost('mia')));
  await assertFails(getDocs(collection(anon(), 'posts')));
});

test('posts are validated', async () => {
  await seedCrew();
  const p = (extra) => addDoc(collection(member(), 'posts'), newPost('mia', extra));
  await assertSucceeds(p({ kind: 'review', rating: 5, item: { key: 'dl::r::Tiki::Dole Whip', label: 'Dole Whip' } }));
  await assertFails(p({ authorUid: 'max' }));
  await assertFails(p({ kind: 'spam' }));
  await assertFails(p({ text: '' }));
  await assertFails(p({ text: 'x'.repeat(1001) }));
  await assertFails(p({ likes: ['mia'] }));
  await assertFails(p({ rating: 4 }));
  await assertFails(p({ kind: 'review', rating: 6 }));
  await assertFails(p({ item: { key: 'k', label: 'l', evil: true } }));
  await assertFails(p({ pinned: true }));
  await assertFails(p({ createdAt: new Date('2001-01-01') }));
});

test('members can like/unlike only for themselves', async () => {
  await seedCrew();
  await seedPost('p1', 'mia', ['mia']);
  const ref = (db) => doc(db, 'posts', 'p1');
  await assertSucceeds(updateDoc(ref(member2()), { likes: arrayUnion('max') }));
  await assertSucceeds(updateDoc(ref(member2()), { likes: arrayRemove('max') }));
  await assertFails(updateDoc(ref(member2()), { likes: arrayRemove('mia') }));
  await assertFails(updateDoc(ref(member2()), { likes: ['mia', 'max', 'someone'] }));
  await assertFails(updateDoc(ref(member2()), { text: 'edited' }));
  await assertFails(updateDoc(ref(outsider()), { likes: arrayUnion('olly') }));
});

test('authors and admins can delete posts; other members cannot', async () => {
  await seedCrew();
  await seedPost('p1', 'mia');
  await seedPost('p2', 'mia');
  await assertFails(deleteDoc(doc(member2(), 'posts', 'p1')));
  await assertSucceeds(deleteDoc(doc(member(), 'posts', 'p1')));
  await assertSucceeds(deleteDoc(doc(admin(), 'posts', 'p2')));
});

test('members can comment on existing posts; comments are validated', async () => {
  await seedCrew();
  await seedPost('p1', 'mia');
  const c = (db, uid, extra = {}) => addDoc(collection(db, 'posts', 'p1', 'comments'),
    { authorUid: uid, authorName: 'Max', text: 'Agreed!', createdAt: serverTimestamp(), ...extra });
  await assertSucceeds(c(member2(), 'max'));
  await assertSucceeds(getDocs(collection(member(), 'posts', 'p1', 'comments')));
  await assertFails(c(outsider(), 'olly'));
  await assertFails(c(member2(), 'mia'));
  await assertFails(c(member2(), 'max', { text: 'x'.repeat(501) }));
  await assertFails(addDoc(collection(member2(), 'posts', 'nope', 'comments'),
    { authorUid: 'max', authorName: 'Max', text: 'hi', createdAt: serverTimestamp() }));
});
