// The engine's web server: two ports, one set of routes.
//
// TEACHER PORT (ENGINE_PORT, published on 127.0.0.1 by docker-compose):
// the teacher app and its API. Everything needs a signed-in session except the
// page itself, sign-in, and joining by invite. Admin routes need the admin role.
//
// INTERNAL PORT (ENGINE_INTERNAL_PORT, never published): for n8n only, on the
// Docker network. It answers a handful of routes without a session, because
// n8n can't hold one; what it makes is recorded as "(via n8n)".
//
// docker-compose keeps both off the open internet. Reaching the teacher port
// from elsewhere needs the proxy or VPN in docs/HOSTING.md.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const kit = require('./lib/kit.js');
const DB = require('./lib/db.js');
const models = require('./lib/models.js');
const auth = require('./lib/auth.js');
const { build, Refused } = require('./step.js');
const { approve } = require('./approve.js');
const { gather } = require('./status.js');
const { listSchoolFiles, saveSchoolFile } = require('./school.js');

const PUBLIC_DIR = path.join(__dirname, 'public');

// On every response: the page may run only its own script file (no inline
// script, so injected markup can't run code), and browsers must not guess
// file types.
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const STATIC = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };

// One step at a time: two teachers pressing "make" at once would race on the same files.
let busy = Promise.resolve();
const oneAtATime = (fn) => { const run = busy.then(fn, fn); busy = run.catch(() => {}); return run; };

const cookieValue = (req, name) => {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};
const sessionCookie = (req, token, maxAge) => {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${auth.SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
};
const joinLinkFor = (req, token) => {
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host}/#/join/${token}`;
};

async function signIn(req, name, password) {
  const { token, user } = await auth.login(name, password);
  return { status: 200, body: { name: user.name, role: user.role, folder: user.folder }, headers: { 'Set-Cookie': sessionCookie(req, token, auth.SESSION_HOURS * 3600) } };
}

// Each route: method, path (string, or RegExp with groups), where it answers
// (teacher port unless internal-only; internal: true also opens it on the
// internal port), whether it's open (no session) or admin-only, and a handler
// returning { status, body, headers } or nothing when it wrote the response itself.
const ROUTES = [
  ...Object.keys(STATIC).map(p => ({ method: 'GET', path: p, open: true, handler: ({ res }) => {
    const [file, type] = STATIC[p];
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(PUBLIC_DIR, file)));
  } })),
  { method: 'GET', path: '/health', open: true, internal: true, handler: () => ({ body: { ok: true } }) },

  { method: 'POST', path: '/api/login', open: true, handler: async ({ req, body }) => {
    try { return await signIn(req, body.name, body.password); }
    catch (e) { if (e instanceof Refused) return { status: 401, body: { error: e.message } }; throw e; }
  } },
  { method: 'GET', path: /^\/api\/invite\/([A-Za-z0-9_-]+)$/, open: true, handler: async ({ params }) => {
    const inv = await auth.checkInvite(params[0]);
    return inv ? { body: inv } : { status: 404, body: { error: 'This invite link has expired or was already used. Ask your school admin for a new one.' } };
  } },
  { method: 'POST', path: '/api/join', open: true, handler: async ({ req, body }) => {
    const user = await auth.acceptInvite(body.token, { name: body.name, password: body.password });
    return signIn(req, user.name, body.password);
  } },
  { method: 'POST', path: '/api/logout', handler: async ({ req }) => {
    await auth.logout(cookieValue(req, auth.SESSION_COOKIE));
    return { body: { ok: true }, headers: { 'Set-Cookie': sessionCookie(req, '', 0) } };
  } },
  { method: 'GET', path: '/api/me', handler: ({ user }) => ({ body: { name: user.name, role: user.role, folder: user.folder } }) },

  { method: 'GET', path: '/api/classes', handler: async ({ user }) => ({ body: await auth.listClasses(user.id) }) },
  { method: 'POST', path: '/api/classes', handler: async ({ user, body }) => ({ body: await auth.addClass(user.id, body) }) },
  { method: 'DELETE', path: /^\/api\/classes\/(\d+)$/, handler: async ({ user, params }) => {
    await auth.deleteClass(user.id, Number(params[0]));
    return { body: { ok: true } };
  } },

  { method: 'GET', path: '/api/school', handler: () => ({ body: listSchoolFiles() }) },
  { method: 'PUT', path: /^\/api\/school\/([^/]+)$/, admin: true, handler: ({ user, params, body }) =>
    ({ body: saveSchoolFile(decodeURIComponent(params[0]), body.text, user.name) }) },
  { method: 'POST', path: '/api/invites', admin: true, handler: async ({ req, user, body }) => {
    const { token } = await auth.createInvite({ role: body.role || 'teacher', createdBy: user.id });
    return { body: { link: joinLinkFor(req, token) } };
  } },
  { method: 'GET', path: '/api/users', admin: true, handler: async () => ({ body: await auth.listUsers() }) },
  { method: 'POST', path: /^\/api\/users\/(\d+)\/disable$/, admin: true, handler: async ({ user, params, body }) => {
    if (Number(params[0]) === user.id) throw new Refused("You can't disable your own account.");
    await auth.setDisabled(Number(params[0]), body.disabled !== false);
    return { body: { ok: true } };
  } },

  { method: 'GET', path: '/api/status', internal: true, handler: async () => {
    const s = await gather();
    s.chain = s.chain.map(({ model, label, usable, why }) => ({ model, label, usable, why }));
    return { body: s };
  } },
  { method: 'GET', path: '/api/chain', handler: () => ({ body: models.chain() }) },
  { method: 'GET', path: '/api/file', internal: true, handler: ({ url }) => {
    const rel = kit.safeRel(url.searchParams.get('path'));
    const text = kit.read(rel);
    return text == null ? { status: 404, body: { error: 'not found' } }
      : { body: { file: rel, text, checks: kit.read(rel.replace(/\.md$/, '.checks.md')) } };
  } },
  { method: 'GET', path: '/download', handler: ({ res, url }) => {
    const rel = kit.safeRel(url.searchParams.get('path'));
    if (!/\.(docx|pptx)$/.test(rel) || !kit.exists(rel)) return { status: 404, body: { error: 'not found' } };
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': rel.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${path.basename(rel)}"`,
    });
    fs.createReadStream(kit.abs(rel)).pipe(res);
  } },
  { method: 'POST', path: '/api/step', internal: true, handler: async ({ user, body }) => {
    // On the teacher port, work is always filed in the signed-in teacher's own folder.
    const args = { ...body, teacher: user ? user.folder : body.teacher };
    const r = await oneAtATime(() => build(String(body.kind || ''), args));
    return { body: { ...r, text: kit.read(r.file) } };
  } },
  { method: 'POST', path: '/api/approve', internal: true, handler: async ({ user, body, internal }) => {
    const by = internal ? (body.by ? `${body.by} (via n8n)` : null) : user.name;
    return { body: await oneAtATime(() => approve(body.file, by)) };
  } },
];

