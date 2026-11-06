# 03 — Rubric governance: humans set the standard, provably

The credibility of Abhyas rests on one claim: **the AI cannot invent
criteria**. This document is the operating manual for that claim.

## 1. Where the standard lives

`src/content/rubric.npst-fln-core.json` — a single versioned file owned by
education experts (not by the code). It contains:

1. **Competencies** — id, name, description, *observable indicators*, and the
   standards cross-walk:

   | Competency | NPST (NCTE 2023) | World Bank TEACH |
   |---|---|---|
   | Accuracy | Area 2 — Professional Knowledge & Understanding | Instruction (accurate content) |
   | Clarity | Area 3 — Professional Practice (age-appropriate pedagogy) | Instruction (clear explanation) |
   | Misconceptions | Area 2 — how children learn; error diagnosis | Instruction (checks for understanding, feedback) |
   | Questioning | Area 3 — questioning & engagement | Instruction (open-ended questioning); Socio-emotional (autonomy) |

   Accuracy and Misconceptions are **critical** — they carry a floor.

2. **Weights per mastery level** — the rubric's judgement of what matters when:

   | Level | accuracy | clarity | misconceptions | questioning |
   |---|---|---|---|---|
   | L1 | **0.6** | 0.25 | — | 0.15 |
   | L2 | 0.3 | **0.5** | — | 0.2 |
   | L3 | 0.1 | 0.2 | **0.45** | 0.25 |
   | L4 | 0.1 | 0.2 | 0.25 | **0.45** |
   | L5 | 0.25 | 0.25 | 0.25 | 0.25 |

3. **Decision policy** — pass ≥ 0.72 · retry ≥ 0.45 · critical floor 0.5 ·
   level-up = 2 passes across ≥ 2 distinct scenarios · min confidence 0.45 ·
   min evidence coverage 0.5.

## 2. How the standard is enforced (not just stated)

- **Schema validation**: zod rejects a rubric with missing competencies,
  non-semver versions, or weights that are not positive numbers.
- **Hash pinning**: SHA-256 over canonical JSON is computed on load. It appears
  in `/api/health`, on every stored attempt (`weightsHash`), and in every
  calibration report. Any rubric edit is visible in every historical record.
- **Prompt containment**: the scorer prompt receives the rubric *indicators*
  and explicitly forbids inventing criteria; it never sees weights or
  thresholds (those are decision-layer secrets, applied by code after scoring).
- **Determinism**: `evaluateAttempt` is a pure function of (score, attempt,
  rubric, level). Same attempt + same rubric version ⇒ same decision — which
  is what makes "the rubric doesn't move, only the practice does" auditable.

## 3. The evidence contract

Every competency score must carry **verbatim quotes from the teacher's own
words**. The pipeline:

- Scorer instruction: "copy the quote character-for-character; if you cannot
  support a score with a real quote, abstain."
- `normalizeScorerOutput` clamps and de-duplicates; missing required
  competencies become abstained.
- `verifyEvidence` re-finds every quote in the transcript (strict matching —
  morphology tolerance is reserved for behaviour *detection*, never for
  *verification*). Fabricated evidence ⇒ confidence collapse ⇒ abstention with
  the reason shown to the teacher: *"Nothing was scored on a guess."*

This is the cite-or-abstain pattern from the LLM-judging literature, applied at
the trust boundary where a score becomes a teacher's feedback.

## 4. Calibration — the rubric's health monitor

`npm run calibration` runs 8 expert-labelled golden attempts (strong / weak /
wrong profiles across all four competencies) through the *identical* pipeline
and reports:

```
Overall MAE: 0.066 · decision agreement: 100% · provisional: 0%
misconceptions  MAE=0.100  within±0.2=83%   band=83%
accuracy        MAE=0.030  within±0.2=100%  band=100%
clarity         MAE=0.067  within±0.2=100%  band=83%
questioning     MAE=0.050  within±0.2=100%  band=100%
```

Governance rules this enables:

- **Any rubric change requires a calibration run** (CI gate:
  `npm run calibration -- --gate` — fails below MAE 0.25 / 70% decision
  agreement).
- **Any engine change (mock → cloud model swap) is measurable** against the
  same golden set: `LLM_PROVIDER=anthropic npm run calibration`.
- **Abstentions are reported, never hidden** — an honest refusal is a metric,
  not a failure.

## 5. Change process (who does what)

| Step | Owner | Output |
|---|---|---|
| 1. Draft competency/indicator/weight change | Expert teachers + FLN specialists | Proposed rubric diff |
| 2. Review scenario coverage | Content team | Updated scenario pack(s), version bumps |
| 3. Extend golden set if a new behaviour matters | Content team | New labelled attempts in `tools/calibration/golden.json` |
| 4. Calibrate | Automated | Agreement report; gate must pass |
| 5. Ship | Release | Bumped semver + new hash; old attempts keep their old hash (auditable history) |

Practising teachers review every competency and scenario before scoring goes
live (deck: "Experts validate") — this file structure is what they review, and
the calibration report is what they sign off on.

## 6. Deliberate limits

- Scores are **banded** (0.15–0.95) on purpose: false precision would imply a
  reliability the system does not have yet.
- The rubric scores *observable behaviour in one rehearsal*, not a teacher.
  No attempt feeds any evaluation, ever — attempts are private by design.
- The current golden set is small (n=8) and authored by the same team that
  built the engine. The pilot phase replaces this with *expert-blinded*
  labels from practising teachers (deck: "AI vs experts", "Transfer test") —
  the harness and gate are built to ingest exactly that.
