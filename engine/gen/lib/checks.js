// Checks run on everything the engine makes, before a teacher sees it.
//
// Two kinds:
//   automatic: the rules in 05_checks/starter_checks.md that a script can test
//              exactly: lesson counts, minutes that add up, codes that exist
//              in the framework, strands practised before they're assessed.
//   review:    one AI read of the output against the school's own
//              05_checks/checks.md, for the rules only a reader can judge.
//
// A failed check never sends the work to another model. It is listed on the
// output, so the teacher can read it and regenerate with feedback.
'use strict';
const kit = require('./kit.js');

const KINDS_OF_WORK = ['hook', 'retrieval', 'bridge', 'explain', 'i-do', 'we-do', 'practice', 'investigate',
  'discuss', 'apply-new-context', 'evaluate', 'create', 'formative', 'summative', 'self-check', 'exit'];
const NOT_REAL_WORK = new Set(['hook', 'retrieval', 'bridge', 'self-check', 'exit']);
const LESSON_KINDS = ['concept', 'practice', 'formative', 'summative', 'low-load', 'reflection', 'flex'];
const SLIDE_PURPOSES = ['agenda', 'hook', 'retrieval', 'bridge', 'explain', 'i-do', 'we-do', 'check', 'practice',
  'instructions', 'summary', 'exit'];

