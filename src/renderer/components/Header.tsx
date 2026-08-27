import { useTranslation } from 'react-i18next';
import { useConverterStore } from '../state/store';

export function Header() {
  const { t } = useTranslation();
  const appSettings = useConverterStore((s) => s.appSettings);
  const setLanguage = useConverterStore((s) => s.setLanguage);
  const setConcurrency = useConverterStore((s) => s.setConcurrency);

  return (
    <header className="app-header">
      <div>
        <h1>{t('app.title')}</h1>
        <p className="app-header__subtitle">{t('app.subtitle')}</p>
      </div>
      <div className="app-header__controls">
        <div className="field field--inline">
          <label htmlFor="concurrency">{t('footer.concurrency')}</label>
          <select
            id="concurrency"
            value={appSettings.concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="lang-switch" role="group" aria-label={t('footer.language')}>
          <button
            type="button"
            className={appSettings.language === 'de' ? 'active' : ''}
            onClick={() => setLanguage('de')}
          >
            DE
          </button>
          <button
            type="button"
            className={appSettings.language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
