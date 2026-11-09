// The two ports: the teacher port (sign-in required) and n8n's internal port.
//   node --test test/server.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The real kit folder must never be touched by these tests: they run against a
// throwaway copy holding only the templates and the engine's settings.
const REAL_KIT = path.resolve(__dirname, '..', '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-server-'));
fs.cpSync(path.join(REAL_KIT, '00_school', '_templates'), path.join(TMP, '00_school', '_templates'), { recursive: true });
fs.cpSync(path.join(REAL_KIT, 'engine', 'config'), path.join(TMP, 'engine', 'config'), { recursive: true });
process.env.KIT_DIR = TMP;

const DB = require('../lib/db.js');
const auth = require('../lib/auth.js');
const { createServers, internalPort, startupNotes } = require('../server.js');

const realVersions = () => { try { return fs.readdirSync(path.join(REAL_KIT, '00_school', '.versions')).length; } catch (e) { return 0; } };
const VERSIONS_BEFORE = realVersions();

const RUN = `s${Date.now().toString(36)}`;
const PASSWORD = 'correct horse battery';
let pub; let internal; let servers;

test.before(async () => {
  await DB.ensureSchema();
  servers = createServers();
  await new Promise(r => servers.public.listen(0, '127.0.0.1', r));
  await new Promise(r => servers.internal.listen(0, '127.0.0.1', r));
  pub = `http://127.0.0.1:${servers.public.address().port}`;
  internal = `http://127.0.0.1:${servers.internal.address().port}`;
});
test.after(async () => {
  servers.public.closeAllConnections(); servers.internal.closeAllConnections();
  servers.public.close(); servers.internal.close();
  const mine = `select id from users where name like '% ${RUN}'`;
  await DB.db().query(`delete from sessions where user_id in (${mine})`);
  await DB.db().query(`delete from classes where user_id in (${mine})`);
  await DB.db().query(`delete from invites where used_by in (${mine}) or created_by in (${mine})`);
  await DB.db().query(`delete from users where name like '% ${RUN}'`);
  await DB.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

async function call(base, method, path, { body, cookie, type = 'application/json' } = {}) {
  const res = await fetch(base + path, {
    method, headers: { ...(body !== undefined ? { 'Content-Type': type } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

async function join(role) {
  const { token } = await auth.createInvite({ role });
  const r = await call(pub, 'POST', '/api/join', { body: { token, name: `${role} ${Math.random().toString(36).slice(2, 6)} ${RUN}`, password: PASSWORD } });
  assert.equal(r.status, 200, r.text);
  return { ...r.json, cookie: r.cookie, token };
}

test('every response forbids inline scripts and content sniffing', async () => {
  for (const path of ['/', '/app.js', '/api/me']) {
    const r = await fetch(pub + path);
    const csp = r.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/, path);
    assert.match(csp, /script-src 'self'(;|$)/, path);
    assert.doesNotMatch(csp, /unsafe-inline/, path);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', path);
  }
});

test('health is open on both ports', async () => {
  assert.equal((await call(pub, 'GET', '/health')).status, 200);
  assert.equal((await call(internal, 'GET', '/health')).status, 200);
});

test('the teacher port needs a session', async () => {
  const r = await call(pub, 'POST', '/api/step', { body: {} });
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'Please sign in.');
  assert.equal((await call(pub, 'GET', '/api/status')).status, 401);
});

test('a write without JSON is refused', async () => {
  assert.equal((await call(pub, 'POST', '/api/login', { body: 'name=x', type: 'application/x-www-form-urlencoded' })).status, 415);
});

test('joining by invite signs you in, with a safe cookie', async () => {
  const admin = await join('admin');
  assert.equal(admin.role, 'admin');
  const me = await call(pub, 'GET', '/api/me', { cookie: admin.cookie });
  assert.equal(me.json.role, 'admin');
  const raw = await fetch(pub + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: admin.name, password: PASSWORD }) });
  assert.match(raw.headers.get('set-cookie'), /kit_session=.+; HttpOnly; SameSite=Strict; Path=\/; Max-Age=43200/);
});

test('a used invite link is refused', async () => {
  const t = await join('teacher');
  const again = await call(pub, 'POST', '/api/join', { body: { token: t.token, name: `Again ${RUN}`, password: PASSWORD } });
  assert.notEqual(again.status, 200);
  assert.match(again.json.error, /expired or was already used/);
  assert.equal((await call(pub, 'GET', `/api/invite/${t.token}`)).status, 404);
});

test('a teacher cannot do admin things; the admin can', async () => {
  const admin = await join('admin');
  const teacher = await join('teacher');
  const school = await call(pub, 'GET', '/api/school', { cookie: teacher.cookie });
  assert.equal(school.status, 200);
  const cal = school.json.find(f => f.name === 'calendar.md');
  const put = (who) => call(pub, 'PUT', '/api/school/calendar.md', { cookie: who.cookie, body: { text: cal.text } });
  const t = await put(teacher);
  assert.equal(t.status, 403);
  assert.equal(t.json.error, 'Only the school admin can do that.');
  assert.equal((await put(admin)).status, 200);
  assert.equal((await call(pub, 'POST', '/api/invites', { cookie: teacher.cookie, body: { role: 'teacher' } })).status, 403);
  const inv = await call(pub, 'POST', '/api/invites', { cookie: admin.cookie, body: { role: 'teacher' } });
  assert.match(inv.json.link, /\/#\/join\/[A-Za-z0-9_-]{20,}$/);
  assert.equal((await call(pub, 'GET', '/api/users', { cookie: teacher.cookie })).status, 403);
});

test('a teacher knows their own folder, and a name typed with extra spaces still signs in', async () => {
  const { token } = await auth.createInvite({ role: 'teacher' });
  const r = await call(pub, 'POST', '/api/join', { body: { token, name: `Ana  Smith   ${RUN}`, password: PASSWORD } });
  assert.equal(r.status, 200, r.text);
  const me = await call(pub, 'GET', '/api/me', { cookie: r.cookie });
  assert.match(me.json.folder, /^[a-z0-9_]+$/);
});

test('classes are per teacher', async () => {
  const a = await join('teacher');
  const b = await join('teacher');
  const made = await call(pub, 'POST', '/api/classes', { cookie: a.cookie, body: { subject: 'science', grade: 'Grade 7', term: 1, label: '7B' } });
  assert.equal(made.status, 200);
  assert.equal((await call(pub, 'GET', '/api/classes', { cookie: b.cookie })).json.length, 0);
  assert.equal((await call(pub, 'GET', '/api/classes', { cookie: a.cookie })).json.length, 1);
});

test('the internal port answers n8n without a session, and only its own routes', async () => {
  assert.equal((await call(internal, 'GET', '/api/status')).status, 200);
  assert.equal((await call(internal, 'GET', '/api/users')).status, 404);
  assert.equal((await call(internal, 'PUT', '/api/school/calendar.md', { body: { text: 'x' } })).status, 404);
  const noBy = await call(internal, 'POST', '/api/approve', { body: { file: '01_curriculum/x/1_outline.md' } });
  assert.equal(noBy.status, 409);
  assert.match(noBy.json.error, /who is approving/);
});

test('the internal port starts only when it is switched on', () => {
  assert.equal(internalPort({}), null);
  assert.equal(internalPort({ ENGINE_INTERNAL_PORT: '' }), null);
  assert.equal(internalPort({ ENGINE_INTERNAL_PORT: '3001' }), 3001);
});

test('starting with no admin says how to make one', () => {
  assert.ok(startupNotes(0).some(l => /first_run\.js/.test(l)));
  assert.equal(startupNotes(1).some(l => /first_run\.js/.test(l)), false);
});

test('the real kit folder was not touched', () => {
  assert.equal(realVersions(), VERSIONS_BEFORE);
});
