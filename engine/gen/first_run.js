// Run once after the engine first starts (SETUP.md, Step 3). Creates the
// database tables, then says in plain words what it found and what's missing.
//
//   docker compose -f engine/docker-compose.yml exec engine node first_run.js
'use strict';
const kit = require('./lib/kit.js');
const DB = require('./lib/db.js');
const models = require('./lib/models.js');

async function main() {
  const todo = [];
  try {
    await DB.ensureSchema();
    console.log('✓ Database ready.');
  } catch (e) {
    console.log(`✗ The database isn't reachable: ${e.message}`);
    console.log('  Is Docker Desktop running? Try: docker compose -f engine/docker-compose.yml up -d');
    process.exitCode = 1;
    return;
  }

  console.log(`✓ Kit folder found at ${kit.KIT}.`);
  const auth = require('./lib/auth.js');
  const admins = await auth.countUsers('admin');
  if (!admins) {
    const { token } = await auth.createInvite({ role: 'admin' });
    console.log(`· Make the admin account: open ${require('./users.js').joinLink(token)} (valid 7 days, one use).`);
    todo.push('Open the admin link above and make the admin account. The admin then invites teachers from the Admin page.');
  } else {
    console.log(`✓ ${admins} admin(s) and ${await auth.countUsers('teacher')} teacher(s).`);
  }
  if (kit.exists('00_school/school_profile.md')) console.log('✓ School layer (00_school/) is set up.');
  else { console.log('· School layer not set up yet.'); todo.push('Type "setup" in your AI tool to fill in 00_school/.'); }

  const cal = kit.calendar();
  if (cal.found && (!cal.lessonsPerUnit || !cal.taughtMinutes)) {
    todo.push('00_school/calendar.md needs "Lessons per unit" (B4) and "Minutes actually taught" (B3) as numbers.');
  }

  const subjects = kit.subjects();
  if (!subjects.length) todo.push('No subject yet: setup\'s Block C makes 01_curriculum/<subject>/.');
  for (const s of subjects) {
    const fw = kit.framework(s);
    console.log(`${fw.status === 'VERIFIED' ? '✓' : '·'} ${s}: framework ${fw.status}${fw.codes.size ? ` (${fw.codes.size} codes)` : ''}.`);
    if (fw.status !== 'VERIFIED') todo.push(`${s}: a person checks framework.md and marks it VERIFIED before anything assessed is made.`);
  }

  const steps = models.chain();
  const live = steps.filter(x => x.usable);
  if (live.length) console.log(`✓ AI models ready: ${live.map(x => x.model).join(' → ')}.`);
  else {
    console.log('· No AI key yet.');
    todo.push('Add at least one key to engine/.env (engine/PROVIDERS.md), then: docker compose -f engine/docker-compose.yml restart engine');
  }
  const limit = Number(process.env.MONTHLY_LIMIT_USD || 0);
  console.log(limit ? `✓ Monthly limit: $${limit}. Set a limit on each provider's website too.` : '· No monthly limit set (MONTHLY_LIMIT_USD).');

  console.log(`\nThe teacher page: http://localhost:${process.env.ENGINE_PORT_HOST || 3000}`);
  console.log(`n8n: http://localhost:${process.env.N8N_PORT || 5678}`);
  if (todo.length) {
    console.log('\nStill to do:');
    todo.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  } else {
    console.log('\nEverything is in place. Make your first unit outline from the teacher page, or:');
    console.log('  node step.js outline --subject <subject> --grade "<grade>" --term 1 --topic "<topic>"');
  }
  await DB.close();
}

main();
