import pptxgen from "pptxgenjs";

// ── Palette (from the existing Abhyas deck identity) ─────────────────────────
const DARK = "221E5B", P = "2E2B72", ACC = "E8842A", TEAL = "0F5A5C";
const TXT = "1E1B33", MUT = "6E6B8F", TINT = "F2F1FA", STINT = "FBEFE3";
const LN = "DDDBEE", WHT = "FFFFFF", DIM = "C9C6E8", BUB = "3D3A85";
const F = "Segoe UI";
const W = 13.33, M = 0.5, CW = 12.33; // canvas, margin, content width

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Team CogniX";
pres.title = "Abhyas — practice before you teach";
const T = (o) => ({ fontFace: F, ...o }); // ensure font everywhere
const shadow = () => ({ type: "outer", color: "1A1735", blur: 7, offset: 2, angle: 45, opacity: 0.18 });
const bu = () => ({ code: "2022", indent: 12 });

function header(s, kick, title, dark = false) {
  s.addText(kick.toUpperCase(), T({ x: M, y: 0.42, w: CW, h: 0.3, fontSize: 13, bold: true, color: ACC, charSpacing: 2, margin: 0 }));
  s.addText(title, T({ x: M, y: 0.74, w: CW, h: 0.85, fontSize: 30, bold: true, color: dark ? WHT : TXT, margin: 0 }));
}
function footer(s, n, dark = false) {
  const c = dark ? "9B97C4" : MUT;
  s.addText("Team CogniX · SEVA31417 · Abhyas", T({ x: M, y: 7.02, w: 5, h: 0.3, fontSize: 12, color: c, margin: 0 }));
  s.addText(`${n} / 13`, T({ x: 12.0, y: 7.02, w: 0.83, h: 0.3, fontSize: 12, color: c, align: "right", margin: 0 }));
}
function chipText(s, text, x, y, w, h, o = {}) {
  s.addText(text, T({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w, h, align: "center", valign: "middle", fontSize: 12.5, margin: 0, ...o }));
}

// ══ 1 · COVER ══════════════════════════════════════════════════════════════════
let s = pres.addSlide();
s.background = { color: DARK };
s.addShape(pres.shapes.OVAL, { x: 7.4, y: -2.2, w: 9.5, h: 8.5, fill: { color: P, transparency: 45 } });
s.addShape(pres.shapes.OVAL, { x: -2.5, y: 4.6, w: 8, h: 6.5, fill: { color: TEAL, transparency: 78 } });
s.addText("अभ्यास", T({ x: 0.15, y: -0.35, w: 13, h: 3.4, fontSize: 140, bold: true, color: WHT, transparency: 93, margin: 0 }));
s.addText("SEVA FIRST INNOVATION CHALLENGE  ·  SOUTH ZONE", T({ x: 0.85, y: 0.55, w: 8, h: 0.35, fontSize: 13, bold: true, color: DIM, charSpacing: 2, margin: 0 }));
s.addText("Abhyas", T({ x: 0.85, y: 1.35, w: 7.4, h: 1.35, fontSize: 76, bold: true, color: WHT, margin: 0 }));
s.addText("अभ्यास — practice before you teach", T({ x: 0.87, y: 2.85, w: 7.2, h: 0.5, fontSize: 22, bold: true, color: ACC, margin: 0 }));
s.addText("An AI practice layer where teachers rehearse real classroom moments — by voice, with a simulated student — get evidence-based feedback, and try again. Before facing real children.", T({ x: 0.87, y: 3.6, w: 6.9, h: 1.35, fontSize: 15.5, color: DIM, lineSpacingMultiple: 1.15, margin: 0 }));
chipText(s, "Track 1 · Product / Technology", 0.87, 5.35, 2.95, 0.5, { color: WHT, fill: { color: P }, line: { color: "8B87C4", width: 1 } });
chipText(s, "Working V0 prototype", 4.0, 5.35, 2.45, 0.5, { color: WHT, fill: { color: P }, line: { color: "8B87C4", width: 1 } });
chipText(s, "Stage: Idea", 6.63, 5.35, 1.6, 0.5, { color: WHT, fill: { color: P }, line: { color: "8B87C4", width: 1 } });
s.addText("Team CogniX  ·  SEVA31417", T({ x: 0.87, y: 6.35, w: 6, h: 0.4, fontSize: 14, bold: true, color: WHT, margin: 0 }));
// phone mockup
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.55, y: 0.75, w: 4.05, h: 5.85, rectRadius: 0.14, fill: { color: P }, shadow: shadow() });
s.addText("Abhyas · Class 3 · Maths · L3", T({ x: 8.85, y: 1.0, w: 3.5, h: 0.35, fontSize: 12.5, bold: true, color: DIM, margin: 0 }));
s.addText("Ma'am, if 5 − 3 is 2, why isn't 3 − 5 also 2?", T({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: 8.85, y: 1.5, w: 3.45, h: 0.85, fontSize: 12, color: WHT, fill: { color: BUB }, valign: "middle", margin: 0.08 }));
s.addText("Good question — let's try it with bundle sticks…", T({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: 8.85, y: 2.5, w: 3.45, h: 0.85, fontSize: 12, color: WHT, fill: { color: ACC }, valign: "middle", margin: 0.08 }));
s.addText("But swapping the numbers shouldn't change the answer…", T({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: 8.85, y: 3.5, w: 3.45, h: 0.85, fontSize: 12, color: WHT, fill: { color: BUB }, valign: "middle", margin: 0.08 }));
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.85, y: 4.55, w: 3.45, h: 1.8, rectRadius: 0.08, fill: { color: WHT } });
s.addText("Feedback, from your own words", T({ x: 9.05, y: 4.68, w: 3.1, h: 0.3, fontSize: 12, bold: true, color: TXT, margin: 0 }));
s.addText("Accurate and clear — but you didn't explore how she thinks. Ask first, then explain.", T({ x: 9.05, y: 5.0, w: 3.1, h: 0.85, fontSize: 12, color: TXT, margin: 0 }));
s.addText([
  { text: "Accuracy ✓ · Clarity ✓", options: { breakLine: true } },
  { text: "Misconceptions ~" },
], T({ x: 9.05, y: 5.85, w: 3.1, h: 0.45, fontSize: 12, bold: true, color: MUT, margin: 0 }));
s.addNotes("Pitch: Abhyas — a flight simulator for teaching. Teachers rehearse by voice with a simulated student, get evidence-based feedback, retry. Working V0 exists.");

