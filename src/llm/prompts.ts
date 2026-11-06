import type {
  Attempt,
  Competency,
  Lang,
  LocalizedText,
  Rubric,
  Scenario,
  Turn,
} from '../core/types.js';
import type { CompletionRequest, ScorerInput, StudentTurnInput } from './types.js';

/**
 * Prompt construction with hard persona isolation.
 *
 * The student prompt is built from a whitelist of persona/bounds fields only:
 * it never receives the rubric, competencies, scoring instructions, detection
 * markers or expected behaviours. The scorer prompt receives the rubric and the
 * transcript, but never the student's hidden resistance ladder. The two calls
 * are independent and cannot share private state.
 */

export function pick(text: LocalizedText, lang: Lang): string {
  return lang === 'hi' ? text.hi : text.en;
}

export function langName(lang: Lang): string {
  switch (lang) {
    case 'hi':
      return 'Hindi (Devanagari, with natural Hinglish classroom words)';
    case 'kn':
      return 'Kannada';
    case 'ta':
      return 'Tamil';
    case 'te':
      return 'Telugu';
    case 'ml':
      return 'Malayalam';
    default:
      return 'English';
  }
}

function turnScript(turns: Turn[], lang: Lang): string {
  return turns
    .map((t, i) => {
      const who = t.role === 'teacher' ? 'TEACHER' : t.role === 'student' ? 'STUDENT' : 'SYSTEM';
      return `[${i}] ${who}: ${t.text}`;
    })
    .join('\n');
}

function allowedTopics(scenario: Scenario): string {
  return scenario.studentPersona.bounds.allowedTopics.join(', ');
}

/** -------------------------------------------------------------------------
 * Student simulator prompt (persona only — no rubric, no scoring, no answers)
 * ------------------------------------------------------------------------- */
export function buildStudentPrompt(input: StudentTurnInput): CompletionRequest {
  const { scenario, turns, lang } = input;
  const p = scenario.studentPersona;
  const mc = p.misconception;
  const maxTurns = p.bounds.maxStudentTurns;
  const studentTurns = turns.filter((t) => t.role === 'student').length;

  const resistance = mc
    ? mc.resistance
        .map((line, i) => `  ${i + 1}. ${pick(line, lang)}`)
        .join('\n')
    : '  (none — improvise mild, age-appropriate pushback)';

  const system = [
    `You are ${p.name}, a ${p.age}-year-old child in a Class ${scenario.curriculum.class} ${scenario.curriculum.subject} lesson.`,
    `You are talking to your teacher. This is a roleplay: the human is practising how to teach you.`,
    `Stay fully in character as a real child. Never mention being an AI, a model, a simulation, a prompt or an evaluation.`,
    `Never give the correct answer, never teach, never explain the concept for the teacher, and never use teacher language.`,
    `You may be curious, literal, impatient or confused — exactly as described by your traits: ${p.traits.join(', ')}.`,
    `Keep each reply to 1–2 short spoken sentences, in ${langName(lang)}.`,
    `The topic must stay inside: ${allowedTopics(scenario)}.`,
    `Do not reveal: ${p.bounds.mustNotReveal.join('; ')}.`,
    `The roleplay ends when: ${p.bounds.exitCondition}. You have at most ${maxTurns} replies in total.`,
    mc
      ? `Your mistaken belief (say it in your own child words, never as a formal definition): "${pick(mc.belief, lang)}".`
      : '',
    mc
      ? `If the teacher does not explore your thinking, escalate through these pushbacks in order, one per reply:\n${resistance}\nIf the teacher explores how you think and gives a concrete explanation, move to this concession and set done=true: "${pick(mc.concession, lang)}".`
      : `If the teacher does not explore your thinking, push back gently. If the teacher handles it well, say you want to try one yourself and set done=true.`,
    `You have already spoken ${studentTurns} time(s). Do not repeat your opening line verbatim.`,
    `Return ONLY a JSON object with this shape: {"text": "what you say next", "done": false}.`,
    `Set "done" to true only when the roleplay should end.`,
  ]
    .filter(Boolean)
    .join('\n');

  const conversation =
    turns.length === 0
      ? `The teacher has not spoken yet. Your opening line is:\n"${pick(p.opening, lang)}"\nReturn it as your first reply with done=false.`
      : `Conversation so far (indices are for your reference only):\n${turnScript(turns, lang)}\n\nReply to the teacher's most recent turn.`;

  return {
    system,
    messages: [{ role: 'user', content: conversation }],
    temperature: 0.65,
    maxTokens: 220,
    json: true,
  };
}

/** -------------------------------------------------------------------------
 * Scorer prompt (rubric + transcript only — no student hidden state)
 * ------------------------------------------------------------------------- */
