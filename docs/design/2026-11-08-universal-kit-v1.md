# Universal kit v1 — design

Status: DRAFT for Ariel's approval · 2026-11-08 · nothing is built from this until approved

## 1. Intent

The public repo (`school-ai-starter`) becomes **the universal kit**: a complete,
working starting point for any school's AI curriculum system, whatever its
curriculum. It is modeled on what Ariel's private platform has proven works,
and carries none of that platform's school, teacher, student or textbook data.

It doesn't ship every curriculum ready to use. It ships **a sound starting point
for every part a school needs**, which a teacher or admin fills with their own
school during `setup`.

Only two repos exist on GitHub:

| Repo | Visibility | What it is |
|---|---|---|
| `school-ai-starter` | public | the universal kit (this design) |
| a private repo | **private, never shared** | backup of Ariel's real platform, which otherwise lives only on his laptop |

There is no separate IB edition. **IB is an optional pack inside the same
repo**, loaded only when a school says in setup that it's an IB school. Every
other school gets the curriculum loader instead (part 13): instructions, plus
AI help, for finding and loading its own curriculum's guides. IB must never
interfere with, or confuse, a school that isn't IB (§5.5).

## 2. Goals

1. **Every part has a working starting point**, end to end with the sample
   school: in practice mode (free) and with a real model.
2. **Same results however it's run.** A part gives the same output whether it's
   started from Claude Code or Codex, the teacher page, or n8n (see §4).
3. **Onboarding for both people who start a school:** a school admin, and a new
   teacher the admin invites.
4. **Any curriculum.** Nothing assumes IB, Science, a textbook or a calendar
   shape; all of that comes from the school's own answers. An IB school loads
   the IB pack; any other school loads its own curriculum with the loader, and
   never sees IB terms it didn't ask for.
5. **Nothing sensitive is ever published.** An automatic check runs before every
   push to the public repo and stops it on any finding.

## 3. Non-goals and anti-goals

**Not in v1:** a full IB edition or other curriculum packs; the private
platform's Science-specific validators verbatim; textbook figure extraction;
Toddle or ManageBac API integration (copy-paste export only); language-specific
modules; government reporting; cloud hosting; feedback on photos of handwriting.

**Failure even if it works:**

- school, teacher or student data, or any key, reaches GitHub
- n8n and Claude Code give different results for the same request
- student work goes to an AI provider the school hasn't approved, or is kept
  longer than the school's retention setting
- a teacher can't tell a draft from an approved version

## 4. How every part runs three ways (the parity rule)

- **The logic lives once**, in `engine/gen/` (Node). Prompts stay in
  `04_prompts/`, rules in `05_checks/`. No part has a second copy of its logic
  anywhere.
- The engine exposes **every part as both a command and a web API endpoint**.
- **Claude Code / Codex** run the command (when the engine is running), or, at
  Level 1 with no engine, follow the same prompt files and checks directly.
- **The teacher page** calls the API.
- **n8n** calls the API. Each n8n workflow does what n8n is good at (forms, file
  intake, schedules, approvals, notifications) and hands the work itself to the
  engine. *(My call: if n8n Code nodes re-implemented the logic, the two would
  drift apart, which is the one thing Ariel ruled out.)*
- **Parity is tested.** The practice test runs every part through the command
  and through its n8n workflow and compares the outputs, which are identical in
  practice mode. With a real model, parity means the same prompt, the same
  checks and the same output format; wording differs run to run.
- Level 1 without the engine follows the same prompts and checks, but a
  different AI tool writes it, so it can't be byte-identical. The docs say so.
- **Every part has a prompt file in `04_prompts/`** (new: `library.md`,
  `feedback.md`, `curriculum_loader.md`, `export.md`) and a command in
  `START_HERE.md`, so each one also works at Level 1, from the AI tool alone.

## 5. The parts

Thirteen parts. The five Ariel named are 3, 4, 7, 8 and 10; the others are what
a real school needs around them, all present in some form in the private
platform.

