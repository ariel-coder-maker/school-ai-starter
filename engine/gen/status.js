// Where everything stands, in under a screen.
//
//   node status.js
'use strict';
const kit = require('./lib/kit.js');
const DB = require('./lib/db.js');
const models = require('./lib/models.js');
const { stateOf } = require('./lib/state.js');

async function gather() {
  const out = { school: kit.exists('00_school/school_profile.md'), calendar: kit.calendar(), subjects: [], spend: null, chain: [] };
  for (const subject of kit.subjects()) {
    const fw = kit.framework(subject);
    const units = [];
    for (const u of kit.listDirs(`01_curriculum/${subject}/units`)) {
      const dir = `01_curriculum/${subject}/units/${u}`;
      const steps = {};
      for (const [k, f] of [['outline', '1_outline.md'], ['sequence', '2_sequence.md'], ['assessment', '3_assessment.md'], ['rubric', '3_rubric.md']]) {
        steps[k] = await stateOf(`${dir}/${f}`);
      }
      units.push({ unit: u, meta: JSON.parse(kit.read(`${dir}/unit.json`) || '{}'), steps });
    }
    out.subjects.push({ subject, framework: fw.status, units });
  }
  out.lessons = [];
  for (const t of kit.listDirs('06_outputs')) {
    for (const u of kit.listDirs(`06_outputs/${t}`)) {
      for (const f of kit.listFiles(`06_outputs/${t}/${u}`, '.md').filter(f => !f.endsWith('.checks.md'))) {
        const rel = `06_outputs/${t}/${u}/${f}`;
        out.lessons.push({ file: rel, ...(await stateOf(rel)) });
      }
    }
  }
  out.spend = await DB.monthSpend();
  out.limit = Number(process.env.MONTHLY_LIMIT_USD || 0);
  out.chain = models.chain();
  return out;
}

async function main() {
  try {
    await DB.ensureSchema();
    const s = await gather();
    const c = s.calendar;
    console.log(`School layer: ${s.school ? 'set up' : 'NOT SET UP (type "setup" in your AI tool)'}`
      + ` · ${c.lessonsPerUnit || 'TODO'} lessons per unit · ${c.taughtMinutes || 'TODO'} minutes taught`);
    for (const sub of s.subjects) {
      console.log(`\n${sub.subject}  (framework: ${sub.framework})`);
      if (!sub.units.length) console.log('  no units yet');
      for (const u of sub.units) {
        const line = Object.entries(u.steps).map(([k, v]) => `${k} ${v.state}${v.failedChecks ? ` (${v.failedChecks} failed)` : ''}`).join(' · ');
        console.log(`  ${u.unit}: ${line}`);
      }
    }
    const waiting = s.lessons.filter(l => l.state !== 'approved');
    console.log(`\nLessons and materials: ${s.lessons.length} made, ${s.lessons.length - waiting.length} approved`);
    waiting.slice(0, 8).forEach(l => console.log(`  ${l.state}: ${l.file}`));
    if (waiting.length > 8) console.log(`  …and ${waiting.length - 8} more`);
    const live = s.chain.filter(x => x.usable);
    console.log(`\nAI models ready: ${live.length ? live.map(x => x.model).join(' → ') : 'NONE (add a key to engine/.env)'}`);
    console.log(`Spent this month: $${s.spend.usd.toFixed(2)} in ${s.spend.calls} call(s)${s.limit ? ` of a $${s.limit} limit` : ''}`);
  } catch (e) {
    console.error(`Could not read the status: ${e.message}`);
    process.exitCode = 1;
  } finally { await DB.close(); }
}

if (require.main === module) main();
module.exports = { gather };
