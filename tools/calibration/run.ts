import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getContentPack } from '../../src/content/index.js';
import { createLlmClient, readLlmEnv } from '../../src/llm/index.js';
import type { Attempt, CompetencyId, ScorerOutput, Turn } from '../../src/core/types.js';
import { evaluateAttempt, normalizeScorerOutput, scoreBand } from '../../src/core/scoring.js';

/**
 * Calibration harness — the "AI vs experts" step from the proof plan, runnable.
 *
 * Every golden attempt is a hand-authored rehearsal transcript with labels from
 * an expert teacher-educator. The harness scores each one with the configured
 * engine (mock by default, cloud via LLM_PROVIDER/keys) through the SAME
 * normalization + evidence-verification + decision pipeline the server uses,
 * then reports agreement.
 *
 * Usage:
 *   npm run calibration            # report with the configured engine
 *   LLM_PROVIDER=anthropic npm run calibration   # calibrate the Claude path
 *   npm run calibration -- --json  # machine-readable output
 *   npm run calibration -- --gate  # exit 1 below agreement thresholds (CI)
 */

interface GoldenAttempt {
  id: string;
  scenarioId: string;
  profile: 'strong' | 'mixed' | 'weak' | 'wrong';
  expertScores: Partial<Record<CompetencyId, number>>;
  expectedDecision: 'pass' | 'retry' | 'redo';
  expertNotes: string;
  turns: Turn[];
}

interface GoldenFile {
  version: string;
  attempts: GoldenAttempt[];
}

interface CompetencyMetric {
  competency: CompetencyId;
  n: number;
  mae: number;
  within02: number;
  bandAgreement: number;
  abstained: number;
}

