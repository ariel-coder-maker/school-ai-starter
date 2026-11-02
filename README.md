# School AI Starter

**Store your school once. Every request after that is one line.**

This is a starter kit for building your school's own AI curriculum assistant.
You set it up once with your calendar, assessment criteria, standards,
resources and house style. After that, any teacher can ask for *"lesson 3 of
my Grade 7 forces unit"* and get something that fits how your school
actually teaches. They don't need a page-long prompt, and the worksheet won't
contradict the unit.

It was built by a science teacher at an IB school, used for a full year of
real teaching, and cleaned of that school's information so you can fill in
your own. It works for **IB MYP** out of the box and for **any other program**
(AP, IGCSE, A Level, national or state curricula) with your own framework.

## Get started

1. **Download this folder.** On GitHub: the green **Code** button →
   **Download ZIP**, then unzip it somewhere you'll find it again. If you're
   using Google Drive, OneDrive or a school network share, put it there so
   colleagues can use it too.
2. **Open the folder in your AI tool** (see the table below).
3. **Type `setup`.** The AI interviews you about your school, one question at
   a time, and builds everything from your answers. Allow about 30 minutes
   for one course.

Filled in the paper setup sheet at a workshop? When setup starts, type your
answers or send it a photo of the sheet, and it will only ask what's missing.
The sheet (`workshop/setup_sheet.pdf`, one A4 sheet front and back) and a
two-page guide to how it all works (`workshop/guide.pdf`) are in `workshop/`.

### Opening the folder in your AI tool

| Tool | How |
|---|---|
| **Claude Code** (desktop app) | Code tab → choose this folder → type `setup` |
| **Claude Code** (terminal) | `cd` into the folder, run `claude`, type `setup` |
| **Codex** (OpenAI) | Open the folder in the Codex app, or run `codex` inside it, then type `setup` |
| **Cursor** / **VS Code with Copilot** | File → Open Folder, open the chat in Agent mode, type `setup` |
| **Gemini CLI** | Run `gemini` inside the folder, type `setup` |
| **ChatGPT, Claude or Gemini in a browser** | Works for Level 1 only. Create a Project, upload `START_HERE.md`, `SETUP.md` and `setup/QUESTIONS.md`, and type `setup`. It can't save files, so it shows you each file's contents and you save them into the folder yourself |

Every tool reads its own instruction file (`CLAUDE.md`, `AGENTS.md`,
`GEMINI.md`). All of them point to `START_HERE.md`, so the behavior is the same
whichever you use.

## Three levels: start at 1

| Level | What you get | What you need |
|---|---|---|
| **1 · Folder** | Your school's information in a folder your AI reads. Ask for a unit, lesson, worksheet, slides or rubric; it's built in steps you approve and checked against your rules | An AI tool. Nothing to install |
| **2 · Folder + engine** | Adds a small program on your computer (n8n and a database, run by Docker). It generates in steps, runs every check automatically, tries the cheapest AI model first, logs every cent, and produces finished Word, PowerPoint and PDF files | Docker Desktop, and an API key from at least one AI provider. Setup walks you through both |
| **3 · School-hosted** | The engine on a school server: one school layer, every teacher inherits it | Your IT team. `docs/HOSTING.md` is written for them |

Most people should stay at Level 1 until it has produced something they'd
actually teach.

## The parts: use only what you need

| Folder | What it is | Who fills it |
|---|---|---|
| `00_school/` | Calendar, unit shape, assessment, policies, house style. Entered once | A coordinator or school leader |
| `01_curriculum/` | One folder per subject: criteria, standards, scope and sequence | Each department |
| `02_sources/` | Textbooks and resources you're licensed to use | Each department |
| `03_resources/` | Rooms, equipment, materials, class sizes | Department or lab technician |
| `04_prompts/` | How each thing is made, step by step | Ready to use; improve over time |
| `05_checks/` | The rules every output must pass | Starts with a tested list; you add your own |
| `06_outputs/` | What each teacher has made | Teachers |

A teacher can set up one course alone. A coordinator can set up `00_school/`
once for everyone. A department can use only the lesson materials part. See
`docs/ROLES.md` for where each role starts, and `docs/HOW_IT_WORKS.md` for
how the parts connect.

## What it won't do

- **Invent your criteria, standards or equipment.** These come from documents
  you give it. Anything it drafts stays `UNVERIFIED` until a person checks it,
  and nothing is assessed against an unverified framework.
- **Hold student data.** No names, grades or reports, ever.
- **Publish to students.** A person approves every step.
- **Supply textbooks.** Use only the sources your school is licensed to use.

## Cost

Level 1 runs on whatever AI subscription you already have. A standard plan
(about $20 a month) was enough for one teacher's full load in the school this
was built for. Level 2 can also use pay-as-you-go API keys, cheapest model
first. In that school, a full term of Science across five grades cost about
$6 in API fees.

## Credits

Built by Ariel Dahan, MYP Sciences teacher, and first shared at AIFE Bangkok
2026 in the workshop *Beyond the AI Lesson Plan*.

Questions, problems or ideas: open an issue on
[the kit's GitHub page](https://github.com/ariel-coder-maker/school-ai-starter/issues).

Released under the MIT License (see `LICENSE`): use it, change it and share
it freely, keeping the licence and credit with it.