// ══ 2 · PROBLEM ════════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "The problem", "Training ends. Practice never begins.");
const stats = [
  ["5.15M", "teachers in government schools"],
  ["121.6M", "children in their classrooms"],
  ["6–10 days", "of in-service training a year — with little planned classroom follow-up"],
];
stats.forEach(([n, l], i) => {
  const y = 1.9 + i * 1.28;
  s.addText(n, T({ x: M, y, w: 2.6, h: 0.85, fontSize: 44, bold: true, color: i === 2 ? ACC : P, margin: 0 }));
  s.addText(l, T({ x: 3.2, y: y + 0.08, w: 2.9, h: 1.1, fontSize: 13, color: MUT, margin: 0 }));
});
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.75, w: 5.6, h: 1.1, rectRadius: 0.08, fill: { color: STINT } });
s.addText("“If 5 − 3 is 2, why isn't 3 − 5 also 2?”", T({ x: 0.72, y: 5.88, w: 5.2, h: 0.4, fontSize: 15, italic: true, bold: true, color: TXT, margin: 0 }));
s.addText("A Class 3 child. Answering well is a skill — and skills need practice.", T({ x: 0.72, y: 6.3, w: 5.2, h: 0.4, fontSize: 12, color: MUT, margin: 0 }));
s.addText("WHERE THE LOOP BREAKS", T({ x: 6.7, y: 1.95, w: 6.1, h: 0.3, fontSize: 13, bold: true, color: P, charSpacing: 1.5, margin: 0 }));
const loop = [
  ["✓", TEAL, "Knowledge delivered at scale", "workshops and courses reach millions of teachers"],
  ["✗", MUT, "Practice rare", "rehearsal before real classrooms almost never happens"],
  ["✗", MUT, "Feedback rarer", "no individualised follow-up on actual teaching"],
  ["✗", MUT, "Improvement stalls", "the skill is never formed — only described"],
];
loop.forEach(([g, c, b, d], i) => {
  const y = 2.45 + i * 0.85;
  s.addText(g, T({ x: 6.7, y, w: 0.5, h: 0.55, fontSize: 24, bold: true, color: c, margin: 0 }));
  s.addText(b, T({ x: 7.35, y: y + 0.02, w: 5.4, h: 0.3, fontSize: 15, bold: true, color: TXT, margin: 0 }));
  s.addText(d, T({ x: 7.35, y: y + 0.33, w: 5.4, h: 0.3, fontSize: 12.5, color: MUT, margin: 0 }));
});
s.addText("Sources: UDISE+ Report 2024–25, Ministry of Education [1]; IDR (2024) [3]; in-service training days [4].", T({ x: 6.7, y: 5.95, w: 6.1, h: 0.3, fontSize: 12, color: MUT, margin: 0 }));
footer(s, 2);
s.addNotes("India trains teachers at scale, then stops where teaching skill is formed. The gap is practice, not content.");

