# 07 — Current-state technical audit (M0)

Read-only audit, 2026-11-06. No code was modified. Companion docs:
[00-milestone-roadmap.md](00-milestone-roadmap.md) ·
[08-architecture.md](08-architecture.md) ·
[09-technical-debt.md](09-technical-debt.md).

## 1. Verdict

**A credible V0 with an unusually trustworthy scoring spine. The hard,
differentiating work (deterministic evidence-cited assessment, persona
isolation, k-anonymised privacy) is done and test-proven. Productionisation is
~60% infrastructure build (DB, auth, tenancy, deploy, observability) around a
~90%-ready core.**

Three different properties must not be conflated:

- **Software correctness** — the engine follows its rules → *established* (72 tests).
- **Educational validity** — the rules measure teaching competency → *not yet established* (needs M4).
- **Operational reliability** — the platform works for real teachers at scale → *not yet established* (needs M1–M2, M6).

Passing tests proves only the first.

## 2. Independent verification log (re-run 2026-11-06)

| Claim | Method | Result |
|---|---|---|
| 72 tests pass | `npm test` re-run | ✅ 72/72, 1.72 s |
| Build clean | `npm run build` re-run | ✅ tsc + vite, 461 kB JS / 132 kB gzip / 88 kB CSS |
| Calibration gate | `npm run calibration -- --gate` | ✅ PASS — MAE 0.066, decision agreement 100%, provisional 0% |
| Deterministic engine is real | read `src/core/scoring.ts` | ✅ Pure functions, injectable clock, floors, abstention gates |
| Persona isolation enforced | read `src/llm/prompts.ts` + leak tests | ✅ Student never sees rubric; scorer never sees resistance ladder |
| Evidence gate is strict | read `src/core/evidence.ts` | ✅ ≥4-char quotes, standalone tokens, no half-credit, factor 0 on fabrication |
| No database | read `src/server/store.ts:107-120` | ✅ Single JSON file, full rewrite per mutation, atomic tmp+rename |
| No auth | grep jwt/bcrypt/passport/oauth | ✅ 0 hits; `x-teacher-id` UUID is the only credential |
| CORS reflects any origin | `src/server/app.ts:51` | ✅ `cors({ origin: true })`; no helmet, no `trust proxy` |
| Offline uses localStorage (not IndexedDB as README claims) | `src/web/offline.ts:29,44,58` | ✅ README.md line 27 is wrong |
| Zero holdout scenarios (roadmap claims they exist) | grep all 6 packs | ✅ 0 `holdout: true` markers |
| `lastLevelUp` race | read `src/server/orchestrator.ts:361` | ✅ Shared instance field; concurrent scorers can return wrong levelUp |
| Not a git repository | `git status` | ✅ `fatal: not a git repository` |
| Calibration caveat | read `tools/calibration/golden.json` | ⚠️ 8 goldens authored against the same marker vocabulary the mock detector uses — validates the pipeline, **not** AI↔expert agreement |

## 3. Feature implementation matrix

| Feature | Status | Evidence |
|---|---|---|
| Rehearsal loop (practice → simulate → review → score → feedback → adaptive next) | ✅ Implemented | app.ts, orchestrator.ts, Practice/Review/Feedback screens |
| Deterministic decision engine (weights, floors, thresholds, level-ups) | ✅ Implemented | core/scoring.ts, core/progression.ts; determinism tested |
| Evidence verification (anti-hallucination) | ✅ Implemented | core/evidence.ts; regression-tested incl. Devanagari |
| Persona isolation | ✅ Implemented | llm/prompts.ts; leak tests |
| Rubric governance (hash-pinned, versioned) | ✅ Implemented | content/schema.ts:95-132; core/hash.ts |
| Transcript-review gate (server-enforced) | ✅ Implemented | orchestrator.ts:234-240 rejects `heardCorrectly:false` |
| Offline practice + on-device scoring + idempotent sync | ✅ Implemented | web/offline.ts, public/sw.js; localStorage queue (README mislabels it) |
| Data export / typed-confirm delete | ✅ Implemented | app.ts:109-143; Settings.tsx |
| k-anonymised cohort analytics | ✅ Implemented | server/privacy.ts (k≥5, ≥3 teachers, suppressed cells reported) |
| Rate limiting | ⚠️ Partial | In-memory per-IP (http.ts:26-44); resets on restart; no trust proxy → breaks behind reverse proxy |
| Voice input | ⚠️ Partial | Web Speech API only (Chrome/Edge for hi-IN); typing is first-class fallback; SARVAM_API_KEY unused |
| i18n | ⚠️ Partial | UI en full / hi ~50% with silent fallback (i18n.ts:469); content 100% Hindi; kn/ta/te/ml are types + bcp47 mappings only |
| Accessibility | ⚠️ Partial | ~47 aria usages concentrated in Practice/Layout; Cohort/Mastery/Feedback none; no audit |
| Persistence | ❌ Prototype | Single JSON file full rewrite; sessions memory-only (2h TTL, lost on restart) |
| Authentication | ❌ Absent | Device UUID = credential; knowing it grants read/export/delete |
| Multi-tenancy | ❌ Absent | No org/school/district entities |
| Consent capture | ❌ Absent | No consent ledger; roadmap defers to pilot phase |
| Data retention | ❌ Absent | No TTL; transcripts persist until manual delete |
| Audit log of data access | ❌ Absent | — |
| LLM cost/token tracking | ❌ Absent | Unbounded spend risk; no budget caps |
| Streaming responses | ❌ Absent | Blocking JSON; up to 60–90 s client waits |
| Observability (metrics, error tracking, tracing) | ❌ Absent | console.log only; `/api/health` sole probe |
| CI/CD, Docker, IaC | ❌ Absent | No .github/, no Dockerfile |
| E2E / load tests | ❌ Absent | Unit + HTTP integration only |
| Holdout scenarios | ❌ Absent (roadmap claims present) | 0 markers across 6 packs |
| Admin panel | ❌ Absent (deliberate — privacy guarantee) | Keep absent for individual data; M5 adds content-editor + aggregate-only org views |

