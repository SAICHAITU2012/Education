# Abhyas — Application Answers (clean rewrite)

Team CogniX · SEVA31417 · Seva First Innovation Challenge
Rewritten 4 Nov 2026 from the working draft. One canonical answer per section; duplicates merged; inconsistencies fixed (see changelog at the end).

---

## 1. The problem

Teacher training and classroom teaching are two different things. A teacher may understand a concept, know the curriculum, and attend every required workshop, yet still struggle to explain it to a seven-year-old, spot the misconception behind a wrong answer, or ask a question that makes a child think rather than guess. India trains teachers at scale — 5.15 million government-school teachers teaching 121.6 million children [1] — with 6–10 days of in-service training a year and little planned classroom follow-up [4]. Training ends, but practice rarely begins.

The gap is not a lack of training content. It is a lack of repeated, structured practice. Teaching is a performance skill: pilots rehearse in flight simulators before flying real aircraft, yet teachers are expected to perform with no rehearsal at all.

When a child asks, *"If 5 − 3 is 2, why isn't 3 − 5 also 2?"*, the right answer is not enough. The teacher must understand the child's reasoning, choose an age-appropriate explanation, and guide the child towards insight. Workshops cannot simulate every interaction; mentor visits and peer feedback are valuable but difficult to provide continuously at scale; generic AI assistants can draft lesson plans, but knowing what to say is different from demonstrating the ability to teach.

We therefore ask: **what if every teacher had a safe practice environment where they could rehearse teaching, make mistakes without affecting real children, and improve one skill at a time?**

*(~230 words)*

## 2. Proposed solution — Abhyas

Abhyas (अभ्यास, "practice") is an AI-powered teacher rehearsal platform, inspired by flight simulators: teachers rehearse real classroom interactions by voice with a simulated student, receive evidence-based feedback, and try again — before facing real children.

Abhyas is a progression-based learning experience, not another AI chatbot. Teachers advance through four core competency levels — **L1 Accuracy** (facts and curriculum alignment), **L2 Clarity** (an explanation a child of that age can follow), **L3 Misconceptions** (surface the belief before correcting it), and **L4 Questioning** (probing that invites curiosity, not guess-the-answer) — after which **L5+** scenarios integrate all competencies in a realistic lesson. Each level offers curated classroom scenarios, competency-specific evaluation criteria, and defined mastery thresholds. The next level stays locked until the current one is passed; feedback identifies weaknesses and the next scenario targets them, so progress reflects demonstrated competency, not sessions completed.

A simulation ends with a structured evaluation covering conceptual accuracy, explanation quality, misconception handling, and pedagogical effectiveness — every judgement linked to specific excerpts from the teacher's own words, so feedback is traceable rather than a generic AI score.

The practice loop: **Simulate → Interact → Evaluate → Identify gaps → Improve → Practise again.**

*(~210 words)*

## 3. How Abhyas works

1. **Onboarding and scenario selection.** The teacher picks class, subject and language, and begins at their level. Each curated scenario targets a specific competency and stays inside its curriculum scope.
2. **AI student simulation.** A language model plays a simulated child with a defined age, grade, language, knowledge level and misconception profile. It responds dynamically to the teacher's explanations rather than following a script — it pushes back, expresses confusion, and reveals misconceptions at authored moments, within age-appropriate and curriculum bounds.
3. **Evidence-based evaluation.** A separate evaluator receives the transcript plus the scenario and rubric versions, and scores the teacher's demonstrated behaviour against predefined criteria — returning structured scores, verbatim evidence quotes, identified gaps and actionable feedback. It distinguishes demonstrated understanding, partial understanding, incorrect understanding, and insufficient evidence, and abstains when evidence is insufficient rather than inventing a score.
4. **Gamified progression.** A deterministic mastery engine applies versioned weights, thresholds and progression rules to validated evaluation outputs, deciding pass, retry, or advance. Roughly ten scenarios per level; levelling up requires passes across distinct scenarios.