// ══ 3 · SOLUTION ═══════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "The solution", "Teaching is a performance skill. Abhyas is where it is rehearsed.");
const steps = [
  ["1", "Practice", "A scenario from the teacher's own class, subject and language — curriculum-scoped."],
  ["2", "Simulate", "An AI student answers back, and pushes back, like a real child with real misconceptions."],
  ["3", "Evaluate", "A separate scorer grades against a fixed rubric, quoting the teacher's own words."],
  ["4", "Retry", "The next scenario targets the measured weakest skill — until mastery unlocks the level."],
];
steps.forEach(([n, b, d], i) => {
  const x = M + i * (2.85 + 0.31);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.0, w: 2.85, h: 2.6, rectRadius: 0.1, fill: { color: TINT }, shadow: shadow() });
  s.addText(n, T({ shape: pres.shapes.OVAL, x: x + 0.25, y: 2.25, w: 0.55, h: 0.55, fontSize: 20, bold: true, color: WHT, fill: { color: ACC }, align: "center", valign: "middle", margin: 0 }));
  s.addText(b, T({ x: x + 0.25, y: 3.0, w: 2.4, h: 0.35, fontSize: 16.5, bold: true, color: TXT, margin: 0 }));
  s.addText(d, T({ x: x + 0.25, y: 3.4, w: 2.4, h: 1.1, fontSize: 12, color: MUT, lineSpacingMultiple: 1.1, margin: 0 }));
});
s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.15, w: W, h: 1.55, fill: { color: TINT } });
s.addText("Simulate → Interact → Evaluate → Identify gaps → Improve → Practise again", T({ x: M, y: 5.45, w: CW, h: 0.4, fontSize: 16, bold: true, color: P, margin: 0 }));
s.addText("Safe · repeatable · private · in the teacher's own language. Progress on demonstrated competency — not on sessions completed.", T({ x: M, y: 5.95, w: CW, h: 0.4, fontSize: 13, color: MUT, margin: 0 }));
footer(s, 3);
s.addNotes("The four-step loop. Emphasise: safe to fail, targeted retries, competency-gated progression.");

// ══ 4 · PROGRESSION ════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "How teachers progress", "One skill at a time — then integrate");
s.addShape(pres.shapes.LINE, { x: M, y: 3.3, w: CW, h: 0, line: { color: LN, width: 1.5 } });
const levels = [
  ["L1", "Accuracy", "Facts and curriculum alignment", false],
  ["L2", "Clarity", "An explanation a child of that age can follow", false],
  ["L3", "Misconceptions", "Surface the belief before correcting it", false],
  ["L4", "Questioning", "Probing that invites curiosity, not guess-the-answer", false],
  ["L5+", "Integrated", "All competencies, weighted like a real lesson", true],
];
levels.forEach(([n, b, d, future], i) => {
  const x = M + i * (2.25 + 0.27);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.0, w: 2.25, h: 2.6, rectRadius: 0.1, fill: { color: future ? STINT : WHT }, line: { color: future ? ACC : LN, width: 1.25, dashType: future ? "dash" : "solid" }, shadow: shadow() });
  s.addText(n, T({ x: x + 0.2, y: 2.2, w: 1.85, h: 0.5, fontSize: 26, bold: true, color: future ? ACC : P, margin: 0 }));
  s.addText(b, T({ x: x + 0.2, y: 2.8, w: 1.85, h: 0.35, fontSize: 15, bold: true, color: TXT, margin: 0 }));
  s.addText(d, T({ x: x + 0.2, y: 3.2, w: 1.85, h: 1.25, fontSize: 12, color: MUT, lineSpacingMultiple: 1.1, margin: 0 }));
});
const facts = [
  ["~10 scenarios per level", "curated against the rubric — not endless generated content"],
  ["Fixed bar, flexible practice", "level-ups need passes across distinct scenarios; retries are private"],
  ["NPST-aligned", "experts set competencies and thresholds — the AI cannot invent criteria"],
];
facts.forEach(([b, d], i) => {
  const x = M + i * (4.11 + 0.0);
  s.addText(b, T({ x, y: 5.15, w: 3.9, h: 0.35, fontSize: 14.5, bold: true, color: P, margin: 0 }));
  s.addText(d, T({ x, y: 5.52, w: 3.9, h: 0.75, fontSize: 12.5, color: MUT, lineSpacingMultiple: 1.1, margin: 0 }));
});
footer(s, 4);
s.addNotes("L1–L4 are the core competencies; L5+ integrates them. The bar is fixed; the practice is flexible and private.");

