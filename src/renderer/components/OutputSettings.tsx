import { useTranslation } from 'react-i18next';
import { useConverterStore } from '../state/store';
import type { OutputOptions } from '@shared/types';

export function OutputSettings() {
  const { t } = useTranslation();
  const outputOptions = useConverterStore((s) => s.outputOptions);
  const setOutputOptions = useConverterStore((s) => s.setOutputOptions);

  function patch(partial: Partial<OutputOptions>) {
    setOutputOptions({ ...outputOptions, ...partial });
  }

  async function handleChooseFolder() {
    const dir = await window.api.selectOutputDir();
    if (dir) patch({ mode: 'custom', customDir: dir });
  }

  return (
    <div className="output-settings">
      <h3>{t('output.title')}</h3>

      <div className="field">
        <label>{t('output.mode')}</label>
        <div className="radio-group">
          <label className="radio">
            <input type="radio" checked={outputOptions.mode === 'sameAsSource'} onChange={() => patch({ mode: 'sameAsSource' })} />
            {t('output.sameAsSource')}
          </label>
          <label className="radio">
            <input type="radio" checked={outputOptions.mode === 'custom'} onChange={() => void handleChooseFolder()} />
            {t('output.custom')}
          </label>
        </div>
        {outputOptions.mode === 'custom' && (
          <div className="output-settings__folder">
            <span title={outputOptions.customDir ?? ''}>{outputOptions.customDir ?? t('output.noFolderChosen')}</span>
            <button type="button" className="button button--ghost" onClick={() => void handleChooseFolder()}>
              {t('output.chooseFolder')}
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label>{t('output.filenamePattern')}</label>
        <input
          type="text"
          value={outputOptions.filenamePattern}
          onChange={(e) => patch({ filenamePattern: e.target.value })}
          placeholder="{name}_converted"
        />
        <p className="hint">{t('output.filenamePatternHint')}</p>
      </div>

      <div className="field">
        <label>{t('output.onConflict')}</label>
        <select value={outputOptions.onConflict} onChange={(e) => patch({ onConflict: e.target.value as OutputOptions['onConflict'] })}>
          <option value="rename">{t('output.onConflictRename')}</option>
          <option value="overwrite">{t('output.onConflictOverwrite')}</option>
          <option value="skip">{t('output.onConflictSkip')}</option>
        </select>
      </div>
    </div>
  );
}
