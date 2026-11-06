import type { DecisionPolicy, Lang, TeacherState } from '../../core/types.js';
import { levelProgress } from '../../core/progression.js';
import { Icon } from './Icons.js';

const names = [
  { en: 'Accuracy', hi: 'सटीकता', focus: { en: 'Facts and curriculum alignment', hi: 'तथ्य और पाठ्यक्रम' } },
  { en: 'Clarity', hi: 'स्पष्टता', focus: { en: 'An explanation a child can follow', hi: 'बच्चे की समझ में आने वाली बात' } },
  { en: 'Misconceptions', hi: 'भ्रांतियाँ', focus: { en: 'Surface the belief before correcting', hi: 'सुधार से पहले सोच समझें' } },
  { en: 'Questioning', hi: 'प्रश्न', focus: { en: 'Probing that invites thinking', hi: 'सोच जगाने वाले प्रश्न' } },
  { en: 'Integrated', hi: 'समेकित', focus: { en: 'All four, weighted like a lesson', hi: 'चारों कौशल, पाठ जैसे भारित' } },
];

export function LevelLadder({
  state,
  policy,
  lang,
  catalog,
}: {
  state: TeacherState;
  policy: DecisionPolicy;
  lang: Lang;
  catalog: { level: number; total: number; passed: number; distinctPasses: number }[];
}) {
  const current = state.profile.currentLevel;
  return (
    <ol className="ladder">
      {names.map((meta, index) => {
        const level = index + 1;
        const item = catalog.find((c) => c.level === level);
        const progress = levelProgress(state, level, policy, item?.total);
        const cleared = current > level || Boolean(state.levelHistory[level] && current > level);
        const active = current === level;
        return (
          <li key={level} className={`ladder-step ${active ? 'active' : ''} ${cleared ? 'cleared' : ''} ${!item ? 'empty' : ''}`}>
            <div className="ladder-marker">
              {cleared ? <Icon name="check" size={16} /> : <span>{level}</span>}
            </div>
            <div className="ladder-body">
              <div className="ladder-title">
                <span className="ladder-realm">REALM 0{level}</span>
                <strong>{lang === 'hi' ? meta.hi : meta.en}</strong>
                {active && (
                  <span className="pill pill-amber">
                    <Icon name="flag" size={11} /> {lang === 'hi' ? 'वर्तमान' : 'Current'}
                  </span>
                )}
                {cleared && <span className="pill pill-green">{lang === 'hi' ? 'पूरा' : 'Cleared'}</span>}
              </div>
              <p>{lang === 'hi' ? meta.focus.hi : meta.focus.en}</p>
              {active && item && (
                <div className="ladder-progress">
                  <span>
                    {progress.passes}/{progress.passesRequired} {lang === 'hi' ? 'पास' : 'passes'} ·{' '}
                    {progress.distinct}/{progress.distinctRequired} {lang === 'hi' ? 'परिदृश्य' : 'scenarios'}
                  </span>
                  <div className="mini-track">
                    <span
                      style={{
                        width: `${Math.min(100, (progress.passes / Math.max(1, progress.passesRequired)) * 100)}%`,
                      }}
                    />
                  </div>
                  <em>{item.total} {lang === 'hi' ? 'उपलब्ध' : 'available'}</em>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
