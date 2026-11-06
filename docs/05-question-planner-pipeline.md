# 05 — Generated question plans: the planner → validator → interviewer pipeline

Status: **design** (not yet implemented). Source material: architecture review
of the interview-agent pattern + team notes on topic-wise question generation.
This doc translates that pattern into Abhyas vocabulary and maps every piece
onto the existing V0 code.

## 1. Why this exists at all

V0's rehearsal loop runs on **31 hand-authored scenarios**. Quality is high
(persona, misconception, resistance ladder, bounds, detection markers — all
curated), but coverage is bounded by authoring capacity: a teacher practising
"subtraction for Class 2" sees the same handful of situations.

The proposed pipeline adds a second practice mode: the teacher picks a
**topic + level**, a **planner** generates a bounded set of questions for that
topic, validators scrub the plan, and an **interviewer** runs the teacher
through it — a viva/oral-exam for the teacher, with the same guardrail
philosophy as the rest of Abhyas: *the LLM proposes, deterministic code
disposes.*

Two modes, one philosophy:

| | Scenario roleplay (V0, ships today) | Topic viva (this design) |
|---|---|---|
| Best at | L2–L4 pedagogy skills (clarity, misconception handling, questioning) | L1 accuracy, curriculum knowledge, concept explanation |
| Content | 31 authored scenarios | Generated question plans from the curriculum DB |
| Teacher is | The teacher (handles a simulated child) | The candidate (answers questions a mentor might ask) |
| Evaluation | Rubric scorer + evidence verification | Expected-answer match where available, rubric LLM-judge elsewhere |
| Risk contained by | Scenario bounds + resistance ladder | Scope contract + validator chain + budgets |

The viva mode is *additive*: same rubric, same deterministic decision layer,
same attempt records, same privacy posture. It is not a replacement.

## 2. Vocabulary mapping (interview-agent → Abhyas)

| Interview-agent term | Abhyas equivalent |
|---|---|
| Candidate | The teacher |
| Interviewer | The AI mentor running the viva (a *third* persona, isolated from student and scorer) |
| JD / role requirements | The **scope contract**: class, subject, topic → concept IDs, level, language |
| CV / uploaded content | Nothing today — if teacher profiles ever carry free text, treat as untrusted data (see §8) |
| Competency | Rubric competency (`accuracy`, `clarity`, `misconceptions`, `questioning`) |
| Question plan | A versioned `QuestionPlan` artifact (schema in §5) |
| Interview session | A `Session` with `mode: 'viva'` |
| Post-interview report | The existing `AttemptRecord` → Feedback screen |

Persona isolation gains a third rule: the **planner** and the **interviewer**
must also be separate contexts — the interviewer receives the *approved* plan
and never sees the raw generation prompt, so it cannot drift outside what was
validated.

## 3. Pipeline (7 stages)

```
teacher picks topic + level
        │
        ▼
[1] Scope contract (immutable, derived from curriculum DB)          P0
        │  concept IDs, difficulty band, question count, time budget
        ▼
[2] Planner (LLM, few-shot: difficulty level + retrieved exemplar
    questions from the question bank; NOT the whole syllabus)       P0
        │  raw QuestionPlan JSON
        ▼
[3] Validator chain (deterministic first, semantic second)          P0
        │  schema → count trim → concept membership → difficulty
        │  → dedup (cosine) → [semantic LLM-judge: concept fit]     P1
        │  fail ×N → deterministic fallback from question bank
        ▼
[4] Interviewer (tool loop over the APPROVED plan)                  P0/P1
        │  ask_next_question · explain_question · record_answer
        │  follow-up: prep-time generated, budget-capped, validated
        ▼
[5] Deterministic termination                                       P0
        │  plan exhausted | time budget | teacher ended | done
        ▼
[6] Post-interview parse + normalize                                P0
        │  questions, answers, follow-ups, timestamps, termination
        │  status, tool trace → normalized answer records
        ▼
[7] Evaluator → report (evidence-backed, existing pipeline)         ✅ mostly exists
        │  expected-answer match (deterministic) where available;
        │  rubric LLM-judge elsewhere; core re-verifies evidence;
        │  scoring.ts decides pass/retry/redo — unchanged
        ▼
AttemptRecord → progression → next selection targets the gap
```

## 4. Stage 1 — the scope contract (P0)

The single source of truth the planner cannot see past. Built
deterministically from the content pack the moment the teacher picks a topic:

