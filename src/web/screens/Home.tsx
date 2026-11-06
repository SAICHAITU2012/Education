import { useMemo } from 'react';
import { weakestCompetency } from '../../core/progression.js';
import { levelCatalog } from '../../core/selection.js';
import type { CompetencyId } from '../../core/types.js';
import { roleplayText } from '../api.js';
import { decisionKey } from '../i18n.js';
import { useApp } from '../store.js';
import { Barcode, PixelSky, QuestBadge, StarField, questCode } from '../components/Gameverse.js';
import { parallaxHandler, tiltHandlers } from '../tilt.js';
import { Icon } from '../components/Icons.js';
import { LevelLadder } from '../components/LevelLadder.js';

const decisionClass: Record<string, string> = {
  pass: 'pass',
  retry: 'retry',
  redo: 'redo',
  provisional: 'provisional',
};

export function Home() {
  const {
    t,
    teacherState,
    profile,
    content,
    attempts,
    nextScenario,
    startPractice,
    practiceLang,
    navigate,
    pending,
    syncNow,
    online,
  } = useApp();

  if (!teacherState || !profile) return null;

  const weakest = useMemo(
    () => (teacherState ? weakestCompetency(teacherState) : ('accuracy' as CompetencyId)),
    [teacherState],
  );
  const competency = content.rubric.competencies.find((c) => c.id === weakest);
  const catalog = useMemo(
    () => (teacherState ? levelCatalog(content.scenarios, teacherState) : []),
    [content.scenarios, teacherState],
  );

  if (!teacherState || !profile) return null;
  const passes = attempts.filter((a) => a.status === 'pass').length;
  const scored = attempts.filter((a) => a.status !== 'provisional').length;
  const passRate = scored > 0 ? Math.round((passes / scored) * 100) : 0;
  const recent = attempts.slice(0, 4);

  const competencyLabel = (id: CompetencyId) => {
    const c = content.rubric.competencies.find((x) => x.id === id);
    return c ? (practiceLang === 'hi' ? c.name.hi : c.name.en) : id;
  };

  const questIndex = nextScenario ? content.scenarios.findIndex((s) => s.id === nextScenario.id) : -1;

  return (
    <div className="home">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('common.today')} · {new Date().toLocaleDateString(practiceLang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          <h1>{t('home.greeting')}</h1>
          <p className="lede">
            Class {profile.curriculum.class} · {profile.curriculum.subject === 'maths' ? t('onboarding.maths') : t('onboarding.hindi')} ·{' '}
            {profile.language === 'hi' ? 'हिंदी' : 'English'}
          </p>
        </div>
        <div className="head-stats">
          <div>
            <span>{t('home.currentLevel')}</span>
            <strong>L{profile.currentLevel}</strong>
          </div>
          <div>
            <span>{t('home.sessions')}</span>
            <strong>{attempts.length}</strong>
          </div>
          <div>
            <span>{t('home.passRate')}</span>
            <strong>{passRate}%</strong>
          </div>
        </div>
      </header>

      {pending > 0 && (
        <div className="notice">
          <Icon name="clock" size={17} />
          <span>{t('common.pending', { n: pending })}</span>
          <button type="button" className="btn btn-mini" disabled={!online} onClick={() => void syncNow(true)}>
            {t('common.sync')}
          </button>
        </div>
      )}

      <section className="hero hero-3d" {...parallaxHandler()}>
        <div className="sun" aria-hidden="true" />
        <span className="float-orb o1" aria-hidden="true" />
        <span className="float-orb o2" aria-hidden="true" />
        <span className="float-orb o3" aria-hidden="true" />
        <div className="px-layer l2">
          <StarField count={14} />
          <PixelSky variant="hero" />
        </div>
        <div className="px-layer l1">
          <div className="hero-portal" aria-hidden="true" />
        </div>

        <div className="hero-copy">
          <span className="pill pill-amber">★ {t('home.focus')}</span>
          <h2>{competencyLabel(weakest)}</h2>
          <p>
            {competency
              ? practiceLang === 'hi'
                ? competency.description.hi
                : competency.description.en
              : t('home.focus.help')}
          </p>
          <div className="hero-actions">
            {nextScenario ? (
              <button type="button" className="btn btn-primary" onClick={() => startPractice(nextScenario)}>
                <Icon name="mic" size={18} />
                {t('home.start')}
              </button>
            ) : (
              <span className="muted">{t('home.noScenarios')}</span>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/mastery')}>
              {t('home.viewAll')}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>

        {nextScenario && (
          <article className="quest-ticket tilt" {...tiltHandlers(5)}>
            <div className="ticket-body">
              <div className="ticket-top">
                <QuestBadge n={Math.max(0, questIndex) + 1} level={nextScenario.level} />
                <span className="topic">{roleplayText(nextScenario.title, practiceLang)}</span>
                <span className="turn-budget">
                  <Icon name="clock" size={14} /> {nextScenario.studentPersona.bounds.maxStudentTurns} {t('common.turns')}
                </span>
              </div>
              <div className="student-quote">
                <div className="ticket-l-avatar">{nextScenario.studentPersona.name.slice(0, 1)}</div>
                <div>
                  <span>{nextScenario.studentPersona.name} · age {nextScenario.studentPersona.age}</span>
                  <p>“{roleplayText(nextScenario.studentPersona.opening, practiceLang)}”</p>
                </div>
              </div>
              <div className="ticket-meta">
                <span className="ticket-l-level">L{nextScenario.level}</span>
                {nextScenario.competencies.map((c) => (
                  <span key={c} className="tag">{competencyLabel(c)}</span>
                ))}
              </div>
              <button type="button" className="ticket-cta" onClick={() => startPractice(nextScenario)}>
                {t('home.rehearse')}
                <Icon name="arrow" size={17} />
              </button>
            </div>
            <div className="ticket-stub" aria-hidden="true">
              <span className="ticket-admit">{t('game.admit')}</span>
              <Barcode />
            </div>
            <span className="tilt-glare" aria-hidden="true" />
          </article>
        )}
      </section>

      <div className="home-grid">
        <section className="card ladder-card">
          <div className="card-head">
            <div>
              <h2>{t('game.board')}</h2>
              <p>{t('mastery.subtitle')}</p>
            </div>
            <button type="button" className="link" onClick={() => navigate('/mastery')}>
              {t('home.viewAll')}
            </button>
          </div>
          <LevelLadder state={teacherState} policy={content.rubric.decision} lang={practiceLang} catalog={catalog} />
        </section>

        <div className="home-side">
          <section className="card recent-card">
            <div className="card-head">
              <h2>{t('home.recent')}</h2>
            </div>
            {recent.length === 0 ? (
              <p className="muted">{t('mastery.empty')}</p>
            ) : (
              <ul className="attempt-list">
                {recent.map((a) => (
                  <li key={a.id}>
                    <span className={`dot ${decisionClass[a.status]}`} />
                    <div>
                      <strong>{roleplayText(a.scenarioTitle, practiceLang)}</strong>
                      <small>
                        L{a.level} · {new Date(a.createdAt).toLocaleDateString(practiceLang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                      </small>
                    </div>
                    <span className={`status-chip ${decisionClass[a.status]}`}>{t(decisionKey(a.status))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="privacy-card">
            <Icon name="shield" size={22} />
            <div>
              <strong>{t('home.privacyTitle')}</strong>
              <p>{t('home.privacyBody')}</p>
            </div>
          </section>

          <blockquote className="quote-card">{t('home.quote')}</blockquote>
        </div>
      </div>
    </div>
  );
}
