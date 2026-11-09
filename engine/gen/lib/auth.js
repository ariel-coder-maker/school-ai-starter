// Accounts, invites, sessions and classes.
//
// People join only by invite link: the admin's link comes from first_run.js,
// teachers' links from the admin. A link works once and expires. Passwords are
// stored scrypt-hashed; tokens are stored only as their sha256, so a copy of
// the database can't be used to sign in. Accounts and classes live in the
// database, never in the kit folder, which a school may share.
'use strict';
const crypto = require('crypto');
const DB = require('./db.js');
const kit = require('./kit.js');
const { Refused } = require('../step.js');

const SESSION_COOKIE = 'kit_session';
const SESSION_HOURS = 12;
const MIN_PASSWORD = 10;
const BAD_LOGIN = "That name and password don't match.";
const BAD_INVITE = 'This invite link has expired or was already used. Ask your school admin for a new one.';

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(plain, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = crypto.scryptSync(String(plain), Buffer.from(salt, 'base64'), want.length);
  return crypto.timingSafeEqual(got, want);
}

const tokenHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

async function createInvite({ role, createdBy = null, days = 7 }) {
  if (!['admin', 'teacher'].includes(role)) throw new Refused('An invite is for an admin or a teacher.');
  const token = newToken();
  await DB.db().query(
    `insert into invites (token_hash, role, created_by, expires_at) values ($1, $2, $3, now() + make_interval(days => $4))`,
    [tokenHash(token), role, createdBy, days]);
  return { token };
}

async function checkInvite(token) {
  const { rows } = await DB.db().query(
    'select role from invites where token_hash = $1 and used_at is null and expires_at > now()', [tokenHash(token)]);
  return rows[0] ? { role: rows[0].role } : null;
}

async function acceptInvite(token, { name, password }) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 60) throw new Refused('Your name must be 2 to 60 characters.');
  if (String(password || '').length < MIN_PASSWORD) throw new Refused(`Your password must be at least ${MIN_PASSWORD} characters.`);
  if (!(await checkInvite(token))) throw new Refused(BAD_INVITE);
  const taken = await DB.db().query('select 1 from users where lower(name) = lower($1)', [clean]);
  if (taken.rows.length) throw new Refused(`The name "${clean}" is already taken. Add a surname or initial.`);
  const client = await DB.db().connect();
  try {
    await client.query('begin');
    const claimed = await client.query(
      `update invites set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning id, role`,
      [tokenHash(token)]);
    if (!claimed.rows.length) throw new Refused(BAD_INVITE);
    const user = await client.query(
      `insert into users (name, role, password_hash, folder) values ($1, $2, $3, 'pending_' || md5(random()::text))
       returning id, name, role`,
      [clean, claimed.rows[0].role, hashPassword(password)]);
    const u = user.rows[0];
    // The folder is the name's slug when that's free; otherwise (a look-alike
    // name, or a name with no Latin letters) it gets the account's number.
    const base = kit.slug(clean);
    const free = base && !(await client.query('select 1 from users where folder = $1', [base])).rows.length;
    u.folder = free ? base : base ? `${base}_${u.id}` : `teacher_${u.id}`;
    await client.query('update users set folder = $1 where id = $2', [u.folder, u.id]);
    await client.query('update invites set used_by = $1 where id = $2', [u.id, claimed.rows[0].id]);
    await client.query('commit');
    return u;
  } catch (e) {
    await client.query('rollback');
    if (e.code === '23505') throw new Refused(`The name "${clean}" is already taken. Add a surname or initial.`);
    throw e;
  } finally { client.release(); }
}

async function login(name, password) {
  const { rows } = await DB.db().query(
    'select id, name, role, folder, password_hash, disabled from users where lower(name) = lower($1)', [String(name || '').trim().replace(/\s+/g, ' ')]);
  const u = rows[0];
  if (!u || u.disabled || !verifyPassword(password, u.password_hash)) throw new Refused(BAD_LOGIN);
  const token = newToken();
  await DB.db().query(
    `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(hours => $3))`,
    [tokenHash(token), u.id, SESSION_HOURS]);
  return { token, user: { id: u.id, name: u.name, role: u.role, folder: u.folder } };
}

async function userFromToken(token) {
  if (!token) return null;
  const { rows } = await DB.db().query(
    `select u.id, u.name, u.role, u.folder from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and not u.disabled`, [tokenHash(token)]);
  return rows[0] || null;
}

async function logout(token) {
  await DB.db().query('delete from sessions where token_hash = $1', [tokenHash(token)]);
}

async function countUsers(role) {
  const { rows } = await DB.db().query('select count(*)::int as n from users where role = $1 and not disabled', [role]);
  return rows[0].n;
}

async function listUsers() {
  const { rows } = await DB.db().query('select id, name, role, disabled, created_at from users order by role, name');
  return rows;
}

async function setDisabled(id, disabled) {
  await DB.db().query('update users set disabled = $2 where id = $1', [id, !!disabled]);
  if (disabled) await DB.db().query('delete from sessions where user_id = $1', [id]);
}

async function listClasses(userId) {
  const { rows } = await DB.db().query(
    'select id, subject, grade, term, label from classes where user_id = $1 order by label', [userId]);
  return rows;
}

async function addClass(userId, { subject, grade, term, label }) {
  if (!subject || !grade || !label) throw new Refused('A class needs a subject, a grade and a name.');
  const { rows } = await DB.db().query(
    'insert into classes (user_id, subject, grade, term, label) values ($1, $2, $3, $4, $5) returning id, subject, grade, term, label',
    [userId, String(subject), String(grade), term ? Number(term) : null, String(label)]);
  return rows[0];
}

async function deleteClass(userId, id) {
  await DB.db().query('delete from classes where id = $1 and user_id = $2', [id, userId]);
}

module.exports = {
  SESSION_COOKIE, SESSION_HOURS, MIN_PASSWORD,
  hashPassword, verifyPassword, tokenHash,
  createInvite, checkInvite, acceptInvite, login, userFromToken, logout,
  countUsers, listUsers, setDisabled, listClasses, addClass, deleteClass,
};
