# Make a rubric

**Typed:** `make a rubric` · **Needs:** an approved assessment (unit step 3)
and a **verified** `framework.md` · **Saves to:** `<unit folder>/3_rubric.md`

If the subject's `framework.md` is `UNVERIFIED` or `TODO`, stop. Say that a
rubric needs checked criteria, and offer to help verify it (`SETUP.md` Step 5).

## Format

One table per criterion assessed:

```markdown
# Rubric · <Unit title> · <Task title>
Status: DRAFT · Built on: 3_assessment.md approved <date>

## Criterion <code>: <name, copied from framework.md>

| Level | Strand <code>: <task-specific: what THIS task asked> | Strand <code> | … |
|---|---|---|---|
| <top band, e.g. 7–8> | | | |
| <e.g. 5–6> | | | |
| <e.g. 3–4> | | | |
| <e.g. 1–2> | | | |
| 0 | Does not reach the standard described by any of the descriptors above. | | |

Assessed by: question(s) <numbers from 3_assessment.md>
```

Use the bands and scale from `00_school/assessment.md` (B5).

## Rules

- **Task-specific.** Each cell describes what *this* task asked, in words a
  student understands, not the generic descriptor reworded.
- **Only what was asked.** A complete, correct answer to the question reaches
  the top band. Nothing beyond the task is required: no "and also discusses…"
  that the task never asked for.
- **Every strand** the assessment lists has a column, and every column
  points to the question that assesses it.
- **Never penalize.** Bands describe what is present at each level, not what
  is missing.
- **Objectives year (IB MYP):** use the objectives year the school set for
  this grade, in `00_school/assessment.md`.

Then run `05_checks/checks.md`, report, and ask for approval.