// ══ 5 · HOW IT WORKS (persona isolation diagram) ═══════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "How Abhyas works", "The student who challenges you never grades you");
const boxes = [
  ["AI student", ["A child persona: age, grade, language, knowledge level, misconception profile", "Pushes back at authored moments — inside curriculum bounds", "Never sees the rubric"]],
  ["AI evaluator", ["Scores against the pinned rubric version", "Quotes verbatim evidence for every judgement", "Abstains when evidence is thin — never guesses"]],
  ["Mastery engine", ["Pure code: versioned weights, floors, thresholds", "Pass · retry · advance — same attempt, same result", "AI cannot invent criteria or unlock levels"]],
];
boxes.forEach(([b, lines], i) => {
  const x = M + i * (3.61 + 0.75);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.9, w: 3.61, h: 3.0, rectRadius: 0.1, fill: { color: i === 2 ? STINT : TINT }, shadow: shadow() });
  s.addText(b, T({ x: x + 0.25, y: 2.1, w: 3.1, h: 0.4, fontSize: 17, bold: true, color: i === 2 ? ACC : P, margin: 0 }));
  s.addText(lines.map((t, j) => ({ text: t, options: { bullet: bu(), breakLine: j < lines.length - 1 } })), T({ x: x + 0.25, y: 2.6, w: 3.15, h: 2.2, fontSize: 12, color: TXT, paraSpaceAfter: 7, lineSpacingMultiple: 1.05, margin: 0 }));
});
s.addShape(pres.shapes.LINE, { x: 4.16, y: 3.35, w: 0.65, h: 0, line: { color: MUT, width: 2, endArrowType: "triangle" } });
s.addShape(pres.shapes.LINE, { x: 8.57, y: 3.35, w: 0.6, h: 0, line: { color: MUT, width: 2, endArrowType: "triangle" } });
s.addText("transcript + rubric version", T({ x: 3.4, y: 5.0, w: 2.2, h: 0.3, fontSize: 12, color: MUT, align: "center", margin: 0 }));
s.addText("validated scores + evidence", T({ x: 7.87, y: 5.0, w: 2.0, h: 0.3, fontSize: 12, color: MUT, align: "center", margin: 0 }));
s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.7, w: W, h: 1.1, fill: { color: TINT } });
s.addText([
  { text: "Persona isolation:", options: { bold: true, color: P, breakLine: false } },
  { text: "  separate instructions · separate model calls. Tests assert the student never sees the rubric and the scorer never sees the student's hidden resistance ladder.", options: { color: MUT } },
], T({ x: M, y: 5.95, w: CW, h: 0.6, fontSize: 13.5, margin: 0 }));
footer(s, 5);
s.addNotes("Three components, strictly separated. Isolation is enforced by tests, not promises.");

// ══ 6 · EVIDENCE-BASED EVALUATION ══════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "Evidence-based evaluation", "Feedback from your own words");
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.95, w: 6.2, h: 4.35, rectRadius: 0.1, fill: { color: WHT }, line: { color: LN, width: 1.25 }, shadow: shadow() });
s.addText("FROM A REAL V0 FEEDBACK CARD", T({ x: 0.8, y: 2.15, w: 5.6, h: 0.3, fontSize: 12, bold: true, color: MUT, charSpacing: 1.5, margin: 0 }));
s.addText("“Let's try it with bundle sticks…”", T({ x: 0.8, y: 2.6, w: 5.6, h: 0.4, fontSize: 15, italic: true, color: TXT, margin: 0 }));
chipText(s, "Clarity ✓", 0.8, 3.08, 1.15, 0.4, { color: WHT, bold: true, fill: { color: TEAL } });
s.addText("A concrete model, pitched right for a Class 2 child.", T({ x: 2.1, y: 3.12, w: 4.4, h: 0.35, fontSize: 12.5, color: MUT, margin: 0 }));
s.addText("“She has to subtract the bigger number first.”", T({ x: 0.8, y: 3.7, w: 5.6, h: 0.4, fontSize: 15, italic: true, color: TXT, margin: 0 }));
chipText(s, "Misconceptions ~", 0.8, 4.18, 1.9, 0.4, { color: TXT, bold: true, fill: { color: TINT } });
s.addText("You corrected the rule before exploring why she thinks that.", T({ x: 2.85, y: 4.22, w: 3.7, h: 0.35, fontSize: 12.5, color: MUT, margin: 0 }));
s.addText("Fabricated or missing evidence lowers confidence —", T({ x: 0.8, y: 4.9, w: 5.6, h: 0.35, fontSize: 13, color: TXT, margin: 0 }));
chipText(s, "Abstain", 0.8, 5.32, 1.15, 0.4, { color: WHT, bold: true, fill: { color: ACC } });
s.addText("the attempt is marked provisional: no score movement, honest reason shown.", T({ x: 2.1, y: 5.36, w: 4.3, h: 0.35, fontSize: 12.5, color: MUT, margin: 0 }));
s.addText("FOUR VERDICTS — NEVER A VAGUE SCORE", T({ x: 7.1, y: 2.15, w: 5.7, h: 0.3, fontSize: 13, bold: true, color: P, charSpacing: 1.5, margin: 0 }));
const verdicts = [
  ["Demonstrated", "quoted, re-verified, and correct", TEAL, WHT],
  ["Partial", "right direction, incomplete reasoning", TINT, TXT],
  ["Incorrect", "a misstatement — cited with evidence", TINT, TXT],
  ["Insufficient evidence", "abstain: honest reason, retry offered", STINT, TXT],
];
verdicts.forEach(([b, d, bg, fg], i) => {
  const y = 2.65 + i * 0.95;
  chipText(s, b, 7.1, y, 2.5, 0.45, { color: fg, bold: true, fill: { color: bg } });
  s.addText(d, T({ x: 9.75, y: y + 0.05, w: 3.1, h: 0.5, fontSize: 12.5, color: MUT, margin: 0 }));
});
footer(s, 6);
s.addNotes("Every score cites the teacher's verbatim words; a second pass re-verifies each quote. A convincing-sounding answer is never mistaken for competence.");