The student persona and the evaluator are deliberately separated — different instructions, different model calls — so the role-playing student can never grade the teacher or influence criteria.

A working V0 prototype already demonstrates this full loop end to end, including voice interaction, offline-capable attempt queuing, and an automated AI-vs-expert calibration harness. The proposed production stack scales it: React, TypeScript and Tailwind CSS for the interface; Python, FastAPI and Pydantic for APIs and structured validation; PostgreSQL for versioned scenarios, rubrics, sessions and evidence; LLM and speech providers behind swappable, model-agnostic interfaces chosen on language quality, latency and cost.

*(~250 words)*

## 4. What is innovative and different

Most AI helps teachers prepare. Abhyas helps them **perform**. Conventional platforms deliver video lectures, quizzes and lesson plans; Abhyas reverses the interaction — the teacher becomes the candidate and the AI student becomes the interviewer, requiring teachers to explain, identify gaps and adapt, rather than recite textbook answers.

Three things make this credible rather than another AI experiment:

- **Evidence-backed evaluation.** LLM judges tend to be subjective, inconsistent or hallucinated. Abhyas combines predefined rubrics, question-specific criteria, verbatim evidence extraction, and deterministic validation of objectively checkable answers wherever possible. A convincing-sounding answer is never mistaken for competence.
- **Humans set the standard.** The pedagogical framework, competencies, rubric weights and thresholds are developed and validated with practising teachers and experts, aligned to NPST. Every evaluation is tied to a specific rubric version; the AI cannot invent criteria or unlock levels — deterministic rules govern progression.
- **Structured skill progression.** Gamified L1–L4 levels build one competency at a time, then integrate them, with private retries until mastery.

The core innovation is not simulating students — it is combining classroom simulation, controlled AI interaction, evidence-grounded assessment and competency-driven progression into one continuous practice loop.

*(~180 words)*

## 5. Guardrails and reliability

- **Pedagogical guardrails:** experts define competencies, rubrics, weights and thresholds; every evaluation is tied to a rubric version.
- **Persona isolation:** student and evaluator have separate instructions, responsibilities and model calls; the student cannot control evaluation criteria.
- **Evidence-based scoring:** evaluators must cite the teacher's actual words; missing evidence or ambiguous responses trigger abstention or a retry, never an invented score.
- **Bounded simulation:** student personas operate within curated scenarios, age-appropriate behaviour and curriculum constraints; they cannot introduce unrelated or inappropriate content.
- **Structured outputs:** schemas validate every model response before it enters the mastery engine; invalid or incomplete outputs are rejected or retried.
- **Privacy:** individual practice attempts are private by design; only anonymised aggregate trends (with a minimum cohort size) are ever shared.
- **Testing and observability:** we track model errors, latency, cost, speech recognition quality, AI–expert agreement, and regressions across model or prompt changes, with evaluation on unseen scenarios.

*(~150 words)*

## 6. Beneficiaries

**Primary:** teachers of Classes 1–3 in government schools, especially those teaching foundational mathematics, who must adapt explanations to different learning levels, identify misconceptions and encourage reasoning — often without access to individualised mentoring or repeated practice. Abhyas gives them a private place to rehearse without real children bearing the cost of practice.

**Indirect:** children, whose teachers become better equipped to spot misunderstandings, explain foundational concepts clearly, and reward reasoning over memorised answers — building strong foundational numeracy (FLN).

**Institutional:** DIETs, SCERTs and other training organisations, which today cannot see which competencies their cohorts struggle with. Anonymised aggregate trends give trainers actionable data while individual attempts stay private.

**Where:** wherever teachers are trained but rarely rehearsed — most acute in large, distributed systems where continuous individual mentoring cannot reach every teacher.

*(~130 words)*

## 7. Scope and roadmap

