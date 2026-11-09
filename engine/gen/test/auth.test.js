// Accounts, invites, sessions and classes. Runs inside the engine container,
// against the real database: node --test test/auth.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const DB = require('../lib/db.js');
const auth = require('../lib/auth.js');

// Every name this file makes ends in this run's tag, so the tests can remove
// their own accounts afterwards and never leave junk in a school's database.
const RUN = `t${Date.now().toString(36)}`;
const unique = (base) => `${base} ${Math.random().toString(36).slice(2, 6)} ${RUN}`;
const PASSWORD = 'correct horse battery';

const made = [];  // ids of accounts whose names can't carry the run tag
test.before(async () => { await DB.ensureSchema(); });
test.after(async () => {
  const mine = `select id from users where name like '% ${RUN}' or id = any('{${made.join(',') || 0}}'::int[])`;
  await DB.db().query(`delete from sessions where user_id in (${mine})`);
  await DB.db().query(`delete from classes where user_id in (${mine})`);
  await DB.db().query(`delete from invites where used_by in (${mine})`);
  await DB.db().query(`delete from users where id in (${mine})`);
  await DB.close();
});

async function newTeacher(name = unique('Teacher')) {
  const { token } = await auth.createInvite({ role: 'teacher' });
  return auth.acceptInvite(token, { name, password: PASSWORD });
}

test('hashPassword/verifyPassword round-trip', () => {
  const stored = auth.hashPassword(PASSWORD);
  assert.equal(auth.verifyPassword(PASSWORD, stored), true);
  assert.equal(auth.verifyPassword('wrong horse battery', stored), false);
  assert.notEqual(auth.hashPassword(PASSWORD), stored);
  assert.match(stored, /^scrypt\$/);
});

test('acceptInvite creates the user once', async () => {
  const { token } = await auth.createInvite({ role: 'teacher' });
  assert.deepEqual(await auth.checkInvite(token), { role: 'teacher' });
  const user = await auth.acceptInvite(token, { name: unique('Once'), password: PASSWORD });
  assert.equal(user.role, 'teacher');
  assert.equal(await auth.checkInvite(token), null);
  await assert.rejects(auth.acceptInvite(token, { name: unique('Twice'), password: PASSWORD }),
    /expired or was already used/);
});

test('acceptInvite rejects an expired token', async () => {
  const { token } = await auth.createInvite({ role: 'teacher', days: -1 });
  await assert.rejects(auth.acceptInvite(token, { name: unique('Late'), password: PASSWORD }),
    /expired or was already used/);
});

test('acceptInvite rejects a made-up token', async () => {
  await assert.rejects(auth.acceptInvite('not-a-real-token', { name: unique('Fake'), password: PASSWORD }),
    /expired or was already used/);
});

test('acceptInvite rejects a short password or a taken name', async () => {
  const short = await auth.createInvite({ role: 'teacher' });
  await assert.rejects(auth.acceptInvite(short.token, { name: unique('Short'), password: '123456789' }),
    /at least 10 characters/);
  const taken = await newTeacher();
  const again = await auth.createInvite({ role: 'teacher' });
  await assert.rejects(auth.acceptInvite(again.token, { name: taken.name, password: PASSWORD }), /already taken/);
  // A refused attempt doesn't use up the link.
  assert.deepEqual(await auth.checkInvite(again.token), { role: 'teacher' });
});

test('login and userFromToken', async () => {
  const user = await newTeacher();
  const { token, user: signedIn } = await auth.login(user.name, PASSWORD);
  assert.equal(signedIn.name, user.name);
  assert.equal((await auth.userFromToken(token)).name, user.name);
  await assert.rejects(auth.login(user.name, 'wrong password!!'), /That name and password don't match\./);
  await assert.rejects(auth.login(unique('Nobody'), PASSWORD), /That name and password don't match\./);
  await auth.logout(token);
  assert.equal(await auth.userFromToken(token), null);
});

test('userFromToken returns null for a disabled user', async () => {
  const user = await newTeacher();
  const { token } = await auth.login(user.name, PASSWORD);
  await auth.setDisabled(user.id, true);
  assert.equal(await auth.userFromToken(token), null);
  await assert.rejects(auth.login(user.name, PASSWORD), /That name and password don't match\./);
});

test('userFromToken returns null for an expired session', async () => {
  const user = await newTeacher();
  const { token } = await auth.login(user.name, PASSWORD);
  await DB.db().query("update sessions set expires_at = now() - interval '1 hour' where token_hash = $1", [auth.tokenHash(token)]);
  assert.equal(await auth.userFromToken(token), null);
});

test('names that look alike get different folders', async () => {
  const a = await newTeacher(`J. Smith ${RUN}`);
  const b = await newTeacher(`J Smith ${RUN}`);
  assert.match(a.folder, /^[a-z0-9_]+$/);
  assert.match(b.folder, /^[a-z0-9_]+$/);
  assert.notEqual(a.folder, b.folder);
  const { user } = await auth.login(b.name, PASSWORD);
  assert.equal(user.folder, b.folder);
});

test('a name with no Latin letters still gets its own folder', async () => {
  const x = await newTeacher(`ဒေါ်မြ ${Math.random().toString(36).slice(2, 4).replace(/[a-z0-9]/g, 'က')}`);
  const y = await newTeacher(`ဦးလှ ${Math.random().toString(36).slice(2, 4).replace(/[a-z0-9]/g, 'ခ')}`);
  made.push(x.id, y.id);
  assert.match(x.folder, /^[a-z0-9_]+$/);
  assert.match(y.folder, /^[a-z0-9_]+$/);
  assert.notEqual(x.folder, y.folder);
});

test('classes belong to their owner', async () => {
  const a = await newTeacher();
  const b = await newTeacher();
  const c = await auth.addClass(a.id, { subject: 'science', grade: 'Grade 7', term: 1, label: '7B Science' });
  await auth.deleteClass(b.id, c.id);
  assert.equal((await auth.listClasses(a.id)).length, 1);
  await auth.deleteClass(a.id, c.id);
  assert.equal((await auth.listClasses(a.id)).length, 0);
});
