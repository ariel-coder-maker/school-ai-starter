// The model chain: try the cheapest model first, fall through only when a
// provider can't answer.
//
// A step is spent when the provider refuses or can't be reached: no key,
// wrong key, no credit, rate limit, timeout, server error, an empty answer.
// An answer that then FAILS THE CHECKS is not sent to the next model: that
// would be paying for a second opinion nobody asked for. The teacher reads
// it, with its problems listed, and regenerates with feedback.
//
// Every call, successful or not, is logged with its real token counts and
// cost. The engine refuses new calls once this month's spend reaches
// MONTHLY_LIMIT_USD.
'use strict';
const fs = require('fs');
const path = require('path');
const kit = require('./kit.js');
const DB = require('./db.js');

const PROVIDERS = {
  anthropic:  { label: 'Anthropic',     keyEnv: 'ANTHROPIC_API_KEY',  wire: 'anthropic' },
  dashscope:  { label: 'Alibaba Qwen',  keyEnv: 'DASHSCOPE_API_KEY',  wire: 'openai',
                url: () => `${(process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '')}/chat/completions` },
  deepseek:   { label: 'DeepSeek',      keyEnv: 'DEEPSEEK_API_KEY',   wire: 'openai', url: () => 'https://api.deepseek.com/v1/chat/completions' },
  gemini:     { label: 'Google Gemini', keyEnv: 'GEMINI_API_KEY',     wire: 'openai', url: () => 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  nvidia:     { label: 'NVIDIA',        keyEnv: 'NVIDIA_API_KEY',     wire: 'openai', url: () => 'https://integrate.api.nvidia.com/v1/chat/completions' },
  openai:     { label: 'OpenAI',        keyEnv: 'OPENAI_API_KEY',     wire: 'openai', url: () => 'https://api.openai.com/v1/chat/completions' },
  openrouter: { label: 'OpenRouter',    keyEnv: 'OPENROUTER_API_KEY', wire: 'openai', url: () => 'https://openrouter.ai/api/v1/chat/completions' },
  practice:   { label: 'Practice run (no AI, no cost)', keyEnv: null, wire: 'practice' },
};

const CONFIG = path.join(kit.KIT, 'engine', 'config', 'model_chain.json');
const config = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const expand = (s) => String(s || '').replace(/\$\{(\w+)\}/g, (_, v) => process.env[v] || '').trim();

// Every step, with whether it can run and, if not, why. Never shows a key.
// ENGINE_PRACTICE=1 replaces the chain with a practice step that returns a
// worked example, so the whole flow can be tried before any key exists.
function chain() {
  if (process.env.ENGINE_PRACTICE === '1') {
    return [{ position: 1, provider: 'practice', label: PROVIDERS.practice.label, model: 'practice',
      price: { in: 0, out: 0 }, usable: true, why: 'ENGINE_PRACTICE=1 in .env' }];
  }
  return (config().chain || []).map((s, i) => {
    const p = PROVIDERS[s.provider];
    const model = expand(s.model);
    let usable = true; let why = 'ready';
    if (!p) { usable = false; why = `unknown provider "${s.provider}" (known: ${Object.keys(PROVIDERS).join(', ')})`; }
    else if (!model) { usable = false; why = `no model name: set ${String(s.model).replace(/[${}]/g, '')} in engine/.env`; }
    else if (p.keyEnv && !process.env[p.keyEnv]) { usable = false; why = `no key: ${p.keyEnv} is empty in engine/.env`; }
    return { position: i + 1, provider: s.provider, label: p ? p.label : s.provider, model,
      price: s.price_per_m || { in: null, out: null }, usable, why };
  });
}

const costOf = (step, tin, tout) => {
  const { in: pin, out: pout } = step.price || {};
  if (pin == null || pout == null) return { usd: 0, known: false };
  return { usd: (tin * pin + tout * pout) / 1e6, known: true };
};

// Reasoning models sometimes put their thinking in the answer. Keep the answer.
const stripThinking = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

async function callAnthropic(step, req) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const stream = client.messages.stream({
    model: step.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('the model declined this request');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, tokensIn: msg.usage.input_tokens || 0, tokensOut: msg.usage.output_tokens || 0,
    truncated: msg.stop_reason === 'max_tokens' };
}

async function callOpenAIWire(step, req) {
  const p = PROVIDERS[step.provider];
  const res = await fetch(p.url(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[p.keyEnv]}` },
    body: JSON.stringify({
      model: step.model,
      max_tokens: req.maxTokens,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  const body = await res.text();
  if (!res.ok) {
    const plain = { 400: 'the request was refused (often a wrong model name)', 401: 'the key was refused',
      402: 'no credit left', 403: 'the key is not allowed to use this model', 404: 'model not found',
      429: 'rate limit or quota reached' }[res.status] || 'the provider had a problem';
    throw new Error(`${plain} (HTTP ${res.status}): ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
  }
  const j = JSON.parse(body);
  const choice = (j.choices || [])[0] || {};
  return { text: stripThinking(choice.message && choice.message.content),
    tokensIn: (j.usage && j.usage.prompt_tokens) || 0, tokensOut: (j.usage && j.usage.completion_tokens) || 0,
    truncated: choice.finish_reason === 'length' };
}

// A practice answer: the worked example for this kind of step, so the whole
// flow (gates, checks, approval, Word and PowerPoint files) can be tried for free.
function callPractice(step, req) {
  const f = path.join(__dirname, '..', 'practice', `${req.kind}.md`);
  const text = fs.existsSync(f) ? fs.readFileSync(f, 'utf8')
    : `# Practice ${req.kind}\nStatus: DRAFT\n\nNo worked example exists for "${req.kind}" yet.`;
  return { text, tokensIn: 0, tokensOut: 0 };
}

async function callOne(step, req) {
  const wire = PROVIDERS[step.provider].wire;
  if (wire === 'practice') return callPractice(step, req);
  if (wire === 'anthropic') return callAnthropic(step, req);
  return callOpenAIWire(step, req);
}

// Call down the chain until one provider answers. Returns the answer, the model
// that gave it, its cost, and every step tried.
async function callChain(req) {
  const limit = Number(process.env.MONTHLY_LIMIT_USD || 0);
  if (limit > 0) {
    const spent = await DB.monthSpend();
    if (spent.usd >= limit) {
      throw new Error(`This month's AI spending ($${spent.usd.toFixed(2)}) has reached MONTHLY_LIMIT_USD ($${limit}). `
        + 'Raise it in engine/.env if the budget holder agrees, then restart the engine.');
    }
  }
  const steps = chain();
  const tried = [];
  const maxTokens = req.maxTokens || config().max_tokens || 32000;
  for (const step of steps) {
    if (!step.usable) { tried.push({ model: step.model || step.provider, skipped: step.why }); continue; }
    try {
      const out = await callOne(step, { ...req, maxTokens });
      if (!out.text || !out.text.trim()) throw new Error('the answer was empty');
      const cost = costOf(step, out.tokensIn, out.tokensOut);
      await DB.logCall({ kind: req.kind, target: req.target, provider: step.provider, model: step.model,
        tokensIn: out.tokensIn, tokensOut: out.tokensOut, cost: cost.usd, ok: true,
        note: [cost.known ? null : 'price unknown: add it to model_chain.json', out.truncated ? 'answer cut off at max_tokens' : null].filter(Boolean).join('; ') || null });
      tried.push({ model: step.model, answered: true });
      return { text: out.text, provider: step.provider, model: step.model, tokensIn: out.tokensIn,
        tokensOut: out.tokensOut, cost: cost.usd, priceKnown: cost.known, truncated: !!out.truncated, tried };
    } catch (e) {
      const why = String(e && e.message || e).slice(0, 300);
      tried.push({ model: step.model, failed: why });
      await DB.logCall({ kind: req.kind, target: req.target, provider: step.provider, model: step.model, ok: false, note: why });
    }
  }
  const lines = tried.map(t => `  ${t.model}: ${t.skipped || t.failed}`).join('\n');
  throw new Error(`No AI model could answer. What each one said:\n${lines}\n`
    + 'Add a key to engine/.env (see engine/PROVIDERS.md), or set ENGINE_PRACTICE=1 to try the flow for free.');
}

module.exports = { PROVIDERS, chain, callChain, config };
