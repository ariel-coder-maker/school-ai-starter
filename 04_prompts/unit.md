# Make a unit

**Typed:** `make a unit` · **Saves to:** `01_curriculum/<subject>/units/<grade>_<term>_<short-title>/`

A unit is made in **three steps**. Each stops for the person's approval
before the next starts. Never make two steps in one go: rejecting an outline
costs a minute, rejecting a finished unit costs the unit.

## Before you start

Ask, if not already given: **subject, grade, term, topic.** Then read:

- `00_school/calendar.md`: lessons per unit, taught minutes, when summatives must finish (B3, B4)
- `00_school/assessment.md`: grading scale, required planner fields (B5, B6)
- `01_curriculum/<subject>/framework.md`: criteria and strands (C2)
- `01_curriculum/<subject>/standards.md`, `scope_and_sequence.md`, `constraints.md` (C3, C4, C6)
- `03_resources/`: what the school actually has (C7–C10)
- the approved unit before this one in `scope_and_sequence.md`, if there is one

Refuse to go on, and say why, if the lessons per unit (B4) or taught minutes
(B3) are `TODO`: the shape can't be checked without them.

If `framework.md` is `UNVERIFIED` or `TODO`, you can make steps 1 and 2, but
not step 3. Say so at the start.

## Step 1 · Outline → `1_outline.md`

```markdown
# <Subject> · <Grade> · Term <n> · <Unit title>
Status: DRAFT · Step 1 of 3

## Big ideas
<For IB MYP: key concept, related concepts, global context and exploration,
statement of inquiry. For other programs: the unit's enduring understandings
in the program's own terms.>

## Inquiry questions
| Type | Question |
|---|---|
| Factual | |
| Conceptual | |
| Debatable | |

## What is assessed
| Criterion | Strands | How (summative task in one sentence) |
|---|---|---|

## Standards
| Code | Wording (copied from standards.md) |
|---|---|

## Every required planner field
<One heading per field listed in 00_school/assessment.md (B6). None left empty.>

## Connects to
<What students learned in the previous unit, and what the next unit needs from this one.>

## Questions for the teacher
<Anything you could not decide from the files. Never guess silently.>
```

Every criterion and strand code must exist in `framework.md`, and every
standard code in `standards.md`. Copy them; never paraphrase a code.

## Step 2 · Lesson sequence → `2_sequence.md` (only after step 1 is approved)

One row per lesson, and **exactly** the number of lessons in B4. Not one more
or fewer: a sequence with the wrong count is rejected and redone, never padded
or trimmed afterwards.

```markdown
# <Unit title> · Lesson sequence
Status: DRAFT · Step 2 of 3 · Built on: 1_outline.md approved <date>

| Lesson | Week | Title | Kind | Inquiry question it answers | Criteria and strands practised | Practical / equipment |
|---|---|---|---|---|---|---|
| 1 | 1 | | concept | | | |
```

**Kind** is one of: `concept`, `practice`, `formative`, `summative`,
`low-load`, `reflection`, `flex`.

The sequence must also:

- put summatives where B4 says, and finish them by the date in B4
- give **every strand a summative assesses** formative practice in an earlier lesson
- make each formative task cover **all** strands of the criterion it practises, not just the last ones
- make the lessons right after a summative `low-load`: the teacher is grading, so no new equipment and no new idea a later lesson depends on
- use only equipment listed in `03_resources/`, or mark it `ORDER` so it goes on the order list

## Step 3 · Assessment → `3_assessment.md` (only after step 2 is approved)

```markdown
# <Unit title> · Summative assessment
Status: DRAFT · Step 3 of 3 · Built on: 2_sequence.md approved <date>

## The task
<Written to the students. IB MYP schools using GRASP: goal, role, audience,
situation, product. Other programs: the task in the program's own format.>

## Questions or parts
| # | What students do | Criterion and strand | Minutes |
|---|---|---|---|

## Data or materials each student gets
<If graded individually, each student produces or gets their own data. No
shared group data in an individual task.>

## Where it was practised
| Strand | Practised in lesson(s) |
|---|---|
```

Then offer `make a rubric` for this task (`04_prompts/rubric.md`).

## After each step

Run `05_checks/checks.md`. Report which passed. Fix failures before showing,
and say what you fixed. Then ask: **"Approve this step, or tell me what to change?"**

If the person changes an approved earlier step, mark every later step
`OUT OF DATE: built on an older version of <file>`, and offer to redo it.
