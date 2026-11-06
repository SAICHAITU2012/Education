# Abhyas — अभ्यास: practice before you teach

An AI practice layer where government-school teachers **rehearse real classroom
moments, by voice, with a simulated student**, get **evidence-cited rubric
feedback**, and retry — before facing real children. Built for the Seva First
Innovation Challenge (Team CogniX · SEVA31417).

```
Teacher speaks ──▶ AI student pushes back ──▶ separate AI scores with evidence
                                                        │
                    code decides (fixed weights) ◀──────┘
                              │
              pass / retry / provisional → next scenario targets the gap
```

## What makes this build honest

| Principle | How it is enforced here |
|---|---|
| **Humans set the standard** | Rubric is a versioned, hash-pinned JSON file (`src/content/rubric.npst-fln-core.json`), NPST/TEACH-aligned. The LLM cannot invent criteria — the prompt gets only the rubric, and `zod` validates the pack on load. |
| **Persona isolation** | The student who challenges you is never the one who grades you. Student and scorer contexts are built by separate functions; tests assert the student prompt never sees the rubric and the scorer never sees the student's hidden resistance ladder. |
| **Evidence-cited scoring** | Every competency score must cite verbatim quotes from the teacher's transcript. `verifyEvidence()` re-checks every quote; fabricated evidence lowers confidence and forces abstention. |
| **Abstain, never guess** | Thin evidence or low confidence → the attempt is **provisional**: no score movement, honest reason shown. Offline scores stay provisional until verified online. |
| **Code decides** | Weighted scoring, floors, thresholds and level-ups are pure functions (`src/core/scoring.ts`) — same attempt, same result, online or offline. |
| **Private by design** | Device-generated pseudonymous ids, transcript-review gate before scoring, k-anonymised cohort endpoint (n ≥ 5), one-click data export + delete. Audio never leaves the device — only the reviewed transcript is sent. |
| **Model-agnostic** | `LlmClient` interface with deterministic mock (default, always works), OpenAI-compatible and Anthropic adapters. Cloud failure → deterministic fallback; the engine used is recorded on every score. |
| **Offline-first** | Airplane-mode in the app: attempts queue in IndexedDB, scored by the on-device engine, synced idempotently later, then verified. |

## Quick start

```bash
npm install
npm run dev          # server on :8787, web on :5173
```

Open http://localhost:5173 — pick a class, subject and language, and start a
5-minute rehearsal. Chrome/Edge give you Hindi speech recognition and
text-to-speech; everything else works on any browser with typing.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server + web (proxied) |
| `npm test` | 72 unit/integration tests (engine, evidence, isolation, HTTP API, offline sync) |
| `npm run calibration` | **AI vs experts**: scores 8 expert-labelled golden attempts through the full pipeline and reports agreement |
| `npm run calibration -- --gate` | CI gate: exit 1 unless MAE ≤ 0.25 and decision agreement ≥ 70% |
| `npm run seed` | Populate anonymised synthetic cohort data for the trends dashboard |
| `npm run build` | Typecheck + production web build (served by the API process) |

### Optional cloud models

No API key is needed — the deterministic engine runs the full loop. To use a
cloud model for the student and scorer:

```bash
cp .env.example .env
# then set OPENAI_API_KEY (any OpenAI-compatible endpoint) or ANTHROPIC_API_KEY
```

`LLM_PROVIDER=anthropic npm run calibration` calibrates the Claude path against
the same golden set.

## Repository layout

```
src/core/       contracts + deterministic engine (scoring, evidence, progression, selection)
src/content/    versioned content packs: rubric + 6 scenario packs (maths & hindi, classes 1–3)
src/llm/        swappable model layer: mock student/scorer, OpenAI-compatible, Anthropic, prompts
src/server/     Express orchestrator: sessions, scoring, sync, privacy, cohort analytics
src/web/        voice-first React app: rehearsal player, transcript review, feedback, mastery map
tools/calibration/  golden attempts + AI-vs-expert harness
tests/          engine, evidence, LLM contract and HTTP integration tests
docs/           research findings, architecture, rubric governance, roadmap
```

## The rehearsal loop

1. **Practice** — a curriculum-scoped scenario in the teacher's own class,
   subject and language (a Class 3 Maths level never wanders outside Class 3 Maths).
2. **Simulate** — the AI student opens with a real misconception ("if 5 − 3 is 2,
   why isn't 3 − 5 also 2?") and pushes back inside authored bounds.
3. **Review** — the teacher confirms the transcript ("heard me correctly" gate).
4. **Evaluate** — a separate scorer pass grades against the fixed rubric,
   quoting the teacher's own words; core re-verifies every quote.
5. **Decide** — deterministic weights produce pass / retry / redo / provisional.
   Level-ups require passes across distinct scenarios.
6. **Retry** — the next scenario targets the measured weakest competency.

## V0 scope (deliberately small)

Classes 1–3 (FLN) · Hindi (romanised classroom Hindi) · 4 competencies ·
6 content packs · one complete rehearsal loop end-to-end — then scale on the
same architecture. See `docs/04-roadmap.md`.

## Key docs

- [Research findings](docs/01-research-findings.md) — what Mursion/TeachFX/Edthena and the LLM-judge literature taught us
- [Architecture](docs/02-architecture.md) — contracts, isolation, offline sync, privacy engineering
- [Rubric governance](docs/03-rubric-governance.md) — NPST/TEACH mapping, weights, thresholds, versioning
- [Roadmap](docs/04-roadmap.md) — validation plan, pilot design, scale path
