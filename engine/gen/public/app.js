// The teacher app. Hash routes:
//   #/signin  #/join/<token>  #/  #/class/<id>  #/unit/<subject>/<unit>
//   #/file/<path>  #/admin
// Everything comes from the engine's API; this file holds no school data.
'use strict';
const $app = document.getElementById('app');
let me = null;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = (hash) => { location.hash = hash; };

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith('/api/login') && !path.startsWith('/api/join')) { me = null; go('#/signin'); throw new Error(j.error || 'Please sign in.'); }
  if (!r.ok) throw new Error(j.error || `Something went wrong (HTTP ${r.status}).`);
  return j;
}

// A file's state, in words as well as color.
const STATE_WORDS = { approved: 'Approved', draft: 'Draft: waiting for approval', 'changed since approval': 'Changed since approval: approve again', 'out of date': 'Out of date: built on an older version', 'not made': 'Not made yet' };
const stateBadge = (st) => {
  const s = st && st.state || 'not made';
  const cls = s === 'approved' ? 'approved' : s === 'out of date' ? 'out' : '';
  return `<span class="state ${cls}">${esc(STATE_WORDS[s] || s)}</span>${st && st.failedChecks ? ` <span class="fail">· ${st.failedChecks} check(s) failed</span>` : ''}`;
};
const msg = (text, bad) => `<div class="msg${bad ? ' bad' : ''}">${esc(text)}</div>`;
const fileLink = (path, label) => `<a class="file" href="#/file/${encodeURIComponent(path)}">${esc(label || path.split('/').pop())}</a>`;

function header() {
  const nav = document.getElementById('nav');
  const who = document.getElementById('who');
  if (!me) { nav.innerHTML = ''; who.innerHTML = ''; return; }
  nav.innerHTML = `<a href="#/">My classes</a>${me.role === 'admin' ? '<a href="#/admin">Admin</a>' : ''}`;
  who.innerHTML = `${esc(me.name)} · ${me.role === 'admin' ? 'school admin' : 'teacher'} <button id="signout">Sign out</button>`;
  document.getElementById('signout').onclick = async () => { await api('/api/logout', { method: 'POST', body: {} }); me = null; go('#/signin'); };
}

// Disable a button while its work runs, and show the result or the error.
async function busy(button, out, work, label) {
  const was = button.textContent;
  button.disabled = true; button.textContent = label || 'Working…';
  try { return await work(); }
  catch (e) { if (out) out.innerHTML = msg(e.message, true); return null; }
  finally { button.disabled = false; button.textContent = was; }
}

// ── sign in and join ───────────────────────────────────────────────────────
function signinPage() {
  $app.innerHTML = `<div class="narrow"><h1>Sign in</h1>
    <label for="n">Your name</label><input id="n" autocomplete="username">
    <label for="p">Password</label><input id="p" type="password" autocomplete="current-password">
    <button id="go">Sign in</button><div id="out"></div>
    <p class="hint">New here? Ask your school admin for an invite link.</p></div>`;
  const submit = () => busy(document.getElementById('go'), document.getElementById('out'), async () => {
    me = await api('/api/login', { method: 'POST', body: { name: document.getElementById('n').value, password: document.getElementById('p').value } });
    go('#/');
  });
  document.getElementById('go').onclick = submit;
  document.getElementById('p').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
}

async function joinPage(token) {
  let invite;
  try { invite = await api(`/api/invite/${encodeURIComponent(token)}`); }
  catch (e) { $app.innerHTML = `<div class="narrow"><h1>Join</h1>${msg(e.message, true)}</div>`; return; }
  const forWhat = invite.role === 'admin'
    ? 'This makes the <b>school admin</b> account: you can edit the school layer and invite teachers.'
    : 'This makes your <b>teacher</b> account: you can add your classes and make units, lessons and materials.';
  $app.innerHTML = `<div class="narrow"><h1>Make your account</h1><p>${forWhat} The link works once.</p>
    <label for="n">Your name, as colleagues know you</label><input id="n" autocomplete="name">
    <label for="p">Password (at least 10 characters)</label><input id="p" type="password" autocomplete="new-password">
    <label for="p2">Password again</label><input id="p2" type="password" autocomplete="new-password">
    <button id="go">Make my account</button><div id="out"></div></div>`;
  document.getElementById('go').onclick = () => busy(document.getElementById('go'), document.getElementById('out'), async () => {
    const p = document.getElementById('p').value;
    if (p !== document.getElementById('p2').value) throw new Error("The two passwords don't match.");
    me = await api('/api/join', { method: 'POST', body: { token, name: document.getElementById('n').value, password: p } });
    go(me.role === 'admin' ? '#/admin' : '#/');
  });
}

