// Which AI models will run, in order, and why the others won't. Never prints a key.
//
//   node chain.js
'use strict';
const models = require('./lib/models.js');

const steps = models.chain();
for (const s of steps) {
  const price = s.price.in == null ? 'price not set' : s.price.in === 0 && s.price.out === 0 ? 'free' : `$${s.price.in} / $${s.price.out} per million`;
  console.log(`${s.usable ? '✓' : '·'} ${String(s.position).padStart(2)}. ${(s.model || '(no model)').padEnd(22)} ${s.label.padEnd(15)} ${price.padEnd(26)} ${s.usable ? '' : s.why}`);
}
const live = steps.filter(s => s.usable);
console.log(live.length
  ? `\n${live.length} model(s) ready. The engine tries them in this order: ${live.map(s => s.model).join(' → ')}.`
  : '\nNo model can run yet. Add at least one key to engine/.env (engine/PROVIDERS.md says where to get one),\nor set ENGINE_PRACTICE=1 to try everything for free with worked examples.');