// ══ 7 · ORIGINALITY (comparison matrix) ════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "What makes it original", "Most AI helps teachers prepare. Abhyas helps them perform.");
const mark = (v) => v === "y" ? { text: "✓", options: { color: TEAL, bold: true, align: "center" } }
  : v === "p" ? { text: "~", options: { color: MUT, align: "center" } }
  : { text: "—", options: { color: MUT, align: "center" } };
const hdr = (t) => ({ text: t, options: { bold: true, color: WHT, fill: { color: P }, align: "center", fontSize: 13 } });
const rowL = (t, hot) => ({ text: t, options: { bold: !!hot, color: hot ? TXT : TXT, fill: { color: hot ? STINT : WHT }, fontSize: 13.5 } });
const rows = [
  [hdr("Approach"), hdr("Practice"), hdr("Evidence feedback"), hdr("Continuous"), hdr("Scalable"), hdr("Expert-calibrated")],
  [rowL("Workshops & courses"), mark("n"), mark("n"), mark("n"), mark("y"), mark("y")],
  [rowL("Mentor / DIET visits"), mark("p"), mark("y"), mark("n"), mark("n"), mark("y")],
  [rowL("Peer communities"), mark("p"), mark("p"), mark("y"), mark("y"), mark("n")],
  [rowL("Generic AI assistants"), mark("n"), mark("p"), mark("y"), mark("y"), mark("n")],
  [rowL("Abhyas", true), mark("y"), mark("y"), mark("y"), mark("y"), mark("y")],
];
s.addTable(rows, T({ x: M, y: 2.1, w: CW, colW: [3.63, 1.74, 1.74, 1.74, 1.74, 1.74], rowH: 0.58, border: { pt: 1, color: LN }, valign: "middle", margin: 0.06 }));
s.addText("Abhyas assesses not what a teacher knows — but how well they can transfer it to a child.", T({ x: M, y: 5.95, w: CW, h: 0.4, fontSize: 16, bold: true, color: P, margin: 0 }));
s.addText("✓ yes   ·   ~ partial   ·   — not really", T({ x: M, y: 6.45, w: CW, h: 0.3, fontSize: 12, color: MUT, margin: 0 }));
footer(s, 7);
s.addNotes("The comparison judges what each approach can actually deliver. Abhyas is the only column with all five.");

