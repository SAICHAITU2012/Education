# 10 — Ops runbook (M1)

Everyday operational procedures. Companion: [08-architecture.md](08-architecture.md).

## Running

| Mode | Command |
|---|---|
| Dev | `npm run dev` — API :8787 (tsx watch), Vite :5173 |
| Production (source) | `npm run build && npm start` — API serves the built PWA on :8787 |
| Container | `docker compose up --build` (or `docker build -t abhyas . && docker run -p 8787:8787 -v abhyas-data:/data abhyas`) |

## Environment variables

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | API listen port |
| `DATA_FILE` | `data/abhyas.json` | JSON store path (volume-mounted in Docker) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allowlist (comma-separated); the server's own origin is always allowed |
| `TRUST_PROXY` | *(off)* | Set when behind a reverse proxy: `true`, a hop count (`1`), or an IP/subnet list — enables correct per-IP rate limits |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` (structured JSON on stdout) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | *(none)* | Cloud student+scorer; without keys the deterministic mock engine runs everything |
| `SARVAM_API_KEY` | *(unused yet)* | Reserved for the M3 server-side Indic STT path |

## Logging

One JSON object per line on stdout: `{"time","level","event",…}`. Events of
note: `http_request` (with scrubbed path + `requestId`), `http_unhandled_error`
(stack trace), `llm_scorer_fallback` (cloud outage → mock engine degraded
service), `store_write_failed`, `server_listening`, `server_shutdown`.
Teacher text and bodies are never logged; teacher ids are scrubbed from paths.

## Backup & restore drill

Backups are timestamped copies of the JSON store with simple retention:

```bash
npm run backup                          # → backups/abhyas-YYYYMMDD-HHMMSS.json
scripts/restore.sh backups/<file>.json  # atomic tmp+rename over DATA_FILE
```

**Restore drill (run after every backup-configuration change):**

1. `npm run backup`
2. Restore to a *scratch* target: `scripts/restore.sh backups/<newest>.json /tmp/abhyas-restore.json`
3. Boot against it: `DATA_FILE=/tmp/abhyas-restore.json PORT=8791 npm start`
4. Verify: `curl http://127.0.0.1:8791/api/health` → `ok:true`, scenario count intact.
5. Kill the drill server; delete the scratch file.

Prefer backing up while the server is quiet (or stop it first): the store
persists via atomic tmp+rename, so a mid-write copy is safe but may miss the
final mutation. Postgres arrives at M2 and this becomes `pg_dump` + restore.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on every PR and push to `main`:
`npm ci` → `npm test` → `npm run calibration -- --gate` (AI-vs-expert gate:
MAE ≤ 0.25, decision agreement ≥ 70%) → `npm run build` (tsc + vite).
Green CI is the merge requirement; a red calibration gate means the engine
changed behaviour — investigate, never force-merge.

## Deploying a staging instance

M1 target: any VM/container host running the Docker image with a mounted
volume for `/data`. Adapt per provider (Fly/Railway/ECS): set
`ALLOWED_ORIGINS` to the staging origin, set `TRUST_PROXY=1` behind their
proxy, wire their log drain to stdout. The nightly backup job = cron of
`npm run backup` against the mounted volume.
