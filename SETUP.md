# SETUP — instructions for the AI assistant

> **If you are a person reading this:** you don't need to follow this file
> yourself. Open this folder in your AI tool and type **`setup`**. The AI reads
> this file and walks you through everything. See `README.md` for how to open
> the folder.

---

**To the AI assistant.** The person in front of you typed `setup`, `get
started` or something like it. Your job is to interview them about their
school, one question at a time, save the answers into this folder, and get
them to a first useful output, checked and approved, in one sitting.

The questions are in `setup/QUESTIONS.md`. **Ask them from there, by number.**
Do not invent new questions, and do not skip the "why": when an answer
matters, say in one line what it changes.

## How to behave

1. **One question per message.** Plain language, no jargon. If you must use a
   technical word (terminal, Docker, API key), explain it in the same sentence
   the first time.
2. **"Skip" and "I don't know" are always fine.** Record `TODO` and move on.
   Never fill a gap with a guess that looks like an answer.
3. **Never ask for an API key, password or student's name in the chat.** Keys
   go into a file on their own computer, typed by them (Step 3). If someone
   pastes a key into the chat anyway, tell them to treat it as exposed, cancel
   it on the provider's website and make a new one.
4. **Never write criteria, standards codes or textbook content from memory.**
   They come from a document the person gives you, or from the files already in
   `tracks/`. Anything you draft from a document is marked `UNVERIFIED` until a
   person confirms it.
5. **Save as you go.** Write the answers to the file named in each question's
   "Saved to" column at the end of each Part, and update `00_school/setup_log.md`
   so setup can be resumed. If `setup_log.md` already shows progress, say what
   is done and offer to continue from there.
6. **Show, then confirm.** After each Part, show a short summary of what you
   saved and ask "Anything wrong or missing?" before moving on.
7. **Match their pace.** A person who answered A4 with "never" gets every
   click spelled out. A person who answered "comfortable" gets the commands
   and nothing more.
8. **Use the words of their tool.** Claude Code, Codex, Cursor, ChatGPT and
   Gemini differ in how files are opened and approved. Answer A3 tells you
   which one they're using.

## Step 1 · Welcome

Say this, in your own words, in about this length:

> Welcome. I'll set this up for your school by asking you questions one at a
> time. Most take a few seconds, and you can say "skip" to any of them.
> We'll finish by making one real thing for one of your classes, so you can
> see it working. It takes about 30 minutes for one course.
>
> Did you fill in the paper setup sheet from the workshop? If so, type your
> answers or send me a photo of it, and I'll only ask what's missing.

If they send the sheet, read the answers by code (A1, B4, C2…), fill in what is
there, and read back anything you could not make out. Then continue with the
first question that still has no answer.

## Step 2 · You and your setup (Block A, A1–A6)

Ask A1 to A4. Then **recommend a level** (A5) and say why in one sentence:

| Level | What it is | Recommend it when |
|---|---|---|
| **1 · Folder** | This folder plus your AI tool. Nothing to install. You ask for a unit or lesson, and the AI builds it from your school's files and checks it against your rules | Almost everyone starts here. Always for "just exploring", and always for A4 = "never" |
| **2 · Folder + engine** | Adds a small program on your computer (n8n and a database, run by Docker) that generates in steps, runs every check automatically, falls back to cheaper models, logs costs, and produces finished Word, PowerPoint and PDF files | A4 is "a little" or "comfortable", and they want more than a few lessons a week |
| **3 · School-hosted** | The engine on a school server, so every teacher shares one school layer | A1 is IT or a school leader, **and** Level 1 or 2 has already worked for one course |

Then ask A6 (where the folder lives).

If A1 is "teacher" and `00_school/school_profile.md` is already filled in
(by a coordinator), say so, show a five-line summary of it, ask "Is this
still right?", and skip A7–A10 and Block B.

## Step 3 · Install (only what their level needs)

**Level 1 — nothing to install.** Check that you can read and write files in
this folder: create `00_school/setup_log.md` from `00_school/_templates/setup_log.md`
and say you've done it. If you
can't write files (for example a web chat without file access), explain that
you will show each file's contents and they will save it themselves. Then go
to Step 4.

**Level 2 — the engine.** Go through these one at a time, checking each before
the next. For A4 = "a little", explain what each command does before they
run it.

1. **Docker Desktop.** Explain: *"Docker runs small, self-contained programs
   on your computer without installing them one by one. The engine runs
   inside it."* Download from https://www.docker.com/products/docker-desktop/
   and install. On Windows, accept the WSL 2 option it offers. Open Docker
   Desktop once, and wait until it says it is running.
   Check: `docker --version` and `docker compose version` both print a version.
2. **The key file.** Copy `engine/.env.example` to `engine/.env`. Ask them to
   open `engine/.env` in a text editor themselves. **Do not open it for them
   and do not ask them to paste keys to you.**
3. **At least one AI key** (question D5). For each provider they chose,
   give the sign-up page from `engine/PROVIDERS.md` and the exact line in
   `engine/.env` to paste it after. Say what it costs, using the prices in
   that file. Suggest a free tier first if they have none.
4. **Spending limit** (D6). Tell them to set it on the provider's website as
   well. The engine logs spend, but a limit set with the provider is the one
   that actually stops charges.
5. **Start it:** `docker compose -f engine/docker-compose.yml up -d`
   Check: open http://localhost:5678 in a browser. n8n asks them to create an
   owner account. That account lives only on their computer.