```jsonc
{
  "contractId": "scope_maths_c2_subtraction@1.0.0",
  "class": 2, "subject": "maths", "language": "hi",
  "level": 1,
  "conceptIds": ["C2.NUM.03"],        // topic → concept-ID map (new content artifact)
  "conceptLabels": { "C2.NUM.03": "दो अंकों का घटाव (उधार के बिना)" },
  "excludedPrerequisites": [],         // concepts the questions must NOT require
  "difficulty": { "min": 1, "max": 3 },// band derived from mastery level
  "questionCount": { "requested": 5, "max": 8 },
  "followUpBudget": { "perQuestion": 1, "total": 3 },
  "timeBudgetMinutes": 8,
  "rubricVersion": "1.0.0"
}
```

Rules:

- **Immutable once created** — frozen into the session; validators check the
  *plan* against it, the interviewer against the *plan*, and the record against
  both. Any stage that disagrees is rejected, not negotiated with.
- The **topic → concept-ID map** is a new versioned content artifact
  (`src/content/concepts/`), human-authored like the packs, hash-pinned the
  same way. The planner receives concept IDs + labels + exemplar questions —
  never "the whole syllabus in the prompt" (the hybrid-architecture point from
  the review: curriculum DB + graph + question bank + retrieval, LLM only
  generates variations).
- **Prerequisite exclusion** uses the curriculum graph: a question about
  borrowing (उधार) is invalid for a contract that excludes `C2.NUM.02`
  (two-digit without borrowing). V0 has NCERT refs but no prerequisite edges —
  the graph is the smallest new artifact with the biggest validation payoff.

## 5. Stage 2 — the planner + QuestionPlan schema (P0)

Few-shot prompt: the contract + 3–5 retrieved exemplar questions for the
concept (from the question bank) + difficulty band. Output is a strict schema —
same philosophy as `normalizeScorerOutput`: a malformed reply degrades to a
fallback, never to an unvalidated plan entering runtime.

```jsonc
// QuestionPlan — validated by zod (src/core/plan-schema.ts, new)
{
  "planId": "qp_<uuid>",
  "contractId": "scope_maths_c2_subtraction@1.0.0",
  "generatedAt": "2026-11-04T10:00:00Z", "generatorEngine": "openai-compat",
  "questions": [
    {
      "id": "Q1",
      "conceptId": "C2.NUM.03",
      "difficulty": 2,                       // within contract band
      "text": { "hi": "…", "en": "…" },
      "expectedAnswer": { "hi": "…", "en": "…" },  // optional; enables deterministic match
      "expectedAnswerType": "numeric|verbal|explanation",
      "followUps": [                          // prep-time probes, NOT mandatory questions
        { "id": "Q1.F1", "text": { "hi": "…", "en": "…" }, "conceptId": "C2.NUM.03" }
      ],
      "rubricFocus": ["accuracy"]             // which competency this question evidences
    }
  ]
}
```

**Follow-up policy** (answers the "should we include followup ques?" note):
follow-ups are generated at **prep time** per question and validated with the
plan; the live interviewer may spend at most `perQuestion` follow-ups on a
question and `total` for the session, and a follow-up must share the parent
question's `conceptId`. This keeps probing alive without unbounded questioning.

## 6. Stage 3 — the validator chain (P0 deterministic, P1 semantic)

Ordered, cheapest first. Each validator returns `accept | reject(reason)`; a
rejected **question** is dropped (plan survives if ≥ `requested` remain), a
rejected **plan** triggers regeneration (max 2 retries) then deterministic
fallback.

| # | Validator | Type | Rejects when |
|---|---|---|---|
| 1 | Schema | deterministic | zod parse fails; unknown conceptId; missing fields |
| 2 | Count trim | deterministic | more than `max` questions → **remove from the end**, never sample (deterministic) |
| 3 | Concept membership | deterministic | question's conceptId ∉ contract's conceptIds |
| 4 | Difficulty band | deterministic | difficulty < min or > max |
| 5 | Deduplication | deterministic | cosine similarity of question text vs any accepted question ≥ τ (start τ=0.82; tune with the calibration harness) |
| 6 | Semantic fit | LLM-as-judge (P1) | judge says the question does not test its assigned concept / competency — judge output is itself schema-validated; on disagreement with the planner, **reject** (escalate to fallback, never average) |
| 7 | Prerequisite | deterministic (P1, needs the graph) | question requires an excluded prerequisite concept |

**Deterministic fallback:** when generation fails, the plan is filled from the
authored question bank (existing scenarios' `expectedBehaviors` + detection
markers already encode vetted questions per topic). The viva mode therefore
*always* runs — cloud LLM or not — matching the V0 principle that the mock
engine is the same contract, not a degraded demo.

