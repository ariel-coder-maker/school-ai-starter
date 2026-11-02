// The engine's small web server: the teacher page, and the API n8n calls.
//
//   GET  /                      the teacher page (public/index.html)
//   GET  /api/status            where everything stands
//   GET  /api/chain             which AI models will run
//   POST /api/step              { kind, subject, unit | grade+term+topic, lesson, teacher, feedback }
//   POST /api/approve           { file, by }
//   GET  /api/file?path=…       a file's text (01_curriculum/ and 06_outputs/ only)
//   GET  /download?path=…       a .docx or .pptx
//
// docker-compose publishes this port on 127.0.0.1 only: it is for the person
// at this computer. Opening it to a school network is Level 3, and needs the
// sign-in described in docs/HOSTING.md first.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const kit = require('./lib/kit.js');
const DB = require('./lib/db.js');
const models = require('./lib/models.js');
const { build, Refused } = require('./step.js');
const { approve } = require('./approve.js');
const { gather } = require('./status.js');

const PORT = Number(process.env.ENGINE_PORT || 3000);
const PAGE = path.join(__dirname, 'public', 'index.html');

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', d => { s += d; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(new Refused('The request was not valid JSON.')); } });
});

// One step at a time: two teachers pressing "make" at once would race on the same files.
let busy = Promise.resolve();
const oneAtATime = (fn) => { const run = busy.then(fn, fn); busy = run.catch(() => {}); return run; };

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, fs.readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const s = await gather();
    s.chain = s.chain.map(({ model, label, usable, why }) => ({ model, label, usable, why }));
    return send(res, 200, s);
  }
  if (req.method === 'GET' && url.pathname === '/api/chain') return send(res, 200, models.chain());
  if (req.method === 'GET' && url.pathname === '/api/file') {
    const rel = kit.safeRel(url.searchParams.get('path'));
    const text = kit.read(rel);
    return text == null ? send(res, 404, { error: 'not found' }) : send(res, 200, { file: rel, text, checks: kit.read(rel.replace(/\.md$/, '.checks.md')) });
  }
  if (req.method === 'GET' && url.pathname === '/download') {
    const rel = kit.safeRel(url.searchParams.get('path'));
    if (!/\.(docx|pptx)$/.test(rel) || !kit.exists(rel)) return send(res, 404, { error: 'not found' });
    res.writeHead(200, {
      'Content-Type': rel.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${path.basename(rel)}"`,
    });
    return fs.createReadStream(kit.abs(rel)).pipe(res);
  }
  if (req.method === 'POST' && url.pathname === '/api/step') {
    const b = await readBody(req);
    const r = await oneAtATime(() => build(String(b.kind || ''), b));
    return send(res, 200, { ...r, text: kit.read(r.file) });
  }
  if (req.method === 'POST' && url.pathname === '/api/approve') {
    const b = await readBody(req);
    return send(res, 200, await oneAtATime(() => approve(b.file, b.by)));
  }
  return send(res, 404, { error: 'not found' });
}

async function start() {
  await DB.ensureSchema();
  http.createServer((req, res) => {
    route(req, res).catch(e => send(res, e instanceof Refused ? 409 : 500,
      { error: e instanceof Refused ? e.message : `Something went wrong: ${e.message}`, refused: e instanceof Refused }));
  }).listen(PORT, () => {
    console.log(`Engine ready. Teacher page: http://localhost:${process.env.ENGINE_PORT_HOST || PORT}`);
    const live = models.chain().filter(s => s.usable);
    console.log(live.length ? `AI models: ${live.map(s => s.model).join(' → ')}` : 'No AI key yet: see engine/PROVIDERS.md');
  });
}

start().catch(e => { console.error(`The engine could not start: ${e.message}`); process.exit(1); });
