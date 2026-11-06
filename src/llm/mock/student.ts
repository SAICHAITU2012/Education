import type { Scenario, Turn } from '../../core/types.js';
import { textHasMarkers } from '../../core/evidence.js';

/**
 * The scripted AI student — deterministic, runs on-device, zero dependencies.
 *
 * It improvises only inside the scenario's bounds: a fixed escalation ladder
 * (opening → push → push → concession), driven by whether the teacher's last
 * turn handled the student's belief. The same markers the mock scorer uses make
 * the two sides consistent, and cloud adapters implement the exact same contract.
 */

const GENERIC_FOLLOWUP = {
  en: 'Achha... can you show me again with something real?',
  hi: 'अच्छा... पर फिर से, किसी असली चीज़ से दिखाइए न?',
};

const GENERIC_STILL_CONFUSED = {
  en: 'Hmm... I am trying but still a little confused.',
  hi: 'हम्म... मैं कोशिश कर रही हूँ पर थोड़ी उलझन है।',
};

const CONCEDED_WRAP = {
  en: 'Okay Ma\'am, now I want to try one myself!',
  hi: 'ठीक मैडम, अब मैं खुद एक कोशिश करना चाहती हूँ!',
};

export function studentTurnCount(turns: Turn[]): number {
  return turns.filter((t) => t.role === 'student').length;
}

/** Did the teacher's last turn handle the student's state well? */
export function teacherHandled(scenario: Scenario, turns: Turn[]): {
  handled: boolean;
  signals: { question: boolean; surfaced: boolean; example: boolean; corrected: boolean };
} {
  const lastTeacher = [...turns].reverse().find((t) => t.role === 'teacher');
  const empty = { question: false, surfaced: false, example: false, corrected: false };
  if (!lastTeacher) return { handled: false, signals: empty };
  const d = scenario.detection;
  const has = (markers: string[]) => textHasMarkers(lastTeacher.text, markers);
  const signals = {
    question: has(d.questionMarkers),
    surfaced: has(d.surfaceMarkers),
    example: has(d.exampleWords),
    corrected: has(d.correctMarkers),
  };
  // Handling = she explored the child's thinking (question/surface) AND gave substance.
  const handled = (signals.surfaced || signals.question) && (signals.example || signals.corrected);
  return { handled, signals };
}

export interface MockStudentPlan {
  text: string;
  done: boolean;
}

export function mockStudentTurn(
  scenario: Scenario,
  turns: Turn[],
  lang: 'en' | 'hi',
): MockStudentPlan {
  const t = (x: { en: string; hi: string }) => (lang === 'hi' ? x.hi : x.en);
  const count = studentTurnCount(turns);
  const persona = scenario.studentPersona;
  const mc = persona.misconception;

  // First student turn is always the scripted opening.
  if (count === 0) return { text: t(persona.opening), done: false };

  const { handled, signals } = teacherHandled(scenario, turns);
  const maxTurns = persona.bounds.maxStudentTurns;

  // Teacher handled the moment well → move toward concession.
  if (handled) {
    if (mc) {
      // One more nudge if she only asked but did not yet give the correct substance.
      if (signals.question && !signals.corrected && count < maxTurns) {
        return { text: t(mc.resistance[Math.min(0, mc.resistance.length - 1)]!), done: false };
      }
      return { text: t(mc.concession), done: true };
    }
    return { text: t(CONCEDED_WRAP), done: true };
  }

  // Not handled → escalate the push ladder.
  if (mc) {
    const pushIndex = Math.min(count - 1, mc.resistance.length - 1);
    if (count - 1 < mc.resistance.length) {
      return { text: t(mc.resistance[pushIndex]!), done: false };
    }
    // Ladder exhausted: wrap in confusion — the attempt is over for scoring.
    return { text: t(GENERIC_STILL_CONFUSED), done: true };
  }
  if (count - 1 < 1) return { text: t(GENERIC_FOLLOWUP), done: false };
  return { text: t(GENERIC_STILL_CONFUSED), done: true };
}
