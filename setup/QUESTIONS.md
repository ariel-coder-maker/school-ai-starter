# The setup questions

This is the one list. `SETUP.md` asks these questions, the printed workshop
sheet has a box for each one, and the files in `00_school/` store the answers.
All three use the **same codes** (A1, B4, C2…). A person who filled in the sheet
can give it to the AI (typed, or as a photo), and setup will read the answers by
code instead of asking again.

The questions come in **four blocks**, and each block takes about four minutes
on paper:

| Block | About | Becomes |
|---|---|---|
| **A** · You and your school | who you are, your setup, the school's program and grades | `00_school/setup_log.md`, `school_profile.md` |
| **B** · Calendar and assessment | terms, periods, unit shape, grading, planners, policies, style | `00_school/` |
| **C** · Curriculum and resources | one subject's criteria, standards, sources; what you actually have | `01_curriculum/<subject>/`, `02_sources/`, `03_resources/` |
| **D** · First output, checks and engine | what to make first, the rule it must pass, who approves; AI keys and budget | `05_checks/`, `engine/` |

**If you change a question here, change it in the sheet and the templates too.**

Each question says:

- **Why** — what the answer changes. A question that changes nothing is not asked.
- **Saved to** — where the answer lives.
- **Who knows** — the person most likely to have the answer.
- **Level** — `all`, or `engine` (only asked at Level 2 and 3).

Nobody has to answer everything. "Skip" and "I don't know yet" are always
allowed. The answer is recorded as `TODO`, and the AI reminds them later instead
of guessing.

---

## Block A · You and your school

A1–A6 are asked first, because they decide which later questions are asked.

| # | Question | Why | Saved to | Who knows | Level |
|---|---|---|---|---|---|
| A1 | What is your role? *(teacher, department head, curriculum coordinator, IT, school leader, other)* | Decides where setup starts and what it skips. A teacher needs one course; a coordinator sets up the school layer for everyone | `00_school/setup_log.md` | you | all |
| A2 | What do you want first? *(one course, one department, the whole school, just exploring)* | Sets the scope. Start small: one course is a good first win, even for a leader | `setup_log.md` | you | all |
| A3 | Which AI tool are you using? *(Claude Code, Codex, Cursor, Copilot, ChatGPT, Gemini, other)* | Setup gives instructions in that tool's words | `setup_log.md` | you | all |
| A4 | Have you used a terminal (command line) before? *(never, a little, comfortable)* | Picks the beginner or fast route. Beginners get every click explained | `setup_log.md` | you | all |
| A5 | Which level? *(1 Folder · 2 Folder + engine · 3 School-hosted)* | Level 1 needs no installing. Level 2 installs Docker and needs API keys. Level 3 is IT's job. Setup recommends one from A1–A4 | `setup_log.md` | you, with setup's advice | all |
| A6 | Where will the folder live? *(this computer, Google Drive, OneDrive, school network)* | A shared folder lets colleagues inherit the school layer. Level 2 needs it on a computer that can run Docker | `setup_log.md` | you or IT | all |
| A7 | School name, city and country *(the name is optional)* | Country decides what can be bought, local examples and holidays. The name only appears on headers | `school_profile.md` | anyone | all |
| A8 | Which program? *(IB MYP / DP / PYP, or name it: AP, IGCSE, A Level, national curriculum, state standards…)* | Picks the track. IB MYP comes with its criteria names; other programs bring their own | `school_profile.md` | coordinator | all |
| A9 | Which grades or year levels are in scope, and what does your school call them? | Every plan is built for a grade. Some schools say "Grade 7", others "Year 8" or "MYP 2" | `school_profile.md` | coordinator | all |
| A10 | Language of instruction, and US or UK spelling? How many students are learning in an additional language? | Sets spelling, reading level, and whether word banks and sentence frames are added to every lesson | `school_profile.md` | coordinator | all |

## Block B · Calendar and assessment → `00_school/`

Entered **once**, by whoever owns it (usually a coordinator). Every teacher's
requests read it, so nobody types it into a prompt again.

| # | Question | Why | Saved to | Who knows | Level |
|---|---|---|---|---|---|
| B1 | School year: number of terms, and the dates of each term | The calendar every unit is planned against | `calendar.md` | school leader | all |
| B2 | How many **learning** weeks per term? *(not counting holidays, exams, trips)* | A 14-week term with 10 learning weeks is planned as 10 | `calendar.md` | school leader | all |
| B3 | Period length: timetabled and actually taught *(e.g. 85 timetabled, 80 taught)*. Lessons per week for the subject | Every lesson is timed to the taught minutes, not the timetable | `calendar.md` | timetabler | all |
| B4 | Unit shape: units per term or year, lessons per unit, and when summatives must be finished | A plan that does not fill exactly this shape is rejected, not patched | `calendar.md` | coordinator | all |
| B5 | Assessment: criteria and grading scale *(e.g. MYP A–D on 0–8, A–F, percentages, IGCSE 9–1)*. What must a rubric look like? | Every summative and rubric is built to this | `assessment.md` | coordinator | all |
| B6 | Which planner platform, and which fields must every plan fill? *(Toddle, ManageBac, Atlas, Google Classroom, none; e.g. ATL skills, global contexts, inquiry questions, differentiation)* | A planner with empty fields cannot be used. Lists exactly what to fill | `assessment.md` | coordinator | all |
| B7 | Policies: homework, student devices, AI use, lab safety, privacy | Generated work follows them, e.g. no homework set for grades that don't get it | `policies.md` | school leader | all |
| B8 | House style: reading level, tone, formatting, anything the AI must never do | Turns "it doesn't sound like us" into rules the checks can test | `house_style.md` | coordinator | all |
| B9 | Who owns this layer and updates it each year? | A school layer nobody owns goes stale, and every plan built on it does too | `school_profile.md` | school leader | all |