function match(route, pathname) {
  if (typeof route.path === 'string') return route.path === pathname ? [] : null;
  const m = pathname.match(route.path);
  return m ? m.slice(1) : null;
}

const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', d => { s += d; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(new Refused('The request was not valid JSON.')); } });
});

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};

async function handle(req, res, internal) {
  const url = new URL(req.url, 'http://localhost');
  let params = null;
  const route = ROUTES.find(r => r.method === req.method && (!internal || r.internal) && (params = match(r, url.pathname)) !== null);
  if (!route) return send(res, 404, { error: 'not found' });
  const writes = ['POST', 'PUT', 'DELETE'].includes(req.method);
  if (writes && !/^application\/json\b/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Send the request as JSON.' });
  let user = null;
  if (!internal) {
    user = await auth.userFromToken(cookieValue(req, auth.SESSION_COOKIE));
    if (!route.open && !user) return send(res, 401, { error: 'Please sign in.' });
    if (route.admin && user.role !== 'admin') return send(res, 403, { error: 'Only the school admin can do that.' });
  }
  const body = writes ? await readBody(req) : {};
  const out = await route.handler({ req, res, url, params, user, body, internal });
  if (out) send(res, out.status || 200, out.body, out.headers);
}

function serve(internal) {
  return http.createServer((req, res) => {
    handle(req, res, internal).catch(e => {
      if (res.headersSent) return res.end();
      send(res, e instanceof Refused ? 409 : 500,
        { error: e instanceof Refused ? e.message : `Something went wrong: ${e.message}`, refused: e instanceof Refused });
    });
  });
}

function createServers() {
  return { public: serve(false), internal: serve(true) };
}

// The internal port answers without a session, so it starts only when
// switched on (docker-compose sets ENGINE_INTERNAL_PORT, on its own network).
function internalPort(env) {
  const p = Number(env.ENGINE_INTERNAL_PORT);
  return env.ENGINE_INTERNAL_PORT && p > 0 ? p : null;
}

function startupNotes(adminCount) {
  return adminCount ? [] : ['No admin account yet. For the admin\'s one-use link, run: '
    + 'docker compose -f engine/docker-compose.yml exec engine node first_run.js'];
}

async function start() {
  await DB.ensureSchema();
  const s = createServers();
  const port = Number(process.env.ENGINE_PORT || 3000);
  const inner = internalPort(process.env);
  s.public.listen(port, async () => {
    console.log(`Engine ready. Teacher page: http://localhost:${process.env.ENGINE_PORT_HOST || port}`);
    const live = models.chain().filter(c => c.usable);
    console.log(live.length ? `AI models: ${live.map(c => c.model).join(' → ')}` : 'No AI key yet: see engine/PROVIDERS.md');
    startupNotes(await auth.countUsers('admin')).forEach(n => console.log(n));
  });
  if (inner) s.internal.listen(inner, () => console.log(`Internal port for n8n: ${inner} (Docker network only)`));
}

if (require.main === module) start().catch(e => { console.error(`The engine could not start: ${e.message}`); process.exit(1); });
module.exports = { createServers, ROUTES, internalPort, startupNotes };
