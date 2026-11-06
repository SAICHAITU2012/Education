# 08 — Architecture: verified current state and production target

Companion to [02-architecture.md](02-architecture.md), which documents the V0
*design intent* (contracts, isolation, offline sync, privacy engineering) —
still accurate, read it for the reasoning. This document records the
**verified-as-built** system (M0 audit, 2026-11-06) and the **production
target** adopted in [00-milestone-roadmap.md](00-milestone-roadmap.md).

## 1. Verified current architecture (as built)

```
┌──────────────────────────────────────────────────────────────┐
│ React PWA (src/web, ~5.3k lines)                              │
│  hash router · 10 screens · voice-first player                │
│  Web Speech API (STT/TTS, Chrome-only for hi) · typing equal  │
│  state: React context → localStorage (teacher, attempts,      │
│  ui-lang, cohort-cache) · device UUID id · offline queue      │
│  service worker: shell SWR, /api/content network-first,       │
│  never caches personal /api                                   │
└───────────────┬──────────────────────────────────────────────┘
                │ fetch JSON (no streaming), 60–90 s timeouts
┌───────────────▼──────────────────────────────────────────────┐
│ Express API (src/server) — single process, port 8787          │
│  zod-validated routes · 512 kb cap · x-request-id             │
│  in-memory per-IP rate limits (180/min general, 40/min hot)   │
│  orchestrator: sessions (memory Map, 2h TTL) · scoring · sync │
│  privacy.ts: k-anonymised cohort aggregator (k≥5, ≥3 teachers)│
└───────┬───────────────────────────────┬──────────────────────┘
        │                               │
┌───────▼─────────┐          ┌──────────▼─────────────────────┐
│ store.ts        │          │ llm/ (LlmClient interface)     │
│ two in-memory   │          │  auto→Anthropic|OpenAI-compat  │
│ Maps → single   │          │  ResilientClient: any cloud    │
│ JSON file, full │          │  failure → MockClient fallback │
│ rewrite/write   │          │  mock = deterministic scripted │
│ (atomic rename) │          │  student + marker-based scorer │
└─────────────────┘          │  no streaming · 1 retry · no   │
                             │  token/cost accounting         │
┌─────────────────┐          └──────────┬─────────────────────┘
│ src/core (pure) │                     │
│ scoring ·       │          ┌──────────▼─────────────────────┐
│ evidence ·      │◀─────────│ content: hash-pinned rubric    │
│ progression ·   │  loaded  │ v1.0.0 + 6 scenario packs      │
│ selection · hash│          │ (31 scenarios, all Hindi)      │
└─────────────────┘          └────────────────────────────────┘
```

**Rehearsal data flow (verified):** client records locally → teacher
confirms transcript (`heardCorrectly` gate enforced server-side,
orchestrator.ts:234-240) → scorer LLM pass → `normalizeScorerOutput` (untrusted
output parsing) → `evaluateAttempt` re-verifies every evidence quote, applies
abstention gates, weights, floors → decision (pass/retry/redo/provisional) →
store + progression EMA → next scenario targets weakest competency.
Offline: same pipeline on-device with the mock engine → `verified:false` →
idempotent sync later, server result authoritative.

## 2. Production target (V1–V3)

```
                    ┌──────────────────────────────────────────────┐
                    │ Clients: PWA / Android shell (offline engine) │
                    └──────────────┬───────────────────────────────┘
                                   │ HTTPS (JWT), TLS/WAF at edge
                    ┌──────────────▼───────────────┐
                    │  API gateway / load balancer  │
                    └──────────────┬───────────────┘
        ┌──────────────────────────┼───────────────────────────┐
┌───────▼────────┐       ┌─────────▼─────────┐       ┌─────────▼────────┐
│ Rehearsal API  │       │  Scoring worker   │       │ Admin/analytics  │
│ SSE-streaming  │       │  queue consumer,  │       │ aggregates only, │
│ student turns  │       │  idempotent       │       │ k-anonymised     │
└───────┬────────┘       └─────────┬─────────┘       └─────────┬───────┘
        └──────────┬───────────────┴───────────────────────────┘
             ┌─────▼──────┐  ┌──────────┐  ┌──────────────────┐
             │ PostgreSQL │  │ Redis*   │  │ Object store (S3)│
             │ orgs/users │  │ queue +  │  │ transcripts,     │
             │ attempts/  │  │ rate     │  │ audit logs,      │
             │ consent/   │  │ limits   │  │ backups          │
             │ audit      │  └──────────┘  └──────────────────┘
             └────────────┘
         ┌─────────▼───────────┐    ┌─────────────────────────┐
         │ AI gateway           │    │ Observability           │
         │ streaming · cost     │    │ structured logs →       │
         │ ledger · budget caps │    │ Sentry · OTel metrics ·  │
         │ sim/scoring model    │    │ uptime alerts           │
         │ split · fallback     │    └─────────────────────────┘
         └──────────────────────┘
```

\* **Queue/Redis is introduced when asynchronous workload justifies it** —
not on day one. A single Node process with Postgres can serve the first pilot
org; the seam is already there (scoring is a discrete function).

### Locked decisions

| Area | Decision | Rationale |
|---|---|---|
| Backend | Keep Node.js + TypeScript, modular single service | Working, typed, tested; team size doesn't justify more |
| Database | PostgreSQL | Durability, tenancy, audit; JSON importer preserves history |
| ORM | Drizzle or Prisma — pick exactly one at M2 start | Both fine; pick once, don't churn |
| Frontend | Keep the PWA; Android = shell later | Offline engine + queue already work; native is P2 |
| AI orchestration | Keep provider-independent `LlmClient`; split sim vs scoring model configs | Chat skill ≠ judging skill; calibration gate per model swap |
| Mock engine | First-class forever | Offline tier + outage fallback + calibration baseline |
| Voice | Sarvam STT/TTS primary, Web Speech fallback | India-hosted, 22 languages; browser STT is Chrome-only |
| Determinism | `src/core` unchanged by M2 | Store interface swaps; engine doesn't |

### Anti-goals (until after V3)

Kubernetes · microservices · A/B framework · billing plumbing · native iOS ·
admin views of individual teacher data (never, by design).

## 3. Migration strategy (M2)

1. Add storage **interface** matching current store semantics (already
   narrow: teachers/records/sessions).
2. Postgres implementation behind it; JSON importer back-fills.
3. Feature-flag: `STORE_DRIVER=json|postgres`; run staging on Postgres,
   keep JSON for tests/offline dev.
4. Sessions: Postgres with TTL sweep (or Redis when queue lands).
5. Rollback = flip the flag; no big-bang cutover. Auth ships behind a flag
   too; UUID flow stays supported (it *is* the offline/recovery story).
