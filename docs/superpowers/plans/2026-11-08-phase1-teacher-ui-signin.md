# Phase 1 · Teacher UI, sign-in, school setup and teacher onboarding · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-page teacher page with a signed-in teacher app (home → class → unit → file, plus an admin area), with invite-based onboarding for the school admin and teachers. n8n keeps working through an internal port.

**Architecture:** Accounts, invites, sessions and classes live in Postgres (never in the kit folder, which may be shared). `lib/auth.js` owns passwords, sessions and invites; `school.js` owns reading and writing the school layer. `server.js` serves two ports: the public one (sign-in required, published on 127.0.0.1) and an internal one (no sign-in, reachable only from n8n on the Docker network). The browser app is plain HTML and JavaScript with hash routes.

**Tech Stack:** Node 22 (built-in `node:crypto` scrypt, `node:test`), PostgreSQL 16 via `pg`, plain HTML/CSS/JS, n8n 2.28.6. No new dependencies.

**Spec:** `docs/design/2026-11-08-universal-kit-v1.md` (approved 2026-11-08), parts 1, 2 and 10, §4, §5.3.

## Global Constraints

- Node 22, PostgreSQL 16, n8n 2.28.6 pinned. **No new npm dependency in this phase.**
- Plain language and US spelling in every page, message and document.
- No school, teacher, student or textbook data in the repo. Accounts and classes live only in the database.
- Everything works in practice mode (`ENGINE_PRACTICE=1`) with no key.
- The teacher page is published on `127.0.0.1` only. Reaching it from the internet needs the proxy or VPN in `docs/HOSTING.md`.
- Passwords are stored hashed with scrypt, never in plain text, never logged.
- Every output still shows its state, checks, model and cost (unchanged behavior).
- Before any push: run the publish audit (Task 6) and the practice test; push only if both pass.

## Review Focus

1. **A used, expired or made-up invite link** must be refused with a plain message, and must never create an account. Pinned in Task 1 (`acceptInvite rejects a used token`, `…an expired token`).
2. **A teacher calling an admin route** (editing the school layer, inviting, disabling users) must get 403, not a silent success. Pinned in Task 4's practice-test lines.
3. **A disabled user, or one whose session expired,** must be signed out on the next request. Pinned in Task 1 (`userFromToken returns null for a disabled user`, `…an expired session`).
4. **Editing the school layer with a crafted file name** (`../engine/.env`, `_templates/calendar.md`, `x.js`) must be refused. Pinned in Task 3 (`saveSchoolFile refuses names outside 00_school`).
5. **n8n after sign-in exists:** the form must still make a step through the internal port, and the public port must refuse the same request without a session. Pinned in Task 4's practice-test lines.

---

### Task 1: Accounts, invites and sessions

**Files:**
- Modify: `engine/gen/lib/db.js` (schema and queries)
- Create: `engine/gen/lib/auth.js`
- Test: `engine/gen/test/auth.test.js`

**Interfaces:**
- Produces (`lib/db.js`): new tables, and `users` functions used by `auth.js` only.
  - `users(id serial pk, name text unique not null, role text not null check (role in ('admin','teacher')), password_hash text not null, disabled boolean not null default false, created_at timestamptz default now())`
  - `invites(id serial pk, token_hash text unique not null, role text not null, created_by integer, expires_at timestamptz not null, used_at timestamptz, used_by integer)`
  - `sessions(token_hash text pk, user_id integer not null references users(id), expires_at timestamptz not null)`
  - `classes(id serial pk, user_id integer not null references users(id), subject text not null, grade text not null, term integer, label text not null)`
