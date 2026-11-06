import { useEffect, useRef, useState } from 'react';
import type { PracticeMode, Scenario, Session, Turn } from '../../core/types.js';
import { mockStudentTurn } from '../../llm/mock/student.js';
import { roleplayText, sendTurn, startSession } from '../api.js';
import { QuestBadge } from '../components/Gameverse.js';
import { Icon } from '../components/Icons.js';
import { Waveform } from '../components/Waveform.js';
import { startDictation, speechRecognitionSupported, speak, stopSpeaking, type Dictation } from '../speech.js';
import { useApp } from '../store.js';

export function Practice() {
  const {
    t,
    teacherId,
    content,
    practiceLang,
    voiceEnabled,
    online,
    toast,
    navigate,
    startScenario,
    nextScenario,
    consumeStartScenario,
    setDraft,
    teacherState,
  } = useApp();

  const initial = useRef<Scenario | null>(startScenario ?? nextScenario);
  const [scenario] = useState<Scenario | null>(initial.current);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<PracticeMode>(navigator.onLine ? 'online' : 'offline');
  const [booting, setBooting] = useState(true);
  const [done, setDone] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [transport, setTransport] = useState<'voice' | 'text'>(
    speechRecognitionSupported() ? 'voice' : 'text',
  );
  const [micError, setMicError] = useState<string | null>(null);
  const [startedAt] = useState(() => new Date().toISOString());
  const recognition = useRef<Dictation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    consumeStartScenario();

    if (!initial.current) {
      navigate('/home');
      return;
    }
    const sc = initial.current;
    const opening: Turn = {
      role: 'student',
      text: roleplayText(sc.studentPersona.opening, practiceLang),
      ts: Date.now(),
    };

    (async () => {
      if (navigator.onLine) {
        try {
          const response = await startSession(teacherId, { scenarioId: sc.id, mode: 'online' });
          setSession(response.session);
          setTurns(response.session.turns);
          setDone(response.session.done);
          setMode('online');
          setBooting(false);
          return;
        } catch {
          toast(t('practice.connectionLost'), 'info');
        }
      }
      setMode('offline');
      setTurns([opening]);
      setBooting(false);
    })();
  }, [consumeStartScenario, navigate, practiceLang, t, teacherId, toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending]);

  useEffect(
    () => () => {
      recognition.current?.abort();
      stopSpeaking();
    },
    [],
  );

  if (!scenario) return null;

  const studentTurns = turns.filter((x) => x.role === 'student').length;
  const maxTurns = scenario.studentPersona.bounds.maxStudentTurns;
  const hasTeacherTurn = turns.some((x) => x.role === 'teacher');
  const latestStudent = [...turns].reverse().find((x) => x.role === 'student');

  const toggleMic = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    setMicError(null);
    setInterim('');
    const dictation = startDictation(practiceLang, {
      onInterim: setInterim,
      onFinal: (text) => {
        setListening(false);
        recognition.current = null;
        setInterim('');
        if (text.trim()) {
          setDraftText((prev) => `${prev} ${text}`.replace(/\s+/g, ' ').trim());
        } else {
          toast(t('practice.quiet'), 'info');
        }
      },
      onError: (code) => {
        setListening(false);
        recognition.current = null;
        setMicError(code);
        if (code === 'aborted') return; // manual stop, not a failure
        setTransport('text');
        const key =
          code === 'not-allowed' || code === 'service-not-allowed'
            ? 'practice.micBlocked'
            : code === 'audio-capture'
              ? 'practice.micMissing'
              : code === 'network'
                ? 'practice.micNet'
                : 'practice.micFail';
        toast(t(key), 'error');
      },
    });
    if (!dictation) {
      setMicError('unsupported');
      setTransport('text');
      return;
    }
    recognition.current = dictation;
    setListening(true);
  };

  const appendStudent = async (list: Turn[], text: string, isDone: boolean) => {
    const reply: Turn = { role: 'student', text, ts: Date.now() };
    const next = [...list, reply];
    setTurns(next);
    setDone(isDone || next.filter((x) => x.role === 'student').length >= maxTurns);
    if (voiceEnabled) speak(text, practiceLang);
  };

  const send = async () => {
    const text = `${draftText} ${interim}`.replace(/\s+/g, ' ').trim();
    if (!text || sending) return;
    if (listening) {
      recognition.current?.stop();
      setListening(false);
    }
    stopSpeaking();
    setSending(true);
    setInterim('');
    setDraftText('');
    const withTeacher: Turn[] = [...turns, { role: 'teacher', text, ts: Date.now(), transport }];
    setTurns(withTeacher);

    try {
      if (mode === 'online' && session) {
        try {
          const response = await sendTurn(teacherId, session.id, text, transport);
          setSession(response.session);
          setTurns(response.session.turns);
          setDone(response.done);
          const reply = response.studentTurn?.text;
          if (reply && voiceEnabled) speak(reply, practiceLang);
        } catch {
          setMode('offline');
          setSession(null);
          toast(t('practice.connectionLost'), 'info');
          const plan = mockStudentTurn(scenario, withTeacher, practiceLang === 'hi' ? 'hi' : 'en');
          await appendStudent(withTeacher, plan.text, plan.done);
        }
      } else {
        const plan = mockStudentTurn(scenario, withTeacher, practiceLang === 'hi' ? 'hi' : 'en');
        await appendStudent(withTeacher, plan.text, plan.done);
      }
    } finally {
      setSending(false);
    }
  };

  const endRehearsal = () => {
    if (!hasTeacherTurn) {
      toast(t('review.nothing'), 'error');
      return;
    }
    recognition.current?.abort();
    stopSpeaking();
    setDraft({ scenario, mode, session, turns, done, startedAt });
    navigate('/review');
  };

  const replay = () => {
    if (!latestStudent) return;
    speak(latestStudent.text, practiceLang);
  };

  if (booting) {
    return (
      <div className="practice-shell">
        <div className="practice-loading">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-shell">
      <header className="practice-top">
        <button type="button" className="icon-btn" onClick={endRehearsal} aria-label={t('practice.endEarly')}>
          <Icon name="arrow" size={19} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="practice-meta">
          <QuestBadge n={content.scenarios.findIndex((s) => s.id === scenario.id) + 1} level={scenario.level} tone="cyan" />
          <div>
            <strong>{roleplayText(scenario.title, practiceLang)}</strong>
            <small>
              Class {scenario.curriculum.class} · {scenario.curriculum.subject === 'maths' ? t('onboarding.maths') : t('onboarding.hindi')} ·{' '}
              {mode === 'online' ? t('common.online') : t('common.offline')}
            </small>
          </div>
        </div>
        <div className="practice-actions">
          <span className="turn-count">{t('practice.turn', { n: Math.min(studentTurns, maxTurns), max: maxTurns })}</span>
          <button type="button" className="btn btn-mini" onClick={endRehearsal}>
            {t('practice.endEarly')}
          </button>
        </div>
      </header>

      <main className="practice-stage" ref={scrollRef}>
        <div className="student-stage">
          <div className="avatar">{scenario.studentPersona.name.slice(0, 1)}</div>
          <div className="student-stage-copy">
            <span className="student-name">
              {scenario.studentPersona.name} · {scenario.studentPersona.age}
            </span>
            <strong>{roleplayText(scenario.title, practiceLang)}</strong>
            <p>{scenario.studentPersona.traits.join(' · ')}</p>
          </div>
          <Waveform active={sending || listening} />
        </div>

        <div className="transcript" role="log" aria-live="polite">
          {turns.map((turn, index) =>
            turn.role === 'student' ? (
              <div className="bubble-row student" key={`${turn.ts}-${index}`}>
                <div className="bubble-avatar">{scenario.studentPersona.name.slice(0, 1)}</div>
                <div className="bubble">
                  <p>{turn.text}</p>
                  {voiceEnabled && index === turns.length - 1 && (
                    <button type="button" className="bubble-action" onClick={() => speak(turn.text, practiceLang)}>
                      <Icon name="volume" size={14} /> {t('practice.replay')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bubble-row teacher" key={`${turn.ts}-${index}`}>
                <div className="bubble">
                  <span className="bubble-label">{t('common.you')}</span>
                  <p>{turn.text}</p>
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="bubble-row student">
              <div className="bubble-avatar">{scenario.studentPersona.name.slice(0, 1)}</div>
              <div className="bubble thinking">
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <small>{t('practice.studentThinking', { name: scenario.studentPersona.name })}</small>
              </div>
            </div>
          )}

          {done && !sending && (
            <div className="done-banner">
              <Icon name="check" size={18} />
              <span>{t('practice.done', { name: scenario.studentPersona.name })}</span>
              <button type="button" className="btn btn-primary btn-mini" onClick={endRehearsal}>
                {t('practice.reviewCta')}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="composer">
        <div className="composer-top">
          <div className="mode-switch" role="tablist" aria-label={t('practice.yourWords')}>
            <button
              type="button"
              className={transport === 'voice' ? 'on' : ''}
              onClick={() => setTransport('voice')}
              disabled={!speechRecognitionSupported()}
            >
              <Icon name="mic" size={15} />
              {t('practice.voice')}
            </button>
            <button type="button" className={transport === 'text' ? 'on' : ''} onClick={() => setTransport('text')}>
              <Icon name="edit" size={15} />
              {t('practice.typing')}
            </button>
          </div>
          <span className="hint">{t('practice.hint')}</span>
        </div>

        <div className={`composer-box ${listening ? 'listening' : ''}`}>
          {transport === 'voice' ? (
            <div className="voice-row">
              <button
                type="button"
                className={`mic-btn ${listening ? 'live' : ''}`}
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? t('practice.stop') : t('practice.tapToSpeak')}
              >
                <Icon name={listening ? 'stop' : 'mic'} size={24} />
              </button>
              <div className="voice-copy">
                <strong>{listening ? t('practice.listening') : t('practice.tapToSpeak')}</strong>
                <p>
                  {interim ||
                    (micError === 'not-allowed'
                      ? t('practice.noMic')
                      : draftText || t('practice.placeholder'))}
                </p>
              </div>
              {draftText && (
                <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={sending}>
                  {t('practice.send')}
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="type-row">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={t('practice.placeholder')}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={sending || !draftText.trim()}>
                {t('practice.send')}
                <Icon name="arrow" size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="composer-foot">
          {!speechRecognitionSupported() && <span>{t('practice.voiceUnsupported')}</span>}
          <span>{t('review.privacy')}</span>
          <button type="button" className="link" onClick={endRehearsal}>
            {t('practice.end')}
          </button>
        </div>
      </footer>
    </div>
  );
}
