# START HERE — for the AI assistant

You are working inside a **school's AI curriculum folder**. The school's
information is stored here once, so a teacher's request can be one line
("make lesson 3 of my Grade 7 forces unit") and what you produce still fits
their calendar, criteria, standards, resources and house style.

Read this file at the start of every session. It is short on purpose.

## What the person can type

| They type | You do |
|---|---|
| `setup`, `get started`, `start` | Follow `SETUP.md` exactly |
| `status` | Read `00_school/setup_log.md` and the folders. Report in under 15 lines: what's set up, what's `TODO`, what's `UNVERIFIED`, what's waiting for approval |
| `explain`, `help`, `what is this` | Explain the folder from `docs/HOW_IT_WORKS.md`, at their level |
| `make a unit` | `04_prompts/unit.md` |
| `make a lesson` | `04_prompts/lesson.md` |
| `make a worksheet`, `make slides`, `make a rubric` | `04_prompts/worksheet.md`, `slides.md`, `rubric.md` |
| `make the order list` | `04_prompts/order_list.md`: everything a term's approved lessons need that `03_resources/` doesn't have |
| `check this` | Run `05_checks/checks.md` on the file they name |
| `add a subject` | `SETUP.md` Step 5 for the new subject |
| `update school` | `SETUP.md` Step 4, showing current answers first |

If `00_school/school_profile.md` doesn't exist yet and they ask for anything
other than `explain`, say that setup comes first (about 30 minutes for one
course) and offer to start it.

## The folder

| Folder | Holds | Changed by |
|---|---|---|
| `00_school/` | calendar, unit shape, assessment, policies, house style | the coordinator, once a year |
| `01_curriculum/<subject>/` | framework and criteria, standards, scope and sequence, constraints | each department |
| `02_sources/` | textbooks and resources the school is licensed to use | each department |
| `03_resources/` | rooms, equipment, materials, class sizes | department or lab technician |
| `04_prompts/` | how each thing is made, step by step | rarely; improved over time |
| `05_checks/` | the rules every output must pass | grows every time something goes wrong |
| `06_outputs/<teacher>/` | what each teacher has made | the teacher |
| `tracks/ib/`, `tracks/general/` | ready-made defaults for IB MYP, and templates for any other program | not edited by the school |
| `engine/` | the optional Level 2 program (n8n, database, scripts) | IT, or a confident teacher |
| `docs/` | how it works, roles, hosting | not edited by the school |

## Rules that always apply

1. **Read before you write.** Before making anything, read `00_school/` and
   the subject's folder in `01_curriculum/`. If something you need is `TODO`,
   say so and ask; don't fill it with a plausible guess.
2. **Never invent what must be real.** Criteria, strands, standard codes,
   textbook content, and equipment come from the files here. If it isn't in a
   file, it doesn't go in the output.
3. **`UNVERIFIED` blocks assessment.** If a subject's `framework.md` is marked
   `UNVERIFIED` or `TODO`, you may make lessons but not summatives or rubrics.
   Say why.
4. **Work in steps, and stop for approval at each one.** A unit is made as
   outline → lessons → assessment, never in one go. An approval belongs to the
   version it approved. If an earlier step changes, later steps are out of
   date. Say so.
5. **Check before you show.** Run `05_checks/checks.md` on everything you make.
   Report what passed. Fix failures first and say what you fixed.
6. **No student personal data.** No names, grades, photos or reports in this
   folder, in prompts, or in outputs. Learning needs are described in general
   terms only.
7. **Keys stay out of the chat.** API keys live only in `engine/.env`, typed by
   the person. Never ask for them, print them, or commit them.
8. **A person approves everything students see.** You prepare; they decide.
9. **Write in the school's style.** Spelling, reading level and tone come from
   `00_school/house_style.md`.

## When something goes wrong

If the person tells you an output was wrong in a way a rule could catch,
offer to add that rule to `05_checks/checks.md` in one sentence. That's how
this folder gets better: every mistake becomes a check, so it happens once.
