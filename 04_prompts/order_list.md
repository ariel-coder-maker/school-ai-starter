# Make the order list

**Typed:** `make the order list` (and which term) · **Needs:** the term's
approved lesson sequences · **Saves to:** `06_outputs/order_lists/<term>.md`
(and `.csv`)

Lists everything a term's approved lessons need that `03_resources/materials.md`
says the school doesn't have, or doesn't have enough of.

## Read first

Every approved `2_sequence.md` and approved lesson for the term,
`03_resources/` (C7–C9), and `00_school/school_profile.md` (A7, for what can
be bought locally).

## Format

```markdown
# Order list · Term <n> · <school year>
Status: DRAFT
Built from: <list of approved units>

| Item | Specification | Quantity needed | Have | To order | Needed by (lesson, week) | Where to buy | Estimated cost |
|---|---|---|---|---|---|---|---|

Total estimated cost: <sum> (budget per term: <C8>)
```

## Rules

- **Quantities from the class**, not guesses: groups (C9) × per-group amount,
  plus about 10% spare for consumables.
- **Have** comes from `03_resources/materials.md`. If the inventory is `TODO`,
  say so, and show everything as "to check".
- **Needed by** is the earliest lesson that uses it, so the person can order
  in time.
- **Where to buy** only if you know it can be bought locally (A7). Otherwise
  write "check locally". Never invent a shop or a price; write "unknown".
- Flag anything **over budget** (C8), and anything that needs special storage
  or handling.

Then ask for approval. An approved order list is the person's to send. The AI
never places an order.
