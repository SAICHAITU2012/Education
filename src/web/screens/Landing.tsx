import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.js';
import { tiltHandlers } from '../tilt.js';
import '../landing.css';

/**
 * In-app landing route (#/landing) — the gameverse front door.
 * Reachable from the brand mark everywhere, PWA included.
 * Copy follows the app's uiLang; local day/dusk/night preview switcher.
 */

type Env = 'day' | 'dusk' | 'night';

const T = {
  en: {
    tagline: 'practice before you teach',
    chip: 'Seva First Innovation Challenge · South Zone',
    h1a: 'Practise before', h1b: 'you ', h1em: 'teach.', h1c: '.',
    tag: '— the flight simulator for teaching',
    lead: 'An AI practice layer where government-school teachers rehearse real classroom moments — by voice, with a simulated student — get evidence-based feedback, and try again. Before facing real children.',
    b1: 'Maths · Classes 1–3', b2: 'Voice-first', b3: 'Working V0 prototype',
    start: 'Press Start ▶', how: "See how it works", built: "What's already built",
    teamA: 'Team ', teamB: ' · SEVA31417 · ', teamC: 'SEVA FIRST 2026',
    turns: 'TURNS', rehearse: '🎙 5-minute rehearsal →',
    problem: 'The problem', problemH: 'Training ends. Practice never begins.',
    problemS: 'India trains teachers at scale, then stops exactly where teaching skill is formed. Teaching is a performance skill — yet it is the one performance profession with no rehearsal.',
    s1l: 'teachers in government schools', s2l: 'children in their classrooms', s3l: 'of in-service training a year — with little planned classroom follow-up',
    src: 'Sources: UDISE+ Report 2024–25, Ministry of Education; IDR (2024).',
    howK: 'How Abhyas works', howH: 'A four-step practice loop',
    howS: 'Safe to fail, targeted to improve, gated by demonstrated competency — not sessions completed.',
    steps: [
      ['Practice', "A scenario from the teacher's own class, subject and language — curriculum-scoped."],
      ['Simulate', 'An AI student answers back, and pushes back, like a real child with real misconceptions.'],
      ['Evaluate', "A separate scorer grades against a fixed rubric, quoting the teacher's own words."],
      ['Retry', 'The next scenario targets the measured weakest skill — until mastery unlocks the level.'],
    ] as [string, string][],
    loop: 'Simulate → Interact → Evaluate → Identify gaps → Improve → Practise again',
    loopS: 'Persona isolation: the student who challenges you never grades you. Separate instructions, separate model calls — enforced by tests.',
    realmK: 'How teachers progress', realmH: 'One skill at a time — then integrate',
    realms: [
      ['Accuracy', 'Facts and curriculum alignment'],
      ['Clarity', 'An explanation a child of that age can follow'],
      ['Misconceptions', 'Surface the belief before correcting it'],
      ['Questioning', 'Probing that invites curiosity, not guess-the-answer'],
      ['Integrated', 'All competencies, weighted like a real lesson'],
    ] as [string, string][],
    rnote: [
      ['~10 scenarios per level', ' — curated against the rubric'],
      ['Fixed bar, flexible practice', ' — passes across distinct scenarios unlock the level; retries are private'],
      ['NPST-aligned', ' — experts set the standard; the AI cannot invent criteria'],
    ] as [string, string][],
    eviK: 'Evidence-based evaluation', eviH: 'Feedback from your own words',
    eviS: 'A separate scorer grades against an expert-set rubric and must quote the teacher verbatim. A convincing-sounding answer is never mistaken for competence.',
    reportT: '✦ Quest complete · Addition with carrying · L1', reportH: 'Feedback in your own words', reportM: 'Level cleared · rubric npst-fln-core v1.0.0',
    c1: 'Factual accuracy', c2: 'Clarity',
    q1: '"So 47 and 26 = 73." — your words, turn 2', v1: '✓ verified quote · trust 76%',
    q2: '"Let\'s show it with bundles — 4 bundles…" — your words, turn 2', v2: '✓ verified quote · trust 63%',
    vdK: 'FOUR VERDICTS — NEVER A VAGUE SCORE',
    verdicts: [
      ['DEMONSTRATED', 'Quoted, re-verified, correct', 'Every score must cite the teacher’s verbatim words — a second pass re-checks each quote.'],
      ['PARTIAL', 'Right direction, incomplete reasoning', 'Partial understanding is named honestly, never rounded up.'],
      ['INCORRECT', 'A misstatement — cited with evidence', 'Fabricated evidence lowers confidence and forces abstention.'],
      ['INSUFFICIENT → ABSTAIN', 'No score movement, honest reason', 'Thin evidence marks the attempt provisional instead of guessing.'],
    ] as [string, string, string][],
    builtK: 'Proof of build', builtH: 'A working V0 already runs the full loop',
    builtS: 'Not a mockup — a voice-first rehearsal player with evidence-cited feedback, offline support, and a calibration harness that keeps the AI honest against experts.',
    proof: [
      ['72', 'automated tests — engine, evidence, isolation, offline sync'],
      ['MAE 0.066', 'AI-vs-expert calibration error (gate: ≤ 0.25)'],
      ['100%', 'decision agreement with expert labels'],
      ['31', 'authored scenarios — Maths + Hindi, Classes 1–3'],
    ] as [string, string][],
    worksK: 'What works today',
    works: [
      'Voice-first rehearsal — speech-to-text in, text-to-speech out',
      '"Heard me correctly" gate — the teacher reviews the transcript before scoring',
      'Offline queue — attempts sync idempotently when connectivity returns',
      'Deterministic engine — same attempt, same result, online or offline',
    ],
    honestK: 'Honest by design',
    honest: [
      'Runs with no API key — cloud models optional behind one interface',
      'Attempts stay private; only k-anonymised cohort trends (n ≥ 5) are shared',
      '27 themes with day-night environments — the gameverse follows your clock',
      'CI gate blocks regressions unless AI–expert agreement stays inside thresholds',
    ],
    pilotK: 'Pilot and proof plan', pilotH: 'How we will prove it works',
    pilot: [
      ['Validate', 'Practising teachers review every competency, scenario and threshold.'],
      ['Calibrate', 'AI scores expert-labelled attempts — agreement measured, expert-blinded.'],
      ['Pilot', '10–20 teachers across 2–3 government schools.'],
      ['Scale', 'More languages, subjects and grades — offline use.'],
    ] as [string, string][],
    whoB: 'Who benefits', whoF: 'Who can take it forward',
    benefitRows: [
      ['Teachers, Classes 1–3', 'a private place to rehearse — without real children bearing the cost of practice'],
      ['Children', 'teachers who spot misunderstandings and reward reasoning over memorised answers'],
      ['DIETs & SCERTs', 'anonymised trends show which competencies cohorts find hardest'],
    ] as [string, string][],
    forwardRows: [
      ['DIETs & SCERTs', 'teacher access, pedagogical validation, pilot implementation'],
      ['NCERT & state departments', 'curriculum alignment, adoption pathways'],
      ['DIKSHA', 'integration and distribution channel'],
      ['FLN-focused NGOs', 'implementation and outreach'],
    ] as [string, string][],
    ctaH1: 'Pilots don\'t learn to fly from a manual.', ctaH2: 'Every teacher deserves a safe place to practise before they teach.',
    envs: { day: 'Day', dusk: 'Dusk', night: 'Night' },
  },
  hi: {
    tagline: 'पढ़ाने से पहले अभ्यास',
    chip: 'सेवा फ़र्स्ट इनोवेशन चैलेंज · साउथ ज़ोन',
    h1a: 'पढ़ाने से', h1b: 'पहले ', h1em: 'अभ्यास', h1c: '।',
    tag: '— पढ़ाने का फ्लाइट सिम्युलेटर',
    lead: 'एक एआई अभ्यास परत जहाँ सरकारी स्कूलों की शिक्षिकाएँ असली क्लासरूम के पल — आवाज़ से, एक सिम्युलेटेड छात्रा के साथ — दोहराती हैं, सबूत के साथ फ़ीडबैक पाती हैं और दोबारा कोशिश करती हैं। असली बच्चों से मिलने से पहले।',
    b1: 'गणित · कक्षा 1–3', b2: 'आवाज़-प्रथम', b3: 'चालू V0 प्रोटोटाइप',
    start: 'प्रेस स्टार्ट ▶', how: 'यह कैसे काम करता है', built: 'क्या-क्या बना है',
    teamA: 'टीम ', teamB: ' · SEVA31417 · ', teamC: 'सेवा फ़र्स्ट 2026',
    turns: 'बारी', rehearse: '🎙 5 मिनट का अभ्यास शुरू करें →',
    problem: 'समस्या', problemH: 'प्रशिक्षण खत्म। अभ्यास कभी शुरू नहीं होता।',
    problemS: 'भारत शिक्षकों को बड़े पैमाने पर प्रशिक्षित करता है, फिर ठीक वहीं रुक जाता है जहाँ पढ़ाने का कौशल बनता है। पढ़ाना एक परफ़ॉर्मेंस कौशल है — फिर भी यह इकलौता परफ़ॉर्मेंस पेशा है जिसका कोई रिहर्सल नहीं।',
    s1l: 'सरकारी स्कूलों में शिक्षक', s2l: 'उनकी क्लासरूम में बच्चे', s3l: 'सालाना इन-सर्विस प्रशिक्षण — बहुत कम कक्षा-अनुसरण',
    src: 'स्रोत: UDISE+ रिपोर्ट 2024–25, शिक्षा मंत्रालय; IDR (2024)।',
    howK: 'अभ्यास कैसे होता है', howH: 'चार-चरणीय अभ्यास लूप',
    howS: 'सुरक्षित असफलता, लक्षित सुधार — दिखाई गई दक्षता पर आधारित, पूरे किए सेशन पर नहीं।',
    steps: [
      ['अभ्यास', 'शिक्षक की अपनी कक्षा, विषय और भाषा का परिदृश्य — पाठ्यक्रम-सीमित।'],
      ['सिम्युलेट', 'एआई छात्रा जवाब देती है, और टकराती भी — असली ग़लतफ़हमी वाले असली बच्चे जैसी।'],
      ['मूल्यांकन', 'अलग स्कोअर स्थिर रूब्रिक पर अंक देता है — शिक्षक के अपने शब्द उद्धृत करते हुए।'],
      ['दोहराएँ', 'अगला परिदृश्य सबसे कमज़ोर कौशल को लक्षित करता है — जब तक महारत स्तर खोल न दे।'],
    ] as [string, string][],
    loop: 'सिम्युलेट → बातचीत → मूल्यांकन → कमी पहचानें → सुधार → फिर अभ्यास',
    loopS: 'पर्सोना आइसोलेशन: जो छात्रा चुनौती देती है, वही कभी अंक नहीं देती। अलग निर्देश, अलग मॉडल कॉल — टेस्ट से लागू।',
    realmK: 'शिक्षक कैसे आगे बढ़ते हैं', realmH: 'एक समय में एक कौशल — फिर सब एक साथ',
    realms: [
      ['सटीकता', 'तथ्य और पाठ्यक्रम'],
      ['स्पष्टता', 'उस उम्र का बच्चा जिसे आसानी से समझे'],
      ['भ्रांतियाँ', 'सुधार से पहले सोच समझें'],
      ['प्रश्न', 'जिज्ञासा जगाने वाले प्रश्न, अंदाज़ा नहीं'],
      ['समेकित', 'चारों कौशल, पाठ जैसे भारित'],
    ] as [string, string][],
    rnote: [
      ['प्रति स्तर ~10 परिदृश्य', ' — रूब्रिक के अनुसार चुने गए'],
      ['स्थिर बार, लचीला अभ्यास', ' — अलग-अलग पास स्तर खोलते हैं; दोहराएँ निजी'],
      ['एनपीएसटी-संगत', ' — मानक विशेषज्ञ तय करते हैं; एआई शर्तें नहीं बनाता'],
    ] as [string, string][],
    eviK: 'सबूत आधारित मूल्यांकन', eviH: 'फ़ीडबैक — आपके अपने शब्दों में',
    eviS: 'अलग स्कोअर विशेषज्ञ-निर्धारित रूब्रिक पर अंक देता है और शिक्षक के शब्द शब्दशः उद्धृत करना ज़रूरी है। पटु जवाब कभी दक्षता नहीं बन जाता।',
    reportT: '✦ क्वेस्ट पूरा · हासिल के साथ जोड़ · L1', reportH: 'आपके अपने शब्दों से प्रतिक्रिया', reportM: 'स्तर पार हुआ · रूब्रिक npst-fln-core v1.0.0',
    c1: 'तथ्यात्मक सटीकता', c2: 'स्पष्टता',
    q1: '"तो 47 और 26 = 73।" — आपके शब्द, बारी 2', v1: '✓ सत्यापित उद्धरण · भरोसा 76%',
    q2: '"चलो बत्ती से दिखाते हैं — 4 बंडल…" — आपके शब्द, बारी 2', v2: '✓ सत्यापित उद्धरण · भरोसा 63%',
    vdK: 'चार निर्णय — कोई अंधाधुंध अंक नहीं',
    verdicts: [
      ['प्रदर्शित', 'उद्धृत, दोबारा जाँचा, सही', 'हर अंक शिक्षक के शब्दशः उद्धरण से साबित होता है — दूसरा चरण हर उद्धरण फिर जाँचता है।'],
      ['आंशिक', 'सही दिशा, अधूरी सोच', 'आंशिक समझ को ईमानदारी से नाम दिया जाता है, कभी नहीं बढ़ाया।'],
      ['ग़लत', 'ग़लत कथन — सबूत के साथ', 'बनाया सबूत भरोसा गिराता है और परहेज़ पर मजबूर करता है।'],
      ['अपर्याप्त → परहेज़', 'कोई अंक-बदलाव नहीं, ईमानदार कारण', 'पतला सबूत अंदाज़े की बजाय कोशिश को अस्थायी चिह्नित करता है।'],
    ] as [string, string, string][],
    builtK: 'प्रूफ़ ऑफ़ बिल्ड', builtH: 'एक चालू V0 पहले से पूरा लूप चलाता है',
    builtS: 'मॉकअप नहीं — आवाज़-प्रथम रिहर्सल प्लेयर, सबूत-संगत फ़ीडबैक, ऑफ़लाइन सहारा और एआई को ईमानदार रखने वाला कैलिब्रेशन हार्नेस।',
    proof: [
      ['72', 'स्वचालित टेस्ट — इंजन, सबूत, आइसोलेशन, ऑफ़लाइन सिंक'],
      ['MAE 0.066', 'एआई-बनाम-विशेषज्ञ कैलिब्रेशन त्रुटि (सीमा: 0.25)'],
      ['100%', 'विशेषज्ञ निर्णयों से सहमति'],
      ['31', 'लिखित परिदृश्य — गणित + हिंदी, कक्षा 1–3'],
    ] as [string, string][],
    worksK: 'आज जो चलता है',
    works: [
      'आवाज़-प्रथम रिहर्सल — बोलिए, सिस्टम सुनता है',
      '"सही सुना" गेट — अंक से पहले शिक्षक ट्रांसक्रिप्ट जाँचता है',
      'ऑफ़लाइन कतार — कनेक्टिविटी लौटते ही सिंक',
      'निर्धारक इंजन — वही कोशिश, वही नतीजा, ऑनलाइन हो या ऑफ़लाइन',
    ],
    honestK: 'डिज़ाइन से ईमानदार',
    honest: [
      'बिना API की चलता है — क्लाउड मॉडल वैकल्पिक',
      'कोशिशें निजी; केवल k-गुमनाम समूह रुझान (n ≥ 5) साझा',
      '27 थीम, दिन-रात के माहौल — गेमवर्स आपकी घड़ी के साथ बदलता है',
      'CI गेट एआई-विशेषज्ञ सहमति सीमा से बाहर होने पर रोक लगाता है',
    ],
    pilotK: 'पायलट और प्रूफ़ योजना', pilotH: 'हम इसे कैसे साबित करेंगे',
    pilot: [
      ['जाँच', 'प्रत्येक कौशल, परिदृश्य और सीमा शिक्षक खुद जाँचते हैं।'],
      ['कैलिब्रेट', 'एआई विशेषज्ञ-चिह्नित कोशिशों पर अंक देता है — सहमति मापी जाती है।'],
      ['पायलट', '2–3 सरकारी स्कूलों में 10–20 शिक्षक।'],
      ['विस्तार', 'और भाषाएँ, विषय, कक्षाएँ — ऑफ़लाइन उपयोग।'],
    ] as [string, string][],
    whoB: 'किसे फ़ायदा', whoF: 'कौन आगे ले जाएँ',
    benefitRows: [
      ['शिक्षक, कक्षा 1–3', 'निजी अभ्यास की जगह — असली बच्चों पर अभ्यास का खर्च नहीं'],
      ['बच्चे', 'शिक्षक जो ग़लतफ़हमी पकड़ते हैं और रटने से बेहतर समझ को सराहते हैं'],
      ['डाइट और एससीईआरटी', 'गुमनाम रुझान बताते हैं कौन-से कौशल कठिन लगते हैं'],
    ] as [string, string][],
    forwardRows: [
      ['डाइट और एससीईआरटी', 'शिक्षक तक पहुँच, पैडागॉजिकल सत्यापन, पायलट'],
      ['एनसीईआरटी और राज्य विभाग', 'पाठ्यक्रम संगति, अपनाने के रास्ते'],
      ['डिक्शा', 'एकीकरण और वितरण माध्यम'],
      ['एफ़एलएन एनजीओ', 'क्रियान्वयन और पहुँच'],
    ] as [string, string][],
    ctaH1: 'पायलट मैनुअल पढ़कर उड़ान नहीं भरते।', ctaH2: 'हर शिक्षक पढ़ाने से पहले अभ्यास की सुरक्षित जगह हक़दार है।',
    envs: { day: 'दिन', dusk: 'गोधूलि', night: 'रात' },
  },
} as const;