// ── home: my classes, and what's waiting for me ───────────────────────────
function myWaiting(status, classes) {
  const out = [];
  for (const s of status.subjects) for (const u of s.units) {
    const mine = classes.some(c => c.subject === s.subject && c.grade === u.meta.grade && String(c.term || '') === String(u.meta.term || ''));
    if (!mine) continue;
    for (const [k, f] of [['outline', '1_outline.md'], ['sequence', '2_sequence.md'], ['assessment', '3_assessment.md'], ['rubric', '3_rubric.md']]) {
      const st = u.steps[k];
      if (st && !['approved', 'not made'].includes(st.state)) out.push({ path: `01_curriculum/${s.subject}/units/${u.unit}/${f}`, st, where: `${s.subject} · ${u.meta.topic || u.unit}` });
    }
  }
  const myFolder = `06_outputs/${me.folder}/`;
  for (const l of status.lessons) if (l.file.startsWith(myFolder) && l.state !== 'approved') out.push({ path: l.file, st: l, where: l.file.split('/')[2] });
  return out;
}

async function homePage() {
  const [classes, status] = await Promise.all([api('/api/classes'), api('/api/status')]);
  const waiting = myWaiting(status, classes);
  const subjects = status.subjects.map(s => s.subject);
  $app.innerHTML = `<h1>My classes</h1>
    ${!status.school ? msg('The school layer is not set up yet. ' + (me.role === 'admin' ? 'Start in Admin.' : 'Ask your school admin.'), true) : ''}
    ${waiting.length ? `<h2>Waiting for your approval</h2><div class="scroll"><table>${waiting.map(w =>
      `<tr><td>${fileLink(w.path)}</td><td class="meta">${esc(w.where)}</td><td>${stateBadge(w.st)}</td></tr>`).join('')}</table></div>` : ''}
    ${classes.length ? `<div class="cards">${classes.map(c => `<a class="card" href="#/class/${c.id}">
        <div class="title">${esc(c.label)}</div><div class="meta">${esc(c.subject)} · ${esc(c.grade)}${c.term ? ` · Term ${esc(c.term)}` : ''}</div></a>`).join('')}</div>`
      : `<div class="card"><b>Add your classes to start.</b><p class="meta">One for each class you teach: its subject, grade and term. Your units, lessons and materials are kept under each one.</p></div>`}
    <h2>Add a class</h2>
    ${subjects.length ? `<div class="row">
      <div><label for="cs">Subject</label><select id="cs">${subjects.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
      <div><label for="cg">Grade</label><input id="cg" placeholder="e.g. Grade 7"></div>
      <div><label for="ct">Term</label><input id="ct" inputmode="numeric" placeholder="1"></div>
      <div><label for="cl">Class name</label><input id="cl" placeholder="e.g. 7B Science"></div>
      <button id="add">Add class</button></div><div id="out"></div>`
    : msg('No subject is set up yet. A subject is added in setup (Block C), or by the school admin.', true)}`;
  const add = document.getElementById('add');
  if (add) add.onclick = () => busy(add, document.getElementById('out'), async () => {
    await api('/api/classes', { method: 'POST', body: { subject: document.getElementById('cs').value, grade: document.getElementById('cg').value.trim(),
      term: document.getElementById('ct').value.trim() || null, label: document.getElementById('cl').value.trim() } });
    homePage();
  });
}

// ── a class, and its units ─────────────────────────────────────────────────
async function classPage(id) {
  const [classes, status] = await Promise.all([api('/api/classes'), api('/api/status')]);
  const c = classes.find(x => String(x.id) === String(id));
  if (!c) { $app.innerHTML = msg('That class is not one of yours.', true); return; }
  const subject = status.subjects.find(s => s.subject === c.subject) || { units: [], framework: 'MISSING' };
  const units = subject.units.filter(u => u.meta.grade === c.grade && String(u.meta.term || '') === String(c.term || ''));
  $app.innerHTML = `<div class="crumbs"><a href="#/">My classes</a> ›</div><h1>${esc(c.label)}</h1>
    <p class="meta">${esc(c.subject)} · ${esc(c.grade)}${c.term ? ` · Term ${esc(c.term)}` : ''} · framework ${esc(subject.framework)}</p>
    <h2>Units</h2>
    ${units.length ? `<div class="scroll"><table><tr><th>Unit</th><th>Outline</th><th>Sequence</th><th>Assessment</th></tr>${units.map(u =>
      `<tr><td><a href="#/unit/${encodeURIComponent(c.subject)}/${encodeURIComponent(u.unit)}">${esc(u.meta.topic || u.unit)}</a></td>
       <td>${stateBadge(u.steps.outline)}</td><td>${stateBadge(u.steps.sequence)}</td><td>${stateBadge(u.steps.assessment)}</td></tr>`).join('')}</table></div>`
      : '<p class="meta">No units for this class yet.</p>'}
    <h2>Start a new unit</h2>
    <div class="row"><div><label for="tp">Topic</label><input id="tp" placeholder="e.g. Forces and motion"></div>
    <button id="mk">Make the outline</button></div>
    <p class="hint">The outline is step 1 of 3. It usually takes one to three minutes.</p><div id="out"></div>
    <p><button class="quiet" id="rm">Remove this class</button></p>`;
  document.getElementById('mk').onclick = (e) => busy(e.target, document.getElementById('out'), async () => {
    const r = await api('/api/step', { method: 'POST', body: { kind: 'outline', subject: c.subject, grade: c.grade, term: c.term, topic: document.getElementById('tp').value.trim() } });
    go(`#/file/${encodeURIComponent(r.file)}`);
  }, 'Making the outline… (one to three minutes)');
  document.getElementById('rm').onclick = async () => {
    if (!window.confirm('Remove this class from your list? Its units and files stay.')) return;
    await api(`/api/classes/${c.id}`, { method: 'DELETE', body: {} }); go('#/');
  };
}

// ── a unit: its steps and lessons ──────────────────────────────────────────
async function unitPage(subject, unit) {
  const status = await api('/api/status');
  const u = ((status.subjects.find(s => s.subject === subject) || {}).units || []).find(x => x.unit === unit);
  if (!u) { $app.innerHTML = msg('That unit was not found.', true); return; }
  const dir = `01_curriculum/${subject}/units/${unit}`;
  const steps = [['outline', '1_outline.md', '1 · Outline'], ['sequence', '2_sequence.md', '2 · Lesson sequence'], ['assessment', '3_assessment.md', '3 · Assessment'], ['rubric', '3_rubric.md', 'Rubric']];
  const lessons = status.lessons.filter(l => l.file.includes(`/${subject}_${unit}/`)).sort((a, b) => a.file.localeCompare(b.file));
  $app.innerHTML = `<div class="crumbs"><a href="#/">My classes</a> ›</div><h1>${esc(u.meta.topic || unit)}</h1>
    <p class="meta">${esc(subject)} · ${esc(u.meta.grade || '')}${u.meta.term ? ` · Term ${esc(u.meta.term)}` : ''}</p>
    <h2>The unit</h2><div class="scroll"><table>${steps.map(([k, f, name]) => {
      const st = u.steps[k];
      return `<tr><td><b>${name}</b><br>${st.state === 'not made' ? '' : fileLink(`${dir}/${f}`, 'Open')}</td><td>${stateBadge(st)}</td>
        <td><button class="${st.state === 'not made' ? '' : 'quiet'}" data-kind="${k}">${st.state === 'not made' ? 'Make it' : 'Make it again'}</button></td></tr>`;
    }).join('')}</table></div>
    <label for="fb">What to change (when making a step again)</label><textarea id="fb" placeholder="Leave empty for a first version"></textarea>
    <div id="out"></div>
    <h2>Lessons</h2>
    ${lessons.length ? `<div class="scroll"><table>${lessons.map(l => `<tr><td>${fileLink(l.file)}</td><td>${stateBadge(l)}</td></tr>`).join('')}</table></div>` : '<p class="meta">No lessons yet.</p>'}
    <div class="row"><div><label for="ln">Lesson number</label><input id="ln" inputmode="numeric" placeholder="3"></div>
      <button data-lesson="lesson">Make the lesson plan</button><button class="quiet" data-lesson="worksheet">Worksheet</button><button class="quiet" data-lesson="slides">Slides</button></div>
    <p class="hint">Each step waits until the steps it builds on are approved.</p><div id="out2"></div>`;
  document.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => busy(b, document.getElementById('out'), async () => {
    const r = await api('/api/step', { method: 'POST', body: { kind: b.dataset.kind, subject, unit, feedback: document.getElementById('fb').value.trim() || undefined } });
    go(`#/file/${encodeURIComponent(r.file)}`);
  }, 'Making it… (one to three minutes)'));
  document.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => busy(b, document.getElementById('out2'), async () => {
    const r = await api('/api/step', { method: 'POST', body: { kind: b.dataset.lesson, subject, unit, lesson: document.getElementById('ln').value.trim() } });
    go(`#/file/${encodeURIComponent(r.file)}`);
  }, 'Making it…'));
}