| # | Part | What it does | Modeled on (private platform) | Engine | Teacher page | n8n workflow |
|---|---|---|---|---|---|---|
| 1 | **School setup** (admin onboarding) | The `setup` interview, plus an admin page to view and edit the school layer and to invite teachers | `class_setup.js`, `setup_page.html`, `teacher_invites.js` | `school` | Admin › School | School setup form |
| 2 | **Teacher onboarding** | An invited teacher signs in, adds their classes (subject, grade, term) and gets their folders | `teacher_invites.js`, `teacher_edit.js`, first-run form | `teacher` | First-run page | Teacher onboarding form |
| 3 | **Curriculum development** | Unit outline → sequence → assessment, each approved *(exists)* | `curriculum_step.js`, `stage_gate.js` | `step` | Unit page | Make a step *(exists)* |
| 4 | **Lesson plans** | One lesson from an approved unit *(exists)* | `lesson_dossier.js`, `lesson_design.js` | `step lesson` | Lesson page | Make a step |
| 5 | **Lesson materials** | Worksheet, slides, rubric; Word and PowerPoint *(exists)*; adds teacher notes and a practical set-up sheet where the lesson has a practical | `run_material.js`, render scripts | `step` | Lesson page | Make a step |
| 6 | **Resources and order list** | What a term needs that the school doesn't have *(exists)* | `build_lab_order.js` | `step order_list` | Admin › Resources | Order list |
| 7 | **Classroom library** | Upload a source → text with page numbers → searchable → generation cites the passage and page | `library_upload.js`, `ingest_library.js`, `library_search.js` | `library` | Library tab | Add to library; Search library |
| 8 | **Student feedback** | Anonymized student work + an approved task and rubric → draft feedback per criterion with one next step → teacher edits and approves → export | `grading_tools/` and its feedback rules | `feedback` | Feedback tab | Student feedback (one); Feedback batch (a folder) |
| 9 | **Checks and review** | Automatic checks plus one AI review *(exists)* | the validators | `check` | shown on every output | Check a file |
| 10 | **Teacher UI** | Sign in → my classes → class → unit → lesson; library; feedback; what's waiting for my approval | `ui_server.js` | `server` | — | — |
| 11 | **Admin and health** | Users and roles, keys and model check, spend, backups, status | `status.js`, `model_chain.js` | `admin` | Admin | Weekly status and spend report; Nightly backup; Clear expired student work |
| 12 | **Planner export** | A unit or lesson as the fields the school's planner needs (B6), as CSV and copy-ready text | `lesson_rubric.js` Toddle paste | `export` | Export button | Export to planner |
| 13 | **Curriculum packs and loader** | IB school: load the IB pack. Any other school: find the official guides, then draft the subject's framework and standards from them, each line citing its source, `UNVERIFIED` until a person checks it | `framework.js`, `convert_aero.js`, `load_guide_strands.js`, `frameworks/` | `curriculum` | Admin › Curriculum | Load a curriculum |

### 5.1 Classroom library (part 7)

- Files go in `02_sources/` (never published). PDF, Word and plain text in v1.
- The engine extracts text page by page, splits it into passages and stores them
  with file, page and the subject and grades the teacher tagged.
- **Search works with no extra key** (Postgres full-text search). If the school
  has an embedding-capable key, meaning-based search is used as well. *(My call:
  the private platform needed an embedding provider, which is one of the two
  blockers its own notes name for new subjects.)*
- Generation steps search the library for the lesson's topic and may quote only
  what they found, citing file and page. The existing source check enforces it.
- Copyright: the upload page and docs say *only sources you're licensed to use*.

### 5.2 Student feedback (part 8)

- **Off until the admin turns it on**, after recording the school's policy (B7)
  and choosing which provider may see student work. That list is separate from
  the general model order, and empty by default.
- A **local model** option (any OpenAI-compatible local server, such as Ollama)
  keeps student work on the school's own computer.
- **Anonymized only:** each submission has a student code (for example `7B-04`),
  never a name. The engine removes "Name:" lines and warns when the text looks
  like it contains a name.
- Feedback follows Ariel's proven rules: it is tied to the task's rubric and
  says what was done well, the criterion level it fits, and one next step. It
  never penalizes beyond what the task asked. The teacher approves every piece
  before export.
- Student work lives in `07_student_work/` (never published) and is deleted
  after the school's retention period, 30 days by default, by a scheduled job.

### 5.3 Teacher UI and sign-in (part 10)

- One web app, the shape the private platform settled on: **home with one card
  per class → class → term → unit → lesson**, with the context carried so a
  teacher never retypes it. Library and feedback are tabs.
- **Sign-in with local accounts:** an admin, and teachers the admin invites by
  link. Passwords are stored hashed (scrypt). *(My call. It is admission for a
  school's own computer or network; reaching it from the internet still needs
  the proxy or VPN in `docs/HOSTING.md`.)*
- Every output shows its state (draft, approved, out of date), its checks, the
  model that made it and the cost.

### 5.4 n8n

- One workflow per part (the right-hand column of §5), all importable with one
  command, `engine/n8n_setup.sh`, which also publishes them.
- Scheduled workflows: weekly status and spend report, nightly database backup,
  clearing expired student work.
