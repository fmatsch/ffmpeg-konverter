import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConverterStore } from './state/store';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { Queue } from './components/Queue';
import { PresetBar } from './components/PresetBar';
import { SettingsPanel } from './components/SettingsPanel';
import { OutputSettings } from './components/OutputSettings';

export default function App() {
  const { t, i18n } = useTranslation();
  const init = useConverterStore((s) => s.init);
  const ready = useConverterStore((s) => s.ready);
  const jobs = useConverterStore((s) => s.jobs);
  const globalSettings = useConverterStore((s) => s.globalSettings);
  const setGlobalSettings = useConverterStore((s) => s.setGlobalSettings);
  const applyJobUpdate = useConverterStore((s) => s.applyJobUpdate);
  const setLanguage = useConverterStore((s) => s.setLanguage);
  const startAll = useConverterStore((s) => s.startAll);
  const cancelAll = useConverterStore((s) => s.cancelAll);
  const isStarting = useConverterStore((s) => s.isStarting);
  const appSettings = useConverterStore((s) => s.appSettings);

  useEffect(() => {
    void init();
    const offUpdate = window.api.onJobUpdate(applyJobUpdate);
    const offLang = window.api.onLanguageChanged(setLanguage);
    return () => {
      offUpdate();
      offLang();
    };
  }, [init, applyJobUpdate, setLanguage]);

  useEffect(() => {
    void i18n.changeLanguage(appSettings.language);
  }, [appSettings.language, i18n]);

  const runnableCount = jobs.filter((j) => j.status === 'pending' || j.status === 'error').length;
  const activeCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;

  if (!ready) return null;

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <section className="app-main__left">
          <Dropzone />
          <Queue />
        </section>
        <aside className="app-main__right">
          <PresetBar />
          <div className="panel">
            <h3>{t('settings.title')}</h3>
            <SettingsPanel settings={globalSettings} onChange={setGlobalSettings} />
          </div>
          <OutputSettings />
        </aside>
      </main>
      <footer className="app-footer">
        <span>{t('footer.filesCount', { count: jobs.length })}</span>
        <div className="app-footer__actions">
          {activeCount > 0 && (
            <button type="button" className="button button--ghost" onClick={cancelAll}>
              {t('actions.cancelAll')}
            </button>
          )}
          <button
            type="button"
            className="button button--primary button--large"
            disabled={runnableCount === 0 || isStarting}
            onClick={() => void startAll()}
          >
            {isStarting ? t('actions.starting') : `${t('actions.start')}${runnableCount > 0 ? ` (${runnableCount})` : ''}`}
          </button>
        </div>
      </footer>
    </div>
  );
}
