import { useMemo } from 'react';
import { weakestCompetency } from '../../core/progression.js';
import { levelCatalog } from '../../core/selection.js';
import { fetchAttempt, roleplayText } from '../api.js';
import { Icon } from '../components/Icons.js';
import { LevelLadder } from '../components/LevelLadder.js';
import { decisionKey } from '../i18n.js';
import { useApp } from '../store.js';

const statusClass: Record<string, string> = {
  pass: 'pass',
  retry: 'retry',
  redo: 'redo',
  provisional: 'provisional',
};

export function Mastery() {
  const {
    t,
    teacherState,
    content,
    attempts,
    practiceLang,
    nextScenario,
    startPractice,
    setResult,
    navigate,
    teacherId,
    toast,
  } = useApp();

  const catalog = useMemo(
    () => (teacherState ? levelCatalog(content.scenarios, teacherState) : []),
    [content.scenarios, teacherState],
  );

  if (!teacherState) return null;

  const weakest = weakestCompetency(teacherState);
  const strongest = [...content.rubric.competencies]
    .map((c) => ({ c, h: teacherState.competencyHealth[c.id] }))
    .sort((a, b) => (b.h?.ema ?? 0) - (a.h?.ema ?? 0))[0];
  const totalScored = Object.values(teacherState.progress).reduce((a, p) => a + p.attempts, 0);
  const passes = attempts.filter((a) => a.status === 'pass').length;

  const openAttempt = async (id: string) => {
    try {
      const record = await fetchAttempt(teacherId, id);
      const scenario = content.scenarios.find((s) => s.id === record.attempt.scenarioId);
      setResult({
        record,
        decision: record.decision,
        state: teacherState,
        levelUp: {
          leveledUp: false,
          from: teacherState.profile.currentLevel,
          to: teacherState.profile.currentLevel,
          passes: 0,
          distinct: 0,
        },
        nextScenario: scenario ?? nextScenario,
        verified: record.verified,
        engine: record.score.engine,
      });
      navigate('/feedback');
    } catch {
      toast(t('error.generic'), 'error');
    }
  };

  return (
    <div className="mastery">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('nav.mastery')}</p>
          <h1>{t('mastery.title')}</h1>
          <p className="lede">{t('mastery.subtitle')}</p>
        </div>
        {nextScenario && (
          <button type="button" className="btn btn-primary" onClick={() => startPractice(nextScenario)}>
            <Icon name="mic" size={17} />
            {t('home.start')}
          </button>
        )}
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <span>{t('home.currentLevel')}</span>
          <strong>L{teacherState.profile.currentLevel}</strong>
          <small>{t('mastery.level', { n: teacherState.profile.currentLevel })}</small>
        </div>
        <div className="stat-card">
          <span>{t('home.sessions')}</span>
          <strong>{totalScored}</strong>
          <small>{t('common.today')}</small>
        </div>
        <div className="stat-card">
          <span>{t('home.streak')}</span>
          <strong>{passes}</strong>
          <small>{t('home.passRate')}</small>
        </div>
        <div className="stat-card">
          <span>{t('home.weakest')}</span>
          <strong className="stat-word">
            {(() => {
              const c = content.rubric.competencies.find((x) => x.id === weakest);
              return c ? (practiceLang === 'hi' ? c.name.hi : c.name.en) : weakest;
            })()}
          </strong>
          <small>{strongest ? `Strongest: ${practiceLang === 'hi' ? strongest.c.name.hi : strongest.c.name.en}` : ''}</small>
        </div>
      </div>

      <div className="mastery-grid">
        <section className="card ladder-card">
          <div className="card-head">
            <h2>{t('mastery.ladder')}</h2>
          </div>
          <LevelLadder state={teacherState} policy={content.rubric.decision} lang={practiceLang} catalog={catalog} />
        </section>

        <section className="card health-card">
          <div className="card-head">
            <h2>{t('mastery.competencies')}</h2>
          </div>
          {Object.values(teacherState.competencyHealth).every((h) => h.n === 0) ? (
            <p className="muted">{t('mastery.noData')}</p>
          ) : (
            <div className="health-list">
              {content.rubric.competencies.map((c) => {
                const h = teacherState.competencyHealth[c.id];
                const value = h?.n ? h.ema : 0.5;
                const has = Boolean(h?.n);
                return (
                  <div key={c.id} className="health-item">
                    <div className="health-head">
                      <div>
                        <strong>{practiceLang === 'hi' ? c.name.hi : c.name.en}</strong>
                        <small>{has ? t('mastery.n', { n: h.n }) : t('mastery.locked')}</small>
                      </div>
                      <span>{Math.round(value * 100)}</span>
                    </div>
                    <div className={`health-track ${has ? '' : 'empty'}`}>
                      <span style={{ width: `${Math.round(value * 100)}%` }} />
                      <i style={{ left: '70%' }} title="Met band" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="health-note">
            <Icon name="target" size={15} />
            {t('home.focus.help')}
          </div>
        </section>
      </div>

      <section className="card attempts-card">
        <div className="card-head">
          <h2>{t('mastery.attempts')}</h2>
          <span className="count-pill">{attempts.length}</span>
        </div>
        {attempts.length === 0 ? (
          <div className="empty-inline">
            <p>{t('mastery.empty')}</p>
            {nextScenario && (
              <button type="button" className="btn btn-primary" onClick={() => startPractice(nextScenario)}>
                {t('mastery.start')}
              </button>
            )}
          </div>
        ) : (
          <div className="attempt-table">
            <div className="attempt-row head">
              <span>{t('common.scenario')}</span>
              <span>{t('common.level')}</span>
              <span>{t('feedback.weighted')}</span>
              <span>{t('common.today')}</span>
              <span />
            </div>
            {attempts.map((a) => (
              <button type="button" className="attempt-row" key={a.id} onClick={() => void openAttempt(a.id)}>
                <span className="attempt-title">{roleplayText(a.scenarioTitle, practiceLang)}</span>
                <span>L{a.level}</span>
                <span className={`status-chip ${statusClass[a.status]}`}>{t(decisionKey(a.status))}</span>
                <span>{new Date(a.createdAt).toLocaleDateString(practiceLang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}</span>
                <span className="row-arrow">
                  <Icon name="arrow" size={15} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
