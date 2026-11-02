# Make a lesson

**Typed:** `make a lesson` · **Needs:** an approved unit (all three steps)
· **Saves to:** `06_outputs/<teacher>/<unit>/L<nn>_lesson.md`

## Before you start

Ask which unit and which lesson number. Read the unit's `1_outline.md`,
`2_sequence.md` and `3_assessment.md`, the lesson before this one if it exists,
`00_school/` and `03_resources/`.

If the sequence row for this lesson says `summative`, use the assessment
in `3_assessment.md`. Don't invent a new task.

## The lesson

```markdown
# Lesson <n> · <Title>
Status: DRAFT · Built on: 2_sequence.md approved <date>
Unit: <unit> · <Grade> · Taught minutes: <B3> · Kind: <from the sequence>

## Objective
Students can <observable verb: explain, calculate, design, evaluate…> <what>.
<Never "understand", "know" or "learn about".>

## Inquiry question
<From the sequence row.>

## Bridge
From last lesson: <what students actually did last lesson, in its own words>
Toward the summative: <which strand this builds toward, and how>

## Plan
| # | Section | Minutes | Kind of work | What the teacher does | What students do |
|---|---|---|---|---|---|
| 1 | Hook | | hook | | |

Total: <must equal the taught minutes exactly>

## New words
| Word | Plain explanation | Example | Non-example | Practised in |
|---|---|---|---|---|

## Check for understanding
<How the teacher finds out, before the end, who learned it.>

## Equipment and set-up
<Every item from 03_resources/ (or marked ORDER), quantities for the class
size and groups in C9, set-up steps, safety notes. "None" if none.>

## Differentiation
<Built into the required work. Scaffolds from C10. Word bank and sentence
frames if A10 says students are learning in an additional language.>

## Every required planner field
<One heading per lesson field in 00_school/assessment.md (B6).>
```

**Kind of work** is one of: `hook`, `retrieval`, `bridge`, `explain`,
`i-do`, `we-do`, `practice`, `investigate`, `discuss`, `apply-new-context`,
`evaluate`, `create`, `formative`, `summative`, `self-check`, `exit`.

## Design rules (each of these is a reason to redo a lesson)

1. **Minutes add up** to the taught minutes, not the timetabled ones.
2. **At least three kinds of real work.** Hook, retrieval, bridge, self-check
   and exit don't count. Never the same kind twice in a row.
3. **It builds.** The last working section is the most demanding:
   apply to a new context, evaluate, create, or a formative task. It has a
   question that asks students to explain why, justify or decide.
4. **I do and We do never use the items the main task tests.** Practise on a
   different example.
5. **Every new word** has an explanation, an example, a non-example, and a
   question that practises it.
6. **Stretch is required, not optional.** No "challenge if you finish" extras.
   If the lesson overruns, cut the least essential task.
7. **A formative lesson practises every strand** of its criterion.
8. **Low-load lessons** (the kind right after a summative) need no new
   equipment and introduce nothing a later lesson depends on.

Then run `05_checks/checks.md`, report, and ask for approval. Offer
`make a worksheet` and `make slides` for the approved lesson.