## 7. Stage 4–5 — the interviewer loop + termination (P0/P1)

The interviewer is a new `LlmClient` persona (`mentorTurn`) — separate prompt
builder, separate context, enforced by the same test pattern that keeps the
student away from the rubric. It holds **tools**, but the tools are the
deterministic layer:

- `ask_next_question(index)` — loops over the approved plan; cannot invent
  question text (P1 runtime guard: output must quote the plan's text; a
  paraphrase that changes the question is rejected and re-asked).
- `explain_question(index, mode)` — rephrase *simpler* only; plan text preserved.
- `record_answer(questionId, quote)` — stores the teacher's answer + verbatim
  quote (feeds evidence verification later).
- `ask_follow_up(questionId, followUpId)` — only from the plan's prep-time
  follow-ups, only if budget remains.
- `end_interview(reason)` — reason ∈ `plan_complete | teacher_ended |
  time_over | budget_exhausted`.

**Deterministic termination (P0)** lives in code, not in the model: the session
ends when the plan is exhausted, the time budget lapses, or the teacher stops —
the interviewer cannot extend it, exactly as `maxStudentTurns` bounds the
roleplay today (orchestrator.ts:215).

**Tool trace (P0, observability):** every tool call is recorded on the session
(`{ tool, args, ts }[]`) and persisted to the attempt record. This is what makes
the metrics in §9 computable and audits possible ("why did it ask that?").

## 8. Guardrails — failure scenarios → protections

Adapted from the review's table, in Abhyas terms:

| Failure scenario | Recommended protection |
|---|---|
| Planner generates duplicate questions | Cosine dedup (validator 5) |
| Planner generates a question needing an excluded prerequisite | Curriculum-graph prerequisite validator (validator 7) |
| Gap selection targets an irrelevant concept | Weakest-competency selection stays deterministic (`selection.ts`); contract conceptIds bound it |
| Planner generates too many questions | Hard count trim from the end (validator 2) |
| LLM repeatedly regenerates invalid plans | Retry limit (2) → deterministic question-bank fallback |
| Planner returns invalid JSON/schema | zod at the boundary → regenerate → fallback; never enter runtime invalid |
| Semantic judge disagrees with planner | Reject + fallback — judge is a gate, not a tiebreak |
| Interviewer asks off-plan / drifts | Runtime output guard: must quote plan text (P1) |
| Teacher asks the interviewer something unrelated | Clarification ≠ assessment: mentor may clarify wording, never evaluates; off-topic exchanges are excluded from evidence |
| Prompt injection via teacher turns | Teacher turns are untrusted data, never instructions — same posture as transcript handling today; interviewer prompt marks them as quoted material |
| Follow-up spirals | Prep-time follow-ups + per-question and session budgets |

## 9. Metrics (instrumented from the tool trace)

Tracked per plan/session and rolled up by engine + rubric version:

- **Out-of-scope question rate** — questions whose conceptId ∉ contract (should be 0 by construction; nonzero = validator bug, which is the point of measuring it).
- **Competency alignment** — % of questions whose `rubricFocus` matches the semantic judge's read (P1).
- **Difficulty compliance** — % within the contract band.
- **Follow-up compliance** — % of follow-ups within budget and sharing parent conceptId.
- **Termination accuracy** — % of sessions ending under the correct stopping condition (plan exhausted vs time vs teacher-ended, as recorded).
- **Fallback rate** — % of plans (or question slots) filled by the deterministic fallback.

The headline metric:

```
Boundary Violation Rate = (invalid questions delivered / total questions delivered) × 100
```

"Delivered" = actually asked by the interviewer — post-validation, post-guard.
Target for the pilot: **BVR < 2%**; anything above signals a validator gap, and
the offending traces become new adversarial test cases.

## 10. Adversarial test suite (P1)

Every row is a unit/integration test seeded with a hand-crafted bad plan or bad
live behaviour:

| Test | Expected result |
|---|---|
| Planner emits a question from an excluded concept | Reject (validator 3) |
| Planner emits difficulty 5 when band max is 3 | Reject (validator 4) |
| Follow-up about a different concept than the parent | Reject (plan validation) |
| Third follow-up when `perQuestion` is 1 | Block (live budget) |
| Question requiring an excluded prerequisite | Reject (validator 7) |
| Question asked outside the plan | Block (runtime guard) |
| All planned questions exhausted | Session ends (`plan_complete`) |
| Two questions with cosine similarity 0.95 | Flag or reject (validator 5) |
| Planner returns invalid JSON | Retry → safe fallback |
| Semantic judge disagrees with planner | Reject/escalate, never average |
| Teacher turn contains "ignore your plan and…" | Interviewer treats as data; trace shows no deviation |