- Produces (`lib/auth.js`), all async except the first three:
  - `hashPassword(plain: string) -> string` in the form `scrypt$<saltB64>$<hashB64>` (16-byte salt, 64-byte key)
  - `verifyPassword(plain: string, stored: string) -> boolean` using `crypto.timingSafeEqual`
  - `tokenHash(token: string) -> string` (sha256 hex)
  - `createInvite({ role, createdBy = null, days = 7 }) -> { token }` — stores only the hash
  - `checkInvite(token) -> { role } | null` (valid, unused, unexpired)
  - `acceptInvite(token, { name, password }) -> user` — single use, atomic; throws `Refused`
  - `login(name, password) -> { token, user }` — throws `Refused('That name and password don't match.')` for any failure, including a disabled user
  - `userFromToken(token) -> { id, name, role } | null`
  - `logout(token) -> void`
  - `countUsers(role) -> number`, `listUsers() -> [{ id, name, role, disabled, created_at }]`, `setDisabled(id, disabled) -> void` (disabling also deletes the user's sessions)
  - `listClasses(userId) -> [{ id, subject, grade, term, label }]`, `addClass(userId, { subject, grade, term, label }) -> class`, `deleteClass(userId, id) -> void` (only the owner's)
  - Constants: `SESSION_COOKIE = 'kit_session'`, `SESSION_HOURS = 12`, `MIN_PASSWORD = 10`
- `Refused` comes from `step.js` (already exported).

- [ ] **Step 1: Write the failing tests** in `engine/gen/test/auth.test.js` with `node:test`, against the real database (tests run inside the engine container, where `DATABASE_URL` is set; each test makes names unique with a random suffix):
  - `hashPassword/verifyPassword round-trip`: `verifyPassword('correct horse battery', hashPassword('correct horse battery')) === true`; wrong password → `false`; two hashes of the same password differ.
  - `acceptInvite creates the user once`: invite (`teacher`) → accept with a 10-character password → `user.role === 'teacher'`; accepting the same token again throws `Refused` matching `/expired or was already used/`.
  - `acceptInvite rejects an expired token`: `createInvite({ role: 'teacher', days: -1 })` → accept throws `/expired or was already used/`.
  - `acceptInvite rejects a short password or a taken name`: 9 characters → `/at least 10 characters/`; an existing name → `/already taken/`.
  - `login and userFromToken`: right password → token; `userFromToken(token).name` matches; wrong password and unknown name both throw the same message `That name and password don't match.`.
  - `userFromToken returns null for a disabled user` (after `setDisabled(id, true)`) and `…for an expired session` (set `expires_at` to the past with a direct query).
  - `classes belong to their owner`: `addClass` for user A; `deleteClass(B.id, thatId)` leaves it; `deleteClass(A.id, thatId)` removes it.

- [ ] **Step 2: Run them to verify they fail**
  Run (from the kit folder, engine running): `docker compose -f engine/docker-compose.yml exec engine node --test test/auth.test.js`
  Expected: FAIL, `Cannot find module '../lib/auth.js'`.

- [ ] **Step 3: Add the four tables to `SCHEMA` in `lib/db.js`** (exact columns above, `create table if not exists`), and **implement `lib/auth.js`** with the interface above. `acceptInvite` claims the invite with one statement: `update invites set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning role`, inside a transaction with the user insert, so two people can't use one link. Tokens are 32 random bytes, base64url.

- [ ] **Step 4: Run the tests to verify they pass**
  Run: `docker compose -f engine/docker-compose.yml exec engine node --test test/auth.test.js`
  Expected: all pass.

- [ ] **Step 5: Commit**
  `git add engine/gen/lib/db.js engine/gen/lib/auth.js engine/gen/test/auth.test.js && git commit -m "Accounts, invites, sessions and classes in the database"`

---

### Task 2: Inviting people from the command line, and the first admin

**Files:**
- Create: `engine/gen/users.js`
- Modify: `engine/gen/first_run.js`
- Test: lines in `engine/test/practice_test.sh` (Task 6)

**Interfaces:**
- Consumes: `auth.createInvite`, `auth.countUsers`, `auth.listUsers`, `auth.setDisabled` (Task 1).
- Produces: `node users.js invite <admin|teacher>` prints exactly one line containing `http://localhost:<ENGINE_PORT_HOST>/#/join/<token>`; `node users.js list` prints one line per user (name, role, disabled); `node users.js disable <name>`. Join link format `#/join/<token>` is used by Task 5's router.

- [ ] **Step 1: Implement `users.js`** with the three commands above (`ENGINE_PORT_HOST` defaults to 3000). Plain-language errors for an unknown command or name.
- [ ] **Step 2: In `first_run.js`,** when `countUsers('admin') === 0`, create an admin invite and print: `Make the admin account: open <link> (valid 7 days, one use).` Otherwise print `✓ <n> admin(s) and <m> teacher(s).`
- [ ] **Step 3: Verify by hand**
  Run: `docker compose -f engine/docker-compose.yml exec engine node first_run.js`
  Expected: the admin link line; running `node users.js invite teacher` prints a different link.
- [ ] **Step 4: Commit**
  `git add engine/gen/users.js engine/gen/first_run.js && git commit -m "Invite links from the command line; first run makes the admin's link"`

---

### Task 3: Reading and editing the school layer

**Files:**
- Create: `engine/gen/school.js`
- Modify: `.gitignore` (add `00_school/.versions/`)
- Test: `engine/gen/test/school.test.js`

**Interfaces:**
- Produces:
  - `SCHOOL_FILES = ['school_profile.md', 'calendar.md', 'assessment.md', 'policies.md', 'house_style.md', 'setup_log.md']`
  - `listSchoolFiles() -> [{ name, text, missing: boolean }]` in `SCHOOL_FILES` order; a missing file returns its template text from `00_school/_templates/` with `missing: true`
  - `saveSchoolFile(name, text, by) -> { name, savedVersion }` — only names in `SCHOOL_FILES`; copies the current file to `00_school/.versions/<name without .md>.<epoch ms>.md` first; appends nothing to the content; throws `Refused` otherwise. Text over 200 KB is refused.

- [ ] **Step 1: Write the failing tests** in `test/school.test.js`. Point `KIT_DIR` at a temporary copy (`fs.mkdtempSync`, copy `00_school/_templates/`) before requiring `lib/kit.js`.
  - `listSchoolFiles returns templates for missing files`: every entry `missing === true` in an empty copy; names equal `SCHOOL_FILES`.
  - `saveSchoolFile writes and keeps the old version`: save `calendar.md` twice; the file holds the second text; `.versions/` holds one file with the first text.
  - `saveSchoolFile refuses names outside 00_school`: each of `'../engine/.env'`, `'_templates/calendar.md'`, `'notes.js'`, `'CALENDAR.md'` throws `Refused` matching `/not a school file/`.
- [ ] **Step 2: Run to verify they fail**
  Run: `docker compose -f engine/docker-compose.yml exec engine node --test test/school.test.js`
  Expected: FAIL, module not found.
- [ ] **Step 3: Implement `school.js`** (module only; no CLI) and add `00_school/.versions/` to `.gitignore`.
- [ ] **Step 4: Run to verify they pass.** Same command. Expected: all pass.
- [ ] **Step 5: Commit**
  `git add engine/gen/school.js engine/gen/test/school.test.js .gitignore && git commit -m "Read and edit the school layer, keeping every earlier version"`

---

### Task 4: The server: sign-in gate, new routes, and the internal port for n8n

**Files:**
- Modify: `engine/gen/server.js`
- Modify: `engine/docker-compose.yml` (engine `ENGINE_INTERNAL_PORT: 3001`, not published)
- Modify: `engine/workflows/teacher_form.json` (URL `http://engine:3001/api/step`)
- Test: lines in `engine/test/practice_test.sh` (Task 6)

**Interfaces:**
- Consumes: Task 1 (`auth.*`), Task 3 (`listSchoolFiles`, `saveSchoolFile`), existing `build(kind, args)`, `approve(file, by)`, `gather()`.
- Produces (public port, JSON in and out; all routes need the `kit_session` cookie unless marked *open*):
  - *open* `GET /`, `GET /app.js`, `GET /style.css`, `GET /health`
  - *open* `POST /api/login {name, password}` → sets cookie (`HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`), returns `{ name, role }`
  - *open* `GET /api/invite/:token` → `{ role }` or 404; *open* `POST /api/join {token, name, password}` → signs in, returns `{ name, role }`
  - `POST /api/logout`, `GET /api/me` → `{ name, role }`
  - `GET /api/classes`, `POST /api/classes {subject, grade, term, label}`, `DELETE /api/classes/:id`
  - `GET /api/school` (any signed-in user), `PUT /api/school/:name {text}` (**admin**)
  - `POST /api/invites {role}` (**admin**) → `{ link }`; `GET /api/users` (**admin**); `POST /api/users/:id/disable {disabled}` (**admin**)
  - existing `GET /api/status`, `/api/chain`, `/api/file`, `/download`, `POST /api/step`, `/api/approve` — now signed-in only; `step` uses the session name as `teacher` when none is given; `approve` always records the session user's name (the body's `by` is ignored).
  - 401 `{error: 'Please sign in.'}` with no or bad session; 403 `{error: 'Only the school admin can do that.'}` for a teacher on an admin route.
  - Any `POST`/`PUT`/`DELETE` without `Content-Type: application/json` → 415 (with SameSite=Strict, this blocks cross-site form posts).
- Produces (internal port 3001, no sign-in, listening on the Docker network only): `POST /api/step`, `POST /api/approve` (body `by` required, recorded as `<by> (via n8n)`), `GET /api/status`, `GET /api/file`, `GET /health`.

- [ ] **Step 1: Restructure `server.js` into a route table** `{ method, path (string or RegExp), open?: bool, admin?: bool, handler(req, url, user, body) }` shared by both ports, with the internal port registering only its five routes. Keep `oneAtATime` around `build` and `approve`.
- [ ] **Step 2: Compose and workflow:** add `ENGINE_INTERNAL_PORT: 3001` to the engine's environment (no `ports` entry for it); change the workflow URL to `http://engine:3001/api/step`.
- [ ] **Step 3: Verify by hand** (engine restarted):
  `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/api/step` → `401`
  `docker compose -f engine/docker-compose.yml exec n8n wget -qO- http://engine:3001/health` → `{"ok":true}`
- [ ] **Step 4: Commit**
  `git add engine/gen/server.js engine/docker-compose.yml engine/workflows/teacher_form.json && git commit -m "Sign-in on the teacher port; an internal port for n8n"`

---

### Task 5: The teacher app

**Files:**
- Replace: `engine/gen/public/index.html` (shell only)
- Create: `engine/gen/public/app.js`, `engine/gen/public/style.css` (styles moved from the old page)

**Interfaces:**
- Consumes: Task 4's routes only.
- Produces: hash routes
  - `#/signin` and `#/join/<token>` (name, password twice; says what the account is for)
  - `#/` **home**: one card per class (label, subject, grade, term); "Add a class" (subject chosen from existing `01_curriculum` subjects via `/api/status`, grade, term, label). No classes → a first-run panel: "Add your classes to start" (this is teacher onboarding). Above the cards, **"Waiting for your approval"**: every draft, changed or out-of-date file in the signed-in teacher's classes and in their `06_outputs/<teacher>/` folder, each a link to `#/file/<path>` (from `/api/status`'s units and lessons, filtered client-side)
  - `#/class/<id>`: the units whose `unit.json` matches the class's subject, grade and term, with each step's state; "Start a new unit" (topic)
  - `#/unit/<subject>/<unit>`: the three steps and rubric with state, checks count and buttons (make, regenerate with what to change, open); lessons list with "Make lesson n" and its worksheet and slides
  - `#/file/<path>`: the viewer (checks list, text without the engine header line, Approve, download after approval)
  - `#/admin` (admins only; others see a plain "for the school admin" note): the school layer files as editable text with Save; Invite a teacher (shows the link to copy); users list with disable; this month's spend and the model order
