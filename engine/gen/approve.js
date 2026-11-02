// Approve one file, as a person.
//
//   node approve.js 01_curriculum/sciences/units/grade_7_t1_forces/1_outline.md --by "J Smith"
//
// An approval belongs to the exact version approved. If the file changes
// afterwards, it needs approving again, and anything built on it reads as out
// of date. A file built on an earlier step that has since changed can't be
// approved: regenerate it first. Approving a lesson, worksheet, slides, rubric,
// assessment or order list also makes its Word or PowerPoint file.
'use strict';
const kit = require('./lib/kit.js');
const DB = require('./lib/db.js');
const { stateOf } = require('./lib/state.js');
const render = require('./render.js');
const { parseArgs, Refused } = require('./step.js');

async function approve(relIn, by) {
  const rel = kit.safeRel(relIn);
  if (!by || by === true) throw new Refused('Say who is approving (--by "Your name").');
  if (/\.checks\.md$/.test(rel)) throw new Refused('That is a checks report. Approve the file it reports on.');
  const md = kit.read(rel);
  if (md == null) throw new Refused(`${rel} does not exist.`);
  const s = await stateOf(rel);
  if (s.state === 'out of date') {
    throw new Refused(`${rel} was built on ${s.stale.join(', ')}, which has changed since. Regenerate it, then approve the new version.`);
  }
  await DB.approve(rel, kit.approvalHash(md), String(by));
  const date = new Date().toISOString().slice(0, 10);
  const updated = md.replace(/^(\s*)Status:[^\n]*/m, `$1Status: APPROVED by ${by} on ${date}`);
  kit.write(rel, updated);
  let rendered = null;
  if (render.renders(rel)) rendered = await render.renderFile(rel);
  return { file: rel, by, failedChecks: s.failedChecks, rendered };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  try {
    await DB.ensureSchema();
    const r = await approve(a._[0], a.by);
    console.log(`Approved ${r.file} (by ${r.by}).`);
    if (r.failedChecks) console.log(`Note: ${r.failedChecks} check(s) had failed on this version. Approved anyway, by a person.`);
    if (r.rendered) console.log(`Made ${r.rendered}.`);
  } catch (e) {
    console.error(e instanceof Refused ? `Not approved. ${e.message}` : `Something went wrong: ${e.message}`);
    process.exitCode = 1;
  } finally { await DB.close(); }
}

if (require.main === module) main();
module.exports = { approve };
