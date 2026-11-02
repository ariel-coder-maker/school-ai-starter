# How it works

## The idea in one paragraph

A chatbot only knows what you type into it, so to get a usable lesson you
end up pasting your calendar, criteria, period length and house rules into
every prompt. Then it still gets something wrong. This kit stores all of that
**once**, in files, and makes the AI read them before it writes anything. Your
request can then be one line, and the output fits your school. The AI also
works **in steps you approve**, and **checks its own work against your rules**
before you see it.

## The five layers

```
 1 SCHOOL      00_school/        calendar, unit shape, assessment, policies, style
 2 CURRICULUM  01_curriculum/    criteria, standards, scope and sequence (per subject)
               02_sources/       textbooks and resources you're licensed to use
 3 RESOURCES   03_resources/     rooms, equipment, materials, class sizes
        │
        ▼  read by
 4 GENERATE    04_prompts/       unit → lessons → materials, one step at a time
        │
        ▼  checked by
 5 CHECK       05_checks/        the rules every output must pass
        │
        ▼  approved by a person, then saved to
               06_outputs/<teacher>/
```

**Layers 1–3 are what you know.** They change rarely: the school layer once a
year, the curriculum when a department reworks it, and resources when you buy
something.

**Layers 4–5 are how the AI works.** The prompts say how each thing is made,
and the checks say what "right" means at your school.

## Why steps

A unit is made as **outline → lessons → assessment**, and you approve each
before the next is made. Rejecting an outline takes a minute. Rejecting a
finished 20-lesson unit costs the whole unit. An approval belongs to the
version you approved: if you change the outline later, the lessons built on
it are marked out of date instead of quietly kept.

## Why checks

Every time the AI gets something wrong in a way a rule could catch, the rule
goes into `05_checks/checks.md`. From then on, every output is tested against
it before you see it. The starter list in `05_checks/starter_checks.md` holds
about twenty rules learned from a year of real use. Your list will grow.

The single most useful check: **if you can't state the rule in one sentence,
the AI can't meet it either.**

## What the AI is never allowed to make up

Criteria, strands, standard codes, textbook content and equipment come only
from your files. Anything the AI drafts from a document you gave it is marked
`UNVERIFIED` until a person reads it back. Nothing is assessed against an
unverified framework.

## Level 2: the engine

Level 1 is the folder and your AI tool, and the AI follows the prompts and
checks by reading them. Level 2 adds a program that does the same thing
automatically and at scale:

| Part | What it does, in plain words |
|---|---|
| **Docker** | Runs the other parts on your computer without installing them one by one |
| **n8n** | A visual workflow tool: the "assembly line" that runs each step in order |
| **Postgres** | The database: units, lessons, approvals, materials, costs |
| **Scripts** (`engine/gen/`) | Build each request, check every answer against your rules, and turn approved lessons into Word, PowerPoint and PDF files |
| **Model order** (`engine/config/model_chain.json`) | Which AI models to try, cheapest first. If one is unavailable it moves to the next. If an answer fails a check, it's sent back with the reason; a fail doesn't mean "try a pricier model" |
| **Cost log** | Every call's real token count and cost, so you always know what a unit cost |

You don't need Level 2 to get value from this. Start at Level 1.