// ══ 8 · GUARDRAILS ═════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "Guardrails and reliability", "Every failure has a protection");
const guards = [
  ["Humans set the standard", "Rubric is versioned, hash-pinned, NPST-aligned. Every evaluation cites its rubric version."],
  ["Persona isolation", "Student and evaluator run separate prompts and model calls; neither can influence the other."],
  ["Evidence, never guesses", "Scores must quote the teacher's words; fabricated quotes lower confidence and force abstention."],
  ["Bounded simulation", "Personas stay inside curated scenarios and curriculum — no off-topic or inappropriate content."],
  ["Structured outputs", "Schemas validate every model response before it reaches the engine; invalid outputs are retried."],
  ["Privacy by design", "Attempts stay private; only k-anonymised cohort trends (n ≥ 5) are ever shared."],
];
guards.forEach(([b, d], i) => {
  const x = i % 2 === 0 ? M : 6.95, y = 2.0 + Math.floor(i / 2) * 1.55;
  s.addText(b, T({ x, y, w: 5.85, h: 0.35, fontSize: 15.5, bold: true, color: P, margin: 0 }));
  s.addText(d, T({ x, y: y + 0.38, w: 5.85, h: 0.75, fontSize: 12.5, color: MUT, lineSpacingMultiple: 1.1, margin: 0 }));
  if (i < 4) s.addShape(pres.shapes.LINE, { x, y: y + 1.32, w: 5.85, h: 0, line: { color: LN, width: 1 } });
});
footer(s, 8);
s.addNotes("If the LLM goes wrong somewhere, something deterministic catches it. Privacy: individual attempts never shown to administrators.");

// ══ 9 · V0 PROOF OF BUILD (dark) ═══════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: DARK };
s.addShape(pres.shapes.OVAL, { x: 9.0, y: 4.0, w: 7, h: 6, fill: { color: P, transparency: 55 } });
s.addText("V0", T({ x: 8.8, y: -0.5, w: 4.8, h: 3.2, fontSize: 150, bold: true, color: WHT, transparency: 93, margin: 0 }));
header(s, "Proof of build", "A working V0 already runs the full loop", true);
const bigs = [
  ["72", "automated tests — engine, evidence, isolation, offline sync"],
  ["6", "scenario packs — Maths + Hindi, Classes 1–3"],
  ["8", "expert-labelled golden attempts for calibration"],
  ["4", "competencies on an NPST-aligned rubric"],
];
bigs.forEach(([n, l], i) => {
  const x = M + i * (2.85 + 0.31);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.85, w: 2.85, h: 1.55, rectRadius: 0.1, fill: { color: P } });
  s.addText(n, T({ x: x + 0.22, y: 1.98, w: 2.4, h: 0.6, fontSize: 36, bold: true, color: ACC, margin: 0 }));
  s.addText(l, T({ x: x + 0.22, y: 2.6, w: 2.45, h: 0.75, fontSize: 11.5, color: DIM, lineSpacingMultiple: 1.05, margin: 0 }));
});
s.addText("WHAT WORKS TODAY", T({ x: M, y: 3.75, w: 6, h: 0.3, fontSize: 13, bold: true, color: ACC, charSpacing: 1.5, margin: 0 }));
s.addText([
  { text: "Voice-first rehearsal — speech-to-text in, text-to-speech out", options: { bullet: bu(), breakLine: true } },
  { text: "“Heard me correctly” gate — teacher reviews the transcript before scoring", options: { bullet: bu(), breakLine: true } },
  { text: "Offline queue — attempts sync idempotently when connectivity returns", options: { bullet: bu(), breakLine: true } },
  { text: "Deterministic engine — same attempt, same result, online or offline", options: { bullet: bu(), breakLine: true } },
  { text: "Runs with no API key — cloud models optional behind one interface", options: { bullet: bu() } },
], T({ x: M, y: 4.15, w: 6.1, h: 2.6, fontSize: 13, color: WHT, paraSpaceAfter: 8, margin: 0 }));
s.addText("CALIBRATED, NOT VIBED", T({ x: 7.0, y: 3.75, w: 5.8, h: 0.3, fontSize: 13, bold: true, color: ACC, charSpacing: 1.5, margin: 0 }));
s.addText([
  { text: "AI-vs-expert harness scores the 8 golden attempts through the full pipeline", options: { bullet: bu(), breakLine: true } },
  { text: "CI gate blocks regressions unless error and decision-agreement stay inside thresholds", options: { bullet: bu(), breakLine: true } },
  { text: "The engine used is recorded on every score — mock or cloud", options: { bullet: bu(), breakLine: true } },
  { text: "Fabricated evidence lowers confidence and forces abstention", options: { bullet: bu() } },
], T({ x: 7.0, y: 4.15, w: 5.8, h: 2.6, fontSize: 13, color: WHT, paraSpaceAfter: 8, margin: 0 }));
footer(s, 9, true);
s.addNotes("This is an idea-stage entry with a working prototype: voice loop, offline, tests, calibration harness. Deterministic mock engine by default; cloud LLM optional.");