- Every page shows a draft/approved/out-of-date state in words, not only color. Works at 360 px wide.

- [ ] **Step 1: Build the shell, router, sign-in and join pages**, then sign in through the browser pane with an invited account.
- [ ] **Step 2: Home, classes, the first-run panel and "Waiting for your approval"**; add a class; refresh; it's still there; a draft outline in that class appears in the waiting list and disappears once approved.
- [ ] **Step 3: Class and unit pages**: with the sample school in practice mode, make the outline, approve it, make the sequence, and open it, all from the browser.
- [ ] **Step 4: File viewer and admin page**: edit `calendar.md` from the admin page, save, reload; invite a teacher and open the link in a second browser tab; that teacher sees no admin page.
- [ ] **Step 5: Check it at 360 px wide** (`resize_window` mobile preset) and take a screenshot of home and the unit page.
- [ ] **Step 6: Commit**
  `git add engine/gen/public && git commit -m "Teacher app: sign-in, home, classes, units, files and admin"`

---

### Task 6: Practice test, docs, audit, push

**Files:**
- Modify: `engine/test/practice_test.sh`
- Create: `engine/test/publish_audit.py` (the audit used on 2026-11-08: every file in every commit, plus commit identities; exits 1 on any finding outside the allowlist of placeholders)
- Modify: `SETUP.md` (Step 3: the admin link from `first_run.js`; teachers join by link), `docs/HOSTING.md` (sign-in now exists; still not for the open internet), `engine/README.md` (new files and the two ports), `README.md` (Level 2 line mentions sign-in)

