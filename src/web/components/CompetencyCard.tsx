import type { Competency, CompetencyScore, Lang } from '../../core/types.js';
import { scoreBand } from '../../core/scoring.js';
import { Icon } from './Icons.js';
import { useApp } from '../store.js';

const bandLabel = {
  en: { met: 'Met', partial: 'Partial', missing: 'Needs work' },
  hi: { met: 'पूरा', partial: 'आंशिक', missing: 'काम बाकी' },
};

const kindLabel = {
  en: { core: 'Core skill', growth: 'Growth skill' },
  hi: { core: 'मूल कौशल', growth: 'विकास कौशल' },
};

export function CompetencyCard({
  score,
  competency,
  lang,
}: {
  score: CompetencyScore;
  competency: Competency | undefined;
  lang: Lang;
}) {
  const { t } = useApp();
  const band = scoreBand(score.score);
  const name = competency ? (lang === 'hi' ? competency.name.hi : competency.name.en) : score.competency;
  const description = competency ? (lang === 'hi' ? competency.description.hi : competency.description.en) : '';

  return (
    <article className={`comp-card band-${band} ${score.abstained ? 'abstained' : ''}`}>
      <header className="comp-head">
        <div>
          <span className="comp-kicker">
            {competency?.critical
              ? kindLabel[lang === 'hi' ? 'hi' : 'en'].core
              : kindLabel[lang === 'hi' ? 'hi' : 'en'].growth}
          </span>
          <h3>{name}</h3>
        </div>
        <div className="comp-score">
          {score.abstained ? (
            <span className="band-pill">{t('feedback.abstained')}</span>
          ) : (
            <>
              <strong>{Math.round(score.score * 100)}</strong>
              <span className={`band-pill band-${band}`}>{bandLabel[lang === 'hi' ? 'hi' : 'en'][band]}</span>
            </>
          )}
        </div>
      </header>

      <div className="bar" aria-hidden="true">
        <span style={{ width: `${score.abstained ? 0 : Math.round(score.score * 100)}%` }} />
      </div>

      <p className="comp-desc">{description}</p>

      {score.abstained ? (
        <p className="abstain-note">
          <Icon name="shield" size={15} />
          {score.reason ? (lang === 'hi' ? score.reason.hi : score.reason.en) : t('feedback.abstained.help')}
        </p>
      ) : (
        <>
          <div className="confidence">
            <span>{t('feedback.confidence')}</span>
            <div className="confidence-track">
              <span style={{ width: `${Math.round(score.confidence * 100)}%` }} />
            </div>
            <em>{Math.round(score.confidence * 100)}%</em>
          </div>

          {score.evidence.length > 0 && (
            <div className="evidence-list">
              {score.evidence.map((e, i) => (
                <figure key={`${e.turnIndex}-${i}`} className={`evidence ${e.verified ? 'verified' : 'unverified'}`}>
                  <blockquote>“{e.quote}”</blockquote>
                  <figcaption>
                    <span>{t('feedback.quoteFrom', { n: e.turnIndex + 1 })}</span>
                    <span className="verify-tag">
                      <Icon name={e.verified ? 'check' : 'alert'} size={13} />
                      {e.verified ? t('feedback.verified') : t('feedback.unverified')}
                    </span>
                  </figcaption>
                  {e.note && <p className="evidence-note">{lang === 'hi' ? e.note.hi : e.note.en}</p>}
                </figure>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