// ══ 10 · STACK ═════════════════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "Technical architecture", "Model-agnostic by design");
const stack = [
  ["Interface", "React · TypeScript · Tailwind CSS"],
  ["Backend", "Python · FastAPI · Pydantic (structured validation)"],
  ["Data", "PostgreSQL — versioned scenarios, rubrics, sessions, evidence"],
  ["AI & voice", "Modular LLM and speech-to-text / text-to-speech behind swappable interfaces"],
];
stack.forEach(([b, d], i) => {
  const y = 2.0 + i * 0.95;
  s.addText(b, T({ x: M, y, w: 2.0, h: 0.4, fontSize: 15, bold: true, color: P, margin: 0 }));
  s.addText(d, T({ x: 2.6, y: y + 0.02, w: 4.5, h: 0.75, fontSize: 13.5, color: TXT, margin: 0 }));
  s.addShape(pres.shapes.LINE, { x: M, y: y + 0.78, w: 6.6, h: 0, line: { color: LN, width: 1 } });
});
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.6, y: 1.95, w: 5.23, h: 3.85, rectRadius: 0.1, fill: { color: TINT } });
s.addText("WHAT THE V0 PROTOTYPE RUNS", T({ x: 7.9, y: 2.15, w: 4.6, h: 0.3, fontSize: 13, bold: true, color: ACC, charSpacing: 1.5, margin: 0 }));
s.addText([
  { text: "React + TypeScript voice-first frontend", options: { bullet: bu(), breakLine: true } },
  { text: "Express orchestrator + deterministic engine", options: { bullet: bu(), breakLine: true } },
  { text: "OpenAI-compatible and Anthropic adapters — optional, behind one interface", options: { bullet: bu(), breakLine: true } },
  { text: "Offline-first on-device storage (IndexedDB)", options: { bullet: bu() } },
], T({ x: 7.9, y: 2.6, w: 4.7, h: 3.0, fontSize: 13, color: TXT, paraSpaceAfter: 9, margin: 0 }));
s.addText("Providers are chosen on language quality, latency and cost after benchmarking. On-device inference is a planned future goal — not a claimed capability.", T({ x: M, y: 6.0, w: CW, h: 0.6, fontSize: 13, italic: true, color: MUT, margin: 0 }));
footer(s, 10);
s.addNotes("Proposed production stack on the left; what the built prototype actually runs on the right. Model-agnostic means we can swap providers, including on-device models later.");

// ══ 11 · PILOT & PROOF PLAN ════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "Pilot and proof plan", "How we will prove it works");
const plan = [
  ["1", "Validate", "Practising teachers review every competency, scenario and threshold"],
  ["2", "Calibrate", "AI scores expert-labelled attempts — agreement measured, expert-blinded"],
  ["3", "Pilot", "10–20 teachers across 2–3 government schools"],
  ["4", "Scale", "More languages, subjects and grades — offline use"],
];
plan.forEach(([n, b, d], i) => {
  const x = M + i * (2.85 + 0.31);
  s.addText(n, T({ shape: pres.shapes.OVAL, x: x + 1.1, y: 2.0, w: 0.6, h: 0.6, fontSize: 22, bold: true, color: WHT, fill: { color: i === 2 ? ACC : P }, align: "center", valign: "middle", margin: 0 }));
  if (i < 3) s.addShape(pres.shapes.LINE, { x: x + 1.85, y: 2.3, w: 1.1, h: 0, line: { color: LN, width: 2 } });
  s.addText(b, T({ x, y: 2.8, w: 2.85, h: 0.4, fontSize: 17, bold: true, color: TXT, align: "center", margin: 0 }));
  s.addText(d, T({ x, y: 3.25, w: 2.85, h: 1.3, fontSize: 12.5, color: MUT, align: "center", lineSpacingMultiple: 1.1, margin: 0 }));
});
s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.0, w: W, h: 1.7, fill: { color: TINT } });
s.addText([
  { text: "We measure: ", options: { bold: true, color: P, breakLine: false } },
  { text: "post-practice vs pre-practice rubric scores on unseen scenarios  ·  AI–expert agreement  ·  speech accuracy by language  ·  retry rate", options: { color: TXT } },
], T({ x: M, y: 5.25, w: CW, h: 0.55, fontSize: 14, margin: 0 }));
s.addText("Unseen scenarios are the transfer test: did practice change teaching, not just memory of the scenario. Targets, not achieved results.", T({ x: M, y: 5.9, w: CW, h: 0.6, fontSize: 12.5, italic: true, color: MUT, margin: 0 }));
footer(s, 11);
s.addNotes("Validate → calibrate → pilot → scale. The transfer test on unseen scenarios is the honest measure.");

