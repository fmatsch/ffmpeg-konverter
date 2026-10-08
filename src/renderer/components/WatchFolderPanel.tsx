import { useTranslation } from 'react-i18next';
import { WATCH_OUTPUT_SUBFOLDER } from '@shared/watch';
import type { WatchSettings } from '@shared/types';
import { useConverterStore } from '../state/store';
import { SettingsPanel } from './SettingsPanel';

export function WatchFolderPanel() {
  const { t } = useTranslation();
  const watch = useConverterStore((s) => s.appSettings.watch);
  const globalSettings = useConverterStore((s) => s.globalSettings);
  const setWatchSettings = useConverterStore((s) => s.setWatchSettings);

  function patch(partial: Partial<WatchSettings>) {
    setWatchSettings({ ...watch, ...partial });
  }

  async function chooseWatchFolder() {
    const dir = await window.api.selectOutputDir();
    if (dir) patch({ folder: dir });
  }

  async function chooseOutputFolder() {
    const dir = await window.api.selectOutputDir();
    if (dir) patch({ outputMode: 'custom', customOutputDir: dir });
  }

  return (
    <div className="panel watch-panel">
      <h3>{t('watch.title')}</h3>
      <p className="hint watch-panel__intro">{t('watch.description')}</p>

      <div className="field">
        <label>{t('watch.folder')}</label>
        <div className="output-settings__folder">
          <span title={watch.folder ?? ''}>{watch.folder ?? t('watch.noFolder')}</span>
          <button type="button" className="button button--ghost" onClick={() => void chooseWatchFolder()}>
            {t('output.chooseFolder')}
          </button>
        </div>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={watch.enabled}
          disabled={!watch.folder}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        {t('watch.enable')}
      </label>
      {watch.enabled && watch.folder && <p className="hint hint--success">{t('watch.active')}</p>}

      <div className="field watch-panel__output">
        <label>{t('watch.outputTo')}</label>
        <div className="radio-group">
          <label className="radio">
            <input type="radio" checked={watch.outputMode === 'subfolder'} onChange={() => patch({ outputMode: 'subfolder' })} />
            {t('watch.outputSubfolder', { name: WATCH_OUTPUT_SUBFOLDER })}
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={watch.outputMode === 'custom'}
              onChange={() => (watch.customOutputDir ? patch({ outputMode: 'custom' }) : void chooseOutputFolder())}
            />
            {t('output.custom')}
          </label>
        </div>
        {watch.outputMode === 'custom' && (
          <div className="output-settings__folder">
            <span title={watch.customOutputDir ?? ''}>{watch.customOutputDir ?? t('output.noFolderChosen')}</span>
            <button type="button" className="button button--ghost" onClick={() => void chooseOutputFolder()}>
              {t('output.chooseFolder')}
            </button>
          </div>
        )}
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={watch.processExisting} onChange={(e) => patch({ processExisting: e.target.checked })} />
        {t('watch.processExisting')}
      </label>

      <details className="watch-panel__target">
        <summary>{t('watch.targetFormat')}</summary>
        <button
          type="button"
          className="button button--ghost watch-panel__copy"
          onClick={() => patch({ settings: structuredClone(globalSettings) })}
        >
          {t('watch.copyCurrent')}
        </button>
        <SettingsPanel settings={watch.settings} onChange={(settings) => patch({ settings })} compact />
      </details>
    </div>
  );
}