function mae(est: number[], exp: number[]): number {
  if (est.length === 0) return 0;
  const sum = est.reduce((acc, e, i) => acc + Math.abs(e - exp[i]!), 0);
  return sum / est.length;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const gate = args.includes('--gate');

  const pack = await getContentPack();
  const goldenPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden.json');
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as GoldenFile;

  const env = readLlmEnv();
  const runtime = createLlmClient(env);

  const rows: {
    id: string;
    profile: GoldenAttempt['profile'];
    engineScores: Record<string, number | 'abstained'>;
    expertScores: Record<string, number>;
    decision: string;
    expected: string;
    decisionMatch: boolean;
    mae: number;
  }[] = [];

  for (const g of golden.attempts) {
    const scenario = pack.scenarios.find((s) => s.id === g.scenarioId);
    if (!scenario) {
      console.error(`[calibration] scenario not found: ${g.scenarioId}`);
      return 2;
    }
    const attempt: Attempt = {
      id: `cal_${g.id}`,
      teacherId: 'calibration-harness',
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      rubricId: pack.rubric.id,
      rubricVersion: pack.rubric.version,
      turns: g.turns,
      mode: 'online',
      clientCreatedAt: new Date().toISOString(),
      heardCorrectly: true,
    };

    let raw: ScorerOutput;
    try {
      raw = await runtime.client.scoreAttempt({ scenario, attempt, rubric: pack.rubric });
    } catch (err) {
      console.error(`[calibration] scoring failed for ${g.id}:`, String(err).slice(0, 200));
      return 2;
    }
    const score = normalizeScorerOutput(raw, scenario.competencies);
    const decision = evaluateAttempt({
      score,
      attempt,
      rubric: pack.rubric,
      level: scenario.level,
      requiredCompetencies: scenario.competencies,
      computedAt: new Date().toISOString(),
    });

    const engineScores: Record<string, number | 'abstained'> = {};
    const perCompEst: number[] = [];
    const perCompExp: number[] = [];
    for (const cs of score.competencyScores) {
      const expert = g.expertScores[cs.competency];
      if (expert === undefined) continue;
      if (cs.abstained) {
        engineScores[cs.competency] = 'abstained';
        // Abstention on a labelled competency counts as a full miss in MAE terms
        // but is tracked separately so the report stays honest.
        perCompEst.push(0);
        perCompExp.push(expert);
        continue;
      }
      engineScores[cs.competency] = Math.round(cs.score * 100) / 100;
      perCompEst.push(cs.score);
      perCompExp.push(expert);
    }

    rows.push({
      id: g.id,
      profile: g.profile,
      engineScores,
      expertScores: g.expertScores,
      decision: decision.status,
      expected: g.expectedDecision,
      decisionMatch: decision.status === g.expectedDecision,
      mae: mae(perCompEst, perCompExp),
    });
  }

  // ---- aggregate metrics ---------------------------------------------------
  const compMap = new Map<CompetencyId, { est: number[]; exp: number[]; band: number[]; abstained: number }>();
  for (const g of golden.attempts) {
    const row = rows.find((r) => r.id === g.id)!;
    for (const [comp, expert] of Object.entries(g.expertScores)) {
      const entry = compMap.get(comp as CompetencyId) ?? { est: [], exp: [], band: [], abstained: 0 };
      const est = row.engineScores[comp];
      if (est === 'abstained') {
        entry.abstained += 1;
        entry.est.push(0);
        entry.exp.push(expert as number);
        entry.band.push(0);
      } else if (typeof est === 'number') {
        entry.est.push(est);
        entry.exp.push(expert as number);
        entry.band.push(scoreBand(est) === scoreBand(expert as number) ? 1 : 0);
      }
      compMap.set(comp as CompetencyId, entry);
    }
  }

  const compMetrics: CompetencyMetric[] = [...compMap.entries()].map(([competency, m]) => ({
    competency,
    n: m.exp.length,
    mae: Math.round(mae(m.est, m.exp) * 1000) / 1000,
    within02: Math.round(
      (m.est.filter((e, i) => Math.abs(e - m.exp[i]!) <= 0.2).length / m.exp.length) * 100,
    ),
    bandAgreement: Math.round((m.band.reduce((a, b) => a + b, 0) / m.band.length) * 100),
    abstained: m.abstained,
  }));

  const overallMae = Math.round(mae(
    rows.flatMap((r) => Object.entries(r.engineScores).filter(([, v]) => typeof v === 'number').map(([k, v]) => v as number)),
    rows.flatMap((r) => Object.entries(r.expertScores).map(([k, v]) => v)),
  ) * 1000) / 1000;
  const decisionAgreement = Math.round(
    (rows.filter((r) => r.decisionMatch).length / rows.length) * 100,
  );
  const provisionalRate = Math.round(
    (rows.filter((r) => r.decision === 'provisional').length / rows.length) * 100,
  );

  if (asJson) {
    console.log(JSON.stringify({
      engine: runtime.engine,
      mode: runtime.mode,
      rubric: { id: pack.rubric.id, version: pack.rubric.version, hash: pack.rubric.hash },
      overall: { mae: overallMae, decisionAgreement, provisionalRate, attempts: rows.length },
      perCompetency: compMetrics,
      rows,
    }, null, 2));
    return gate ? (decisionAgreement >= 70 && overallMae <= 0.25 ? 0 : 1) : 0;
  }

  const line = '─'.repeat(78);
  console.log(`\nAbhyas calibration — AI vs experts`);
  console.log(line);
  console.log(`Engine: ${runtime.engine} (${runtime.mode}) · rubric ${pack.rubric.id} v${pack.rubric.version}`);
  console.log(`Rubric hash: ${pack.rubric.hash?.slice(0, 16)}…`);
  console.log(line);
  console.log(
    'attempt'.padEnd(28) + 'profile'.padEnd(9) + 'engine vs expert (per competency)'.padEnd(38) + 'decision',
  );
  for (const r of rows) {
    const comps = Object.entries(r.engineScores)
      .map(([c, v]) => `${c.slice(0, 4)}:${typeof v === 'number' ? v.toFixed(2) : 'abst'}/${r.expertScores[c]?.toFixed(2)}`)
      .join(' ');
    const mark = r.decisionMatch ? '✓' : '✗';
    console.log(
      r.id.padEnd(28) + r.profile.padEnd(9) + comps.padEnd(38) + `${r.decision}${mark} (exp: ${r.expected})`,
    );
  }
  console.log(line);
  console.log('Per-competency agreement:');
  for (const m of compMetrics) {
    console.log(
      `  ${m.competency.padEnd(16)} n=${m.n}  MAE=${m.mae.toFixed(3)}  within±0.2=${m.within02}%  band=${m.bandAgreement}%  abstained=${m.abstained}`,
    );
  }
  console.log(line);
  console.log(`Overall MAE: ${overallMae.toFixed(3)} · decision agreement: ${decisionAgreement}% · provisional: ${provisionalRate}%`);
  console.log(
    '\nInterpretation: MAE ≤ 0.25 and decision agreement ≥ 70% is the V0 calibration gate.',
    '\nAbstentions are honest refusals, not failures — track them, do not hide them.',
  );

  if (gate) {
    const ok = decisionAgreement >= 70 && overallMae <= 0.25;
    console.log(`\nGate: ${ok ? 'PASS' : 'FAIL'}`);
    return ok ? 0 : 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
