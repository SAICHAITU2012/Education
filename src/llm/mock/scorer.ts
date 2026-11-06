import type { Attempt, CompetencyScore, Rubric, Scenario, ScorerOutput } from '../../core/types.js';
import { allSentencesWith, firstSentenceWith, sentences, textHasMarkers } from '../../core/evidence.js';
import type { ScorerInput } from '../types.js';

/**
 * The on-device / fallback scorer: deterministic detector families per
 * competency, driven only by the scenario's declared markers and the transcript.
 *
 * Contract identical to the cloud scorer — per-competency score bands, verbatim
 * evidence, confidence, abstention when signals are thin. It never sees the
 * student's hidden state (persona isolation), only the transcript.
 */

const BAND = (s: number) => Math.max(0.1, Math.min(0.95, Math.round(s * 100) / 100));

function teacherText(attempt: Attempt): string {
  return attempt.turns
    .filter((t) => t.role === 'teacher')
    .map((t) => t.text)
    .join('\n');
}

function confidenceOf(signals: number): number {
  // More independent signals matched → more confidence. Thin signal → abstain.
  return Math.min(0.9, 0.5 + 0.13 * signals);
}

function ev(
  hit: { quote: string; turnIndex: number } | null,
  note: { en: string; hi: string },
): CompetencyScore['evidence'] {
  return hit ? [{ quote: hit.quote, turnIndex: hit.turnIndex, verified: true, note }] : [];
}