const ok = (check, why) => ({ check, pass: true, why: why || '' });
const no = (check, why) => ({ check, pass: false, why });
const norm = (s) => String(s || '').toLowerCase().replace(/[`*]/g, '').trim();

// Codes in a cell, with a bare criterion letter ("C") expanded to its strands.
function expand(codes, fw) {
  const out = new Set();
  for (const c of codes) {
    if (/^[A-Z]$/.test(c) && fw.strands.some(s => s.startsWith(`${c}.`))) {
      fw.strands.filter(s => s.startsWith(`${c}.`)).forEach(s => out.add(s));
    } else out.add(c);
  }
  return out;
}

function unknownCodes(codes, fw) {
  if (!fw.codes.size) return [];
  return [...codes].filter(c => !fw.codes.has(c));
}

function codesExist(name, cells, fw) {
  if (fw.status === 'MISSING') return no(name, 'the subject has no framework.md, so codes cannot be checked');
  const all = new Set(cells.flatMap(c => kit.codesIn(c)));
  const bad = unknownCodes(all, fw);
  return bad.length ? no(name, `not in framework.md: ${bad.join(', ')}`) : ok(name, `${all.size} code(s), all in framework.md`);
}

function frameworkVerified(fw) {
  return fw.status === 'VERIFIED'
    ? ok('The framework has been checked by a person (VERIFIED)')
    : no('The framework has been checked by a person (VERIFIED)', `framework.md is ${fw.status}: nothing assessed may be built on it yet`);
}

function outline(md, ctx) {
  const r = [];
  const iq = kit.tableWith(md, 'Type', 'Question');
  const types = iq ? iq.rows.map(x => norm(kit.col(x, 'Type'))) : [];
  r.push(['factual', 'conceptual', 'debatable'].every(t => types.includes(t))
    ? ok('Inquiry questions: factual, conceptual and debatable')
    : no('Inquiry questions: factual, conceptual and debatable', `found: ${types.join(', ') || 'no inquiry question table'}`));
  const assessed = kit.tableWith(md, 'Criterion', 'Strands');
  r.push(assessed
    ? codesExist('Every criterion and strand exists in framework.md', assessed.rows.flatMap(x => [kit.col(x, 'Criterion'), kit.col(x, 'Strands')]), ctx.fw)
    : no('Every criterion and strand exists in framework.md', 'no "What is assessed" table with Criterion and Strands columns'));
  const std = kit.read(`01_curriculum/${ctx.subject}/standards.md`);
  const used = kit.tableWith(md, 'Code', 'Wording');
  if (std && used) {
    const known = new Set(kit.tables(std).flatMap(t => t.rows.map(x => norm(kit.col(x, 'Code')))).filter(Boolean));
    const bad = used.rows.map(x => norm(kit.col(x, 'Code'))).filter(c => c && !known.has(c));
    r.push(bad.length ? no('Every standard code exists in standards.md', `not found: ${bad.join(', ')}`)
      : ok('Every standard code exists in standards.md'));
  }
  return r;
}

function sequence(md, ctx) {
  const r = [];
  const t = kit.tableWith(md, 'Lesson', 'Kind');
  if (!t) return [no('Has the lesson sequence table', 'no table with Lesson and Kind columns')];
  const rows = t.rows;
  const want = ctx.cal.lessonsPerUnit;
  r.push(!want ? no('Exactly the number of lessons in calendar.md (B4)', 'B4 (lessons per unit) is TODO in 00_school/calendar.md')
    : rows.length === want ? ok('Exactly the number of lessons in calendar.md (B4)', `${want} lessons`)
      : no('Exactly the number of lessons in calendar.md (B4)', `${rows.length} lessons, calendar.md says ${want}. Rejected: redo it, don't pad or trim`));
  const nums = rows.map(x => Number(kit.col(x, 'Lesson')));
  r.push(nums.every((n, i) => n === i + 1) ? ok('Lessons numbered 1, 2, 3… in order')
    : no('Lessons numbered 1, 2, 3… in order', `found ${nums.join(', ')}`));
  const kinds = rows.map(x => norm(kit.col(x, 'Kind')));
  const badKinds = [...new Set(kinds.filter(k => !LESSON_KINDS.includes(k)))];
  r.push(badKinds.length ? no('Every lesson has a known kind', `unknown: ${badKinds.join(', ')} (allowed: ${LESSON_KINDS.join(', ')})`)
    : ok('Every lesson has a known kind'));
  const practisedCol = (x) => kit.col(x, 'Criteria');
  r.push(codesExist('Every criterion and strand practised exists in framework.md', rows.map(practisedCol), ctx.fw));
  const summatives = rows.map((x, i) => ({ x, i })).filter(o => norm(kit.col(o.x, 'Kind')) === 'summative');
  if (!summatives.length) r.push(no('Has a summative', 'no lesson of kind "summative"'));
  else {
    const missing = [];
    for (const s of summatives) {
      const assessed = expand(kit.codesIn(practisedCol(s.x)), ctx.fw);
      const before = new Set(rows.slice(0, s.i).filter(x => norm(kit.col(x, 'Kind')) !== 'summative')
        .flatMap(x => [...expand(kit.codesIn(practisedCol(x)), ctx.fw)]));
      for (const c of assessed) if (c.includes('.') && !before.has(c)) missing.push(`${c} (lesson ${s.i + 1})`);
    }
    r.push(missing.length ? no('Every strand a summative assesses is practised in an earlier lesson', `never practised first: ${[...new Set(missing)].join(', ')}`)
      : ok('Every strand a summative assesses is practised in an earlier lesson'));
    const last = summatives[summatives.length - 1].i;
    const after = rows[last + 1] ? norm(kit.col(rows[last + 1], 'Kind')) : null;
    r.push(!after || ['low-load', 'reflection'].includes(after) ? ok('The lesson after the last summative is low-load')
      : no('The lesson after the last summative is low-load', `lesson ${last + 2} is "${after}": the teacher is grading`));
  }
  const formatives = rows.filter(x => norm(kit.col(x, 'Kind')) === 'formative');
  const partial = [];
  for (const f of formatives) {
    const codes = kit.codesIn(practisedCol(f));
    const crits = [...new Set(codes.map(c => c.split('.')[0]))];
    for (const c of crits) {
      const all = ctx.fw.strands.filter(s => s.startsWith(`${c}.`));
      const has = expand(codes, ctx.fw);
      const miss = all.filter(s => !has.has(s));
      if (all.length && miss.length) partial.push(`lesson ${kit.col(f, 'Lesson')} misses ${miss.join(', ')}`);
    }
  }
  r.push(partial.length ? no('A formative task covers every strand of its criterion', partial.join('; '))
    : ok('A formative task covers every strand of its criterion'));
  return r;
}

function assessment(md, ctx) {
  const r = [frameworkVerified(ctx.fw)];
  const q = kit.tableWith(md, '#', 'Criterion');
  if (!q) return r.concat(no('Has the questions table', 'no table with # and Criterion columns'));
  r.push(codesExist('Every question names a criterion and strand in framework.md', q.rows.map(x => kit.col(x, 'Criterion')), ctx.fw));
  const assessed = new Set(q.rows.flatMap(x => kit.codesIn(kit.col(x, 'Criterion'))).filter(c => c.includes('.')));
  const where = kit.tableWith(md, 'Strand', 'Practised');
  const listed = new Set(where ? where.rows.map(x => kit.codesIn(kit.col(x, 'Strand'))).flat() : []);
  const miss = [...assessed].filter(c => !listed.has(c));
  r.push(miss.length ? no('"Where it was practised" covers every assessed strand', `missing: ${miss.join(', ')}`)
    : ok('"Where it was practised" covers every assessed strand'));
  return r;
}

function lesson(md, ctx) {
  const r = [];
  const t = kit.tableWith(md, '#', 'Section', 'Minutes');
  if (!t) return [no('Has the lesson plan table', 'no table with #, Section and Minutes columns')];
  const total = t.rows.reduce((s, x) => s + (Number(String(kit.col(x, 'Minutes')).replace(/[^\d.]/g, '')) || 0), 0);
  const want = ctx.cal.taughtMinutes;
  r.push(!want ? no('Minutes add up to the taught minutes (B3)', 'B3 (minutes taught) is TODO in 00_school/calendar.md')
    : total === want ? ok('Minutes add up to the taught minutes (B3)', `${total} minutes`)
      : no('Minutes add up to the taught minutes (B3)', `${total} minutes planned, ${want} taught`));
  const kinds = t.rows.map(x => norm(kit.col(x, 'Kind')));
  const bad = [...new Set(kinds.filter(k => k && !KINDS_OF_WORK.includes(k)))];
  if (bad.length) r.push(no('Every section names a known kind of work', `unknown: ${bad.join(', ')}`));
  const isSummative = kinds.includes('summative');
  if (!isSummative) {
    const real = new Set(kinds.filter(k => k && !NOT_REAL_WORK.has(k)));
    r.push(real.size >= 3 ? ok('At least three kinds of real work', [...real].join(', '))
      : no('At least three kinds of real work', `only ${[...real].join(', ') || 'none'}`));
    const twice = kinds.findIndex((k, i) => i > 0 && k && k === kinds[i - 1]);
    r.push(twice === -1 ? ok('Never the same kind of work twice in a row')
      : no('Never the same kind of work twice in a row', `"${kinds[twice]}" in sections ${twice} and ${twice + 1}`));
  }
  const obj = (md.match(/##\s*Objective\s*\n+([^\n#]+)/i) || [])[1] || '';
  r.push(!obj.trim() ? no('The objective is observable', 'no Objective section')
    : /\b(understand|know|learn about|be aware|appreciate)\b/i.test(obj) ? no('The objective is observable', `"${obj.trim().slice(0, 90)}"`)
      : ok('The objective is observable'));
  r.push(/##\s*Bridge/i.test(md) ? ok('Has a bridge from last lesson') : no('Has a bridge from last lesson', 'no Bridge section'));
  return r;
}

function worksheet(md, ctx) {
  const r = [];
  const extras = md.match(/\b(optional|challenge question|extension task|if you finish early)\b/gi);
  r.push(extras ? no('No optional or "challenge" extras: every question is required', `found: ${[...new Set(extras)].join(', ')}`)
    : ok('No optional or "challenge" extras: every question is required'));
  const tagged = [...md.matchAll(/\(([A-Z][A-Za-z]{0,3}\d{0,2}\.[ivx\d]+[a-z]?)\)/g)].map(m => m[1]);
  r.push(codesExist('Every assessed question names a strand in framework.md', tagged, ctx.fw));
  const sections = md.match(/^##\s.+·\s*\d+\s*min/gim) || [];
  r.push(sections.length ? ok('Every section states its minutes', `${sections.length} sections`)
    : no('Every section states its minutes', 'no "## Section · N min" headings'));
  return r;
}

function slides(md) {
  const r = [];
  const blocks = md.split(/^##\s+Slide\s+/m).slice(1).map(b => {
    const head = b.split('\n')[0];
    const purpose = norm((head.split('·')[1] || ''));
    const note = (b.match(/Teacher note:\s*([\s\S]*?)(?:\n---|\n##|$)/i) || [])[1] || '';
    const screen = b.split('\n').slice(1).join('\n').split(/^(?:Figure|Teacher note):/mi)[0];
    return { head, purpose, note: note.trim(), words: screen.split(/\s+/).filter(Boolean).length };
  });
  if (!blocks.length) return [no('Has slides', 'no "## Slide n · purpose" headings')];
  const have = new Set(blocks.map(b => b.purpose));
  const need = ['agenda', 'hook', 'explain', 'i-do', 'we-do', 'check', 'summary', 'exit'];
  const miss = need.filter(p => !have.has(p));
  r.push(miss.length ? no('Has every kind of teaching slide', `missing: ${miss.join(', ')}`) : ok('Has every kind of teaching slide'));
  const bad = [...new Set(blocks.map(b => b.purpose).filter(p => p && !SLIDE_PURPOSES.includes(p)))];
  if (bad.length) r.push(no('Every slide names a known purpose', `unknown: ${bad.join(', ')}`));
  const thin = blocks.filter(b => ['explain', 'i-do', 'we-do', 'practice'].includes(b.purpose) && b.note.length < 80);
  r.push(thin.length ? no('Teaching slides have a full teacher note (80+ characters)', thin.map(b => `slide ${b.head.split('·')[0].trim()}`).join(', '))
    : ok('Teaching slides have a full teacher note (80+ characters)'));
  const wordy = blocks.filter(b => b.words > 45);
  r.push(wordy.length ? no('No slide carries more than about 40 words', wordy.map(b => `slide ${b.head.split('·')[0].trim()} (${b.words})`).join(', '))
    : ok('No slide carries more than about 40 words'));
  return r;
}

function rubric(md, ctx) {
  const r = [frameworkVerified(ctx.fw)];
  const heads = kit.tables(md).flatMap(t => t.headers.filter(h => /^Strand\b/i.test(h)));
  r.push(heads.length ? codesExist('Every rubric column is a strand in framework.md', heads, ctx.fw)
    : no('Every rubric column is a strand in framework.md', 'no "Strand …" columns'));
  r.push(/\bnot\s+(penalized|penalised)\b/i.test(md) || !/\b(penalt|deduct|lose marks|minus)\b/i.test(md)
    ? ok('Bands describe what is present, never penalties') : no('Bands describe what is present, never penalties', 'mentions penalties or deductions'));
  return r;
}

function orderList(md) {
  const t = kit.tableWith(md, 'Item', 'To order');
  return [t ? ok('Has the order table', `${t.rows.length} item(s)`) : no('Has the order table', 'no table with Item and To order columns')];
}

const AUTO = { outline, sequence, assessment, lesson, worksheet, slides, rubric, order_list: orderList };

function automatic(kind, md, ctx) {
  const r = [];
  r.push(kit.statusOf(md) ? ok('Has a Status line') : no('Has a Status line', 'no "Status:" line'));
  if (/\b(TODO|lorem ipsum)\b/.test(md.replace(/<!--[\s\S]*?-->/g, ''))) {
    r.push(no('No placeholders left in', 'contains TODO or placeholder text'));
  }
  return r.concat((AUTO[kind] || (() => []))(md, ctx));
}

// One AI read against the school's own checks. Returns [] if review is off.
async function review(kind, md, target, callChain, cfg) {
  if (!cfg || !cfg.enabled) return [];
  const system = 'You check one school document against the school\'s rules. Apply only the rules that fit this kind of document. '
    + 'Be strict and specific. Reply with JSON only, no other text: an array of objects '
    + '{"check": "<the rule, shortened to under 12 words>", "pass": true or false, "why": "<one short sentence; quote the problem if it fails>"}.';
  const user = `## The school's rules (05_checks/checks.md)\n\n${kit.checksText()}\n\n## The document (a ${kind})\n\n${md}`;
  try {
    const out = await callChain({ kind: 'review', target, system, user, maxTokens: cfg.max_tokens || 4000 });
    const json = (out.text.match(/\[[\s\S]*\]/) || [])[0];
    const list = JSON.parse(json).filter(x => x && typeof x.check === 'string')
      .map(x => ({ check: x.check, pass: x.pass === true, why: String(x.why || ''), by: out.model }));
    list.cost = out.cost;
    return list;
  } catch (e) {
    return [{ check: 'AI review against 05_checks/checks.md', pass: false, why: `the review could not be read: ${String(e.message).slice(0, 120)}` }];
  }
}

module.exports = { automatic, review, LESSON_KINDS, KINDS_OF_WORK };
