import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  Attempt,
  AttemptRecord,
  Lang,
  Scenario,
  TeacherState,
  Turn,
} from '../core/types.js';
import { evaluateAttempt } from '../core/scoring.js';
import { applyAttempt, emptyTeacherState } from '../core/progression.js';
import { getContentPack } from '../content/index.js';
import { mockScore } from '../llm/mock/scorer.js';
import { Store } from './store.js';
import { loadEnvFile } from './env.js';

/**
 * Deterministic synthetic cohort for the demo dashboard.
 *
 * It produces realistic transcripts (built from each scenario's public marker
 * vocabulary), scores them with the same mock scorer teachers see offline, and
 * verifies evidence through the real decision engine. No personal data.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: T[], rng: () => number, fallback: T): T {
  return list.length > 0 ? list[Math.floor(rng() * list.length)]! : fallback;
}

function makeTranscript(scenario: Scenario, quality: number, rng: () => number): Turn[] {
  const d = scenario.detection;
  const turns: Turn[] = [];
  const add = (text: string) => turns.push({ role: 'teacher', text, ts: Date.now() });
  const surface = d.surfaceMarkers.filter((m) => m !== '?');
  const question = d.questionMarkers.filter((m) => m !== '?');
  const example = d.exampleWords;
  const correct = d.correctMarkers;
  const wrong = d.wrongFactMarkers;

  const exampleSentence = `जैसे ${pick(example, rng, 'गोली')} से दिखाऊँ।`;
  const questionSentence = `${pick(question, rng, 'क्या')} ${pick(surface, rng, 'सोचो')}?`;
  const correctSentence = `${pick(correct, rng, 'सही')} सही है।`;
  const wrongSentence = `देखो ${pick(wrong, rng, 'गलत')}।`;

  if (quality >= 0.72) {
    add(correctSentence);
    add(`${exampleSentence} ${pick(surface, rng, 'देखो')}।`);
    add(questionSentence);
  } else if (quality >= 0.42) {
    add(exampleSentence);
    if (rng() > 0.5) add(correctSentence);
    add(questionSentence);
  } else {
    add(wrongSentence);
    if (rng() > 0.5) add('शाबाश, बहुत अच्छे।');
  }
  return turns;
}

export interface SeedOptions {
  filePath?: string;
  force?: boolean;
  teachers?: number;
  attemptsPerTeacher?: number;
  now?: Date;
}

export async function seed(options: SeedOptions = {}): Promise<{ teachers: number; attempts: number }> {
  loadEnvFile();
  const filePath = resolve(options.filePath ?? process.env.DATA_FILE ?? 'data/abhyas.json');
  if (options.force) {
    try {
      rmSync(filePath, { force: true });
    } catch {
      // A missing or locked file is not fatal; the store will report failures.
    }
  }
  const store = new Store(filePath);
  if (!options.force && store.countRecords() > 0) {
    return { teachers: store.countTeachers(), attempts: store.countRecords() };
  }

  const content = await getContentPack();
  const now = options.now ?? new Date();
  const rng = mulberry32(0x5f1c2026);
  const teacherCount = options.teachers ?? 18;
  const perTeacher = options.attemptsPerTeacher ?? 7;
  const curricula: { class: 1 | 2 | 3; subject: 'maths' | 'hindi' }[] = [
    { class: 1, subject: 'maths' },
    { class: 1, subject: 'hindi' },
    { class: 2, subject: 'maths' },
    { class: 2, subject: 'hindi' },
    { class: 3, subject: 'maths' },
    { class: 3, subject: 'hindi' },
  ];

  let total = 0;
  for (let i = 0; i < teacherCount; i++) {
    const curriculum = curricula[i % curricula.length]!;
    const language: Lang = i % 3 === 0 ? 'en' : 'hi';
    const teacherId = `seed_teacher_${String(i + 1).padStart(2, '0')}`;
    const pool = content.scenarios.filter(
      (s) => !s.holdout && s.curriculum.class === curriculum.class && s.curriculum.subject === curriculum.subject,
    );
    let state: TeacherState = emptyTeacherState({
      id: teacherId,
      createdAt: new Date(now.getTime() - 45 * 86_400_000).toISOString(),
      curriculum,
      language,
      currentLevel: 1,
    });
    state.levelHistory[1] = new Date(now.getTime() - 45 * 86_400_000).toISOString();
    const used = new Set<string>();

    for (let j = 0; j < perTeacher && pool.length > 0; j++) {
      let scenario = pick(pool, rng, pool[0]!);
      // Avoid immediate repeats; prefer a new scenario when possible.
      let guard = 0;
      while (used.has(scenario.id) && guard++ < 10 && pool.length > 1) {
        scenario = pick(pool, rng, pool[0]!);
      }
      used.add(scenario.id);

      const quality = rng();
      const turns = makeTranscript(scenario, quality, rng);
      // Spread attempts across six weeks, with more than one teacher per cell.
      const daysAgo = Math.floor(rng() * 41) + 1;
      const createdAt = new Date(now.getTime() - daysAgo * 86_400_000 - Math.floor(rng() * 8) * 3_600_000);
      const attempt: Attempt = {
        id: `a_seed_${String(++total).padStart(4, '0')}_${randomUUID().slice(0, 6)}`,
        teacherId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        rubricId: content.rubric.id,
        rubricVersion: content.rubric.version,
        turns,
        mode: 'online',
        clientCreatedAt: createdAt.toISOString(),
        heardCorrectly: true,
      };
      const score = await mockScore({ scenario, attempt, rubric: content.rubric });
      const decision = evaluateAttempt({
        score,
        attempt,
        rubric: content.rubric,
        level: scenario.level,
        requiredCompetencies: scenario.competencies,
        computedAt: createdAt.toISOString(),
      });
      const record: AttemptRecord = {
        attempt,
        score,
        decision,
        verified: true,
        syncedAt: createdAt.toISOString(),
      };
      store.addRecord(record);
      state = applyAttempt(state, record, scenario.level, createdAt.toISOString());
    }
    store.upsertTeacher(state);
  }

  await store.flush();
  return { teachers: store.countTeachers(), attempts: store.countRecords() };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const force = process.argv.includes('--force');
  const result = await seed({ force });
  console.log(`[abhyas] seeded ${result.teachers} teachers · ${result.attempts} verified attempts`);
}
