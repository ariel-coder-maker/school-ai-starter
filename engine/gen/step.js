// Make one step. The heart of the engine.
//
//   node step.js outline    --subject sciences --grade "Grade 7" --term 1 --topic "Forces"
//   node step.js sequence   --subject sciences --unit grade_7_t1_forces
//   node step.js assessment --subject sciences --unit grade_7_t1_forces
//   node step.js rubric     --subject sciences --unit grade_7_t1_forces
//   node step.js lesson     --subject sciences --unit grade_7_t1_forces --lesson 3 --teacher "J Smith"
//   node step.js worksheet  --subject sciences --unit grade_7_t1_forces --lesson 3 --teacher "J Smith"
//   node step.js slides     --subject sciences --unit grade_7_t1_forces --lesson 3 --teacher "J Smith"
//   node step.js order_list --term 1
//
// Add --feedback "what to change" to regenerate a step with the teacher's notes.
//
// THE SAME RULES AS LEVEL 1, ENFORCED. Each step is built from the files in
// the kit folder and the prompt in 04_prompts/. A step waits until the steps
// it builds on are APPROVED, and an approval only counts for the exact version
// approved: change an approved outline and the sequence built on it is out of
// date. Every output is checked before anyone sees it; a failed check is
// listed, never silently retried on a dearer model.
'use strict';
const fs = require('fs');
const path = require('path');
const kit = require('./lib/kit.js');
const DB = require('./lib/db.js');
const models = require('./lib/models.js');
const checks = require('./lib/checks.js');

const UNIT_STEPS = ['outline', 'sequence', 'assessment'];
const SPECS = {
  outline:    { prompt: 'unit.md',      only: 'Step 1 · Outline',         needs: [] },
  sequence:   { prompt: 'unit.md',      only: 'Step 2 · Lesson sequence', needs: ['outline'] },
  assessment: { prompt: 'unit.md',      only: 'Step 3 · Assessment',      needs: ['outline', 'sequence'], verified: true },
  rubric:     { prompt: 'rubric.md',    needs: ['assessment'], verified: true },
  lesson:     { prompt: 'lesson.md',    needs: ['outline', 'sequence', 'assessment'], lessonLevel: true },
  worksheet:  { prompt: 'worksheet.md', needs: ['lesson'], lessonLevel: true },
  slides:     { prompt: 'slides.md',    needs: ['lesson'], lessonLevel: true },
  order_list: { prompt: 'order_list.md', needs: [] },
};

class Refused extends Error {}

const pad = (n) => String(n).padStart(2, '0');

// Where every file of a unit lives.
function unitPaths(a) {
  if (!a.subject) throw new Refused('Say which subject (--subject), as named in 01_curriculum/.');
  if (!kit.exists(`01_curriculum/${a.subject}`)) {
    throw new Refused(`There is no 01_curriculum/${a.subject}/ folder. Run setup's Block C for this subject first, or check the spelling. `
      + `Subjects set up: ${kit.subjects().join(', ') || 'none yet'}.`);
  }
  const unit = a.unit || (a.grade && a.term && a.topic ? kit.slug(`${a.grade} t${a.term} ${a.topic}`) : null);
  if (!unit) throw new Refused('Say which unit (--unit), or for a new unit give --grade, --term and --topic.');
  const dir = `01_curriculum/${a.subject}/units/${unit}`;
  const teacher = kit.slug(a.teacher || 'shared') || 'shared';
  const out = `06_outputs/${teacher}/${a.subject}_${unit}`;
  const n = a.lesson ? pad(Number(a.lesson)) : null;
  return {
    unit, dir, out,
    outline: `${dir}/1_outline.md`, sequence: `${dir}/2_sequence.md`, assessment: `${dir}/3_assessment.md`,
    rubric: `${dir}/3_rubric.md`,
    lesson: n && `${out}/L${n}_lesson.md`, worksheet: n && `${out}/L${n}_worksheet.md`, slides: n && `${out}/L${n}_slides.md`,
    previousLesson: n && Number(a.lesson) > 1 && `${out}/L${pad(Number(a.lesson) - 1)}_lesson.md`,
  };
}

// Is this file approved, in exactly its current version?
async function approved(rel) {
  const md = kit.read(rel);
  if (md == null) return { ok: false, why: `${rel} has not been made yet` };
  const a = await DB.approvalOf(rel);
  if (!a) return { ok: false, why: `${rel} is waiting for approval` };
  if (a.content_hash !== kit.approvalHash(md)) return { ok: false, why: `${rel} has changed since ${a.approved_by} approved it. Approve it again` };
  return { ok: true, hash: a.content_hash, by: a.approved_by, at: a.at, md };
}

const section = (title, files) => files.filter(f => f && f.text != null)
  .map(f => `### ${f.name}\n\n${f.text.trim()}`).join('\n\n') || `(${title}: nothing filled in yet)`;

