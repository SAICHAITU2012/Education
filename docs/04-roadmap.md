# 04 — Roadmap: from this build to a measured pilot

## Where this build sits

This repository is the **V0 rehearsal loop, end to end** — the deck's promise
("one complete rehearsal loop, end to end. Then scale on the same
architecture") made runnable: 31 scenarios across Classes 1–3 Maths & Hindi,
voice-first practice, evidence-cited scoring, deterministic decisions, offline
sync, privacy-preserving cohort trends, and a calibration harness that measures
the AI against expert labels.

## What is measured today vs what must be measured in the field

| Metric | Today (this repo) | Pilot target |
|---|---|---|
| AI↔expert agreement | MAE 0.066, decision agreement 100% on 8 authored goldens | Expert-blinded labels from practising teachers on unseen scenarios |
| Speech accuracy | Browser STT (hi-IN) | WER by region and noise level (Sarvam/AI4Bharat), teachers' "heard me correctly" rate |
| Retry rate | Instrumented in every decision | Target: falling within 3 attempts per scenario |
| Provisional rate | Reported by calibration | < 10% of attempts; higher ⇒ audio/coverage problem, not a teacher problem |
| Pre→post transfer | Schema, selection and level-up logic all honour `holdout: true`, but no pack marks one yet (M0 audit, 2026-11-06) — packs gain holdout items before the pilot | Pre-test → practice → post-test on unseen scenarios, expert-blinded |

## Phase 1 — Expert validation (weeks 1–4)

- Practising teachers review every competency, indicator and scenario
  (the rubric JSON + packs are the review artifacts).
- Extend `tools/calibration/golden.json` with labels from ≥ 3 independent
  experts; compute inter-expert agreement first — it bounds what the AI can
  achieve.
- Freeze rubric v1.1 with the gate (`--gate`) as a CI requirement.

## Phase 2 — Field pilot (weeks 5–12), 10–20 teachers, 2–3 government schools

- Android shell (TWA/Capacitor) around this UI; Hindi STT via Sarvam with
  browser-engine fallback; session length capped at 5–10 minutes.
- DIET-mediated recruitment; consent in Hindi; data-rights briefing
  (export/delete demonstrated live).
- Measure: completion rate, retry curve, provisional rate, "heard me
  correctly" rate, and a pre/post transfer test on holdout scenarios.
- Complex cases escalate to human mentors (the district layer from the deck) —
  the anonymised trend heatmap prepares mentors' visits.

## Phase 3 — Local-first scale (months 4–8)

- On-device path: LiteRT-LM + Gemma 3n E4B (PLE) on ~8 GB phones; E2B on
  4–6 GB; scripted scenarios below that. The `LlmClient` boundary means this is
  an adapter, not a rewrite.
- Kannada pack (the deck's second language), then Tamil/Telugu/Malayalam —
  content packs, not code changes.
- DIKSHA/state integration for anonymised cohort feedback into the next
  training cycle.

## Risks and honest mitigations

| Risk | Mitigation |
|---|---|
| Teachers don't talk to a machine (voice hesitation) | Transcript-review gate; typing always available; pilot measures it rather than assuming |
| Scoring drift across model changes | Hash-pinned rubric + golden calibration gate on every engine swap |
| "Practice tool" drifts into "evaluation tool" | No supervisor-facing individual endpoint exists; k-anonymised aggregates only; attempts non-exportable to admins by construction |
| Hindi script edge cases (inflection, code-mixed roman) | Strict verification / tolerant detection split with regression tests; content-level marker curation |
| Small golden set overfits the engine | Phase 1 replaces authored labels with blinded expert labels; inter-expert agreement reported |

## Definition of done for V0.5 (pilot-ready)

1. Android build installs on a ₹8–10k phone and completes a rehearsal offline.
2. Calibration gate green with ≥ 3 blinded expert labels per golden.
3. 5 teachers complete ≥ 3 sessions each without facilitator help.
4. Zero individual-level data leaves the device unconfirmed by the teacher.
