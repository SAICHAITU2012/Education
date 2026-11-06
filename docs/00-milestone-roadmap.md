# 00 — Master roadmap: V0 → production-ready product (milestone-based)

The master execution plan. Adopted 2026-11-06 from the product-strategy review;
supersedes the *phase scheduling* in [06-production-plan.md](06-production-plan.md)
(§4), which remains valid as strategic context (positioning, cost model, GTM
channels, architecture decisions). Milestones complete on **exit-criteria
evidence, not dates**. Implementation backlogs live under each milestone —
see [09-technical-debt.md](09-technical-debt.md) for the current one.

**Status: M0 complete ✅ · M1 executed (2026-11-06, 7 commits: baseline, TD-02 fix
+ regression, CI, doc integrity, security hardening, Docker (smoke-tested),
logging + backup drill — 81 tests, calibration gate PASS, restore drill
verified) · GitHub push + branch protection pending (no `gh` CLI on this
machine) · M2 (Postgres, auth, tenancy) not started.**

---

## The eight milestones

| # | Milestone | Objective | Status |
|---|---|---|---|
| M0 | Comprehensive audit & product understanding | Establish exactly what exists, with evidence | ✅ **Done** → [07](07-current-state-audit.md), [08](08-architecture.md), [09](09-technical-debt.md) |
| M1 | Engineering foundations & stabilisation | Reliable, maintainable, secure, deployable | Next |
| M2 | Production backend & infrastructure | Real DB, auth, tenancy, privacy, ops | Blocked by M1 |
| M3 | AI intelligence, voice & performance | Natural, reliable, affordable AI | Overlaps M2 |
| M4 | Educational validation & trust | Evidence that Abhyas measures teaching | Starts before M3 ends |
| M5 | Product experience & features | Complete teacher-facing product | Overlaps M3/M4 |
| M6 | Real-world institutional pilot | Validate with real teachers/institutions | Needs M2+M4 core |
| M7 | Commercialisation & government adoption | Sustainable business, institutional adoption | Needs M6 evidence |

---

## M0 — Comprehensive audit & product understanding ✅

**Objective:** establish the real baseline; independently verify every claim.

**Done as:** [07-current-state-audit.md](07-current-state-audit.md) (verification
log + feature matrix), [08-architecture.md](08-architecture.md) (verified
current + target architecture), [09-technical-debt.md](09-technical-debt.md)
(debt register + prioritised backlog).

**Exit criteria met:** every important feature classified
implemented/partial/broken/absent with file:line evidence; tests, build and
calibration gate independently re-run (72/72, build clean, gate PASS);
doc-rot identified (README IndexedDB claim, roadmap holdout claim); no code
modified.

## M1 — Engineering foundations & stabilisation

**Objective:** make the existing app reproducible, secure and deployable
*without changing working components*.

**Scope in:** git + branch protection, CI/CD, bug fixes (TD-02), doc-rot fixes
(TD-12), Docker, env/config management, security headers + CORS allowlist +
trust proxy, structured logging, staging deploy, backup & restore.
**Scope out:** database, auth rewrite, feature work.

**Exit criteria:** a clean checkout builds, tests and deploys to staging; a
backup is restored successfully once; CI gates every PR (typecheck → test →
calibration `--gate` → build).

## M2 — Production backend & infrastructure

**Objective:** replace prototype infrastructure without touching the
assessment engine.

| Workstream | Implementation |
|---|---|
| Database | PostgreSQL, schema, migrations; storage abstraction + JSON importer |
| Auth | Phone-OTP + JWT behind feature flag; device-pseudonymous mode retained |
| Authorisation | RBAC (5 roles) + ownership checks on every sensitive route |
| Multi-tenancy | Org → school → teacher hierarchy; **one controlled pilot org first** |
| Privacy | Consent ledger, retention TTL, deletion workflows |
| Auditability | Access + admin audit logs |
| AI operations | Usage/cost tracking, per-org budget caps |
| Reliability | Persistent rate limiting, monitoring, backups |

**Exit criteria:** two test organisations cannot see each other's data; export,
deletion and audit workflows verified; AI spend provably capped.

## M3 — AI intelligence, voice & performance *(iterative with M4/M5)*

**Objective:** natural, reliable, affordable AI experience.

- **A. Simulation:** richer student personalities/levels, realistic
  misconceptions, adaptive difficulty (authored bounds stay).
- **B. Assessment:** consistency, evidence-grounded feedback, preserve
  deterministic scoring, better abstention handling; **separate
  simulation-model and scoring-model configurations** — a model good at chat
  is not automatically good at judging.
- **C. Voice:** Sarvam STT/TTS with browser fallback; Hindi + English; regional
  accent evaluation; latency measurement.
- **D. AI infrastructure:** provider-independent gateway, streaming, token/cost
  tracking, fallback to deterministic engine, caching where rubric-bounded,
  budget/rate controls.

**Exit criteria:** full rehearsal stable with measurable latency, quality and
expenditure; documented fallback mechanism.

## M4 — Educational validation & trust *(starts before M3 completes)*

**Objective:** evidence that Abhyas is educationally credible, not just
technically functional. This is the differentiator and the procurement asset.

- 5–10 experienced educators; common evaluation protocol; NPST/rubric review.
- 100+ representative teacher attempts, blind-assessed by independent
  evaluators; compare AI vs human; inter-rater agreement first (it bounds
  achievable AI agreement).
