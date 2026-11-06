import { useState } from 'react';
import { deleteTeacher, exportData } from '../api.js';
import { Icon } from '../components/Icons.js';
import { useApp } from '../store.js';

export function Settings() {
  const {
    t,
    uiLang,
    setUiLang,
    voiceEnabled,
    setVoiceEnabled,
    online,
    pending,
    syncNow,
    health,
    content,
    teacherId,
    clearLocal,
    install,
    installAvailable,
    toast,
  } = useApp();
  const pendingCount = pending;
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!online) {
      toast(t('error.offline'), 'error');
      return;
    }
    setBusy(true);
    try {
      const data = await exportData(teacherId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abhyas-${teacherId.slice(-8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast(t('error.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (confirmText !== 'DELETE') return;
    setBusy(true);
    try {
      if (online) await deleteTeacher(teacherId);
    } catch {
      // Local erasure still proceeds; server purge can happen on next connect.
    } finally {
      clearLocal();
      setBusy(false);
      toast(t('toast.deleted'), 'success');
    }
  };

  return (
    <div className="settings">
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('nav.settings')}</p>
          <h1>{t('settings.title')}</h1>
          <p className="lede">{t('settings.privacyBody')}</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="card appearance-card">
          <div className="card-head">
            <h2>{t('settings.appearance')}</h2>
          </div>
          <p className="muted">{t('settings.appearanceBody')}</p>
          <a className="btn btn-primary" href="#/themes" style={{ alignSelf: 'flex-start', marginTop: 12 }}>
            <Icon name="palette" size={17} />
            {t('nav.themes')}
          </a>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t('settings.uiLang')}</h2>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('common.language')}</strong>
              <small>{t('onboarding.language.help')}</small>
            </div>
            <div className="segmented">
              <button type="button" className={uiLang === 'en' ? 'on' : ''} onClick={() => setUiLang('en')}>
                English
              </button>
              <button type="button" className={uiLang === 'hi' ? 'on' : ''} onClick={() => setUiLang('hi')}>
                हिंदी
              </button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('settings.voice')}</strong>
              <small>{t('settings.voice.help')}</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={voiceEnabled}
              className={`switch ${voiceEnabled ? 'on' : ''}`}
              onClick={() => setVoiceEnabled(!voiceEnabled)}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('settings.install')}</strong>
              <small>{t('settings.install.help')}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void install()}>
              <Icon name="download" size={15} />
              {installAvailable ? t('settings.install') : 'PWA'}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t('settings.data')}</h2>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('settings.export')}</strong>
              <small>{t('settings.export.help')}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-small" disabled={busy || !online} onClick={() => void download()}>
              <Icon name="download" size={15} />
              {t('common.download')}
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('common.pending', { n: pendingCount })}</strong>
              <small>{online ? t('common.online') : t('common.offline')}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-small" disabled={!online || pendingCount === 0} onClick={() => void syncNow(true)}>
              <Icon name="rotate" size={15} />
              {t('common.sync')}
            </button>
          </div>
          <div className="danger-zone">
            <div>
              <strong>{t('settings.delete')}</strong>
              <small>{t('settings.delete.help')}</small>
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('settings.delete.confirm')}
              aria-label={t('settings.delete.confirm')}
            />
            <button
              type="button"
              className="btn btn-danger btn-small"
              disabled={confirmText !== 'DELETE' || busy}
              onClick={() => void erase()}
            >
              <Icon name="trash" size={15} />
              {t('settings.delete')}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t('settings.privacyTitle')}</h2>
          </div>
          <p className="body-copy">{t('settings.privacyBody')}</p>
          <div className="setting-row">
            <div>
              <strong>{t('settings.identity')}</strong>
              <small className="mono">{teacherId}</small>
            </div>
            <button
              type="button"
              className="icon-btn bordered"
              aria-label={t('common.copy')}
              onClick={() => {
                void navigator.clipboard?.writeText(teacherId);
                toast(t('toast.copied'), 'success');
              }}
            >
              <Icon name="copy" size={16} />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('settings.engine')}</strong>
              <small>{health ? `${health.engine} · ${health.mode}` : 'offline'}</small>
            </div>
            <span className={`status-chip ${online ? 'pass' : 'provisional'}`}>
              {online ? t('common.online') : t('common.offline')}
            </span>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('settings.rubric')}</strong>
              <small className="mono">
                {content.rubric.id} v{content.rubric.version} · {(content.rubric.hash ?? '').slice(0, 12)}
              </small>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t('settings.content')}</strong>
              <small className="mono">{content.packVersion} · {content.scenarios.length} scenarios</small>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t('settings.cohortTitle')}</h2>
          </div>
          <p className="body-copy">{t('settings.cohortBody')}</p>
          <div className="privacy-points">
            <div>
              <Icon name="lock" size={17} />
              <span>{t('onboarding.private')}</span>
            </div>
            <div>
              <Icon name="users" size={17} />
              <span>{t('cohort.k', { k: 5, t: 3 })}</span>
            </div>
            <div>
              <Icon name="shield" size={17} />
              <span>{t('review.privacy')}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
