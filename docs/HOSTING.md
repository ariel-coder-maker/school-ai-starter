# Hosting the engine for a school (Level 3)

**For whoever looks after the school's servers (question D8).** Do Level 1,
and ideally Level 2 on one laptop, for one course first. Host it for everyone
only once it has made something a teacher actually taught.

## What runs

Three containers, defined in `engine/docker-compose.yml`:

| Container | What it is | Holds |
|---|---|---|
| `postgres` | PostgreSQL 16 | approvals, runs and the cost of every AI call (volume `postgres_data`) |
| `engine` | Node 22 running `engine/gen/` | nothing of its own; reads and writes the kit folder mounted at `/kit` |
| `n8n` | n8n 2.28.6 | its own accounts and workflows (volume `n8n_data`) |

The **kit folder** is the school's real data: `00_school/` to `06_outputs/`.
It's plain files, so back it up and version it like any shared drive.

A small machine is enough: 2 CPU cores, 4 GB RAM, 10 GB disk. The AI runs at
the providers, not on your server.

## Where to run it

| Option | Good for | Watch out for |
|---|---|---|
| A school server or NAS with Docker | Most schools | Make sure it stays on during school hours |
| A small cloud machine | Schools without on-site servers | The kit folder then lives in the cloud: check your data policy |
| One teacher's laptop | A pilot | Only that teacher can use the teacher page |

## Before anyone else can reach it: sign-in

**The engine's teacher page has no sign-in.** That's why `docker-compose.yml`
publishes it on `127.0.0.1` only. Before you open it to the school network:

1. Put it behind a reverse proxy that requires sign-in. For example, Caddy
   or nginx with your school's single sign-on (through `oauth2-proxy`), or at
   minimum basic authentication over HTTPS.
2. Or reach it only over a VPN (for example Tailscale or WireGuard) that
   staff already use.
3. Only then change `127.0.0.1:` in the `ports` lines to the address the
   proxy reaches it on.

n8n has its own sign-in: the first person to open it creates the owner
account. Create accounts for colleagues from n8n's settings.

## Keys and spending

- Keys live only in `engine/.env` on the server. Make it readable by the
  service account alone (`chmod 600` on Linux).
- Name one budget holder (question D6). They set `MONTHLY_LIMIT_USD` and a
  matching limit on every provider's website. The provider's limit is the one
  that actually stops charges.
- Use only the providers your school's policy allows. Remove the others from
  `engine/config/model_chain.json`.
- Spend is logged per call: `docker compose -f engine/docker-compose.yml exec engine node status.js`.

## Privacy

- **No student data goes in the kit folder.** Not names, grades, reports or
  photos. Learning needs are written in general terms only.
- The AI providers receive the school layer, curriculum files and the
  request. Check each provider's data terms (training, retention, region)
  against your school's policy before adding its key.

## Backups

```bash
docker compose -f engine/docker-compose.yml exec -T postgres pg_dump -U school_ai school_ai > school_ai_backup.sql
```

Run that nightly, and back up the kit folder with your normal file backups.
**Never run `docker compose down -v`**: the `-v` deletes the database volume,
and every approval with it.

## Several teachers at once

The engine makes one step at a time and queues the rest, so two teachers
can't overwrite each other's files. Each step takes one to three minutes. If
a department works at the same time and the queue gets long, run one engine
per department, each with its own kit folder.

## Updating

Images are pinned to exact versions in `docker-compose.yml`. To update, change
the version deliberately, back up first, then run:

```bash
docker compose -f engine/docker-compose.yml pull
docker compose -f engine/docker-compose.yml up -d
```
