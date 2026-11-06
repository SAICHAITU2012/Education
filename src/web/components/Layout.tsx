import type { ReactNode } from 'react';
import { levelCatalog } from '../../core/selection.js';
import { levelProgress } from '../../core/progression.js';
import { useApp } from '../store.js';
import { useRoute } from '../route.js';
import { Icon, type IconName } from './Icons.js';

const navItems: { path: string; label: 'nav.home' | 'nav.mastery' | 'nav.cohort' | 'nav.settings' | 'nav.themes'; icon: IconName }[] = [
  { path: '/home', label: 'nav.home', icon: 'home' },
  { path: '/mastery', label: 'nav.mastery', icon: 'chart' },
  { path: '/cohort', label: 'nav.cohort', icon: 'users' },
  { path: '/settings', label: 'nav.settings', icon: 'settings' },
  { path: '/themes', label: 'nav.themes', icon: 'palette' },
];

/** XP is derived from real progression data: 100 XP per pass, 20 per attempt. */
function playerStats(progress: Record<number, { passesByScenario: Record<string, number>; attempts: number }>) {
  let passes = 0;
  let attempts = 0;
  for (const p of Object.values(progress)) {
    for (const n of Object.values(p.passesByScenario)) passes += n;
    attempts += p.attempts;
  }
  return { passes, attempts, xp: passes * 100 + attempts * 20 };
}

export function Layout({ children }: { children: ReactNode }) {
  const { t, profile, teacherState, content, online, pending, syncNow, uiLang, setUiLang } = useApp();
  const route = useRoute();
  const level = teacherState?.profile.currentLevel ?? 1;

  const stats = teacherState ? playerStats(teacherState.progress) : { passes: 0, attempts: 0, xp: 0 };
  const catalog = teacherState ? levelCatalog(content.scenarios, teacherState) : [];
  const item = catalog.find((c) => c.level === level);
  const progress = teacherState ? levelProgress(teacherState, level, content.rubric.decision, item?.total) : null;
  const xpFill = progress ? Math.min(100, (progress.passes / Math.max(1, progress.passesRequired)) * 100) : 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#/landing" aria-label={t('app.name')}>
          <span className="brand-mark">अ</span>
          <span className="brand-text">
            <strong>{t('app.name')}</strong>
            <small>{t('app.tagline')}</small>
          </span>
        </a>

        <nav className="side-nav" aria-label="Primary">
          {navItems.map((item2) => (
            <a
              key={item2.path}
              href={`#${item2.path}`}
              className={`nav-item ${route.path === item2.path ? 'active' : ''}`}
            >
              <Icon name={item2.icon} size={19} />
              <span>{t(item2.label)}</span>
            </a>
          ))}
        </nav>

        <div className="side-card">
          <span className="side-card-label">{t('game.player')}</span>
          <div className="side-card-head">
            <span className="player-avatar" aria-hidden="true">अ</span>
            <div>
              <strong>Level {level}</strong>
              <small>{profile ? `${profile.curriculum.subject === 'maths' ? t('onboarding.maths') : t('onboarding.hindi')} · Class ${profile.curriculum.class}` : ''}</small>
            </div>
          </div>
          <div className="xp-row">
            <span className="xp-value">{stats.xp} XP</span>
            <span className="xp-cap">
              {progress ? `${progress.passes}/${progress.passesRequired} ${t('game.passes').toLowerCase()}` : ''}
            </span>
          </div>
          <div className="xp-track" role="img" aria-label={`${t('home.currentLevel')}: ${xpFill}%`}>
            <span style={{ width: `${xpFill}%` }} />
          </div>
          <div className="level-dots" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= level ? 'on' : ''} />
            ))}
          </div>
        </div>

        <div className="side-foot">
          <span className={`status-dot ${online ? 'online' : 'offline'}`} />
          {online ? t('common.online') : t('common.offline')}
          <button
            type="button"
            className="lang-chip"
            onClick={() => setUiLang(uiLang === 'en' ? 'hi' : 'en')}
            aria-label={t('common.language')}
          >
            {uiLang === 'en' ? 'हिं' : 'EN'}
          </button>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="mobile-top">
          <a className="brand compact" href="#/landing">
            <span className="brand-mark">अ</span>
            <strong>{t('app.name')}</strong>
          </a>
          <div className="mobile-top-right">
            <span className="xp-value">{stats.xp} XP</span>
            <span className={`status-dot ${online ? 'online' : 'offline'}`} />
            <span className="level-pill">L{level}</span>
            <button type="button" className="lang-pill" onClick={() => setUiLang(uiLang === 'en' ? 'hi' : 'en')}>
              {uiLang === 'en' ? 'हिं' : 'EN'}
            </button>
          </div>
        </header>

        {!online && (
          <div className="offline-banner" role="status">
            <Icon name="wifiOff" size={17} />
            <span>
              {t('common.offline')}
              {pending > 0 ? ` · ${t('common.pending', { n: pending })}` : ''}
            </span>
            {pending > 0 && (
              <button type="button" className="btn btn-mini" onClick={() => void syncNow(true)}>
                {t('common.sync')}
              </button>
            )}
          </div>
        )}

        <main className="page">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        {navItems.map((item2) => (
          <a
            key={item2.path}
            href={`#${item2.path}`}
            className={`bottom-item ${route.path === item2.path ? 'active' : ''}`}
          >
            <Icon name={item2.icon} size={21} />
            <span>{t(item2.label)}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
