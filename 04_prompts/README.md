# Prompts

How each thing is made. The AI follows these when someone types a `make …`
command (see `START_HERE.md`). The engine (Level 2) uses the same files, so
improving a prompt here improves both.

| File | Typed | Makes |
|---|---|---|
| `unit.md` | `make a unit` | A unit, in three approved steps: outline → lesson sequence → assessment |
| `lesson.md` | `make a lesson` | One lesson plan from an approved unit, timed to the taught minutes |
| `worksheet.md` | `make a worksheet` | The student worksheet for an approved lesson |
| `slides.md` | `make slides` | The slide deck for an approved lesson, with teacher notes |
| `rubric.md` | `make a rubric` | A task-specific rubric for an approved summative |
| `order_list.md` | `make the order list` | What a term's approved lessons need that you don't have |

## Every prompt follows the same pattern

1. **Read first.** `00_school/`, the subject's `01_curriculum/` folder, and
   `03_resources/`. Stop and ask if something needed is `TODO`.
2. **Write in the fixed format** the prompt gives. Fixed headings and tables
   are what let the checks, and the engine, read the work.
3. **Check before showing.** Run `05_checks/checks.md`. Say what passed, and
   fix anything that failed before the person sees it.
4. **Stop for approval.** Save as `DRAFT`. Approved work loses the `DRAFT`
   in its name and gets an "Approved by … on …" line at the top.

## Improving a prompt

When an output is wrong, ask first: **is this a rule?** If yes, it belongs
in `05_checks/checks.md`, where it's tested every time. Only change a prompt
when the AI keeps meeting the rule badly, not when it breaks it.
