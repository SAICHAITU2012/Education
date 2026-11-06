# 09 — Technical debt register & prioritised backlog (M0 output)

Companions: [00-milestone-roadmap.md](00-milestone-roadmap.md) ·
[07-current-state-audit.md](07-current-state-audit.md).

## 1. Debt register

Severity: **S1** blocks production/institutional use · **S2** degrades
reliability/efficiency · **S3** hygiene.

| ID | Sev | Item | Evidence | Target |
|---|---|---|---|---|
| TD-01 | S1 | ~~Not a git repository~~ **fixed in M1** — local git history; remote push pending | `git status` previously failed | ✅ M1 |
| TD-02 | S1 | ~~`lastLevelUp` shared instance race~~ **fixed in M1** — returns `{record, levelUp}`; regression test verified failing on old code | orchestrator.ts:361,364,406 | ✅ M1 |
| TD-03 | S1 | No database: single JSON file, full rewrite per mutation; sessions memory-only (2 h TTL, lost on restart) | store.ts:107-120 | M2 |
| TD-04 | S1 | No authentication: UUID-is-the-credential; possession grants read/export/delete | app.ts:247-252 | M2 |
| TD-05 | S1 | ~~CORS reflects any origin; no helmet/CSP~~ **fixed in M1** — allowlist + security headers, dependency-free | app.ts:51 | ✅ M1 |
| TD-06 | S1 | ~~No CI/CD~~ **fixed in M1** — GitHub Actions: test → calibration gate → build | no .github/ | ✅ M1 |
| TD-07 | S1 | ~~No containerisation~~ **fixed in M1** — multi-stage image, non-root, healthcheck; smoke-tested via colima | no Dockerfile | ✅ M1 |
| TD-08 | S1 | Transcripts plaintext at rest, no retention TTL, no consent capture, no access audit log | store.ts, no consent code | M2 |
| TD-09 | S2 | Rate limits in-memory per-IP; **trust proxy fixed in M1** (`dad08b9`); shared/mutable limit store still M2 | http.ts:26-44 | M2 (shared store) |
| TD-10 | S2 | No LLM token/cost tracking, no budget caps → unbounded spend | no usage code anywhere | M2 (ledger) / M3 (gateway) |
| TD-11 | S2 | No streaming; blocking LLM calls, 60–90 s client waits | api.ts:130,141 | M3 |
| TD-12 | S2 | ~~Doc rot~~ **fixed in M1** — README IndexedDB + test count, 04-roadmap holdout claim | README.md:27, offline.ts:25, packs | ✅ M1 |
| TD-13 | S2 | Zero `holdout: true` scenarios → no transfer-testing instrument | grep all 6 packs | M3/M5 |
| TD-14 | S2 | ~~No observability~~ **partially fixed in M1** — structured JSON logs + events; error tracking/metrics/alerting still M2 | http.ts:47-55 | ✅ partial M1 |
| TD-15 | S2 | Calibration goldens authored against mock's own markers — validates pipeline, not validity | tools/calibration/golden.json | M4 |
| TD-16 | S3 | i18n: Hindi UI ~50%, silent English fallback | i18n.ts:469 | M3/M5 |
| TD-17 | S3 | Accessibility: no aria on Cohort/Mastery/Feedback; no audit | web/screens | M5 |
| TD-18 | S3 | Seed + test residue mixed with production data file | data/abhyas.json (42 teachers) | M2 |
| TD-19 | S3 | No E2E/load tests | tests/ = unit+integration only | M1 (smoke) → M5 (full) |
| TD-20 | S3 | `.env` plaintext secrets; custom env loader fine but no vault story | env.ts | M2 |
| TD-21 | S3 | Docker runtime image carries devDependencies (server runs via tsx from source) | Dockerfile note | M2 (precompile server) |

## 2. Prioritised backlog

### P0 — essential (first)
- [x] Git baseline: init, private remote, branch protection, PR template *(TD-01 — local history done; remote push + protection pending, needs `gh` auth)*
- [x] Fix TD-02 (`lastLevelUp` race) + add a concurrency regression test — `944be00`
- [x] Fix TD-12 doc rot (README, 04-roadmap) — `e4c9bf9`
- [x] CI: typecheck → vitest → calibration `--gate` → build — `3f509d7` (first CI run lands with the first push)
- [x] Security hardening: CSP/headers, CORS allowlist, trust proxy *(TD-05, TD-09)* — `dad08b9`
- [x] Dockerfile + compose, smoke-tested; restore drill executed *(nightly cron + hosted staging move to M2/deploy step)* — `2e7a901`
- [x] Structured logging *(TD-14)* — `743a02d` (Sentry/error tracking remains M2)
- [ ] E2E smoke test: one full rehearsal on staging *(TD-19 — needs the staging host; container smoke covers the boot path meanwhile)*

### P1 — important (next)
- [ ] Postgres schema + migrations + storage interface + JSON importer *(TD-03, TD-18)*
- [ ] Phone-OTP auth behind feature flag; ownership checks on every sensitive route *(TD-04)*
- [ ] Org entity (single pilot org), tenant-scoped queries
- [ ] Consent ledger + retention TTL + access audit log *(TD-08)*
- [ ] AI usage ledger + per-org budget caps with mock degrade *(TD-10)*
- [ ] Sarvam STT spike: 20 real Hindi rehearsal clips → WER report
- [ ] Streaming student turns (SSE) *(TD-11)*
- [ ] Educator evaluation protocol + recruitment (M4 start; TD-15)

### P2 — later (after validation)
- [ ] Scenario library 31 → 200+, with `holdout: true` set *(TD-13)*
- [ ] Hindi UI 100% → English pack → Kannada pack *(TD-16)*
- [ ] Teacher dashboard polish, content-authoring UI, accessibility audit *(TD-17)*
- [ ] Full E2E + load suites *(TD-19)*
- [ ] On-device LLM (LiteRT/Gemma 3n), Classes 4–8, further languages, NDEAR alignment

## 3. M1 sprint plan (first 14 days, evidence-gated not date-gated)

Day-counts are sizing hints, not commitments; the exit gate is what ships.

| Window | Work | Deliverable |
|---|---|---|
| 1–2 | ~~Technical audit~~ ✅ **done (this M0)** · freeze unnecessary feature work | 07/08/09 docs |
| 3–4 | Git init + CI + TD-02 fix + doc-rot fixes + E2E smoke test | Reproducible build |
| 5–7 | Docker, security headers/CORS/trust-proxy, structured logging, staging, backup+restore drill | Secure staging V1 |
| 8–10 | Postgres schema, storage interface, migrations, JSON importer, integrity + rollback tests | DB-backed staging |
| 11–12 | Auth prototype behind flag + authorisation tests + AI token tracking + cost caps + fallback tests | Controlled access, measurable AI spend |
| 13–14 | Educator recruitment, evaluation protocol, demo scenario set, pilot demo prep | Ready to start M4 |

**Honesty rule:** database migration, auth and security get proper testing —
if they need more than 14 days, the sprint ends when their acceptance criteria
are met, not the calendar.

**Definition of done (every backlog item):** implemented · tested (new test
where the change is behaviour) · documented (doc claims match code) · CI green
· merged via PR.