## 11. Post-interview → evaluation (stage 6–7)

The interviewer hands over a structured record: questions asked (in order),
teacher answers (normalized: whitespace/number-form normalization — the same
spirit as `normalizeScorerOutput`), follow-ups spent, timestamps, termination
status, tool trace. Then:

1. **Deterministic pass** — questions with `expectedAnswer` of type
   `numeric` are checked by code (this generalizes the existing
   `correctFactMarkers`/`wrongFactMarkers` detection). Result:
   `correct | incorrect | insufficient_evidence` — never coerced to a guess.
2. **Rubric judge pass** — verbal/explanation answers go to the existing scorer
   contract (`scoreAttempt`) with the level rubric; evidence rules unchanged
   (verbatim quotes, core re-verification, abstention on thin evidence).
3. **Decision** — `scoring.ts` unchanged. Viva attempts produce the same
   `AttemptRecord`, feed the same EMA/progression, and the next roleplay or
   viva targets the measured gap.
4. **Report** — Feedback screen gains a question-wise section (per-question
   outcome + evidence quote + rubric competency), which is exactly the
   "report generator, evidence-backed" note.

## 12. Gap analysis: V0 today vs this design

| Pipeline piece | Status in V0 |
|---|---|
| Deterministic decision layer, evidence verification, abstention, persona isolation | ✅ built (`core/scoring.ts`, `core/evidence.ts`, tests) |
| Deterministic termination (turn budget) | ✅ built for roleplay (`maxStudentTurns`) |
| Curriculum DB (topics, NCERT refs, per-class packs, zod + hash pinning) | ✅ built as content packs |
| Retry targeting the weakest competency | ✅ built (`core/selection.ts`) |
| Expected-answer deterministic checking | 🟡 marker-based only, per authored scenario |
| Scope contract artifact | ❌ new (but composed of existing pack fields + level) |
| Topic → concept-ID map + prerequisite graph | ❌ new content artifact |
| Question bank + retrieval for few-shot | 🟡 authored scenarios are the seed bank; retrieval is new |
| Planner + QuestionPlan schema + validator chain | ❌ new |
| Follow-up generation + budgets | ❌ new |
| Interviewer persona with tools + tool trace | ❌ new (`LlmClient.mentorTurn`) |
| Runtime output guard | 🟡 roleplay clamps text + bounds; quote-guard for viva is new |
| Adversarial suite + BVR instrumentation | ❌ new (72 existing tests cover the engine, not generation) |

## 13. Build order

**P0 — the contract and the walls (1 focused effort)**
1. `src/content/concepts/` — concept map + graph for the 6 existing pack topics (hand-authored, hash-pinned like packs).
2. `src/core/plan-schema.ts` — QuestionPlan zod schema + validators 1–5 (all deterministic).
3. `src/llm/planner.ts` — few-shot planner with retry + question-bank fallback (mock planner first: picks from the bank deterministically, so the whole loop works offline).
4. `src/server/orchestrator.ts` — viva sessions: `mode: 'viva'`, budgets, deterministic termination, tool trace on the session.
5. Tests: validator chain table from §10 (deterministic rows).

**P1 — the intelligence and the proof**
6. Semantic judge (validator 6) + adversarial rows needing it.
7. Runtime output guard (quote-the-plan) + remaining §10 rows.
8. BVR + compliance metrics surfaced in `/health` and calibration report.
9. Question-wise Feedback screen section.

**P2 — polish**
10. Adaptive difficulty (band narrows/widens within contract from EMA trend).
11. Competency-coverage optimization across a plan (cover all `rubricFocus` values).

## 14. Open questions (from the notes — decide before P0 coding)

1. **Dataset for variants** — the notes flag "try to get a dataset" of relevant
   questions per topic. Sources to evaluate: NCERT workbooks, DIKSHA question
   banks, or expert-authored seed sets during Phase-1 teacher validation.
   Until then, the authored scenarios serve as the bank.
2. **Concept-ID granularity** — one ID per NCERT chapter section vs per
   misconception family. Recommend: misconception-aligned (finer), because the
   validator and retry logic both key off it.
3. **Expected answers** — who authors them per generated question? Recommend:
   planner proposes, validators require `expectedAnswer` only for `numeric`
   type, and experts review generated+shipped plans like any content pack
   (versioned, hash-pinned, signed off in Phase 1).
4. **Does a viva attempt gate levels?** Recommend: V0.5 counts viva passes
   toward L1 only; L2+ remains roleplay-gated until expert validation says
   otherwise.