// ── one file: its checks, its text, approve, download ─────────────────────
const parseChecks = (md) => (md || '').split('\n').filter(l => /^\| (pass|\*\*FAIL\*\*) \|/.test(l))
  .map(l => { const c = l.split('|').map(x => x.trim()); return { pass: c[1] === 'pass', check: c[2], why: c[3] }; });

async function filePage(path) {
  const [f, status] = await Promise.all([api(`/api/file?path=${encodeURIComponent(path)}`), api('/api/status')]);
  let st = status.lessons.find(l => l.file === path);
  if (!st) for (const s of status.subjects) for (const u of s.units) for (const [k, v] of Object.entries(u.steps)) {
    if (path === `01_curriculum/${s.subject}/units/${u.unit}/${{ outline: '1_outline.md', sequence: '2_sequence.md', assessment: '3_assessment.md', rubric: '3_rubric.md' }[k]}`) st = v;
  }
  const checks = parseChecks(f.checks);
  // Built from the server's cleaned path, never from the address bar, and escaped.
  const unitMatch = String(f.file).match(/^01_curriculum\/([^/]+)\/units\/([^/]+)\//);
  const unitHref = unitMatch ? `#/unit/${encodeURIComponent(unitMatch[1])}/${encodeURIComponent(unitMatch[2])}` : '';
  $app.innerHTML = `<div class="crumbs"><a href="#/">My classes</a> ›${unitMatch ? ` <a href="${esc(unitHref)}">the unit</a> ›` : ''}</div>
    <h1>${esc(String(f.file).split('/').pop())}</h1><p>${stateBadge(st)}</p>
    ${checks.length ? `<h2>Checks</h2><div class="scroll"><table>${checks.map(c => `<tr><td class="${c.pass ? 'pass' : 'fail'}">${c.pass ? 'pass' : 'FAIL'}</td><td>${esc(c.check)}${c.pass || !c.why ? '' : `<br><span class="meta">${esc(c.why)}</span>`}</td></tr>`).join('')}</table></div>` : ''}
    <pre>${esc(String(f.text).replace(/^<!-- engine:.*-->\n?/m, ''))}</pre>
    <button class="secondary" id="ap">Approve this version</button>
    <p class="hint">Approve only what you have read. It's recorded in your name, and makes the Word or PowerPoint file.</p><div id="out"></div>`;
  document.getElementById('ap').onclick = (e) => busy(e.target, document.getElementById('out'), async () => {
    const r = await api('/api/approve', { method: 'POST', body: { file: path } });
    const dl = r.rendered && !/kept\)$/.test(r.rendered) ? ` <a href="/download?path=${encodeURIComponent(r.rendered)}">Download ${esc(r.rendered.split('/').pop())}</a>` : (r.rendered ? ` ${esc(r.rendered)}` : '');
    document.getElementById('out').innerHTML = `<div class="msg">Approved by ${esc(r.by)}.${dl}</div>`;
  }, 'Approving…');
}

