import { useEffect, useState } from 'react';
import { fetchCohort } from '../api.js';
import { Icon } from '../components/Icons.js';
import { useApp } from '../store.js';
import type { CohortResponse } from '../../shared/api.js';

const CACHE_KEY = 'abhyas:cohort-cache';

function cached(): CohortResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CohortResponse) : null;
  } catch {
    return null;
  }
}

export function Cohort() {
  const { t, content, practiceLang, online, toast } = useApp();
  const [data, setData] = useState<CohortResponse | null>(cached);
  const [loading, setLoading] = useState(!data);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetchCohort(8, 5);
      setData(response);
      localStorage.setItem(CACHE_KEY, JSON.stringify(response));
    } catch {
      toast(t('error.offline'), 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (online) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const weeks = data?.weeks ?? [];
  const cellFor = (week: string, competency: string) =>
    data?.cells.find((c) => c.week === week && c.competency === competency);

  const tone = (mean: number) => (mean >= 0.7 ? 'strong' : mean >= 0.5 ? 'mid' : 'weak');

  return (
    <div className="cohort">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('nav.cohort')}</p>
          <h1>{t('cohort.title')}</h1>
          <p className="lede">{t('cohort.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={!online || loading}>
          <Icon name="rotate" size={16} />
          {t('common.sync')}
        </button>
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <span>{t('home.sessions')}</span>
          <strong>{data?.totalAttempts ?? 0}</strong>
          <small>{t('cohort.attempts', { n: data?.includedAttempts ?? 0 })}</small>
        </div>
        <div className="stat-card">
          <span>{t('cohort.contributing')}</span>
          <strong>{data?.contributingTeachers ?? '—'}</strong>
          <small>{t('cohort.k', { k: data?.k ?? 5, t: data?.minTeachers ?? 3 })}</small>
        </div>
        <div className="stat-card">
          <span>Withheld</span>
          <strong>{data?.suppressedCells ?? 0}</strong>
          <small>{t('cohort.suppressed', { n: data?.suppressedCells ?? 0 })}</small>
        </div>
        <div className="stat-card">
          <span>Weeks</span>
          <strong>{weeks.length}</strong>
          <small>{weeks[0] ?? '—'} → {weeks[weeks.length - 1] ?? '—'}</small>
        </div>
      </div>

      <section className="card cohort-card">
        <div className="card-head">
          <div>
            <h2>{t('cohort.title')}</h2>
            <p>{t('cohort.k', { k: data?.k ?? 5, t: data?.minTeachers ?? 3 })}</p>
          </div>
          <div className="legend">
            <span className="legend-label">{t('cohort.weak')}</span>
            <i className="swatch weak" />
            <i className="swatch mid" />
            <i className="swatch strong" />
            <span className="legend-label">{t('cohort.legend')}</span>
          </div>
        </div>

        {loading ? (
          <div className="cohort-loading">
            <span className="spinner" />
            <p>{t('common.loading')}</p>
          </div>
        ) : weeks.length === 0 ? (
          <div className="empty-inline">
            <Icon name="shield" size={30} />
            <p>{t('cohort.empty')}</p>
            <small>{data ? t('cohort.suppressed', { n: data.suppressedCells }) : ''}</small>
          </div>
        ) : (
          <div className="heatmap-scroll">
            <table className="heatmap">
              <thead>
                <tr>
                  <th scope="col">{t('cohort.week')}</th>
                  {content.rubric.competencies.map((c) => (
                    <th key={c.id} scope="col">
                      {practiceLang === 'hi' ? c.name.hi : c.name.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week}>
                    <th scope="row">{week}</th>
                    {content.rubric.competencies.map((c) => {
                      const cell = cellFor(week, c.id);
                      return (
                        <td key={c.id}>
                          {cell ? (
                            <span className={`heat-cell ${tone(cell.meanScore)}`}>
                              <strong>{Math.round(cell.meanScore * 100)}</strong>
                              <small>n={cell.n}</small>
                            </span>
                          ) : (
                            <span className="heat-cell suppressed" title={t('common.confirm')}>
                              ·
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="cohort-foot">
        <section className="privacy-card">
          <Icon name="shield" size={22} />
          <div>
            <strong>{t('settings.cohortTitle')}</strong>
            <p>{t('settings.cohortBody')}</p>
          </div>
        </section>
        <section className="card note-card">
          <Icon name="alert" size={18} />
          <p>{t('cohort.suppressed', { n: data?.suppressedCells ?? 0 })}</p>
        </section>
      </div>
    </div>
  );
}