export function Landing() {
  const { uiLang, setUiLang, profile, navigate } = useApp();
  const C = T[uiLang === 'hi' ? 'hi' : 'en'];
  const [env, setEnv] = useState<Env>('day');
  const rootRef = useRef<HTMLDivElement>(null);
  const tilt = tiltHandlers(5);

  // scroll reveals + realm bars + count-ups
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('in');
        if (el.classList.contains('realm')) {
          const bar = el.querySelector<HTMLSpanElement>('.bar i');
          if (bar) bar.style.width = `${bar.dataset.w}%`;
        }
        if (el.classList.contains('stat')) {
          const n = el.querySelector<HTMLElement>('.n');
          if (n && !n.dataset.done) {
            n.dataset.done = '1';
            const end = parseFloat(n.dataset.count ?? '0');
            const dec = (n.dataset.count ?? '').includes('.') ? 1 : 0;
            const t0 = performance.now();
            const step = (ts: number) => {
              const p = Math.min((ts - t0) / 1300, 1);
              n.textContent = (end * p).toFixed(dec);
              if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        }
        io.unobserve(el);
      }
    }, { threshold: 0.18 });
    root.querySelectorAll('.reveal,.stat,.realm').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [uiLang]);

  const enter = () => navigate(profile ? '/home' : '/onboarding');
  const bars = [88, 72, 54, 38, 20];

  return (
    <div id="abhyas-landing" ref={rootRef} data-env={env}>
      <nav className="lp-nav">
        <div className="wrap">
          <a
            className="brand"
            href="#/landing"
            onClick={(e) => { e.preventDefault(); navigate('/landing'); }}
          >
            <span className="mark">अ</span>
            <span><b>Abhyas</b><small>{C.tagline}</small></span>
          </a>
          <div className="lp-links">
            <div className="env" role="group" aria-label="environment preview">
              {(['day', 'dusk', 'night'] as Env[]).map((e) => (
                <button key={e} type="button" className={env === e ? 'on' : ''} onClick={() => setEnv(e)}>
                  {C.envs[e]}
                </button>
              ))}
            </div>
            <button type="button" className="lang-btn" onClick={() => setUiLang(uiLang === 'en' ? 'hi' : 'en')}>
              {uiLang === 'en' ? 'हिंदी' : 'EN'}
            </button>
            <button type="button" className="btn primary px" onClick={enter}>Press Start ▶</button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <span className="sun" aria-hidden="true" />
        <div className="wrap">
          <div>
            <span className="badge">{C.chip}</span>
            <h1>{C.h1a}<br />{C.h1b}<em>{C.h1em}</em>{C.h1c}</h1>
            <div className="tag">{C.tag}</div>
            <p className="lead">{C.lead}</p>
            <div className="badges">
              <span className="badge">{C.b1}</span>
              <span className="badge">{C.b2}</span>
              <span className="badge gold">{C.b3}</span>
            </div>
            <div className="cta">
              <button type="button" className="btn primary" onClick={enter}>{C.start}</button>
              <button type="button" className="btn ghost" onClick={() => rootRef.current?.querySelector('#lp-built')?.scrollIntoView({ behavior: 'smooth' })}>{C.built}</button>
            </div>
            <div className="team">{C.teamA}<b>CogniX</b>{C.teamB}<span className="px">{C.teamC}</span></div>
          </div>
          <div>
            <article className="ticket" {...tilt}>
              <div className="body">
                <div className="top">
                  <span className="quest">QUEST 103</span>
                  <span className="topic">हासिल के साथ जोड़</span>
                  <span className="turns">⏱ 3 {C.turns}</span>
                </div>
                <div className="student">
                  <span className="av">A</span>
                  <div>
                    <span>ANU · AGE 8</span>
                    <p>"मैडम, 47 और 26 जोड़ो... मुझे 613 आया! देखिए — 4+2 है 6, और 7+6 है 13। तो 613!"</p>
                  </div>
                </div>
                <div className="meta">
                  <span className="lvl">L1</span>
                  <span className="tagz"><i>{C.steps[0]![0]}</i><i>{C.steps[1]![0]}</i></span>
                </div>
                <button type="button" className="cta2" onClick={enter}>{C.rehearse}</button>
              </div>
              <div className="stub"><span className="admit">ADMIT ONE</span><span className="barcode" /></div>
            </article>
          </div>
        </div>
      </header>

      <section className="band">
        <div className="wrap">
          <div className="kicker reveal">{C.problem}</div>
          <h2 className="reveal">{C.problemH}</h2>
          <p className="sub reveal">{C.problemS}</p>
          <div className="cols" style={{ marginTop: 42 }}>
            <div className="stat reveal" data-count="5.15"><div className="n">0</div><div className="l">{C.s1l}</div></div>
            <div className="stat reveal" data-count="121.6"><div className="n">0</div><div className="l">{C.s2l}</div></div>
            <div className="stat reveal" data-count="10"><div className="n">0</div><div className="l">{C.s3l}</div></div>
          </div>
          <p className="srcnote reveal">{C.src}</p>
        </div>
      </section>

      <section id="lp-how">
        <div className="wrap">
          <div className="kicker reveal">{C.howK}</div>
          <h2 className="reveal">{C.howH}</h2>
          <p className="sub reveal">{C.howS}</p>
          <div className="path">
            {C.steps.map(([h, d], i) => (
              <div className="step reveal" key={h}>
                <div className="num">{i + 1}</div>
                <h3>{h}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="loopline reveal">{C.loop}<small>{C.loopS}</small></div>
        </div>
      </section>

      <section id="lp-realms" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker reveal">{C.realmK}</div>
          <h2 className="reveal">{C.realmH}</h2>
          <div className="realms">
            {C.realms.map(([h, d], i) => (
              <div className={`realm reveal ${i === 4 ? 'future' : ''}`} key={h}>
                <div className="ln">L{i + 1}{i === 4 ? '+' : ''}</div>
                <h3>{h}</h3>
                <p>{d}</p>
                <div className="bar"><i data-w={bars[i]} /></div>
              </div>
            ))}
          </div>
          <div className="rnote reveal">
            {C.rnote.map(([b, d]) => (<span key={b}><b>{b}</b>{d}</span>))}
          </div>
        </div>
      </section>

      <section id="lp-evidence" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker reveal">{C.eviK}</div>
          <h2 className="reveal">{C.eviH}</h2>
          <p className="sub reveal">{C.eviS}</p>
          <div className="evi">
            <div className="report reveal" {...tilt}>
              <div className="rh">
                <div><span className="t">{C.reportT}</span><h3>{C.reportH}</h3><span className="t">{C.reportM}</span></div>
                <div className="ring"><b>75</b></div>
              </div>
              <div className="comp">
                <div className="ch"><b>{C.c1}</b><span className="sc">88</span></div>
                <div className="bar"><i /></div>
                <div className="q">{C.q1}</div>
                <div className="v">{C.v1}</div>
              </div>
              <div className="comp">
                <div className="ch"><b>{C.c2}</b><span className="sc" style={{ color: 'var(--acc)' }}>85</span></div>
                <div className="bar"><i style={{ width: '85%', background: 'linear-gradient(90deg,var(--acc),var(--acc2))' }} /></div>
                <div className="q">{C.q2}</div>
                <div className="v" style={{ color: 'var(--acc)' }}>{C.v2}</div>
              </div>
            </div>
            <div className="verdicts">
              <div className="kicker reveal" style={{ marginBottom: 2 }}>{C.vdK}</div>
              {C.verdicts.map(([pill, b, p], i) => (
                <div className="v-row reveal" key={pill}>
                  <span className={`pill ${['ok', 'part', 'no', 'abs'][i]}`}>{pill}</span>
                  <div><b>{b}</b><p>{p}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="night" id="lp-built">
        <div className="wrap">
          <div className="kicker reveal">{C.builtK}</div>
          <h2 className="reveal">{C.builtH}</h2>
          <p className="sub reveal">{C.builtS}</p>
          <div className="proof">
            {C.proof.map(([n, l]) => (
              <div className="b reveal" key={n}><div className="n">{n}</div><div className="l">{l}</div></div>
            ))}
          </div>
          <div className="ncols">
            <div>
              <div className="kicker reveal" style={{ color: '#6fe5a8' }}>{C.worksK}</div>
              <ul>{C.works.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
            <div>
              <div className="kicker reveal" style={{ color: '#6fe5a8' }}>{C.honestK}</div>
              <ul>{C.honest.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section id="lp-pilot">
        <div className="wrap">
          <div className="kicker reveal">{C.pilotK}</div>
          <h2 className="reveal">{C.pilotH}</h2>
          <div className="path" style={{ marginTop: 42 }}>
            {C.pilot.map(([h, d], i) => (
              <div className="step reveal" key={h}>
                <div className="num">{i + 1}</div>
                <h3>{h}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="two" style={{ marginTop: 36 }}>
            <div>
              <h3 style={{ marginBottom: 10, fontSize: 17 }}>{C.whoB}</h3>
              {C.benefitRows.map(([b, d]) => (<div className="row" key={b}><b>{b}</b><span>{d}</span></div>))}
            </div>
            <div>
              <h3 style={{ marginBottom: 10, fontSize: 17 }}>{C.whoF}</h3>
              {C.forwardRows.map(([b, d]) => (<div className="row" key={b}><b>{b}</b><span>{d}</span></div>))}
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wm">अभ्यास</div>
        <div className="wrap">
          <div className="cta-band">
            <h3>{C.ctaH1}<br /><em>{C.ctaH2}</em></h3>
            <button type="button" className="btn primary" onClick={enter}>{C.start}</button>
          </div>
          <div className="cols">
            <div><b>Team CogniX · SEVA31417</b><br />{C.chip}</div>
            <div>अभ्यास — {C.tagline}</div>
            <div>{C.b1}</div>
          </div>
        </div>
      </footer>

      <button type="button" className="back-float" onClick={enter}>{C.start}</button>
    </div>
  );
}