## 4. Content & calibration reality

- 31 scenarios / 6 packs (maths+hindi, classes 1–3), 19 with authored
  misconceptions; all `language:"hi"`; L1×8 → L5×3.
- Calibration numbers (MAE 0.066, 100% agreement) come from the **mock engine
  scoring goldens authored against that same engine's marker vocabulary**. They
  validate pipeline mechanics, not educational validity. Treat them as a
  harness smoke test; real numbers come from M4's blinded expert labels.
- Seed data (18 synthetic teachers × 7 attempts) lives in the same
  `data/abhyas.json` as real residue — separate seed from production data at M2.

## 5. Security & privacy assessment

**Genuine strengths:** server-enforced transcript gate; k-anonymised cohort
(verified leak-free by server.test.ts:270-279); request-log id scrubbing; SW
never caches personal API; export/delete flows; no PII fields in schema.

**Gaps (ordered by severity):** no authn (S1) → CORS any-origin + no security
headers (S1) → plaintext transcripts at rest, forever (S1) → no consent/audit
(S2) → unbounded LLM spend (S2) → no trust proxy/rate-limit persistence (S2) →
`.env` plaintext secrets (S3).

**DPDP precision (correcting 06 §6):** teachers are adult data principals, so
the child-data regime (verifiable parental consent, §9) does not apply to
*them* — but that is not the whole story: (a) teachers may speak children's
names into transcripts, pulling student data into the system unbidden —
mitigate by data minimisation (prompts discourage naming children), retention
TTL and no-student-PII checks; (b) DPDP Rules notified Nov 2025 with phased
commencement — principal provisions (consent, children's data) reported for
May 2027 — no reason to postpone privacy engineering, and every reason to have
the consent ledger, retention TTL and audit log done before institutional
deployment; (c) get qualified legal review before the first paid pilot. The
correct posture: *teachers = standard fiduciary duties; students = zero data
collected by design.*

## 6. Evaluation of docs/06-production-plan.md

Strategic direction confirmed. Four corrections, adopted into the master roadmap:

1. **Cost model / pricing (Issue 3).** ₹4–8/rehearsal × 8/month ≈ ₹384–768 per
   teacher-year *in AI costs alone*; ₹150/teacher/yr government pricing cannot
   cover that usage model. ₹150 is **not** a validated profitable price.
   Required: measure real usage in the pilot, engineer cost down (smaller
   scorer, caching, on-device), and price on measured economics — possibly
   usage-tiered or state-subsidised.
2. **Validation caveat (Issue 2).** The MAE 0.066 / 100% figures are
   mock-on-authored-goldens (§4 above). Real blinded-expert validation is the
   gate that matters (M4).
3. **DPDP nuance (Issue 4).** See §5 — the "teachers are adults" argument is
   necessary but insufficient.
4. **NDEAR framing (Issue 5).** NDEAR is an interoperability architecture, not
   a certification or procurement channel. Abhyas aligns to relevant standards
   and must never advertise "government approved" until actually established.

Also confirmed from 06: preserve the scoring engine (do not rewrite); keep the
mock engine as a first-class citizen (offline tier, outage fallback,
calibration baseline); no microservices/Kubernetes at this stage.

## 7. Answers to the six M0 questions

1. **Genuinely working:** rehearsal loop end-to-end; deterministic engine +
   evidence gate + isolation; offline sync; privacy architecture; 72 tests;
   HTTP integration coverage.
2. **Incomplete or unsafe:** persistence (JSON), auth (none), tenancy (none),
   LLM ops (no cost control), observability (none), deploy (none), consent/
   retention (none), i18n (hi ~50%), voice (browser-only), accessibility
   (partial), content (31 scenarios, 0 holdouts).
3. **Fix immediately (M1):** git baseline; `lastLevelUp` race (TD-02);
   CORS/headers/trust proxy (TD-05/TD-17); doc rot (TD-12); CI + Docker +
   staging + backup (TD-01/TD-06/TD-07).
4. **Build next (M2):** Postgres + importer, OTP auth behind flag, one pilot
   org, consent/retention/audit, AI cost ledger + caps.
5. **Deliberately postpone:** native iOS, microservices/K8s, languages beyond
   Kannada, Classes 4–8, on-device LLM, NDEAR integration, individual-facing
   admin dashboards.
6. **Smallest milestone toward an institutional pilot:** M1 complete + M2 core
   (DB + auth + one org) + calibration gate re-run on 5 blinded expert labels —
   that is the minimum honest artefact to show a DIET or B.Ed college.
