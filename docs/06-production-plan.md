# 06 — Production plan: V0 → deployable, sellable, government-ready

Companion to [04-roadmap.md](04-roadmap.md), which covers validation and the
field pilot. This document covers everything around that: the engineering spine,
cost model, compliance, and go-to-market. Written 2026-11-06 after a full
codebase audit + market research; re-verify numbers before quoting externally.

---

## 1. Where we actually are (audit verdict)

**One line: a credible V0 with an unusually trustworthy scoring spine —
productionization is ~60% infrastructure build around a ~90%-ready core.**

Tests: 72/72 pass. Build: clean (461 kB JS / 132 kB gzip). Calibration harness:
MAE 0.066, 100% decision agreement (mock engine, authored goldens).

### Maturity scorecard

| Layer | Grade | Evidence |
|---|---|---|
| Decision engine (`src/core`) | **Production-grade** | Deterministic, pure, hash-pinned rubric, injectable clock; survives production largely as-is |
| Anti-hallucination evidence gate | **Production-grade** | Strict quote verification, no half-credit, regression-tested |
| Persona isolation (student ≠ scorer) | **Production-grade** | Enforced in prompt builders + leak tests |
| Input validation / error handling | **Production-grade** | zod on every route, 512 kb cap, central error handler with request ids, transcript rollback |
| Privacy design | **Strong-for-V0** | Pseudonymous ids, `heardCorrectly` gate enforced server-side, k-anonymised cohort (k≥5, ≥3 teachers), export/delete, SW never caches personal API |
| Tests | **Good** | 72 unit/integration incl. HTTP integration; **no e2e, no load tests** |
| Content | **Thin but real** | 31 scenarios, Hindi-only, Classes 1–3, 4 competencies, L1–5; **zero `holdout: true` scenarios** despite roadmap claiming they exist |
| Persistence | **Prototype** | One JSON file, full rewrite per mutation (`store.ts:107-120`); in-memory sessions (2 h TTL, lost on restart); in-memory rate limits; `data/` gitignored → no backup story |
| Identity | **Prototype** | A device UUID *is* the credential (`x-teacher-id`); knowing it grants read/export/delete of everything |
| Multi-tenancy | **Absent** | No org/school/district entities anywhere |
| LLM ops | **Prototype** | No streaming (up to 90 s blocking), 1 retry, **zero token/cost tracking**, silent mock fallback |
| Observability | **Weak** | console.log only; no Sentry/OTel/metrics; `/api/health` is the only probe |
| Deploy | **Absent** | No Dockerfile, no CI, no security headers, CORS `origin: true` (reflects any origin), no `trust proxy`, **not even a git repo** |
| Consent & retention | **Absent** | No consent capture, no retention TTL, plaintext JSON at rest, no access audit log |
| i18n / voice | **Partial** | UI en + ~50% hi; content 100% Hindi; voice = Chrome-only Web Speech API; `SARVAM_API_KEY` unused |
| Accessibility | **Partial** | ~47 aria usages concentrated in Practice/Layout; Cohort/Mastery/Feedback have none |
| Known bug | `Orchestrator.lastLevelUp` shared instance field → concurrent scorers can return wrong levelUp payload (`orchestrator.ts:361,276,406`) | Fix in Sprint 0 |
| Doc rot | README claims IndexedDB; code uses localStorage (`offline.ts:25`); roadmap claims holdouts exist; none marked | Fix in Sprint 0 |

### Why this is a good position

The hard, differentiating work — **trustworthy AI assessment** — is largely
done and test-proven. What remains is mostly *known* engineering (DB, auth,
tenancy, deploy), not research. Competitors who start from a chatbot wrapper
have the opposite problem: easy infrastructure, no trustworthy scoring spine.

---

## 2. Positioning (the argument that sells it)

1. **"NISHTHA teaches; Abhyas rehearses."** DIKSHA/NISHTHA have trained 4.7M+
   teachers online, but the format is watch-video → quiz. NEP 2020 mandates 50
   hours of CPD/year per teacher; there is no practice layer that measures
   *classroom performance*, only course completion. Abhyas is that layer.
2. **Standards-aligned already.** The rubric cross-walks NPST (NCTE 2023) and
   World Bank TEACH — the exact frameworks SCERTs/DIETs already report against.
3. **Privacy as a feature, not a cost.** Teachers are adults, so DPDP's
   child-data regime (verifiable parental consent, §9) does **not** apply — a
   major advantage over student-facing edtech. The pseudonymity +
   k-anonymised-cohort + no-supervisor-endpoint design can be marketed as
   "we cannot show your principal your scores, by construction."
4. **Offline-first is not optional** — ~33% of government schools face
   connectivity limits. The PWA + on-device scoring + idempotent sync already
   works; this is a moat vs. cloud-only competitors.