function rulesFromStartHere() {
  const md = kit.read('START_HERE.md') || '';
  const m = md.match(/## Rules that always apply[\s\S]*?(?=\n## |$)/);
  return m ? m[0] : '';
}

function systemPrompt(kind, spec, fileName) {
  const prompt = kit.read(`04_prompts/${spec.prompt}`) || '';
  const only = spec.only ? `Make ONLY "${spec.only}" from the prompt above. Not the other steps.` : '';
  return [
    'You are the generator inside a school\'s curriculum engine. The school\'s information follows in the user message; use it exactly.',
    rulesFromStartHere(),
    `# The prompt for this step (04_prompts/${spec.prompt})\n\n${prompt}`,
    '# ENGINE MODE',
    `You are running inside the engine, not in a chat. ${only}`,
    `Produce exactly one document, ${fileName}, in the exact Markdown format the prompt gives, and nothing else: no preamble, no closing remarks, no code fence around the document.`,
    'Do not ask questions and do not wait for approval. If something you need is missing or TODO, still write the document, and list what you need under a final heading "## Questions for the teacher".',
    'Write "Status: DRAFT" as the status line. A person approves it later.',
    'Before you finish, check the document against the school\'s rules in the user message and fix anything that breaks them.',
  ].filter(Boolean).join('\n\n');
}

async function build(kind, a) {
  const spec = SPECS[kind];
  if (!spec) throw new Refused(`"${kind}" is not a step. Steps: ${Object.keys(SPECS).join(', ')}.`);
  const cal = kit.calendar();
  if (!kit.exists('00_school/school_profile.md')) {
    throw new Refused('00_school/ is not set up yet. Run setup first (type "setup" in your AI tool).');
  }

  // ── where it goes, and what it needs ────────────────────────────────────
  let target; let paths = null; let fw = { status: 'MISSING', codes: new Set(), strands: [] };
  const upstream = [];
  if (kind === 'order_list') {
    if (!a.term) throw new Refused('Say which term (--term).');
    target = `06_outputs/order_lists/term${a.term}.md`;
    for (const subject of kit.subjects()) {
      for (const u of kit.listDirs(`01_curriculum/${subject}/units`)) {
        const meta = JSON.parse(kit.read(`01_curriculum/${subject}/units/${u}/unit.json`) || '{}');
        if (String(meta.term) !== String(a.term)) continue;
        const ap = await approved(`01_curriculum/${subject}/units/${u}/2_sequence.md`);
        if (ap.ok) upstream.push({ rel: `01_curriculum/${subject}/units/${u}/2_sequence.md`, ...ap });
      }
    }
    if (!upstream.length) throw new Refused(`No approved lesson sequence for term ${a.term} yet. Approve each unit's 2_sequence.md first.`);
  } else {
    paths = unitPaths(a);
    if (spec.lessonLevel && !a.lesson) throw new Refused('Say which lesson (--lesson).');
    target = paths[kind];
    fw = kit.framework(a.subject);
    if (kind === 'outline' && !(a.grade && a.term && a.topic) && !kit.exists(`${paths.dir}/unit.json`)) {
      throw new Refused('A new unit needs --grade, --term and --topic.');
    }
    if ((kind === 'sequence' || kind === 'lesson') && !cal.lessonsPerUnit) {
      throw new Refused('Lessons per unit (B4) is TODO in 00_school/calendar.md. The sequence can\'t be checked without it.');
    }
    if (kind === 'lesson' && !cal.taughtMinutes) {
      throw new Refused('Minutes taught (B3) is TODO in 00_school/calendar.md. A lesson can\'t be timed without it.');
    }
    if (spec.verified && fw.status !== 'VERIFIED') {
      throw new Refused(`01_curriculum/${a.subject}/framework.md is ${fw.status}. Nothing assessed is made until a person has checked the criteria and marked it VERIFIED (SETUP.md, Step 5).`);
    }
    for (const need of spec.needs) {
      const ap = await approved(paths[need]);
      if (!ap.ok) throw new Refused(`Waiting: ${ap.why}.`);
      upstream.push({ rel: paths[need], ...ap });
    }
  }

  // ── what the model reads ────────────────────────────────────────────────
  const meta = paths && kit.exists(`${paths.dir}/unit.json`) ? JSON.parse(kit.read(`${paths.dir}/unit.json`)) : {};
  const request = {
    step: kind, subject: a.subject, grade: a.grade || meta.grade, term: a.term || meta.term,
    topic: a.topic || meta.topic, lesson: a.lesson, teacher: a.teacher,
  };
  const parts = [
    `# Request\n\n${Object.entries(request).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`,
    `# The school (00_school/)\n\n${section('school', kit.school())}`,
  ];
  if (a.subject) parts.push(`# The subject (01_curriculum/${a.subject}/)\n\n${section('subject', kit.subjectFiles(a.subject))}`);
  parts.push(`# Resources (03_resources/)\n\n${section('resources', kit.resources())}`);
  if (upstream.length) {
    parts.push(`# Approved earlier steps\n\n${upstream.map(u => `### ${u.rel} (approved by ${u.by})\n\n${u.md.trim()}`).join('\n\n')}`);
  }
  if (paths && paths.previousLesson && kit.exists(paths.previousLesson)) {
    parts.push(`# The lesson before this one\n\n${kit.read(paths.previousLesson).trim()}`);
  }
  parts.push(`# The school's rules every output must pass (05_checks/)\n\n${kit.checksText()}`);
  const previous = kit.read(target);
  if (a.feedback) {
    parts.push(`# Regenerate with the teacher's feedback\n\nThe previous version is below. Keep what the teacher did not ask to change.\n\nFeedback: ${a.feedback}\n\n## Previous version\n\n${previous || '(none)'}`);
  }

  // ── make it ─────────────────────────────────────────────────────────────
  const out = await models.callChain({
    kind, target, system: systemPrompt(kind, spec, path.basename(target)), user: parts.join('\n\n---\n\n'),
  });
  let md = out.text.trim().replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim();
  if (!kit.statusOf(md)) md = md.replace(/^(#[^\n]*\n)/, '$1Status: DRAFT\n');
  const builtOn = upstream.map(u => `${u.rel}@${u.hash.slice(0, 12)}`).join(',') || '-';
  md = `<!-- engine: kind=${kind} built_on=${builtOn} model=${out.model} at=${new Date().toISOString()} -->\n${md}\n`;

  if (previous != null) {
    const v = `${path.dirname(target)}/.versions/${path.basename(target, '.md')}.${Date.now()}.md`;
    kit.write(v, previous);
  }
  kit.write(target, md);
  if (paths && kind === 'outline') {
    kit.write(`${paths.dir}/unit.json`, JSON.stringify({ subject: a.subject, grade: request.grade, term: request.term,
      topic: request.topic, unit: paths.unit }, null, 2) + '\n');
  }

  // ── check it ────────────────────────────────────────────────────────────
  const ctx = { subject: a.subject, fw, cal };
  const auto = checks.automatic(kind, md, ctx);
  if (out.truncated) auto.push({ check: 'The answer is complete', pass: false, why: 'it was cut off at max_tokens: regenerate, or raise max_tokens in model_chain.json' });
  const reviewed = await checks.review(kind, md, target, models.callChain, models.config().review);
  const all = auto.map(c => ({ ...c, by: 'automatic' })).concat(reviewed);
  const failed = all.filter(c => !c.pass);
  const cost = out.cost + (reviewed.cost || 0);
  kit.write(target.replace(/\.md$/, '.checks.md'), reportMd(target, out, all, cost));
  await DB.logRun({ kind, target, model: out.model, cost, passed: all.length - failed.length, failed: failed.length,
    problems: failed.map(f => `${f.check}: ${f.why}`) });

  return { file: target, model: out.model, cost, tried: out.tried, checks: all, failed: failed.length };
}

function reportMd(target, out, all, cost) {
  const rows = all.map(c => `| ${c.pass ? 'pass' : '**FAIL**'} | ${c.check} | ${String(c.why || '').replace(/\|/g, '/')} | ${c.by || ''} |`);
  const failed = all.filter(c => !c.pass).length;
  return `# Checks · ${path.basename(target)}\n\nMade by ${out.model} · cost $${cost.toFixed(4)} · ${new Date().toISOString()}\n\n`
    + `${failed ? `**${failed} check(s) failed.** Read them, then regenerate with feedback or fix the file by hand before approving.` : 'Every check passed. It still needs a person\'s approval.'}\n\n`
    + `| Result | Check | Why | By |\n|---|---|---|---|\n${rows.join('\n')}\n`;
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else a._.push(argv[i]);
  }
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const kind = a._[0];
  if (!kind) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 13).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return; }
  try {
    await DB.ensureSchema();
    const r = await build(kind, a);
    console.log(`Made ${r.file} with ${r.model} for $${r.cost.toFixed(4)}.`);
    for (const c of r.checks) console.log(`  ${c.pass ? 'pass' : 'FAIL'}  ${c.check}${c.pass ? '' : `: ${c.why}`}`);
    console.log(r.failed ? `\n${r.failed} check(s) failed. Regenerate with --feedback, or fix the file, then approve it.`
      : `\nEvery check passed. Read it, then approve it: node approve.js ${r.file} --by "Your name"`);
  } catch (e) {
    console.error(e instanceof Refused ? `Not made. ${e.message}` : `Something went wrong: ${e.message}`);
    process.exitCode = 1;
  } finally { await DB.close(); }
}

if (require.main === module) main();
module.exports = { build, approved, unitPaths, Refused, SPECS, UNIT_STEPS, parseArgs };
