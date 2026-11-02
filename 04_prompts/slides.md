# Make slides

**Typed:** `make slides` · **Needs:** an approved lesson (and ideally its worksheet)
· **Saves to:** `06_outputs/<teacher>/<unit>/L<nn>_slides.md` (and `.pptx` at Level 2)

Slides teach. They are not the worksheet on a screen. Students should never
be able to answer a worksheet question by copying a slide.

## Format

One block per slide:

```markdown
---
## Slide <n> · <purpose> · <section from the lesson plan>
<On-screen text: short. A heading and at most five short lines, or one
figure with a caption.>

Figure: <what it shows, and its source from 02_sources/, or "none">

Teacher note: <what the teacher says and asks, 80 words or more on any
teaching slide. The talk goes here, not on the slide.>
```

**Purpose** is one of: `agenda`, `hook`, `retrieval`, `bridge`, `explain`,
`i-do`, `we-do`, `check` (a quick question for the class), `practice`,
`instructions`, `summary`, `exit`.

## Rules

- **Follow the lesson plan** section by section. Every section has at least
  one slide, and the slides' timing matches the plan.
- **A teaching deck has at least:** agenda, hook, one `explain`, one `i-do`,
  one `we-do`, one `check`, the practice instructions, a summary and an exit.
- **Scaffold, don't announce.** An `explain` slide shows a worked step or a
  picture, not the rule in different words. `i-do` models the thinking aloud.
  `we-do` hands part of it to the class.
- **New words** are taught on an `explain` slide with an example and a
  non-example, not first met on a `check` slide.
- **Readable from the back:** large text, never more than about 40 words on a
  slide; long tables split across slides. Every figure is named and sourced.
- **No invented links or videos.** A video or simulation is named with its
  real address, and a person must open it before it's used.

Then run `05_checks/checks.md`, report, and ask for approval.