- No credentials stored in any workflow file. The engine holds the keys.

### 5.5 Curriculum packs, and keeping IB out of the way (part 13)

**The IB pack** (`tracks/ib/`) holds what the IB publishes openly: criteria
names and strand codes for all eight MYP subject groups, the key concepts,
global contexts, ATL skill categories, the unit planner fields, the
objectives-by-year setting, and the IB-style checks (formative practice on every
strand before a summative, task-specific rubrics). It **can't** hold strand
wording from the licensed subject guides; setup asks the school to paste that in
from its own copy.

**Every other school** uses the loader, in one of three ways:

1. **They have the document** (a PDF or web page of the official guide or
   syllabus): the loader extracts the assessment objectives, strands, mark scale
   and standards into `framework.md` and `standards.md`. Every line cites the
   page it came from.
2. **They don't have it to hand:** at Level 1, their AI tool searches the web
   for the official source, using the search instructions in
   `tracks/general/FINDING_YOUR_CURRICULUM.md` (official publishers first, the
   current edition, never a third-party summary), shows what it found, and loads
   it once they confirm. Through the engine and n8n, they paste the official URL
   and the engine fetches that page. *(My call: the engine has no web-search key
   of its own; searching belongs to the AI tool, which already has it.)*
3. **No public source** (a school's own framework): the loader turns their
   description into the same template.

Whichever way, the result stays **`UNVERIFIED`** until a person reads it back,
and nothing assessed is generated before then (the rule the kit already
enforces). The loader respects copyright and site terms: official pages only,
nothing behind a login or paywall.

**IB stays out of the way:**

- The program answer (A8) is the only switch. The IB pack is read **only** when
  A8 says IB; the engine refuses to load any `tracks/ib/` file for a school that
  isn't IB.
- Every prompt in `04_prompts/` is curriculum-neutral. IB words (criteria A–D,
  GRASP, ATL, global context, statement of inquiry) reach a prompt only through
  the school's own files.
- **A check enforces it:** for a school that isn't IB, any IB-only term in an
  output that isn't in the school's own files fails the check. The practice
  test runs one IB sample school and one non-IB sample school side by side.
- Setup asks A8 before anything else about the curriculum, and a non-IB answer
  never shows IB defaults or examples.

### 5.6 Never publishing anything sensitive

- `engine/test/publish_check` scans every file, in every commit, for keys,
  tokens, emails, personal paths, private addresses, and school or student data
  words. It also scans the commit identities. It runs inside the practice test,
  and **must pass before every push** to the public repo.
- Kit users get the same check (`check before sharing`) for their own folder,
  before they share it with anyone.
- New commits in the kit repo already use GitHub's private email alias.

## 6. Constraints

- Node 22, PostgreSQL 16 (pgvector optional), n8n 2.28.6 pinned. One small
  pure-JavaScript PDF text library is the only new dependency.
- Plain language and US spelling in every page, message and document.
- No school, teacher, student or textbook data in the repo, ever. The sample
  school stays fictional.
- Everything works in practice mode with no key, so anyone can try it free.

## 7. Decided by Ariel

- The public repo is the universal kit; the private platform is a backup only;
  no IB edition (2026-11-08).
- The kit includes starting points for the classroom library, student feedback
  and teacher UI, and the parts around them (2026-11-08).
- Every part runs on n8n with the same results as running it from Code or Codex;
  missing workflows are created now (2026-11-08).
- One repo: IB is an optional pack used only when a school says it's IB; every
  other school gets instructions and AI help to load its own curriculum (guides,
  web search, official pages), and IB must never interfere with them
  (2026-11-08).
- MIT licence; no email in the repo (2026-11-02).

## 8. Left to the builder

Page layout and styling, database tables, file names, the CSV columns of the
export, and the fictional sample data for the library and feedback.

## 9. Build order and size

Each part lands with its tests, practice examples, n8n workflow and docs, and is
pushed only after the publish check passes.

1. Teacher UI shell and sign-in (10), with school setup and teacher onboarding (1, 2)
2. Curriculum packs and loader, IB isolation and its check, a second
   (non-IB) sample school (13)
3. Classroom library (7)
4. Student feedback (8)
5. Admin and health, with the scheduled jobs (11)
6. Planner export (12), plus teacher notes and the practical set-up sheet (5)
7. n8n workflow for every part, and the parity test (§4)
8. Publish check (§5.6), full real-model run of every part, docs, push

About seven to nine working sessions. The real-model runs use the cheapest
working model on the sample schools, with a hard cap of US$0.50 in total; every
other test runs in practice mode, at no cost.