6. **The rest of Block D's engine questions:** ask D7 (where it runs) and D8
   (who looks after it) now, while the engine is in front of them.
7. **First run:** `docker compose -f engine/docker-compose.yml exec engine node first_run.js`
   It creates the database tables and says in plain words what it found and
   what is still missing. The first start takes about a minute while the
   engine installs its libraries.
8. **The teacher page:** open http://localhost:3000 (or the `ENGINE_PORT` they
   chose). That's where they make a step, read its checks, approve it and
   download the Word or PowerPoint file.
9. **The n8n form (optional):** to make steps from an n8n form as well, run
   `docker compose -f engine/docker-compose.yml exec n8n n8n import:workflow --input=/workflows/teacher_form.json`
   and `docker compose -f engine/docker-compose.yml exec n8n n8n publish:workflow --id=MakeAStepForm01`,
   then `docker compose -f engine/docker-compose.yml restart n8n`. The form is at
   http://localhost:5678/form/make-a-step.

**No key yet?** Put `ENGINE_PRACTICE=1` in `engine/.env` and restart the
engine. Every step then returns a worked example instead of calling an AI,
so they can try the whole flow (gates, checks, approval, Word and PowerPoint
files) for free. With the sample school from `examples/sample_school/`, every
step works. Remove the line once a key is in.

If any step fails, read the error and explain it in one or two plain sentences
before suggesting a fix. Never suggest `docker compose down -v`: the `-v`
deletes their data.

**Level 3 — school-hosted.** Don't install anything now. Do Level 1 for one
course first, then hand `docs/HOSTING.md` to whoever looks after the school's
servers (question D8).

## Step 4 · Your school (A7–A10, then Block B)

Ask A7 to B9. Then:

- **A8 decides the track.**
  - **IB MYP:** copy `tracks/ib/school_defaults.md` into `00_school/` as a
    starting point and tell them which answers it already filled (unit shape,
    criteria A–D, each marked 0–8). Ask them only to confirm or change those.
  - **IB DP or PYP:** say plainly that the kit's ready-made pieces are for
    MYP. Their program works on the general track, with their own framework
    file, which you help them write in Step 5.
  - **Anything else:** general track. Copy `tracks/general/school_defaults.md`.
- Write `school_profile.md`, `calendar.md`, `assessment.md`, `policies.md` and
  `house_style.md` from the templates in `00_school/_templates/`. Keep their words.
- **Check the calendar adds up**: terms × learning weeks × lessons per week
  should equal the lessons the units need (B4). If it doesn't, show the sum
  and ask which number is wrong. Don't adjust it yourself.

## Step 5 · Curriculum (Block C, C1–C6)

Ask C1 to C6 for **one subject only**. Then make
`01_curriculum/<subject>/` from `01_curriculum/_template/`.

For C2 (criteria):

- **IB MYP:** copy the subject's file from `tracks/ib/criteria/`. It holds
  the criteria names from the IB's public subject briefs. The strand wording
  (i, ii, iii…) comes from the school's own copy of the subject guide. Ask them
  to paste or upload that page, and mark the file `UNVERIFIED` until they've
  read it back and confirmed it.
- **General track:** ask them for the official document (a PDF, a web page,
  a syllabus). Draft `framework.md` from it using
  `tracks/general/framework_template.md`, quote the page each criterion came
  from, mark it `UNVERIFIED`, and go through it with them line by line.
- **No document available:** say so, leave `framework.md` as `TODO`, and
  explain that nothing assessed can be generated until it exists. Lessons
  without assessment can still be made.

For C5 (sources): only files they are licensed to use. Tell them to put them
in `02_sources/` themselves. Never download a textbook for them.

## Step 6 · Resources (Block C, C7–C10)

Ask C7 to C10. If the subject has no practical work (for example Mathematics
or Language), ask only C7, C9 and C10, and say why you skipped C8.

## Step 7 · First output and its check (Block D, D1–D4)

Ask D1 to D4. Write `05_checks/checks.md` starting from
`05_checks/starter_checks.md`, with their rule (D3) at the top.

Then **make the first thing** (D1), using the matching prompt in `04_prompts/`.
Work in steps, as that prompt says, and stop for their approval at each one.
Before showing the result, run every check in `05_checks/checks.md` against it
and say which passed. If one failed, fix it first and say what you fixed.

Save the result in `06_outputs/<their name or initials>/`.

## Step 8 · Finish

Update `setup_log.md` with every `TODO` left. Then tell them, briefly:

- what is set up, and what is still `TODO` (and who in B9 or D8 owns it)
- what they can type from now on:

| Type | What happens |
|---|---|
| `make a unit` | A unit plan, built in steps you approve |
| `make a lesson` | One lesson, timed to your periods, from an approved unit |
| `make a worksheet` / `make slides` / `make a rubric` | Materials for an approved lesson |
| `check this` | Runs your checks on any file |
| `status` | What's set up, what's missing, what's waiting for approval |
| `add a subject` | Block C again, for a new subject |
| `update school` | Change the school layer (calendar, policies…) |
| `explain` | What each part of this folder does |
| `setup` | Resume or redo setup |

- **One suggestion for next week**: share the folder with one colleague
  (Level 1) or try the engine (if they're on Level 1 and said "a little" or
  "comfortable").
