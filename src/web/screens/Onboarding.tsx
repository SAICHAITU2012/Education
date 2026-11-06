import { useMemo, useState } from 'react';
import type { Lang } from '../../core/types.js';
import { useApp } from '../store.js';
import { PixelSky, StarField } from '../components/Gameverse.js';
import { Icon } from '../components/Icons.js';
import { classKey } from '../i18n.js';

export function Onboarding() {
  const { content, saveProfile, t, uiLang, setUiLang } = useApp();
  const [step, setStep] = useState(1);
  const [klass, setKlass] = useState<1 | 2 | 3>(3);
  const [subject, setSubject] = useState<'maths' | 'hindi'>('maths');
  const [language, setLanguage] = useState<Lang>('hi');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = useMemo(
    () =>
      content.scenarios.filter(
        (s) => s.curriculum.class === klass && s.curriculum.subject === subject && !s.holdout,
      ).length,
    [content.scenarios, klass, subject],
  );

  const next = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else void submit();
  };

  const submit = async () => {
    if (!consent || available === 0 || busy) return;
    setBusy(true);
    try {
      await saveProfile({ curriculum: { class: klass, subject }, language });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-art" aria-hidden="true">
        <StarField count={16} />
        <PixelSky variant="panel" />
        <div className="art-portal" />
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="art-quote">
          <span className="art-mark">अ</span>
          <p>{t('home.quote')}</p>
          <small>{t('app.name')} · {t('app.tagline')}</small>
        </div>
      </div>

      <div className="onboarding-panel">
        <div className="onboarding-top">
          <span className="brand-mark small">अ</span>
          <a className="ob-back" href="#/landing">←</a>
          <button
            type="button"
            className="lang-chip dark"
            onClick={() => {
              const nextLang = uiLang === 'en' ? 'hi' : 'en';
              setUiLang(nextLang);
            }}
          >
            {uiLang === 'en' ? 'हिंदी' : 'English'}
          </button>
        </div>

        <div className="step-dots" aria-label={t('onboarding.step', { n: step })}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= step ? 'on' : ''} />
          ))}
        </div>
        <p className="eyebrow">{t('onboarding.step', { n: step })}</p>

        {step === 1 && (
          <>
            <h1>{t('onboarding.class')}</h1>
            <p className="lede">{t('onboarding.class.help')}</p>
            <div className="choice-grid">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`choice-card ${klass === n ? 'selected' : ''}`}
                  onClick={() => setKlass(n)}
                >
                  <span className="choice-num">{n}</span>
                  <strong>{t(classKey(n))}</strong>
                  <small>Class {n}</small>
                </button>
              ))}
            </div>
            <h2 className="sub-head">{t('onboarding.subject')}</h2>
            <div className="subject-grid">
              <button
                type="button"
                className={`subject-card ${subject === 'maths' ? 'selected' : ''}`}
                onClick={() => setSubject('maths')}
              >
                <span className="subject-icon">123</span>
                <strong>{t('onboarding.maths')}</strong>
                <small>Maths</small>
              </button>
              <button
                type="button"
                className={`subject-card ${subject === 'hindi' ? 'selected' : ''}`}
                onClick={() => setSubject('hindi')}
              >
                <span className="subject-icon">अ</span>
                <strong>{t('onboarding.hindi')}</strong>
                <small>Hindi</small>
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>{t('onboarding.language')}</h1>
            <p className="lede">{t('onboarding.language.help')}</p>
            <div className="language-grid">
              <button
                type="button"
                className={`language-card ${language === 'hi' ? 'selected' : ''}`}
                onClick={() => setLanguage('hi')}
              >
                <strong>हिंदी</strong>
                <span>नमस्ते, मैडम!</span>
              </button>
              <button
                type="button"
                className={`language-card ${language === 'en' ? 'selected' : ''}`}
                onClick={() => setLanguage('en')}
              >
                <strong>English</strong>
                <span>Hello, Ma'am!</span>
              </button>
            </div>
            <div className="coming-langs">
              <Icon name="globe" size={16} />
              <span>ಕನ್ನಡ · தமிழ் · తెలుగు · മലയാളം — coming next</span>
            </div>
            <div className={`availability ${available === 0 ? 'warn' : ''}`}>
              <Icon name={available === 0 ? 'alert' : 'sparkle'} size={17} />
              {available > 0 ? t('onboarding.scenarios', { n: available }) : t('onboarding.none')}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1>{t('onboarding.title')}</h1>
            <p className="lede">{t('onboarding.subtitle')}</p>
            <div className="summary-card">
              <div>
                <span>{t('common.class')}</span>
                <strong>Class {klass}</strong>
              </div>
              <div>
                <span>{t('onboarding.subject')}</span>
                <strong>{subject === 'maths' ? t('onboarding.maths') : t('onboarding.hindi')}</strong>
              </div>
              <div>
                <span>{t('common.language')}</span>
                <strong>{language === 'hi' ? 'हिंदी' : 'English'}</strong>
              </div>
              <div>
                <span>{t('common.scenario')}</span>
                <strong>{available}</strong>
              </div>
            </div>
            <label className={`consent ${consent ? 'on' : ''}`}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="consent-box">{consent && <Icon name="check" size={14} />}</span>
              <span>{t('onboarding.consent')}</span>
            </label>
            <div className="privacy-strip">
              <Icon name="lock" size={16} />
              <span>{t('onboarding.private')}</span>
            </div>
          </>
        )}

        <div className="onboarding-actions">
          {step > 1 && (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              {t('common.back')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary grow"
            disabled={step === 3 ? !consent || busy || available === 0 : false}
            onClick={next}
          >
            {step === 3 ? (busy ? t('common.loading') : t('onboarding.start')) : t('common.continue')}
            {step < 3 && <Icon name="arrow" size={18} />}
          </button>
        </div>

        <p className="foot-note">{t('onboarding.voice')}</p>
      </div>
    </div>
  );
}
