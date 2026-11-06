import { useState } from 'react';
import type { Turn } from '../../core/types.js';
import { roleplayText, scoreSession } from '../api.js';
import { ApiError } from '../api.js';
import { Icon } from '../components/Icons.js';
import { speakSequence, speechSynthesisSupported } from '../speech.js';
import { buildAttempt, scoreLocally } from '../offline.js';
import { useApp } from '../store.js';

export function Review() {
  const {
    t,
    draft,
    teacherId,
    content,
    practiceLang,
    teacherState,
    setResult,
    setDraft,
    navigate,
    startPractice,
    refreshPending,
    refreshState,
    toast,
  } = useApp();

  const [turns, setTurns] = useState<Turn[]>(draft?.turns ?? []);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!draft) {
    return (
      <div className="review-shell">
        <div className="empty-panel">
          <p>{t('review.nothing')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/home')}>
            {t('feedback.home')}
          </button>
        </div>
      </div>
    );
  }

  const teacherTurns = turns.filter((x) => x.role === 'teacher');
  const scenario = draft.scenario;

  const updateTurn = (index: number, text: string) => {
    setTurns((list) => list.map((turn, i) => (i === index ? { ...turn, text } : turn)));
  };

  const score = async () => {
    if (!confirmed || busy || !teacherState) return;
    setBusy(true);
    try {
      const body = {
        heardCorrectly: true,
        turns: turns.map((x) => ({ ...x, text: x.text.trim() })),
      };
      if (draft.mode === 'online' && draft.session) {
        try {
          const response = await scoreSession(teacherId, draft.session.id, body);
          setResult(response);
          setDraft(null);
          void refreshState();
          navigate('/feedback');
          return;
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 0) {
            throw err;
          }
          toast(t('practice.connectionLost'), 'info');
        }
      }

      const attempt = buildAttempt({
        teacherId,
        scenario,
        rubricId: content.rubric.id,
        rubricVersion: content.rubric.version,
        turns,
        mode: 'offline',
      });
      const local = await scoreLocally({
        attempt,
        scenario,
        rubric: content.rubric,
        scenarios: content.scenarios,
        state: teacherState,
      });
      setResult(local.response);
      setDraft(null);
      refreshPending();
      navigate('/feedback');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('error.generic');
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const replay = () => {
    speakSequence(
      teacherTurns.map((x) => x.text),
      practiceLang,
    );
  };

  const rerecord = () => {
    startPractice(scenario);
  };

  return (
    <div className="review-shell">
      <header className="review-top">
        <button type="button" className="icon-btn" onClick={() => navigate('/home')} aria-label={t('common.back')}>
          <Icon name="arrow" size={19} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div>
          <p className="eyebrow">{scenario.title ? roleplayText(scenario.title, practiceLang) : ''}</p>
          <h1>{t('review.title')}</h1>
        </div>
        <span className="level-badge">L{scenario.level}</span>
      </header>

      <main className="review-main">
        <p className="lede">{t('review.subtitle')}</p>

        <div className="review-toolbar">
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={replay}
            disabled={!speechSynthesisSupported() || teacherTurns.length === 0}
          >
            <Icon name="volume" size={16} />
            {t('review.play')}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={rerecord}>
            <Icon name="rotate" size={16} />
            {t('review.audioUnclear')}
          </button>
        </div>

        <div className="review-list">
          {turns.map((turn, index) =>
            turn.role === 'teacher' ? (
              <div className="review-turn teacher" key={`${turn.ts}-${index}`}>
                <div className="review-turn-head">
                  <span className="avatar tiny">{t('common.you').slice(0, 1)}</span>
                  <span>
                    {t('common.you')} · {turn.transport === 'voice' ? t('practice.voice') : t('practice.typing')}
                  </span>
                  <span className="edit-hint">
                    <Icon name="edit" size={13} /> {t('review.edit')}
                  </span>
                </div>
                <textarea
                  value={turn.text}
                  onChange={(e) => updateTurn(index, e.target.value)}
                  rows={Math.min(5, Math.max(2, Math.ceil(turn.text.length / 70)))}
                  aria-label={`${t('common.you')} turn ${index + 1}`}
                />
              </div>
            ) : (
              <div className="review-turn student" key={`${turn.ts}-${index}`}>
                <div className="review-turn-head">
                  <span className="avatar tiny">{scenario.studentPersona.name.slice(0, 1)}</span>
                  <span>
                    {scenario.studentPersona.name} · {t('review.studentTurn')}
                  </span>
                </div>
                <p>{turn.text}</p>
              </div>
            ),
          )}
        </div>

        <div className="confirm-card">
          <label className={`consent ${confirmed ? 'on' : ''}`}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span className="consent-box">{confirmed && <Icon name="check" size={14} />}</span>
            <span>{t('review.heard')}</span>
          </label>
          <div className="privacy-strip compact">
            <Icon name="shield" size={15} />
            <span>{t('review.privacy')}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary full"
            disabled={!confirmed || busy || teacherTurns.length === 0}
            onClick={() => void score()}
          >
            {busy ? (
              <>
                <span className="spinner small" /> {t('review.scoring')}
              </>
            ) : (
              <>
                <Icon name="sparkle" size={18} />
                {t('review.score')}
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