5. **"Abstain, never guess"** is the answer to the first question every
   education officer asks about AI: *how do you know the score is real?*
   Evidence-cited scoring + calibration gate + hash-pinned rubric is a
   procurement-grade answer.

---

## 3. Target architecture

```
                    ┌──────────────────────────────────────────────┐
                    │  Clients: PWA/Android (offline engine + queue)│
                    └──────────────┬───────────────────────────────┘
                                   │ HTTPS (JWT)
                    ┌──────────────▼───────────────┐
                    │  API gateway / LB  (TLS, WAF) │
                    └──────────────┬───────────────┘
        ┌──────────────────────────┼───────────────────────────┐
        │                          │                           │
┌───────▼────────┐       ┌─────────▼─────────┐       ┌─────────▼────────┐
│ Rehearsal API  │       │  Scoring worker    │       │  Admin/analytics │
│ (streaming SSE │       │  (queue consumer,  │       │  API (aggregates │
│  student turns)│       │   idempotent)      │       │  only, k-anon)   │
└───────┬────────┘       └─────────┬─────────┘       └─────────┬───────┘
        │                          │                           │
        └──────────┬───────────────┴───────────────────────────┘
             ┌─────▼──────┐  ┌──────────┐  ┌──────────────────┐
             │ PostgreSQL │  │ Redis    │  │ Object store (S3)│
             │ (orgs,     │  │ (queue,  │  │ transcripts,     │
             │ users,     │  │ rate     │  │ audit logs,      │
             │ attempts)  │  │ limits)  │  │ backups          │
             └────────────┘  └──────────┘  └──────────────────┘
                    │                        │
         ┌──────────▼─────────┐    ┌─────────▼──────────┐
         │ LLM gateway        │    │ Observability      │
         │ streaming, budget  │    │ OTel → Grafana,    │
         │ caps, provider     │    │ Sentry, uptime     │
         │ routing, cost ledger│   │                    │
         └────────────────────┘    └────────────────────┘
```

Key decisions:
- **Postgres via Drizzle or Prisma** — migrations, indexes, real transactions.
  `src/core` stays untouched; only `store.ts`'s interface changes.
- **Keep the mock engine as a first-class citizen** — it is the offline engine,
  the free tier, the calibration baseline, and the outage fallback. This is an
  asset; productionize it, don't delete it.
- **Queue scoring work** (BullMQ + Redis) so scorer latency never blocks the
  student-turn loop; SSE streams student turns.
- **Org hierarchy**: `state → district → block → school → teacher`, with roles
  (teacher, school-admin, district-admin, content-editor, platform-admin).
  Individual attempts remain invisible to admins by construction — admins see
  only k-anonymised aggregates. Do not compromise this.

---

## 4. The plan — six phases

Each phase has a hard exit gate. Do not start the next phase's spend until the
gate is green.

### Phase 0 — Foundations (Weeks 1–2) · *"make it deployable"*
| Workstream | Tasks |
|---|---|
| Repo | `git init`, private GitHub repo, branch protection, PR template; fix README/roadmap doc rot |
| Bug fix | `lastLevelUp` race → return per-attempt payload |
| CI | GitHub Actions: typecheck → test → calibration `--gate` → build → Docker image; main branch always releasable |
| Hardening | helmet/CSP, CORS allowlist, `trust proxy`, pino structured logs (request-id already exists), graceful shutdown already present — keep |
| Deploy | Dockerfile + compose (app+Postgres); deploy to a managed host (Fly.io/Railway/EC2 ap-south-1); staging env; nightly Postgres backup test |

**Gate:** green CI on every PR; staging URL serves the full loop; restore-from-backup rehearsed once.

### Phase 1 — Production spine (Weeks 2–6) · *"data, identity, tenancy, money-control"*
| Workstream | Tasks |
|---|---|
| Database | Postgres schema: orgs, users, attempts, sessions, consent_ledger, audit_log, content_packs; migrate JSON store via a one-shot importer; keep atomic-write discipline |
| Auth | Phone + OTP (MSG91/Twilio) with device-pseudonymous fallback retained; JWT access+refresh; RBAC five roles; every `/api/teachers/:id` route switches from "knows-the-UUID" to "owns-the-token" |
| Multi-tenancy | Org entities + scoped queries + org-level rate limits |
| Consent & retention (DPDP-aligned) | Versioned consent notice (Hindi+English) captured before first score; retention TTL job (raw transcripts 90 days → delete, scores+aggregates retained); audit log of every read/export/delete; breach-notification runbook |
| LLM gateway | SSE streaming for student turns; token+cost ledger per org/request; per-org monthly budget caps with graceful degrade to mock engine; cheap model for student turns, strong model for scorer; response caching where rubric-bounded |
| Observability | Sentry + OpenTelemetry + Grafana; SLOs: p95 turn < 3 s (streaming), score < 15 s, error rate < 1%; uptime alerting |

