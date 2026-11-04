// Which AI models will run, in order, and why the others won't. Never prints a key.
//
//   node chain.js            the order, and what can run
//   node chain.js --check    also ask each provider whether the key works and
//                            the model name still exists (free: no AI call)
'use strict';
const models = require('./lib/models.js');

// The provider's own list of model names, or why it couldn't be read.
async function modelList(step) {
  const p = models.PROVIDERS[step.provider];
  if (!p || p.wire === 'practice') return { skip: true };
  const key = process.env[p.keyEnv];
  const url = p.wire === 'anthropic' ? 'https://api.anthropic.com/v1/models?limit=1000'
    : p.url().replace(/\/chat\/completions$/, '/models');
  const headers = p.wire === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${key}` };
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (r.status === 401 || r.status === 403) return { error: 'the key was refused: check it, or make a new one' };
    if (!r.ok) return { error: `could not read the model list (HTTP ${r.status})` };
    const j = await r.json();
    return { ids: (j.data || []).map(m => String(m.id || '').replace(/^models\//, '')) };
  } catch (e) { return { error: `could not reach the provider: ${e.message}` }; }
}

async function main() {
  const check = process.argv.includes('--check');
  const steps = models.chain();
  for (const s of steps) {
    const price = s.price.in == null ? 'price not set' : s.price.in === 0 && s.price.out === 0 ? 'free' : `$${s.price.in} / $${s.price.out} per million`;
    let note = s.usable ? '' : s.why;
    if (check && s.usable) {
      const l = await modelList(s);
      if (l.error) note = `✗ ${l.error}`;
      else if (l.ids && !l.ids.includes(s.model)) {
        const stem = s.model.split(/[-.]/)[0];
        const like = l.ids.filter(id => id.startsWith(stem)).slice(0, 6);
        note = `✗ "${s.model}" is not offered any more${like.length ? `. Similar: ${like.join(', ')}` : ''}`;
      } else if (l.ids) note = '✓ key works, model exists';
    }
    console.log(`${s.usable ? '✓' : '·'} ${String(s.position).padStart(2)}. ${(s.model || '(no model)').padEnd(22)} ${s.label.padEnd(15)} ${price.padEnd(26)} ${note}`);
  }
  const live = steps.filter(s => s.usable);
  console.log(live.length
    ? `\n${live.length} model(s) ready. The engine tries them in this order: ${live.map(s => s.model).join(' → ')}.`
    : '\nNo model can run yet. Add at least one key to engine/.env (engine/PROVIDERS.md says where to get one),\nor set ENGINE_PRACTICE=1 to try everything for free with worked examples.');
  if (!check && live.length) console.log('To check each key and model name with the providers (free): node chain.js --check');
}

main();
