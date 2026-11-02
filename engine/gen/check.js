// Run the automatic checks on any file: one the engine made, one you edited
// by hand, or one you made somewhere else and copied in.
//
//   node check.js 01_curriculum/science/units/grade_7_t1_forces/2_sequence.md
//   node check.js my_lesson.md --kind lesson --subject science
//
// The kind is read from the file's engine header, or from its name
// (1_outline, 2_sequence, 3_assessment, 3_rubric, _lesson, _worksheet,
// _slides, order_lists/), or given with --kind.
'use strict';
const path = require('path');
const kit = require('./lib/kit.js');
const checks = require('./lib/checks.js');
const { parseArgs } = require('./step.js');

function kindOf(rel, md) {
  const h = kit.header(md);
  if (h.kind) return h.kind;
  const n = path.basename(rel);
  return [[/1_outline\.md$/, 'outline'], [/2_sequence\.md$/, 'sequence'], [/3_assessment\.md$/, 'assessment'],
    [/3_rubric\.md$/, 'rubric'], [/_lesson\.md$/, 'lesson'], [/_worksheet\.md$/, 'worksheet'], [/_slides\.md$/, 'slides'],
    [/order_lists\//, 'order_list']].find(([re]) => re.test(rel) || re.test(n))?.[1] || null;
}

const a = parseArgs(process.argv.slice(2));
const rel = a._[0];
const md = rel && kit.read(rel);
if (!md) { console.error(rel ? `Can't read ${rel}.` : 'Usage: node check.js <file.md> [--kind k] [--subject s]'); process.exit(1); }
const kind = a.kind || kindOf(rel, md);
const subject = a.subject || (rel.match(/01_curriculum\/([^/]+)\//) || [])[1] || (rel.match(/06_outputs\/[^/]+\/([^_/]+)_/) || [])[1];
if (!kind) { console.error('Say what kind of file this is with --kind (outline, sequence, assessment, rubric, lesson, worksheet, slides, order_list).'); process.exit(1); }
const result = checks.automatic(kind, md, { subject, fw: subject ? kit.framework(subject) : { status: 'MISSING', codes: new Set(), strands: [] }, cal: kit.calendar() });
for (const c of result) console.log(`  ${c.pass ? 'pass' : 'FAIL'}  ${c.check}${c.pass ? '' : `: ${c.why}`}`);
const failed = result.filter(c => !c.pass).length;
console.log(failed ? `\n${failed} check(s) failed.` : '\nEvery automatic check passed. (The AI review runs only when the engine makes a file.)');
process.exitCode = failed ? 2 : 0;
