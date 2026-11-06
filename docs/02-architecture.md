# 02 — Architecture

## 1. The one-paragraph version

A voice-first rehearsal app: the teacher talks to a simulated child inside a
bounded scenario; a *separate* scorer grades the transcript against a
versioned rubric with verbatim evidence; pure code turns that into
pass / retry / redo / provisional; progress and next-scenario choice follow
deterministically. Everything is swappable behind interfaces (`LlmClient`,
speech, storage), so the same contracts run cloud, on-device, or fully
deterministic with zero keys.

## 2. Module map

```
┌──────────────────────────── web (React, mobile-first) ────────────────────────────┐
│ Onboarding → Home → Practice (voice player) → Review → Feedback → Mastery         │
│ store.tsx (local state + profile)   offline.ts (IndexedDB queue + airplane mode)  │
│ speech.ts (Web Speech hi-IN STT/TTS)   api.ts (typed client)                      │
└───────────────┬──────────────────────────────────────────────────────┬────────────┘
                │ /api (JSON)                                          │ offline
┌───────────────▼──────────────────────────────┐        ┌──────────────▼───────────┐
│ server (Express)                             │        │ IndexedDB sync queue     │
│  sessions → orchestrator → scoreAndStore     │◀───────│ attempts scored on-device│
│  /sync (idempotent upsert)  /cohort (k≥5)    │  sync  │ as provisional           │
│  /export /delete (privacy)  /health /content │        └──────────────────────────┘
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────────────────────────────────────────────┐
│ core (pure, shared)                                                               │
│  types.ts     contracts: Scenario, Rubric, Attempt, ScorerOutput, Decision…       │
│  scoring.ts   normalize → verify evidence → weighted decision (pure)              │
│  evidence.ts  strict verification + morphology-tolerant detection                 │
│  progression.ts applyAttempt, level-up policy, competency EMA                     │
│  selection.ts next scenario targets the measured weakest competency               │
├───────────────────────────────────────────────────────────────────────────────────┤
│ content  rubric.npst-fln-core.json + 6 packs (31 scenarios, zod-validated, hashed)│
│ llm      LlmClient: MockClient (deterministic) | OpenAI-compatible | Anthropic    │
│          ResilientClient wraps cloud → mock fallback; engine recorded per score   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## 3. The attempt pipeline (the heart)

Every attempt — live, offline, synced, or golden — flows through the same
five stages:

1. **Simulate** (`Orchestrator.submitTurn`): teacher turn appended; the student
   client (cloud or mock) replies inside scenario bounds; `done` fires on
   concession or `maxStudentTurns`. Cloud failure rolls the transcript back —
   a teacher's words are never lost to a network blip.
2. **Gate** (`ScoreRequest`): the endpoint *refuses* to score unless
   `heardCorrectly === true` — the transcript-review step from the deck is a
   hard server rule, not UI sugar.
3. **Score** (`LlmClient.scoreAttempt`): per-competency banded scores with
   verbatim quotes, confidence, abstention. `normalizeScorerOutput` clamps,
   de-duplicates, and fills missing required competencies as abstained — a
   malformed model reply degrades to abstention, never to a fabricated grade.
4. **Verify** (`evaluateAttempt`): every quote is re-found in the transcript
   (strict). Unverified evidence → confidence drop; mostly-fabricated evidence →
   competency abstained with an honest reason. Then: coverage and confidence
   gates → weighted score over active competencies using the level's weights →
   critical floors → decision.
5. **Progress** (`applyAttempt` + level-up policy): only *verified,
   non-provisional* attempts move mastery. Passes must span distinct scenarios
   before a level-up.

Concrete numbers (rubric v1.0.0): pass ≥ 0.72, retry ≥ 0.45, critical floor
0.5 (accuracy and misconceptions are critical), min confidence 0.45, min
evidence coverage 0.5, level-up = 2 passes across ≥ 2 distinct scenarios.
L3 weights: misconceptions 0.45 · questioning 0.25 · clarity 0.2 · accuracy 0.1.

## 4. Persona isolation, mechanically

- `buildStudentPrompt(scenario, turns, lang)` — persona, traits, belief,
  resistance ladder, bounds. **No rubric, no weights, no indicators.**
- `buildScorerPrompt(rubric, scenario, attempt)` — rubric indicators, bands,
  cite-or-abstain contract, transcript. **No resistance ladder, no bounds, no
  scripted pushes.** The child's belief is *visible in the transcript* (she says
  it), so the scorer grades the teacher's handling without ever seeing the
  script behind it.
- The two prompts are built by different functions with disjoint inputs; tests
  (`tests/llm.test.ts`) assert leakage cannot happen (e.g. the string
  "rubric"/"indicator"/ladder lines must not appear in the student prompt).

## 5. Detection vs verification (a Devanagari story)

The scripted engine detects behaviours via marker lists. Devanagari inflection
broke naive substring matching two ways, discovered by the calibration harness:

- **False negative**: "गोलियाँ" (marbles, inflected) does not contain "गोली"
  (different vowel length). Fix: consonant-skeleton matching — but *only* for
  markers whose skeleton is ≥ 3 chars, because
- **False positive**: stripping matras makes "किया" (did) contain "क्या"
  (what). Short skeletons collide.

Final matcher (`evidence.ts → textHasMarkers`): strict containment first;
≤ 2-char markers must be standalone tokens ("कम" ≠ कमल); longer markers fall
back to the skeleton. Single punctuation markers ("?") mean "any question".
Meanwhile **quote verification never uses the skeleton** — a fabricated quote
cannot hide behind morphology. Golden attempts in `tools/calibration/` pin this
behaviour; the regression tests encode the किया/क्या and कम/कमल traps.

## 6. Offline-first

- The web app keeps an attempt queue in IndexedDB with client-generated ids
  (`a_uuid`) — the unit of sync, idempotent by construction.
- Airplane mode: sessions run against the on-device (mock) engine; scores are
  recorded **provisional** and shown as such.
- Back online: `POST /api/sync` accepts the batch, re-validates scenario/rubric
  versions, re-scores through the *same* pipeline, upserts by id (duplicates are
  reported, foreign-teacher attempts rejected), and returns fresh state.
- Determinism matters here: the decision layer is pure, so an offline decision
  and a later cloud verification can be compared honestly, and the engine used
  is stamped on every score.

## 7. Privacy engineering

- **Identity**: `teacherId` is a device-generated UUID. No names, no employee
  ids, no school mapping in the data model.
- **Audio**: never uploaded. The STT transcript is shown; scoring requires the
  teacher's explicit "heard me correctly" confirmation.
- **Cohort**: `GET /api/cohort` aggregates attempts per ISO-week × competency
  and suppresses any cell below k (default 5) and any teacher-group below the
  minimum group size. There is no endpoint that returns an individual's attempts
  to anyone holding another device id — session and attempt routes are
  teacher-id-scoped and tested for cross-device 403s.
- **Data rights**: `GET /api/teachers/:id/export` (full JSON export) and
  `DELETE /api/teachers/:id` (everything, including sessions) — both tested.
- **DPDP posture**: purpose limitation is structural (practice + anonymised
  trends only); retention is teacher-controlled via delete.

## 8. Content packs as governed artifacts

`src/content/` is the "versioned skill files" idea from the deck, made
concrete:

- `rubric.npst-fln-core.json` — competencies, indicators, NPST/TEACH refs,
  per-level weights, decision policy. On load: zod-validated, then **SHA-256
  hash-pinned**; the hash rides on `/health`, every attempt record, and the
  calibration report.
- 6 scenario packs (31 scenarios) — each with curriculum refs (NCERT book
  chapters), a named child persona, misconception spec (belief → resistance
  ladder → concession), bounds (`mustNotReveal`), detection markers for the
  scripted engine, and expert `expectedBehaviors` that feedback draws from.
- Adding a language/subject = adding a pack file; zero code changes.

## 9. What production Android changes (and what it doesn't)

| Layer | This build | Production |
|---|---|---|
| App | React PWA | Same UI in an Android shell (TWA/Capacitor); IndexedDB → SQLite |
| STT/TTS | Web Speech | Sarvam / AI4Bharat adapters behind the same speech interface; audio retries on low confidence |
| Student/scorer | Cloud `LlmClient` + mock | LiteRT-LM (Gemma 3n E4B, PLE) on ~8 GB phones; E2B on 4–6 GB; scripted-only below — same `LlmClient` interface |
| Decisions | Pure functions | Unchanged — identical code, identical weights file |
| Privacy | k-anonymised cohort API | Same, plus DPDP review and on-device LLM keeping transcripts fully offline |

The deck's "same rubric, same scenarios, same scoring code in both modes" is
literal here: `core/` has no I/O and no provider imports.