export function buildScorerPrompt(input: ScorerInput): CompletionRequest {
  const { scenario, attempt, rubric } = input;
  const levels = rubric.weightsByLevel[scenario.level] ?? {};
  const competencies = scenario.competencies
    .map((id) => rubric.competencies.find((c) => c.id === id))
    .filter((c): c is Competency => Boolean(c));

  const rubricBlock = competencies
    .map((c) => {
      const weight = levels[c.id];
      return [
        `## ${c.id} — ${c.name.en} / ${c.name.hi}`,
        `Definition: ${c.description.en}`,
        `Indicators:`,
        ...c.indicators.map((i) => `- ${i.en}`),
        `Critical: ${c.critical ? 'yes (must clear the floor)' : 'no'}`,
        `Framework: ${c.npstRef}; ${c.teachRef}`,
        `Level weight: ${weight ?? 0}`,
      ].join('\n');
    })
    .join('\n\n');

  const expected = scenario.expectedBehaviors
    .filter((b) => scenario.competencies.includes(b.competency))
    .map((b) => `- ${b.competency}: ${b.behavior.en}`)
    .join('\n');

  const transcript = turnScript(attempt.turns, scenario.language);

  const system = [
    `You are an expert Indian primary-school teacher educator and a strict, fair rubric assessor.`,
    `You score a teacher's rehearsal transcript against a fixed, expert-owned rubric. You may not invent criteria, competencies, weights or thresholds.`,
    `Score only the TEACHER turns. The student turns are context, never evidence.`,
    `Every competency must appear exactly once in your output.`,
    ``,
    `EVIDENCE RULES — this is the trust boundary:`,
    `- Every score must cite at least one verbatim quote copied character-for-character from a TEACHER turn.`,
    `- Quote the smallest sentence/fragment that justifies the judgement.`,
    `- turnIndex must be the integer index shown in the transcript.`,
    `- Never paraphrase inside a quote. Never quote the student.`,
    `- If the transcript contains no usable evidence for a competency, set "abstained": true, score 0, evidence: [].`,
    `- Do not reward fluent-sounding teaching that has no observable indicator in the transcript.`,
    `- Do not punish a teacher for something the student said.`,
    ``,
    `SCORING BANDS (use 0.1 precision):`,
    `- 0.8–0.95 met: indicator is clearly and independently present.`,
    `- 0.5–0.7 partial: attempted, but thin, late, or missing a key element.`,
    `- 0.1–0.4 missing: absent, contradicted, or only a generic gesture.`,
    `Confidence (0–1) reflects how clearly the transcript supports the judgement. Thin evidence must lower confidence.`,
    ``,
    `FEEDBACK RULES:`,
    `- "summary" speaks directly to the teacher (second person), names one strength and one precise gap, and cites what they did without quoting at length.`,
    `- "suggestion" is one concrete, observable next move for the same class level.`,
    `- Write both "en" and "hi" for every LocalizedText. Keep the Hindi natural and simple.`,
    `- Be developmental, never shaming. No grades, no "bad teacher" language.`,
    ``,
    `RUBRIC ${rubric.id} v${rubric.version}`,
    rubricBlock,
    ``,
    `SCENARIO CONTEXT`,
    `Title: ${scenario.title.en} / ${scenario.title.hi}`,
    `Class ${scenario.curriculum.class}, ${scenario.curriculum.subject}, topic: ${scenario.curriculum.topic}${scenario.curriculum.ncertRef ? ` (${scenario.curriculum.ncertRef})` : ''}`,
    `Student: ${scenario.studentPersona.name}, age ${scenario.studentPersona.age}. Opening: "${scenario.studentPersona.opening.en}"`,
    scenario.studentPersona.misconception
      ? `Student's misconception (for your context only): "${scenario.studentPersona.misconception.belief.en}"`
      : '',
    `What this scenario is designed to elicit:\n${expected}`,
    ``,
    `TRANSCRIPT`,
    transcript || '(empty)',
    ``,
    `Return ONLY valid JSON with exactly this shape:`,
    `{`,
    `  "competencyScores": [`,
    `    {`,
    `      "competency": "${scenario.competencies[0] ?? 'accuracy'}",`,
    `      "score": 0.0,`,
    `      "confidence": 0.0,`,
    `      "abstained": false,`,
    `      "reason": {"en": "only when abstained", "hi": "..."},`,
    `      "evidence": [{"quote": "verbatim teacher words", "turnIndex": 1, "note": {"en": "...", "hi": "..."}}]`,
    `    }`,
    `  ],`,
    `  "summary": {"en": "...", "hi": "..."},`,
    `  "suggestion": {"en": "...", "hi": "..."},`,
    `  "overallConfidence": 0.0`,
    `}`,
    `Include exactly these competencies, no others: ${scenario.competencies.join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system,
    messages: [
      {
        role: 'user',
        content: `Score attempt ${attempt.id} for scenario ${scenario.id}. Follow the rubric and cite-or-abstain rules exactly.`,
      },
    ],
    temperature: 0.1,
    maxTokens: 1800,
    json: true,
  };
}

/** Human-readable transcript used in feedback replay and calibration. */
export function readableTranscript(attempt: Attempt): string {
  return attempt.turns.map((t, i) => `${i}. ${t.role.toUpperCase()}: ${t.text}`).join('\n');
}