## Block C · Curriculum and resources → `01_curriculum/`, `02_sources/`, `03_resources/`

**One subject first.** Add the others later with `add a subject`. C7–C10 are
what you **actually have**: the AI may not plan an activity that needs
something that isn't listed.

| # | Question | Why | Saved to | Who knows | Level |
|---|---|---|---|---|---|
| C1 | Which subject first? Which grades of it? | One subject done properly beats eight done halfway | `01_curriculum/<subject>/` | you | all |
| C2 | Assessment criteria for this subject | **IB MYP:** criteria names for all eight subject groups are included, from the IB's public subject briefs; the strand wording comes from your licensed subject guide. **Other programs:** give the AI the official document and it drafts the file. Either way, a person confirms it before anything assessed is generated. The AI never writes criteria from memory | `01_curriculum/<subject>/framework.md` | department head | all |
| C3 | Which standards do you align to? *(NGSS, Common Core, AERO, a national or state framework, none)* | Each unit and lesson is tagged to real standard codes from your file, never invented ones | `01_curriculum/<subject>/standards.md` | coordinator | all |
| C4 | Do you already have a scope and sequence or unit plans? Where are they? | The AI builds on what you teach instead of starting from nothing | `01_curriculum/<subject>/scope_and_sequence.md` | department head | all |
| C5 | Textbooks and approved sources: titles and editions. Can you supply files you are licensed to use? | Content and citations come only from sources you are allowed to use | `02_sources/` | department head | all |
| C6 | Content constraints: topics to avoid, cultural or religious considerations, local context to include | Avoids content that can't be taught at your school; adds local examples students recognize | `01_curriculum/<subject>/constraints.md` | department head | all |
| C7 | Rooms and equipment: labs, makerspace, studios, projector, devices per student | A lesson needing a fume hood is useless in a room without one | `03_resources/rooms_and_equipment.md` | department head | all |
| C8 | Materials: an inventory if you have one. What can be bought locally? Budget per term? | Practicals are chosen from what exists or can be bought. Produces an order list per term | `03_resources/materials.md` | lab technician / department head | all |
| C9 | Typical class size, and the most groups you can run at once | Sets group sizes and how many sets of equipment to prepare | `03_resources/classes.md` | teacher | all |
| C10 | Learning support the materials should build in *(general needs only, never student names)* | Adds scaffolds every lesson can use | `03_resources/classes.md` | learning support | all |

## Block D · First output, checks and engine → `05_checks/`, `engine/`

D5–D8 are for Level 2 and 3 only. **Never write an API key on paper or in a
chat.** Setup tells you which file to type each key into, on your own computer.

| # | Question | Why | Saved to | Who knows | Level |
|---|---|---|---|---|---|
| D1 | What should it make first? *(unit plan, one lesson, worksheet, slides, rubric)* | The first win. Small and frequent beats big and rare | `setup_log.md` | you | all |
| D2 | Which file types? *(Google Docs / Word, Slides / PowerPoint, PDF, plain text)* | Output is delivered in the format you'll actually open | `school_profile.md` | you | all |
| D3 | One rule every output must pass. *(e.g. "every lesson fills exactly 80 minutes", "every question names its criterion")* Then any others | Rules become checks. A failed check sends the work back before you see it. If you can't state the rule in one sentence, the AI can't meet it | `05_checks/checks.md` | you | all |
| D4 | Who approves each step before students see it? | Nothing reaches students without a person's approval | `school_profile.md` | coordinator | all |
| D5 | Which AI providers do you have, or can you get, keys for? *(Anthropic, OpenAI, Google Gemini, DeepSeek, Qwen, NVIDIA free tier, OpenRouter)* | The engine needs at least one. Setup shows where to get each | `engine/.env` (keys, typed by you) | IT or you | engine |
| D6 | A monthly spending limit, and should the cheapest model be tried first? | The engine tries the cheapest model first and only moves on when one is unavailable. Costs are logged on every call | `engine/config/model_chain.json` | budget holder | engine |
| D7 | Where will it run? *(your laptop, a school server, a cloud machine)* | A laptop is fine for one teacher. Several teachers need a machine that stays on | `setup_log.md` | IT | engine |
| D8 | Who looks after it: updates, backups, keys? | An engine nobody maintains stops working quietly | `setup_log.md` | IT | engine |