// ══ 12 · SCALE & ADOPTION ══════════════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: WHT };
header(s, "Scale and adoption", "One architecture for every language, subject and class");
s.addText("HOW IT SCALES", T({ x: M, y: 1.95, w: 5.8, h: 0.3, fontSize: 13, bold: true, color: ACC, charSpacing: 1.5, margin: 0 }));
const scales = [
  ["Versioned content packs", "Kannada first, then more Indian languages, subjects and grades — without a rebuild"],
  ["District mentorship layer", "shows which skills each cohort finds hardest, so training targets them"],
  ["State & DIKSHA integration", "anonymised aggregate trends feed the next training cycle"],
];
scales.forEach(([b, d], i) => {
  const y = 2.4 + i * 1.05;
  s.addText(b, T({ x: M, y, w: 5.8, h: 0.35, fontSize: 15, bold: true, color: P, margin: 0 }));
  s.addText(d, T({ x: M, y: y + 0.36, w: 5.8, h: 0.6, fontSize: 12.5, color: MUT, margin: 0 }));
});
s.addText("WHO CAN TAKE IT FORWARD", T({ x: 7.0, y: 1.95, w: 5.8, h: 0.3, fontSize: 13, bold: true, color: P, charSpacing: 1.5, margin: 0 }));
const adopters = [
  ["DIETs & SCERTs", "teacher access, pedagogical validation, pilot implementation"],
  ["NCERT & state departments", "curriculum alignment, adoption pathways"],
  ["DIKSHA", "integration and distribution channel"],
  ["FLN-focused NGOs", "implementation and outreach"],
];
adopters.forEach(([b, d], i) => {
  const y = 2.4 + i * 0.85;
  s.addText(b, T({ x: 7.0, y, w: 5.8, h: 0.3, fontSize: 14.5, bold: true, color: TXT, margin: 0 }));
  s.addText(d, T({ x: 7.0, y: y + 0.3, w: 5.8, h: 0.35, fontSize: 12, color: MUT, margin: 0 }));
});
s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.85, w: W, h: 0.95, fill: { color: STINT } });
s.addText([
  { text: "Scale potential: 5.15M government-school teachers. ", options: { bold: true, color: TXT, breakLine: false } },
  { text: "Adopters and partners are targets only — none committed yet.", options: { color: MUT } },
], T({ x: M, y: 6.12, w: CW, h: 0.45, fontSize: 13.5, margin: 0 }));
footer(s, 12);
s.addNotes("Same architecture, new packs. Be explicit: adoption targets, not commitments.");

// ══ 13 · SUPPORT + CLOSING (dark) ══════════════════════════════════════════════
s = pres.addSlide();
s.background = { color: DARK };
s.addShape(pres.shapes.OVAL, { x: 8.2, y: -2.5, w: 9, h: 8, fill: { color: P, transparency: 50 } });
s.addText("अभ्यास", T({ x: 7.5, y: 4.4, w: 6, h: 3, fontSize: 120, bold: true, color: WHT, transparency: 93, margin: 0 }));
header(s, "Support we need", "What would make this real", true);
const asks = [
  ["Pedagogy mentorship", "teacher educators, mathematics-education experts, AI researchers"],
  ["Teacher access", "a DIET connection and 2–3 partner government schools"],
  ["Language experts", "Hindi, Kannada and early-grade pedagogy specialists"],
  ["Technical mentorship", "multilingual speech systems, LLM evaluation, privacy"],
  ["Pilot support", "cloud credits, funding, incubation"],
];
asks.forEach(([b, d], i) => {
  const y = 2.0 + i * 0.92;
  s.addText(b, T({ x: M, y, w: 3.1, h: 0.35, fontSize: 15, bold: true, color: ACC, margin: 0 }));
  s.addText(d, T({ x: 3.7, y: y + 0.03, w: 4.6, h: 0.6, fontSize: 13, color: DIM, margin: 0 }));
  if (i < 4) s.addShape(pres.shapes.LINE, { x: M, y: y + 0.72, w: 7.8, h: 0, line: { color: "44406F", width: 1 } });
});
s.addText("Pilots don't learn to fly from a manual.", T({ x: 8.6, y: 2.3, w: 4.3, h: 0.9, fontSize: 24, bold: true, color: WHT, margin: 0 }));
s.addText("Every teacher deserves a safe place to practise before they teach.", T({ x: 8.6, y: 3.3, w: 4.3, h: 1.4, fontSize: 24, bold: true, color: ACC, margin: 0 }));
s.addText("Team CogniX  ·  SEVA31417  ·  अभ्यास — practice before you teach", T({ x: M, y: 6.6, w: 9, h: 0.4, fontSize: 13, bold: true, color: DIM, margin: 0 }));
s.addNotes("Close on the ask and the line. Thank the panel.");

await pres.writeFile({ fileName: "Abhyas_Pitch.pptx" });
console.log("wrote Abhyas_Pitch.pptx");
