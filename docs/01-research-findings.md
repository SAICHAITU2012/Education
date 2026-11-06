# 01 — Research findings: what exists, what it teaches, what we avoided

*Synthesis of the landscape review behind this build (November 2026). Every
"→ Design" item below is implemented in this repository, not aspirational.*

## 1. The rehearsal tools that came before

### Mursion — mixed-reality rehearsal (US teacher education)
- Virtual avatar students, historically operated by trained human actors
  ("interactors"); used by Harvard, UVA, SMU for classroom-management and
  number-talks rehearsal. Studies (four 10-minute sessions) show transfer to
  real classroom behaviour — rehearsal works.
- **Limitations documented in a CITE Journal scoping review**: scheduling and
  the cost of human interactors; suspension-of-disbelief problems; institutional
  pricing. It cannot reach 5.15M government-school teachers.
- → **Design:** the AI student replaces the interactor. The cost that killed
  Mursion's scale is exactly the thing an LLM removes — but we kept Mursion's
  core insight: *scripted, bounded scenarios with an escalation ladder*, not
  free-form chat.

### TeachFX — classroom audio analytics
- Records real lessons, visualises teacher-vs-student talk ratio, private and
  non-evaluative by design. Teacher discourse on Reddit centres on recording
  consent and trust — the privacy posture is the product.
- → **Design:** private-by-design is structural, not a policy: pseudonymous
  device-generated ids, audio never uploaded (only the reviewed transcript is
  scored), attempts never visible to administrators, k-anonymised cohort trends
  only. "Not for evaluation" is written into the decision layer — attempts
  cannot produce a supervisor-facing score by construction.

### Edthena AI Coach — video reflection
- Teachers upload lesson video and work an AI-guided reflection cycle. It
  analyses *past* practice; it never lets you try again in the moment.
- → **Design:** Abhyas sits *before* the lesson (rehearsal), not after
  (reflection), and every attempt ends in an actionable retry.

## 2. What the research says about simulated students and LLM judging

- **LLM-simulated students are an active, promising field**: ECNU 2025 showed
  pre-class rehearsal against simulated students improves teaching plans;
  "Can LLMs Reliably Simulate Real Students?" (arXiv 2025) and TeachTune
  (arXiv 2024) stress *profile fidelity* — one generic child is not enough.
  → **Design:** every scenario carries a named child with age, traits, a
  specific misconception and an escalation ladder; the simulator is bounded by
  `mustNotReveal` (the student never teaches, never reveals the answer).
- **LLM judges hallucinate citations.** Documented repeatedly (e.g. arXiv
  2511.04205); the emerging mitigation is *cite-or-abstain* plus deterministic
  checks alongside the judge.
  → **Design:** `verifyEvidence()` re-finds every quoted span in the transcript
  (strict normalisation; Devanagari-matra-tolerant *detection* is kept separate
  from *verification*). Fabricated evidence caps confidence and flips the
  competency to abstained. A score without quotes is treated as a guess.
- **Judge best practices**: split criteria into separate judgements, low-
  precision bands, detailed rubric with observable indicators, guard against
  verbosity/sycophancy bias.
  → **Design:** the scorer outputs one banded score per competency with its own
  evidence and confidence, over a fixed indicator list; the transcript — not the
  model's taste — is the only evidence source. Feedback is developmental,
  never a grade.
- **"Is ChatGPT a Good Teacher Coach?" (BEA @ ACL 2023)**: most generic ChatGPT
  coaching suggestions were practices teachers already used.
  → **Design:** suggestions come from the scenario's expert-authored
  `expectedBehaviors`, targeted at the measured weakest competency — not
  free-form advice.
- **Measuring Teaching with LLMs (ACL AIME-Con 2025)** validates the approach
  of aligning LLM ratings with external measures — which is what the
  calibration harness does from day one.
  → **Design:** `tools/calibration/` scores expert-labelled golden attempts
  through the *identical* pipeline (normalise → verify → decide) and reports
  MAE, band agreement and decision agreement; `--gate` makes it a CI check.

## 3. The Indic technology path

