// The database: approvals, runs and the cost of every AI call. Nothing about
// the school itself lives here; that is in the kit folder.
'use strict';
const { Pool } = require('pg');

let pool = null;
function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Run the engine with docker compose (see SETUP.md, Step 3).');
  }
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  return pool;
}

const SCHEMA = `
create table if not exists ai_calls (
  id          serial primary key,
  at          timestamptz not null default now(),
  kind        text,
  target      text,
  provider    text,
  model       text,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  cost_usd    numeric(12,6) not null default 0,
  ok          boolean not null,
  note        text
);
create table if not exists approvals (
  id            serial primary key,
  at            timestamptz not null default now(),
  file          text not null,
  content_hash  text not null,
  approved_by   text not null
);
create index if not exists approvals_file on approvals(file);
create table if not exists runs (
  id             serial primary key,
  at             timestamptz not null default now(),
  kind           text not null,
  target         text not null,
  model          text,
  cost_usd       numeric(12,6) not null default 0,
  checks_passed  integer not null default 0,
  checks_failed  integer not null default 0,
  problems       jsonb not null default '[]'
);`;

async function ensureSchema() { await db().query(SCHEMA); }

async function logCall(c) {
  await db().query(
    `insert into ai_calls (kind, target, provider, model, tokens_in, tokens_out, cost_usd, ok, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [c.kind, c.target, c.provider, c.model, c.tokensIn || 0, c.tokensOut || 0, c.cost || 0, !!c.ok, c.note || null]);
}

async function logRun(r) {
  await db().query(
    `insert into runs (kind, target, model, cost_usd, checks_passed, checks_failed, problems)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [r.kind, r.target, r.model, r.cost || 0, r.passed || 0, r.failed || 0, JSON.stringify(r.problems || [])]);
}

async function monthSpend() {
  const { rows } = await db().query(
    `select coalesce(sum(cost_usd),0)::float as usd, count(*)::int as calls
       from ai_calls where at >= date_trunc('month', now())`);
  return rows[0];
}

async function approve(file, hash, by) {
  await db().query('insert into approvals (file, content_hash, approved_by) values ($1,$2,$3)', [file, hash, by]);
}

// The latest approval of a file, or null.
async function approvalOf(file) {
  const { rows } = await db().query(
    'select content_hash, approved_by, at from approvals where file = $1 order by at desc, id desc limit 1', [file]);
  return rows[0] || null;
}

async function spendByModel() {
  const { rows } = await db().query(
    `select model, count(*)::int as calls, sum(tokens_in)::int as tokens_in, sum(tokens_out)::int as tokens_out,
            coalesce(sum(cost_usd),0)::float as usd
       from ai_calls where ok and at >= date_trunc('month', now()) group by model order by usd desc`);
  return rows;
}

async function close() { if (pool) await pool.end(); pool = null; }

module.exports = { db, ensureSchema, logCall, logRun, monthSpend, approve, approvalOf, spendByModel, close };