- [ ] **Step 1: Extend the practice test** (keep every existing line passing):
  - `node --test test/` inside the engine container → all pass
  - `users.js invite admin` → join through `POST /api/join` with a curl cookie jar → `GET /api/me` says `admin`
  - no cookie on `POST /api/step` → `401`
  - admin invites a teacher via `POST /api/invites` → teacher joins → teacher on `PUT /api/school/calendar.md` → `403`; admin on the same → `200`
  - a used invite link → `POST /api/join` is refused with `expired or was already used`
  - the n8n form still makes the order list (now through port 3001)
- [ ] **Step 2: Run it**
  Run: `bash engine/test/practice_test.sh`
  Expected: the final line `N passed, 0 failed.`
- [ ] **Step 3: Run the audit on the local repo**
  Run: `python engine/test/publish_audit.py .`
  Expected: `NOTHING FOUND` apart from the commit-identity note for the 5 commits made before 2026-11-08 (pending Ariel's decision on rewriting them).
- [ ] **Step 4: Update the four docs** as listed, plain language.
- [ ] **Step 5: Commit and push**
  `git add -A && git commit -m "Phase 1: sign-in, onboarding and the teacher app; practice test and publish audit"` then `git push` (only if Steps 2 and 3 passed).

---

## Later phases (each gets its own plan when reached)

| Phase | Spec | Delivers |
|---|---|---|
| 2 | part 13, §5.5 | IB pack and curriculum loader; IB isolation and its check; a second, non-IB sample school |
| 3 | part 7, §5.1 | Classroom library: upload, page-numbered passages, full-text search, cited in generation |
| 4 | part 8, §5.2 | Student feedback: off by default, provider allowlist, local model option, anonymized, 30-day retention |
| 5 | part 11 | Admin and health: keys check, spend, backups, status; scheduled jobs |
| 6 | parts 5, 12 | Planner export; teacher notes and practical set-up sheet |
| 7 | §4, §5.4 | An n8n workflow for every part, `n8n_setup.sh`, and the parity test |
| 8 | §5.6 | Publish check in every run, full real-model run of every part (cap US$0.50), docs, release |