| Layer | V0 (this build) | Production path |
|---|---|---|
| Speech-to-text | Browser Web Speech API (`hi-IN`) + typing fallback | Sarvam Saaras v4 (₹0.49/min, 22 languages) or self-hosted AI4Bharat IndicConformer (600M params, open) |
| Text-to-speech | Browser `speechSynthesis` (`hi-IN` voice) | Sarvam Bulbul v3 (₹3/1k chars) or Indic Parler-TTS (Apache-2.0, self-hosted) |
| Student + scorer | Deterministic mock engine (default) or any OpenAI-compatible/Anthropic model | Same `LlmClient` contract; on-device via LiteRT-LM + Gemma 3n E4B (Per-Layer Embeddings keep RAM feasible on 8 GB phones); llama.cpp GGUF as the portable fallback; <4 GB phones use scripted scenarios + voice only |
| Sync | IndexedDB queue → idempotent batch endpoint | Same pattern field-data apps (ODK/CommCare/Avni) use: client-generated ids, upsert, provisional→verified reconciliation |

Key finding: LiteRT-LM's PLE architecture is what makes Gemma 3n E4B realistic
on mid-range Android; llama.cpp loads the full quant into RAM, so it is the
portable but heavier option. The deck's "chosen by phone RAM" claim maps to:
E4B (PLE) on ~8 GB, E2B on 4–6 GB, scripted-only below that. The `LlmClient`
boundary means this swap touches no scoring code.

## 4. Standards grounding

- **NPST (NCTE, 2023/24)** — four areas, thirteen domains: Core Values & Ethics;
  Professional Knowledge & Understanding; Professional Practice & Competence;
  Professional Growth & Development. The rubric maps each competency to NPST
  areas and to **World Bank TEACH** observable behaviours (Instruction,
  Socio-emotional). Experts own the mapping; the AI never invents criteria.
- **NIPUN Bharat / NCERT** ground the scenario topics (subtraction with
  borrowing, place value, multiplication as repeated addition, matras).

## 5. Failure modes we deliberately designed against

| Failure mode (seen in the wild) | Our guard |
|---|---|
| Judge invents criteria | Rubric is validated, versioned, hash-pinned; prompt contains only rubric indicators |
| Judge invents quotes | Verbatim quote verification + abstention gate |
| Sycophantic scoring (everything passes) | Critical-competency floors; pass requires clearing *both* weighted bar and floors; praise-only behaviour scores 0.2 |
| Student collapses into an assistant | `mustNotReveal` bounds + isolation tests assert no teaching language in the student prompt |
| Offline scores silently differ | Same decision code both modes; offline = provisional until verified; engine recorded per attempt |
| Privacy theatre | k-anonymity enforced in the endpoint; export/delete endpoints tested; no name/employee-id anywhere in the data model |

## 6. Sources

- CITE Journal — *Mixed-Reality Simulations in Teacher Education: A Scoping Review* — https://citejournal.org/volume-26/issue-2-26/current-practice/mixed-reality-simulations-in-teacher-education-a-scoping-review
- Edthena AI Coach FAQ — https://www.edthena.com/what-you-want-to-know-ai-coach-by-edthena
- TeachFX district case study — https://teachfx.com/blog/jordan-school-district-feedback-coaching-pd-joy
- Hu et al. 2025 (ECNU) — *Exploring the potential of LLM to enhance teaching plans* (pre-class rehearsal)
- *Can LLMs Reliably Simulate Real Students' Abilities in ITS?* — https://arxiv.org/html/2507.08232v1
- TeachTune — https://arxiv.org/abs/2410.04078
- *Improving the Validity of Automatically Generated Feedback* — https://arxiv.org/html/2403.01304v2
- *Measuring Teaching with LLMs* (ACL AIME-Con 2025) — https://aclanthology.org/2025.aimecon-main.40.pdf
- *Evaluating LLMs for automatic analysis of classroom discourse* — https://arxiv.org/html/2407.20360
- LLM-as-judge hallucination & biases — https://arxiv.org/html/2511.04205v1, https://www.sebastiansigl.com/blog/llm-judge-biases-and-how-to-fix-them
- "Is ChatGPT a Good Teacher Coach?" (BEA @ ACL 2023) — cited in the SFIC deck
- NPST — https://npst.ncte.gov.in · PIB launch note — https://www.pib.gov.in/PressReleasePage.aspx?PRID=2013066
- World Bank TEACH — https://www.worldbank.org/en/brief/2022/08/30/teach-helping-countries-track-and-improve-teaching-quality
- Sarvam AI pricing — https://www.sarvam.ai/api-pricing
- AI4Bharat IndicConformer — https://github.com/AI4Bharat/IndicConformerASR · Indic Parler-TTS — https://ai4bharat.iitm.ac.in/areas/model/TTS/Indic%20Parler%20TTS
- LiteRT-LM / Gemma 3n on-device — https://github.com/google-ai-edge/LiteRT-LM