**Gate:** two simultaneous orgs isolated; OTP login works on a ₹8k phone; per-org budget cap provably stops runaway spend; every data access appears in audit log.

### Phase 2 — Voice & language layer (Weeks 4–8, overlaps Phase 1)
| Workstream | Tasks |
|---|---|
| Server-side STT | Sarvam Saaras (22 Indic languages) as primary; Web Speech API stays as free fallback; measure WER by region/noise; `SARVAM_API_KEY` already stubbed |
| TTS | Sarvam/edge TTS for the AI student's voice — far more natural than Web Speech; keep text-first-class |
| i18n | Complete Hindi UI (228 → 457 keys); then English content pack; then **Kannada** pack (second state); kn/ta/te/ml types + bcp47 already wired |
| Content scale | Scenario authoring guide + admin content-editor UI (schema-validated); 31 → 200+ scenarios; **mark 10–15% `holdout: true`** for transfer testing (audit: zero exist today) |

**Gate:** WER measured on real teacher audio (target < 12% for hi-IN classroom speech); a Kannada pack runs end-to-end without code changes; 100+ authored scenarios live.

### Phase 3 — Evidence & trust (Weeks 6–10) · *the differentiator, and the procurement artifact*
This is [04-roadmap.md](04-roadmap.md) Phase 1, productionized:
- Recruit 5–10 practising teachers/educators; blind-label **100+ attempts** (not 8); compute inter-expert agreement (Krippendorff's α) first — it bounds achievable AI agreement.
- Run AI-vs-expert calibration on blinded goldens through the real pipeline; publish the numbers whatever they are.
- Psychometrics: item analysis per competency, bias audit (gender/accent/region via voice-proxy features), provisional-rate monitoring.
- Ship an **Evidence Pack**: methodology, blinded agreement stats, rubric governance, privacy architecture. This document closes government/CSR deals.

**Gate:** MAE ≤ 0.25 & decision agreement ≥ 70% on blinded labels (the existing `--gate` thresholds); Evidence Pack v1 published.

### Phase 4 — Field pilot (Weeks 8–14) · *[04-roadmap.md](04-roadmap.md) Phase 2, funded and instrumented*
- Android app: Capacitor/TWA shell around the PWA (offline engine + queue already built); APK that installs on ₹8–10k phones.
- Pilot: 20–50 teachers, 2–3 government schools via DIET partners, Hindi-speaking state (MP/UP/Rajasthan/Chhattisgarh). Consent in Hindi; live demo of export/delete (builds trust faster than any privacy policy).
- Instrument everything [04-roadmap.md](04-roadmap.md) specifies: completion, retry curve, provisional rate, "heard me correctly" rate, pre/post transfer on holdouts.
- Infra cost per teacher measured in production — feeds the pricing model.
- Human escalation path: district mentors see the k-anonymised heatmap only.

**Gate (scale-or-stop decision):** ≥ 60% weekly-active among enrolled teachers; NPS ≥ 40; calibration agreement holds on live data; cost/teacher < ₹40/month; zero unconfirmed-egress incidents.

### Phase 5 — Go-to-market & sustainability (Months 4–9) · *runs alongside Phase 4*
Three channels, in order:
1. **Government (high-touch, slow, biggest):** state Samagra Shiksha projects;
   SCERT/DIET MoUs; GeM listing; NDEAR building-block alignment; propose Abhyas
   as the *practice module* complementing NISHTHA FLN courses (NPST mapping is
   the hook). Entry via one district, not the state.
2. **Institutional B2B (fast, funds the mission):** B.Ed colleges / teacher
   education institutes, private school chains, teacher-training NGOs. These
   pay ₹199–499/teacher/year and validate fast.
3. **Grant/CSR (non-dilutive):** Central Square Foundation, ACT, Rohini
   Nilekani Foundation, Mantra4Change ecosystem, corporate CSR via Samagra
   smart-classroom budgets. The Evidence Pack from Phase 3 is the application.

Business model: per-teacher-per-year licensing (govt at ₹100–150/teacher at
scale, institutional at ₹299–499); district-level licenses for govt; no ads,
ever (also a DPDP posture).

**Gate:** one signed paid pilot (any channel); one grant application submitted with the Evidence Pack; unit economics sheet validated by Phase 4 cost data.

### Phase 6 — Scale & moat (Months 6–12)
- Infra: managed containers → 2+ app replicas, read replica, CDN for the shell; single region ap-south-1 is fine to 100k teachers.
- On-device LLM (LiteRT-LM + Gemma 3n) for offline student simulation — the `LlmClient` boundary makes this an adapter, not a rewrite (roadmap Phase 3).
- Classes 4–8 + new subjects; 4 languages; NISHTHA course mapping per state.
- Integrations: NDEAR building blocks, DIKSHA course links, state teacher registries (aggregate-only).
- Team plan: +1 fullstack engineer, +1 content/pedagogy lead (ex-teacher), +1 field pilot manager; founder owns GTM.

---

## 5. Cost model (order-of-magnitude, verify with real usage)

Per-rehearsal (5–8 min, ~6 LLM turns + 1 scorer pass):
| Item | Est. cost |
|---|---|
| Student turns (mini-class model) | ₹0.3–0.8 |
| Scorer pass (strong model, ~2k tok) | ₹2–4 |
| Sarvam STT (~5 min audio) | ₹1–2 |
| Infra amortised | ₹0.5–1 |
| **Total** | **₹4–8 per rehearsal** |

At scale (8 rehearsals/teacher/month):
| Teachers | Monthly LLM+STT | Monthly infra | Total |
|---|---|---|---|
| 1,000 | ₹40–60k | ₹5–10k | **< ₹75k** |
| 10,000 | ₹4–6L | ₹30–50k | **< ₹7L** |
| 50,000 | ₹20–30L | ₹1.5–2L | **< ₹32L** |

Break-even at ₹150/teacher/yr govt pricing ≈ 10k teachers ≈ ₹15L/yr revenue vs
~₹60L/yr cost → institutional B2B (₹299–499) and grants bridge the gap until
govt scale. Cost engineering levers when needed: fine-tuned small scorer,
on-device engine, batch scoring.

---

## 6. Compliance & trust pack

| Item | Status → action |
|---|---|
| DPDP Act 2023 | Teachers = adult data principals → standard fiduciary duties, not the child regime. Build: consent ledger, notice (hi/en), retention TTL, breach runbook, access audit log (Phase 1) |
| Children's data | **Design goal: zero student PII collected.** Risk: teachers may speak child names in rehearsal → scrub prompts warn against naming children; retention TTL caps exposure |
| Data residency | India region (ap-south-1) end to end; Sarvam is India-hosted — prefer it over OpenAI for STT; consider an India-hosted LLM (Sarvam LLM) for full residency |
| Security | OWASP ASVS-lite: authn/authz tests, dependency scanning in CI, secrets in vault, pen-test before govt deals |
| Accessibility | WCAG 2.1 AA audit before govt pilot (GIGW is the govt baseline); fix aria coverage on Cohort/Mastery/Feedback screens |
| Rubric governance | Already hash-pinned + versioned; publish changelog with each rubric version — this is a *feature* for procurement |

---

## 7. What NOT to build yet (scope discipline)

- ❌ Billing/payments plumbing (invoicing by hand until ~50 paying orgs)
- ❌ Native iOS / Play Store (PWA + TWA covers it; Play costs ₹ and review cycles)
- ❌ A/B framework (pilot n is too small; instrument, don't experiment)
- ❌ Admin dashboards with individual data (would break the core privacy promise)
- ❌ Microservices (3 processes max; one well-modularised service)
- ❌ Tamil/Telugu/Malayalam packs before Kannada proves the content pipeline

---

## 8. Sprint 0 — the next two weeks (concrete)

1. `git init` + GitHub private repo + CI (typecheck/test/calibration-gate/build) — *half a day*
2. Fix `lastLevelUp` race + README IndexedDB claim + roadmap holdout claim — *half a day*
3. Dockerfile + compose + staging deploy (Fly/Railway) — *2 days*
4. helmet/CORS-allowlist/trust-proxy/structured-logging — *1 day*
5. Postgres + Drizzle schema for the four existing entities, JSON importer — *4 days*
6. Phone-OTP auth behind a feature flag; UUID flow stays default — *3 days*
7. Sarvam STT spike: 20 real Hindi rehearsal clips → WER report — *2 days*

## 9. Risk register (infrastructure risks; pedagogy risks in 04-roadmap)

| Risk | Mitigation |
|---|---|
| LLM spend blows up on a district-wide rollout | Per-org budget caps + graceful mock degrade + cost ledger (Phase 1, first-class) |
| Scoring latency degrades UX at scale | Queue + streaming + strong-model-only-for-scorer; SLO alerting |
| Single-region outage kills pilot trust | Mock engine = offline engine = outage fallback; PWA works fully offline; staging + backup-restore drill |
| Auth change breaks the privacy promise | Device-pseudonymous mode stays a supported flow; audit log proves who saw what |
| Govt sales cycle stalls the company | Channel 2 (B.Ed/NGO/institutional) pays the bills in 60 days, not 12 months |
| Key-person concentration (solo builder) | Docs discipline (this repo's culture), CI as institutional memory, hire content lead early |
