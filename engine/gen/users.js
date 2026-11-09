// People, from the command line.
//
//   node users.js invite admin       a one-use link for a new admin (valid 7 days)
//   node users.js invite teacher     a one-use link for a new teacher
//   node users.js list               everyone, with their role
//   node users.js disable "Name"     sign someone out and stop them signing in
//   node users.js enable "Name"
//
// Admins can do the same from the teacher page's Admin area.
'use strict';
const DB = require('./lib/db.js');
const auth = require('./lib/auth.js');

const joinLink = (token) => `http://localhost:${process.env.ENGINE_PORT_HOST || 3000}/#/join/${token}`;

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  try {
    await DB.ensureSchema();
    if (cmd === 'invite') {
      const { token } = await auth.createInvite({ role: arg });
      console.log(`Invite for a new ${arg} (one use, valid 7 days): ${joinLink(token)}`);
    } else if (cmd === 'list') {
      const users = await auth.listUsers();
      if (!users.length) console.log('Nobody yet. Run: node users.js invite admin');
      users.forEach(u => console.log(`${u.name} · ${u.role}${u.disabled ? ' · disabled' : ''}`));
    } else if (cmd === 'disable' || cmd === 'enable') {
      const u = (await auth.listUsers()).find(x => x.name.toLowerCase() === String(arg || '').toLowerCase());
      if (!u) throw new Error(`Nobody called "${arg}". Run: node users.js list`);
      await auth.setDisabled(u.id, cmd === 'disable');
      console.log(`${u.name} is ${cmd === 'disable' ? 'disabled and signed out' : 'enabled'}.`);
    } else {
      console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(2, 9).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally { await DB.close(); }
}

if (require.main === module) main();
module.exports = { joinLink };