- Bias, accent and language variation analysis; validate improvement across
  repeated practice.
- **Do not force AI to agree with every human — human disagreement itself must
  be understood and reported.**

**Deliverables:** evaluation dataset, AI-vs-human report, rubric governance
docs, Educational Evidence Pack (incl. limitations and failed evaluations).

**Exit criteria:** assessment quality meets pre-defined thresholds
(MAE ≤ 0.25, decision agreement ≥ 70% on blinded labels — the existing
`--gate`); limitations documented; independently reviewable.

## M5 — Product experience & feature enhancement *(overlaps M3/M4)*

| Product area | Features |
|---|---|
| Teacher dashboard | Progress, history, competencies, recommended practice |
| Classroom simulation | Realistic student interactions (with M3.A) |
| Assessment | Competency-wise evidence-linked feedback |
| Analytics | Individual progress + protected k-anonymised aggregates |
| Scenario library | Categories, levels, curriculum mapping |
| Content management | Authoring, editing, approval workflow |
| Languages | Hindi (100%), English, Kannada |
| Accessibility | WCAG 2.1 AA / GIGW-oriented fixes |
| Offline | Reliable practice + sync (already built — polish) |

**Standing product rule:** individual teacher scores stay invisible to
administrators *by construction*; institutional analytics are aggregated and
k-anonymised only.

**Exit criteria:** teachers independently complete rehearsals, understand
feedback, and track progress without facilitator help.

## M6 — Real-world institutional pilot

**Objective:** validate in actual educational environments.

**Setup:** 20–50 teachers · 2–3 institutions (DIET-mediated) · limited
validated scenario set · one language · educator supervision.

| Evaluation area | Success indicator |
|---|---|
| Adoption / engagement | Teachers actively use and complete rehearsals |
| Retention | Teachers return (weekly-active ≥ 60% proposed) |
| Educational value | Measurable competency improvement on holdouts |
| Reliability | Low failure/interruption rates on ₹8–10k phones |
| Accessibility | Works on affordable devices, poor connectivity |
| Economics | Cost per active teacher measured, then optimised |
| Trust | Teachers understand and trust assessments |

**Exit criteria:** demonstrated repeated usage, educational value, acceptable
costs, zero critical security incidents.

## M7 — Commercialisation & government adoption

**Objective:** sustainable institutional product.

- **Institutional:** B.Ed colleges, TEIs, private school networks, NGOs,
  DIETs/SCERTs — *this channel pays first; government pays later.*
- **Government ecosystem:** NISHTHA complement (not replacement), DIKSHA
  integration opportunities, NPST mapping, NDEAR interoperability **as
  standards alignment — never claimed as endorsement/certification**, state
  partnerships via one district first, GeM exploration.
- **Business:** licensing + unit economics (validated against measured pilot
  costs — see cost-model correction in [07](07-current-state-audit.md) §6),
  onboarding, support, security assessments, CSR/grant partnerships.

**Exit criteria:** one paid or funded institutional pilot with a defined
procurement pathway; repeatable deployment; sustainable economics.

---

## Cross-milestone workstreams (always on)

| Workstream | Ongoing activity |
|---|---|
| Security | Threat modelling, dependency scanning, vulnerability testing |
| Testing | Unit → integration → E2E → load, as each becomes possible |
| AI evaluation | Calibration gate on every engine/model change |
| Privacy | Data minimisation, retention, audit-log discipline |
| Documentation | Architecture and API docs stay true to code |
| Observability | Logs → metrics → incident tracking |
| Cost optimisation | AI, infra, storage reviewed monthly against measured usage |
| Educational research | Educator feedback loop into rubric versions |

## Dependency map

```
M0 ──▶ M1 ──▶ M2 ──▶ M3 ──┐
              │           ├──▶ M6 ──▶ M7
              └──▶ M4 ────┤     ▲
                   ▲      └─ M5 ┘
                   └── overlaps M3 (begin validation before AI work ends;
                       feed findings back into M3 assessment tuning)
```

## Priority matrix

| Priority | Work | Why |
|---|---|---|
| **P0** | M0 ✅, git baseline, bug fixes, CI/staging, security hardening, DB + auth, educator evaluation setup | Nothing else is credible without these |
| **P1** | AI gateway + cost tracking, streaming + voice, scenario expansion, teacher dashboard, accessibility, institutional onboarding | Quality and completeness |
| **P2** | Advanced analytics, more languages, Classes 4–8, Android distribution, on-device LLM, NDEAR integration, large-scale govt | Only after validation |

**Deliberately postponed:** native iOS, microservices/Kubernetes, multi-language
and multi-subject expansion before the first validated experience.

## Milestone management discipline

Every milestone carries exactly five things: **Objective · Scope (in/out) ·
Tasks · Deliverables · Exit criteria.** A milestone closes only when its exit
criteria are demonstrably met — evidence, not calendar.

## What success looks like (three product milestones, not one)

| Milestone | Meaning |
|---|---|
| **V1 — Production-capable** | Secure, deployed, backed up, monitored, tested (M1+M2) |
| **V2 — Pilot-validated** | Real teachers use it; educators validate assessments; costs measured (M4+M6) |
| **V3 — Institution-ready** | Multi-tenancy, privacy controls, support, evidence, deployment process (M5+M7) |

Government-ready is an adoption milestone beyond V3, not a software release.