V0 is deliberately small: **Mathematics for Classes 1–3, in Hindi** (the classroom language of the initial pilot), with one complete rehearsal loop end to end. The architecture stores scenarios and rubrics as versioned content packs, so **Kannada is the first expansion** — followed by more subjects, grades and Indian languages — without rebuilding the product. Offline use and on-device inference are planned future goals, not current capabilities; cloud models sit behind swappable provider interfaces so the model can be changed on quality, latency and cost.

Near term: validate the pedagogical framework and rubrics with practising teachers and experts, then pilot. Scale path: partnerships with DIETs, SCERTs and state teacher-training programmes; later integration with DIKSHA and district mentorship programmes, feeding anonymised trends into the next training cycle.

*(~130 words)*

## 8. Pilot plan and what we will measure

Initial target: **10–20 teachers across 2–3 government schools.** Before piloting, practising teachers and experts validate every competency, rubric and scenario.

We will measure: post-practice vs pre-practice rubric scores on **unseen scenarios** (a transfer test, expert-blinded); agreement between AI and expert evaluations; speech recognition accuracy by language; and retry rate. AI scores will also be calibrated against expert-labelled attempts through an automated harness before any pilot.

These are proposed targets, not achieved results. Abhyas complements existing training and mentorship — it adds the repeatable, accessible practice layer they cannot easily provide at scale.

*(~100 words)*

## 9. Partners and collaboration we seek

- **DIETs and SCERTs** — teacher access, pedagogical validation, and pilot implementation.
- **NCERT and state education departments** — curriculum alignment and adoption pathways.
- **DIKSHA** — potential integration and distribution channel.
- **Samagra Shiksha and FLN-focused NGOs** — implementation and outreach.
- **Government-school teachers, teacher educators, mathematics education experts, and Hindi/Kannada language specialists** — to co-develop and validate scenarios and rubrics.

*(~80 words)*

## 10. Support we need

1. **Pedagogical mentorship** — teacher educators, mathematics education experts and AI researchers to co-develop the competency framework and validate rubrics.
2. **Teacher access** — practising government-school teachers and DIET connections to test scenarios and run the initial pilot, plus **partnerships with 2–3 government schools**.
3. **Technical mentorship** — multilingual speech systems, LLM evaluation, privacy and reliable AI assessment.
4. **Resources** — cloud credits, development resources and funding to build and test the end-to-end prototype.
5. **Measurement support** — help measuring learning transfer and comparing AI feedback against expert judgement before scaling.

*(~100 words)*

---

## Changelog vs the original draft (for your review)

1. **L1–L4 vs L5+ reconciled.** The draft said "four gamified difficulty levels (L1–L4)" in some answers and a five-stage progression (…L5+ Integrated) in others. Now: four core competency levels **plus L5+ integration scenarios** — consistent with the deck and the V0's four competencies.
2. **Open-weight models claim removed.** The banner claimed "cloud and open-weight models"; your note said you don't have open-weight models. Now: "cloud models behind swappable provider interfaces; on-device inference is a planned future goal".
3. **Kannada claim made honest.** The draft repeatedly said Hindi **and** Kannada in V0, but the built V0 ships Maths + Hindi only (6 packs, no Kannada). Now: "Hindi in V0; Kannada is the first expansion" (§7). If you'd rather keep claiming both, say so and I'll revert — but a judge who opens the app will notice.
4. **Stack honesty.** The draft claims Python/FastAPI/PostgreSQL — that's the *proposed* production stack, but the working V0 is TypeScript/Express. §3 now separates "working V0 prototype" (real, and a strength at Idea stage) from "proposed production stack".
5. **Deduplication.** Beneficiaries, pilot plan, flight-simulator analogy, and the innovation section each appeared 2–3× in variants; merged into single canonical answers (~2,800 → ~1,560 words).
6. **Stats added with sources.** 5.15M teachers / 121.6M children [1] and 6–10 in-service days [4] reused from the deck (UDISE+ 2024–25; your sources slide carries the full citations).
