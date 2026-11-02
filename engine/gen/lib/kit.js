// Reading and writing the kit folder: the school layer, a subject's files,
// resources, prompts and checks, and the markdown tables inside them.
//
// Everything the engine knows about a school comes through here, from the
// same files the AI reads at Level 1. There is no second copy of the school
// in the database: the database holds only approvals, runs and costs.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KIT = process.env.KIT_DIR || path.resolve(__dirname, '..', '..', '..');
const abs = (rel) => path.join(KIT, rel);

function read(rel) {
  try { return fs.readFileSync(abs(rel), 'utf8'); } catch (e) { return null; }
}
const exists = (rel) => fs.existsSync(abs(rel));

function write(rel, text) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), text);
}

// A path from outside (the teacher page) must stay inside the kit, and inside
// the folders the engine writes to.
const WRITABLE = ['01_curriculum/', '06_outputs/'];
function safeRel(rel) {
  const clean = path.posix.normalize(String(rel || '').replace(/\\/g, '/')).replace(/^\/+/, '');
  if (clean.startsWith('..') || !WRITABLE.some(w => clean.startsWith(w))) {
    throw new Error(`"${rel}" is not a file the engine works with`);
  }
  return clean;
}

const listDirs = (rel) => {
  try {
    return fs.readdirSync(abs(rel), { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map(d => d.name).sort();
  } catch (e) { return []; }
};
const listFiles = (rel, ext) => {
  try {
    return fs.readdirSync(abs(rel)).filter(f => !ext || f.endsWith(ext)).sort();
  } catch (e) { return []; }
};

// Every markdown table in a document, as { headers, rows: [{ header: cell }] }.
function tables(md) {
  const out = [];
  const lines = String(md || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) continue;
    const split = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const headers = split(lines[i]);
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const cells = split(lines[j]);
      const row = {};
      headers.forEach((h, k) => { row[h] = cells[k] == null ? '' : cells[k]; });
      rows.push(row);
    }
    out.push({ headers, rows, line: i + 1 });
    i = j - 1;
  }
  return out;
}

// The first table whose headers include every one named.
const tableWith = (md, ...names) => tables(md).find(t =>
  names.every(n => t.headers.some(h => h.toLowerCase().startsWith(n.toLowerCase()))));
const col = (row, name) => {
  const k = Object.keys(row).find(h => h.toLowerCase().startsWith(name.toLowerCase()));
  return k ? row[k] : '';
};

// "Status: DRAFT ..." or "**Status:** VERIFIED"
function statusOf(md) {
  const m = String(md || '').match(/^\s*(?:\*\*)?Status:?(?:\*\*)?:?\s*([A-Z][A-Z ]*[A-Z])/m);
  return m ? m[1].trim() : null;
}

// What an approval is an approval OF: the content, not its status line or
// the engine's own header, so approving a file doesn't change what was approved.
function contentHash(md) {
  const body = String(md || '').split(/\r?\n/)
    .filter(l => !/^\s*(?:\*\*)?Status:?/.test(l) && !/^\s*Approved by /.test(l) && !/^<!-- engine:/.test(l))
    .join('\n').trim();
  return crypto.createHash('sha256').update(body).digest('hex');
}

// What an approval binds to: the content AND the versions it was built on.
// The same text built on a different outline is a different thing to approve.
function approvalHash(md) {
  const builtOn = header(md).built_on || '-';
  return crypto.createHash('sha256').update(`${contentHash(md)}|${builtOn}`).digest('hex');
}

// The engine's header on everything it writes: what it was built from.
function header(md) {
  const m = String(md || '').match(/^<!-- engine: (.*?) -->/m);
  if (!m) return {};
  const o = {};
  m[1].split(/\s+/).forEach(kv => { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1); });
  return o;
}

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/[\s_-]+/g, '_').slice(0, 60);

// The school layer: every filled-in file in 00_school/ (never the templates).
function school() {
  const files = listFiles('00_school', '.md');
  return files.map(f => ({ name: f, text: read(`00_school/${f}`) }));
}

// Lessons per unit and taught minutes, from 00_school/calendar.md (B3, B4).
function calendar() {
  const md = read('00_school/calendar.md') || '';
  const num = (re) => { const m = md.match(re); return m ? Number(m[1]) : null; };
  return {
    lessonsPerUnit: num(/Lessons per unit[^:\n]*:\s*\**\s*(\d+)/i),
    taughtMinutes: num(/actually taught[^:\n]*:\s*\**\s*(\d+)/i),
    found: !!md,
  };
}

// A subject's framework: its status and every code it defines.
function framework(subject) {
  const rel = `01_curriculum/${subject}/framework.md`;
  const md = read(rel);
  if (md == null) return { status: 'MISSING', codes: new Set(), criteria: [], strands: [], rel };
  const codes = new Set();
  const criteria = [];
  const strands = [];
  for (const t of tables(md)) {
    if (!t.headers.some(h => /^code$/i.test(h))) continue;
    for (const r of t.rows) {
      const code = col(r, 'Code').replace(/[`*]/g, '').trim();
      if (!code || /^<.*>$/.test(code)) continue;
      codes.add(code);
      if (/^[A-Z]$/.test(code) || /criteria|objective/i.test(t.headers.join(' '))) {
        if (!code.includes('.')) criteria.push(code);
      }
      const listed = col(r, 'Strands');
      if (listed) listed.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean).forEach(s => { codes.add(s); strands.push(s); });
      if (code.includes('.')) strands.push(code);
    }
  }
  return { status: statusOf(md) || 'UNVERIFIED', codes, criteria, strands: [...new Set(strands)], rel };
}

// Codes written in a table cell: "C.i, C.ii; D.iv" or "B (B.i–B.iii)".
function codesIn(cell) {
  const text = String(cell || '').replace(/[`*]/g, '');
  if (!text || /^(none|n\/a|-|—)$/i.test(text.trim())) return [];
  const found = text.match(/\b[A-Z][A-Za-z]{0,3}\d{0,2}(?:\.(?:[ivx]+|\d+[a-z]?))?\b/g) || [];
  // Drop ordinary capitalized words; keep things shaped like codes.
  // "I" is a word ("I do"), not a criterion.
  return [...new Set(found.filter(c => c !== 'I' && (/^[A-Z]$/.test(c) || /\./.test(c) || /^[A-Z]{1,4}\d{1,2}$/.test(c))))];
}

function subjects() {
  return listDirs('01_curriculum');
}

function subjectFiles(subject) {
  const dir = `01_curriculum/${subject}`;
  return ['framework.md', 'standards.md', 'scope_and_sequence.md', 'constraints.md']
    .map(f => ({ name: f, text: read(`${dir}/${f}`) }))
    .filter(f => f.text != null);
}

function resources() {
  return listFiles('03_resources', '.md').filter(f => f !== 'README.md')
    .map(f => ({ name: f, text: read(`03_resources/${f}`) }));
}

function checksText() {
  return read('05_checks/checks.md') || read('05_checks/starter_checks.md') || '';
}

module.exports = {
  KIT, abs, read, write, exists, safeRel, listDirs, listFiles,
  tables, tableWith, col, statusOf, contentHash, approvalHash, header, slug,
  school, calendar, framework, codesIn, subjects, subjectFiles, resources, checksText,
};