export function mockScore(input: ScorerInput): ScorerOutput {
  const { scenario, attempt } = input;
  const d = scenario.detection;
  const full = teacherText(attempt);
  const teacherTurns = attempt.turns.filter((t) => t.role === 'teacher');
  const allSentences = teacherTurns.flatMap((t) => sentences(t.text));
  const avgWords =
    allSentences.length > 0
      ? allSentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / allSentences.length
      : 0;
  const has = (markers: string[]) => textHasMarkers(full, markers);

  const scores: CompetencyScore[] = [];

  // ---- accuracy -----------------------------------------------------------
  if (scenario.competencies.includes('accuracy')) {
    // A sentence that also states the correct fact is not a wrong-fact
    // violation — short numeric markers otherwise substring-collide with
    // correct sums ("3+3+3" inside "3+3+3+3 = 12").
    const wrongHit =
      allSentencesWith(attempt.turns, d.wrongFactMarkers).find(
        (h) => !textHasMarkers(h.quote, d.correctFactMarkers),
      ) ?? null;
    const correctHit = firstSentenceWith(attempt.turns, d.correctFactMarkers);
    if (wrongHit) {
      scores.push({
        competency: 'accuracy',
        score: BAND(0.15),
        confidence: confidenceOf(2),
        evidence: [wrongHit, ...(correctHit ? [correctHit] : [])].map((q) => ({
          quote: q.quote,
          turnIndex: q.turnIndex,
          verified: true,
          note: {
            en: 'A fact was stated incorrectly here.',
            hi: 'यहाँ एक तथ्य गलत बताया गया।',
          },
        })),
        abstained: false,
      });
    } else if (correctHit) {
      scores.push({
        competency: 'accuracy',
        score: BAND(0.88),
        confidence: confidenceOf(2),
        evidence: [{ quote: correctHit.quote, turnIndex: correctHit.turnIndex, verified: true }],
        abstained: false,
      });
    } else {
      scores.push({
        competency: 'accuracy',
        score: BAND(0.5),
        confidence: 0.35,
        evidence: [],
        abstained: true,
        reason: {
          en: 'No factual statement was detected to check.',
          hi: 'जाँच के लिए कोई तथ्य नहीं मिला।',
        },
      });
    }
  }

  // ---- clarity ------------------------------------------------------------
  if (scenario.competencies.includes('clarity')) {
    const exampleHits = allSentencesWith(attempt.turns, d.exampleWords);
    const jargonHit = firstSentenceWith(attempt.turns, d.jargonBlacklist);
    let score = 0.3;
    const notes: CompetencyScore['evidence'] = [];
    if (exampleHits.length > 0) {
      score += 0.4;
      notes.push({
        quote: exampleHits[0]!.quote,
        turnIndex: exampleHits[0]!.turnIndex,
        verified: true,
        note: { en: 'A concrete example from her world.', hi: 'उसकी दुनिया से ठोस उदाहरण।' },
      });
    }
    if (avgWords > 0 && avgWords < 20) score += 0.15;
    if (jargonHit) {
      score -= 0.45;
      notes.push({
        quote: jargonHit.quote,
        turnIndex: jargonHit.turnIndex,
        verified: true,
        note: { en: 'Hard word for this age.', hi: 'इस उम्र के लिए कठिन शब्द।' },
      });
    }
    const nSignals = exampleHits.length + (jargonHit ? 1 : 0);
    scores.push({
      competency: 'clarity',
      score: BAND(score),
      confidence: confidenceOf(Math.max(nSignals, 1)),
      evidence: notes,
      abstained: nSignals === 0 && allSentences.length === 0,
      reason: nSignals === 0 && allSentences.length === 0
        ? { en: 'Nothing was said to judge clarity on.', hi: 'स्पष्टता जाँचने के लिए कुछ कहा ही नहीं गया।' }
        : undefined,
    });
  }

  // ---- misconceptions -----------------------------------------------------
  if (scenario.competencies.includes('misconceptions')) {
    const surfaceHit = firstSentenceWith(attempt.turns, d.surfaceMarkers);
    const correctHit = firstSentenceWith(attempt.turns, d.correctMarkers);
    if (!surfaceHit && !correctHit) {
      scores.push({
        competency: 'misconceptions',
        score: BAND(0.25),
        confidence: confidenceOf(1),
        evidence: [],
        abstained: teacherTurns.length === 0,
        reason:
          teacherTurns.length === 0
            ? { en: 'No teacher response to judge.', hi: 'जाँच के लिए कोई उत्तर नहीं।' }
            : undefined,
      });
    } else {
      let score = 0.15;
      const evidence: CompetencyScore['evidence'] = [];
      if (surfaceHit) {
        score += 0.45;
        evidence.push({
          quote: surfaceHit.quote,
          turnIndex: surfaceHit.turnIndex,
          verified: true,
          note: { en: 'Explored how she is thinking first.', hi: 'पहले उसकी सोच समझी।' },
        });
      }
      if (correctHit) {
        score += 0.35;
        evidence.push({
          quote: correctHit.quote,
          turnIndex: correctHit.turnIndex,
          verified: true,
          note: { en: 'Addressed the idea behind the mistake.', hi: 'गलती के पीछे का विचार संभाला।' },
        });
      }
      let note: { en: string; hi: string } | undefined;
      if (correctHit && !surfaceHit) {
        score = Math.min(score, 0.45);
        note = {
          en: 'Corrected before exploring how she was thinking. Ask first, then explain.',
          hi: 'सोच समझे बिना ही सुधार दे दिया। पहले पूछें, फिर समझाएँ।',
        };
      }
      scores.push({
        competency: 'misconceptions',
        score: BAND(score),
        confidence: confidenceOf(evidence.length),
        evidence,
        abstained: false,
      });
      if (note) {
        const last = scores[scores.length - 1]!;
        last.evidence = last.evidence.map((e) => ({ ...e, note }));
      }
    }
  }

  // ---- questioning --------------------------------------------------------
  if (scenario.competencies.includes('questioning')) {
    const qSentences = allSentencesWith(attempt.turns, d.questionMarkers);
    const showHit = firstSentenceWith(attempt.turns, ['दिखाओ', 'dikhaao', 'दिखा', 'बताओ', 'batao', 'show me', 'तोड़', 'todo', 'करके देखो']);
    const praiseOnly =
      has(['शाबाश', 'shabash', 'very good', 'बहुत अच्छे', 'sahi hai', 'correct']) &&
      qSentences.length === 0;
    if (qSentences.length === 0 && !showHit && allSentences.length > 0) {
      scores.push({
        competency: 'questioning',
        score: BAND(praiseOnly ? 0.2 : 0.25),
        confidence: confidenceOf(1),
        evidence: praiseOnly && teacherTurns.length > 0
          ? [{ quote: sentences(teacherTurns[teacherTurns.length - 1]!.text)[0] ?? '', turnIndex: attempt.turns.length - 1, verified: true, note: { en: 'Praised without probing her thinking.', hi: 'सोच जाँचे बिना ही तारीफ़ कर दी।' } }]
          : [],
        abstained: false,
      });
    } else {
      let score = 0.25 * Math.min(qSentences.length, 3);
      if (showHit) score += 0.15;
      scores.push({
        competency: 'questioning',
        score: BAND(score),
        confidence: confidenceOf(qSentences.length + (showHit ? 1 : 0)),
        evidence: [...qSentences.slice(0, 2).map((q) => ({ quote: q.quote, turnIndex: q.turnIndex, verified: true })), ...(showHit ? [{ quote: showHit.quote, turnIndex: showHit.turnIndex, verified: true, note: { en: 'Asked her to show her thinking.', hi: 'सोच दिखाने को कहा।' } }] : [])],
        abstained: false,
      });
    }
  }

  // Summary + suggestion from the weakest scored competency.
  const active = scores.filter((s) => !s.abstained);
  const weakest = [...active].sort((a, b) => a.score - b.score)[0];
  const compMeta = input.rubric.competencies.find((c) => c.id === weakest?.competency);
  const behavior = weakest
    ? scenario.expectedBehaviors.find((b) => b.competency === weakest.competency)
    : undefined;

  return {
    attemptId: attempt.id,
    competencyScores: scores,
    summary: {
      en: weakest
        ? `Strongest signal this attempt: ${compMeta?.name.en ?? weakest.competency}. Your own words were quoted as evidence.`
        : 'The attempt was too short to score reliably.',
      hi: weakest
        ? `इस कोशिश का मुख्य संकेत: ${compMeta?.name.hi ?? weakest.competency}। सबूत के तौर पर आपके अपने शब्द उद्धृत किए गए हैं।`
        : 'यह कोशिश भरोसेमंद अंक के लिए बहुत छोटी थी।',
    },
    suggestion: behavior
      ? behavior.behavior
      : {
          en: 'Try once more — ask her what she is thinking before explaining.',
          hi: 'एक बार और — समझाने से पहले पूछें कि वह क्या सोच रही है।',
        },
    overallConfidence: active.length > 0 ? active.reduce((a, s) => a + s.confidence, 0) / active.length : 0.3,
    engine: 'mock',
    rubricVersion: input.rubric.version,
    scoredAt: new Date().toISOString(),
  };
}
