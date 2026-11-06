import { useState } from 'react';
import type { Scenario } from '../../core/types.js';
import { selectRetryScenario } from '../../core/selection.js';
import { roleplayText } from '../api.js';
import { CompetencyCard } from '../components/CompetencyCard.js';
import { Confetti, LevelUpOverlay } from '../components/Gameverse.js';
import { Icon } from '../components/Icons.js';
import { ScoreRing } from '../components/ScoreRing.js';
import { decisionKey, decisionSubKey } from '../i18n.js';
import { useApp } from '../store.js';

export function Feedback() {
  const { t, result, content, practiceLang, teacherState, setResult, startPractice, navigate } = useApp();
  const [overlay, setOverlay] = useState(() => Boolean(result?.levelUp.leveledUp));

  if (!result) {
    return (
      <div className="empty-panel card">
        <h1>{t('feedback.title')}</h1>
        <p className="muted">{t('mastery.empty')}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/home')}>
          {t('feedback.home')}
        </button>
      </div>
    );
  }

  const { record, decision, engine, verified } = result;
  const scenario = content.scenarios.find((s) => s.id === record.attempt.scenarioId);
  const summary = practiceLang === 'hi' ? record.score.summary.hi : record.score.summary.en;
  const suggestion = practiceLang === 'hi' ? record.score.suggestion.hi : record.score.suggestion.en;
  const retry = scenario
    ? selectRetryScenario(content.scenarios, scenario.id, scenario.level, teacherState ?? undefined)
    : null;
  const next = result.nextScenario ?? retry;
  const status = decision.status;
  const statusClass = status === 'pass' ? 'pass' : status === 'retry' ? 'retry' : status === 'redo' ? 'redo' : 'provisional';

  const goNext = (target: Scenario | null) => {
    if (!target) return;
    setOverlay(false);
    setResult(null);
    startPractice(target);
  };

  const continueToNext = () => {
    if (next) {
      goNext(next);
    } else {
      setOverlay(false);
      navigate('/home');
    }
  };

  return (
    <div className="feedback">
      {status === 'pass' && <Confetti active />}

      {overlay && result.levelUp.leveledUp && (
        <LevelUpOverlay
          from={result.levelUp.from}
          to={result.levelUp.to}
          heading={t('game.congratsPlayer')}
          body={t('game.realmUnlocked')}
          continueLabel={t('game.nextQuest')}
          detailsLabel={t('game.later')}
          onContinue={continueToNext}
          onDetails={() => setOverlay(false)}
        />
      )}

      <div className="feedback-top">
        <button type="button" className="link" onClick={() => navigate('/home')}>
          <Icon name="arrow" size={16} style={{ transform: 'rotate(180deg)' }} />
          {t('feedback.home')}
        </button>
        <span className={`decision-badge ${statusClass}`}>
          {t(decisionKey(status))}
        </span>
      </div>

      {result.levelUp.leveledUp && (
        <div className="levelup-banner">
          <Icon name="star" size={20} />
          <span>
            {t('game.levelCleared', { from: result.levelUp.from, to: result.levelUp.to })}
          </span>
        </div>
      )}

      {!verified && (
        <div className="notice">
          <Icon name="wifiOff" size={17} />
          <span>{t('feedback.offline')}</span>
        </div>
      )}

      <section className={`feedback-hero ${statusClass}`}>
        <div className="feedback-hero-copy">
          <p className="eyebrow">★ {t('game.questComplete')} · {scenario ? roleplayText(scenario.title, practiceLang) : t('feedback.title')} · L{decision.level}</p>
          <h1>{t('feedback.title')}</h1>
          <p className="feedback-summary">{summary}</p>
          <div className="feedback-meta">
            <span>{t(decisionSubKey(status))}</span>
            <span className="dot-sep" />
            <span>{t('feedback.engine', { engine })}</span>
            <span className="dot-sep" />
            <span>{t('feedback.rubric', { id: content.rubric.id, version: decision.rubricVersion })}</span>
          </div>
        </div>
        <ScoreRing value={decision.weighted} status={status} label={t('feedback.weighted')} />
      </section>

      <div className="feedback-grid">
        <section className="card feedback-skills">
          <div className="card-head">
            <h2>{t('mastery.competencies')}</h2>
          </div>
          <div className="comp-grid">
            {record.score.competencyScores.map((cs) => (
              <CompetencyCard
                key={cs.competency}
                score={cs}
                competency={content.rubric.competencies.find((c) => c.id === cs.competency)}
                lang={practiceLang}
              />
            ))}
          </div>
        </section>

        <aside className="feedback-side">
          <section className="card suggestion-card">
            <span className="card-kicker">
              <Icon name="target" size={16} /> {t('feedback.suggestion')}
            </span>
            <p>{suggestion}</p>
          </section>

          <section className="card next-card">
            <span className="card-kicker">{t('game.chooseQuest')}</span>
            {next ? (
              <>
                <h3>{roleplayText(next.title, practiceLang)}</h3>
                <p>
                  L{next.level} · {next.studentPersona.name} ·{' '}
                  {next.competencies
                    .map((id) => {
                      const c = content.rubric.competencies.find((x) => x.id === id);
                      return c ? (practiceLang === 'hi' ? c.name.hi : c.name.en) : id;
                    })
                    .join(' · ')}
                </p>
                <button type="button" className="btn btn-primary full" onClick={() => goNext(next)}>
                  <Icon name="mic" size={17} />
                  {t('home.start')}
                </button>
              </>
            ) : (
              <p className="muted">{t('home.noScenarios')}</p>
            )}
            {retry && retry.id !== next?.id && (
              <button type="button" className="btn btn-ghost full" onClick={() => goNext(retry)}>
                <Icon name="rotate" size={16} />
                {t('feedback.retry')}
              </button>
            )}
          </section>

          <section className="privacy-card small">
            <Icon name="shield" size={20} />
            <div>
              <strong>{t('home.privacyTitle')}</strong>
              <p>{t('home.privacyBody')}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
