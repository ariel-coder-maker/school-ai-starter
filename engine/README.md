# The engine (Level 2)

The same rules as Level 1, enforced by a program instead of trusted to an AI
tool. It reads the kit folder, makes one step at a time with the cheapest
model that answers, checks every output, waits for a person's approval, logs
every cent, and makes the Word and PowerPoint files.

**Setting it up:** type `setup` in your AI tool and choose Level 2. It walks
you through Docker, keys and the first run (`SETUP.md`, Step 3).

## What's here

| Path | What it is |
|---|---|
| `docker-compose.yml` | The three parts: database, engine, n8n |
| `.env.example` | Copy to `.env` and fill in yourself: keys, monthly limit, ports |
| `PROVIDERS.md` | Where to get each AI key, and what it costs |
| `config/model_chain.json` | The order models are tried in, cheapest first, with prices |
| `gen/step.js` | Makes one step: outline, sequence, assessment, rubric, lesson, worksheet, slides, order list |
| `gen/approve.js` | Approves a file, as a person; makes its Word or PowerPoint file |
| `gen/check.js` | Runs the automatic checks on any file, including ones made by hand |
| `gen/status.js` | Where everything stands, and this month's spend |
| `gen/chain.js` | Which AI models will run, and why the others won't |
| `gen/first_run.js` | Run once after the first start |
| `gen/server.js` | The teacher app on http://localhost:3000 (sign-in required), and an internal port (3001, never published) that n8n calls |
| `gen/public/` | The teacher app: sign-in, my classes, units, lessons, files, admin |
| `gen/lib/auth.js`, `gen/users.js` | Accounts, invite links and sessions; `node users.js invite teacher` |
| `gen/school.js` | Reading and editing the school layer from the Admin page, keeping earlier versions |
| `gen/test/` | Unit tests: `node --test test/*.test.js` |
| `test/publish_audit.py` | Scans every file and commit for keys, emails and school data before anything is published |
| `gen/lib/` | Reading the kit folder, the database, the model chain, the checks |
| `gen/practice/` | Worked examples, returned instead of AI answers when `ENGINE_PRACTICE=1` |
| `workflows/teacher_form.json` | An n8n form that makes a step through the engine |
| `test/practice_test.sh` | The whole engine end to end, in practice mode, in a throwaway copy |

## Upgrading from the first version (no sign-in)

The teacher page now needs a sign-in, and n8n now reaches the engine on its
own internal port. After updating the kit folder:

1. Restart: `docker compose -f engine/docker-compose.yml up -d`
2. Make the admin account: `docker compose -f engine/docker-compose.yml exec engine node first_run.js`
   prints a one-use link. The engine also says this at start-up until an admin exists.
3. If you imported the n8n form before, import it again so it uses the new
   address: `docker compose -f engine/docker-compose.yml exec n8n n8n import:workflow --input=/workflows/teacher_form.json`,
   then `docker compose -f engine/docker-compose.yml restart n8n`.

Your units, lessons and approvals are kept.

## Commands

From the kit folder, with the engine running:

```bash
docker compose -f engine/docker-compose.yml exec engine node status.js
```

```bash
docker compose -f engine/docker-compose.yml exec engine node step.js outline --subject science --grade "Grade 7" --term 1 --topic "Forces"
```

```bash
docker compose -f engine/docker-compose.yml exec engine node approve.js 01_curriculum/science/units/grade_7_t1_forces/1_outline.md --by "Your name"
```

Most people never need these: the teacher page does the same.

## The rules it enforces

- **Steps in order.** Outline → sequence → assessment, then lessons, then
  worksheets and slides. Each waits for the steps it builds on to be approved.
- **An approval covers one exact version**, and what it was built on. Change
  an approved file, and everything built on it, however far down, reads
  *out of date* and can't be approved until it's remade.
- **Nothing assessed without a verified framework.**
- **Checks before anyone sees it.** A failed check is listed on the output,
  never quietly retried on a dearer model.
- **A monthly spending limit.** New calls are refused once it's reached.
- **Sign-in by invite only.** The admin's link comes from `first_run.js`;
  teachers' links from the admin. Approvals are recorded in the signed-in
  person's name.
- **The teacher page is for this computer only** until it's behind the proxy
  or VPN in `docs/HOSTING.md`.
