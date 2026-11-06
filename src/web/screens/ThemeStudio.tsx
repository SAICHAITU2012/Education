import { useState } from 'react';
import { Icon } from '../components/Icons.js';
import { CATEGORIES, THEMES, setTheme, useTheme } from '../themes.js';
import { useApp } from '../store.js';

/**
 * Theme Studio — browse 27 themes, preview swatches, apply instantly.
 * Auto mode follows the local clock through four environments.
 */
export function ThemeStudio() {
  const { t, uiLang } = useApp();
  const { auto, themeId, period } = useTheme();
  const [cat, setCat] = useState<string>('all');

  const list = cat === 'all' ? THEMES : THEMES.filter((x) => x.cat === cat);

  return (
    <div className="themes-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">★ {t('nav.themes')}</p>
          <h1>{t('themes.title')}</h1>
          <p className="lede">{t('themes.subtitle')}</p>
        </div>
      </header>

      <section className="theme-auto-card">
        <div>
          <h3>{t('themes.auto')}</h3>
          <p>{t('themes.autoDesc')}</p>
        </div>
        <span className="auto-clock">
          <Icon name="clock" size={16} />
          {t(`themes.period.${period}`)} · {THEMES.find((x) => x.env === period)?.name}
        </span>
        <button
          type="button"
          className={`auto-pill ${auto ? 'on' : ''}`}
          onClick={() => setTheme(auto ? themeId : 'auto')}
        >
          <Icon name={auto ? 'check' : 'close'} size={15} />
          {auto ? t('themes.autoOn') : t('themes.autoOff')}
        </button>
      </section>

      <div className="cat-tabs" role="tablist" aria-label={t('themes.title')}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={`cat-tab ${cat === c.id ? 'on' : ''}`}
            onClick={() => setCat(c.id)}
          >
            {uiLang === 'hi' ? c.hi : c.en}
          </button>
        ))}
      </div>

      <div className="theme-grid">
        {list.map((x) => {
          const active = x.id === themeId && (auto ? x.env === period : true);
          return (
            <button
              key={x.id}
              type="button"
              className={`theme-card ${active ? 'active' : ''}`}
              onClick={() => setTheme(x.id)}
              aria-pressed={active}
            >
              <span
                className="tc-sky"
                style={{ background: `linear-gradient(168deg, ${x.sky[0]}, ${x.sky[1]} 52%, ${x.sky[2]})` }}
              >
                {active && <span className="tc-active">{t('themes.active')}</span>}
                <span className="tc-orbs">
                  {x.orb.map((o) => (
                    <i key={o} style={{ background: `radial-gradient(circle at 34% 30%, #fff, ${o} 65%)` }} />
                  ))}
                </span>
              </span>
              <span className="tc-body">
                <span className="tc-name">{x.name}</span>
                <span className="tc-name-hi">{x.hi}</span>
                <span className="tc-meta">
                  <i className="tc-dot" style={{ background: x.gold }} />
                  <i className="tc-dot" style={{ background: x.cyan }} />
                  <i className="tc-dot" style={{ background: x.coral }} />
                  <span className="tc-badge">{x.mode === 'light' ? t('themes.light') : t('themes.dark')}</span>
                  {x.env && (
                    <span className="tc-badge" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}>
                      {t(`themes.period.${x.env}`)}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
