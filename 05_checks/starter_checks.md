# Starter checks

Every output is checked against these before a person sees it. Setup copies
this file to `checks.md` and puts the school's own rule (question D3) at the
top. Delete a check that doesn't apply; add one every time something goes
wrong.

Each check is one sentence a person or an AI can test with a yes or no.
These come from a year of real use in one school. Every one is here because
its absence caused a real problem.

## Shape

- [ ] The unit has exactly the number of lessons in `00_school/calendar.md` (B4). A plan with the wrong count is **rejected and redone**, not patched.
- [ ] Every lesson's timings add up to the **taught** minutes (B3), not the timetabled minutes.
- [ ] Every summative finishes by the date or week in B4.
- [ ] Lessons right after a summative are low-load for the teacher, who is grading: no new equipment, and no new idea a later lesson depends on.

## Alignment

- [ ] Every assessed question names the criterion and strand it assesses, using codes that exist in the subject's `framework.md`.
- [ ] Every standard code exists in the subject's `standards.md`. None are invented.
- [ ] Before each summative, students have practised **every** strand it assesses in at least one earlier formative task.
- [ ] A formative task that practises a criterion covers **all** of that criterion's strands, not just the last ones.

## Assessment

- [ ] The rubric describes only what each question asked. A complete answer to the task reaches the top band, and nothing beyond the task is required.
- [ ] Each student produces their own data or answer when the task is graded individually. No shared group data in an individual summative.
- [ ] Nothing is assessed if the subject's `framework.md` is `UNVERIFIED` or `TODO`.

## Learning

- [ ] Every lesson objective is observable: "explain", "calculate", "design", never "understand" or "know".
- [ ] Every lesson ends with a way to check who learned it.
- [ ] Worked examples ("I do / we do") use different items from the ones the main task tests.
- [ ] Stretch for strong students is part of the required work, not an optional extra.
- [ ] If students are learning in an additional language (A10), every lesson has a short word bank and sentence frames.
- [ ] Reading level and spelling match `00_school/house_style.md`.

## Resources

- [ ] Every piece of equipment and every material is listed in `03_resources/` or on the term's order list. Nothing is invented, and nothing that can't be bought locally is used.
- [ ] Every practical has safety notes and a set-up list someone else could follow.
- [ ] Group sizes and equipment counts fit the class size and maximum groups (C9).

## Sources

- [ ] Every fact, figure or diagram taken from a source names it, and the source is in `02_sources/` or is general knowledge.
- [ ] Every link and video is named and has been opened and checked. No made-up links.

## Planner

- [ ] Every required field from `00_school/assessment.md` (B6) is filled. A planner with an empty required field is not usable.

## Privacy

- [ ] No student names, grades, photos or personal details anywhere.