// ── admin: the school layer, people, spend ────────────────────────────────
async function adminPage() {
  if (me.role !== 'admin') { $app.innerHTML = `<h1>Admin</h1>${msg('This area is for the school admin.')}`; return; }
  const [files, users, status] = await Promise.all([api('/api/school'), api('/api/users'), api('/api/status')]);
  const live = status.chain.filter(c => c.usable);
  $app.innerHTML = `<h1>Admin</h1>
    <h2>Invite a teacher</h2>
    <div class="row"><div><label for="ir">Role</label><select id="ir"><option value="teacher">Teacher</option><option value="admin">Another admin</option></select></div>
      <button id="inv">Make an invite link</button></div><div id="iout"></div>
    <h2>People</h2><div class="scroll"><table>${users.map(u => `<tr><td>${esc(u.name)}</td><td>${u.role}</td><td>${u.disabled ? 'disabled' : 'active'}</td>
      <td>${u.name === me.name ? '' : `<button class="quiet" data-user="${u.id}" data-disabled="${u.disabled}">${u.disabled ? 'Enable' : 'Disable'}</button>`}</td></tr>`).join('')}</table></div>
    <h2>AI models and spending</h2>
    <p>${live.length ? `Tried in this order: <b>${live.map(c => esc(c.model)).join(' → ')}</b>.` : msg('No AI key yet. See engine/PROVIDERS.md.', true)}
      This month: <b>$${status.spend.usd.toFixed(2)}</b>${status.limit ? ` of a $${status.limit} limit` : ''}.</p>
    <h2>The school layer</h2><p class="meta">Every teacher's work reads these. Each save keeps the earlier version in 00_school/.versions/.</p>
    ${files.map((f, i) => `<label for="sf${i}">${esc(f.name)}${f.missing ? ' (not filled in yet: showing the template)' : ''}</label>
      <textarea class="file" id="sf${i}">${esc(f.text)}</textarea><button class="quiet" data-save="${i}">Save ${esc(f.name)}</button><div id="so${i}"></div>`).join('')}`;
  document.getElementById('inv').onclick = (e) => busy(e.target, document.getElementById('iout'), async () => {
    const r = await api('/api/invites', { method: 'POST', body: { role: document.getElementById('ir').value } });
    document.getElementById('iout').innerHTML = `<div class="msg">Send this link to the person (it works once, for 7 days):<br><b>${esc(r.link)}</b></div>`;
  });
  document.querySelectorAll('[data-user]').forEach(b => b.onclick = () => busy(b, document.getElementById('iout'), async () => {
    await api(`/api/users/${b.dataset.user}/disable`, { method: 'POST', body: { disabled: b.dataset.disabled !== 'true' } });
    adminPage();
  }));
  document.querySelectorAll('[data-save]').forEach(b => b.onclick = () => busy(b, document.getElementById(`so${b.dataset.save}`), async () => {
    const f = files[Number(b.dataset.save)];
    await api(`/api/school/${encodeURIComponent(f.name)}`, { method: 'PUT', body: { text: document.getElementById(`sf${b.dataset.save}`).value } });
    document.getElementById(`so${b.dataset.save}`).innerHTML = msg(`Saved ${f.name}.`);
  }, 'Saving…'));
}

// ── router ─────────────────────────────────────────────────────────────────
async function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const join = h.match(/^\/join\/(.+)$/);
  try {
    if (join) { me = null; header(); return await joinPage(decodeURIComponent(join[1])); }
    if (h === '/signin') { me = null; header(); return signinPage(); }
    if (!me) me = await api('/api/me');
    header();
    let m;
    if ((m = h.match(/^\/class\/(\d+)$/))) return await classPage(m[1]);
    if ((m = h.match(/^\/unit\/([^/]+)\/([^/]+)$/))) return await unitPage(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    if ((m = h.match(/^\/file\/(.+)$/))) return await filePage(decodeURIComponent(m[1]));
    if (h === '/admin') return await adminPage();
    return await homePage();
  } catch (e) {
    if (me) $app.innerHTML = msg(e.message, true);
  }
}

window.addEventListener('hashchange', route);
route();
