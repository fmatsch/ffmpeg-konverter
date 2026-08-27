import { useTranslation } from 'react-i18next';
import { QUICK_PRESETS } from '@shared/presets';
import { useConverterStore } from '../state/store';

export function PresetBar() {
  const { t } = useTranslation();
  const applyPreset = useConverterStore((s) => s.applyPreset);
  const applyGlobalToAll = useConverterStore((s) => s.applyGlobalToAll);
  const savePreset = useConverterStore((s) => s.savePreset);
  const deletePreset = useConverterStore((s) => s.deletePreset);
  const presets = useConverterStore((s) => s.presets);

  function handleQuickPreset(settings: (typeof QUICK_PRESETS)[number]['settings']) {
    applyPreset(settings);
    applyGlobalToAll();
  }

  function handleCustomPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    applyPreset(preset.settings);
    applyGlobalToAll();
  }

  async function handleSaveCurrent() {
    const name = window.prompt(t('presets.namePrompt'));
    if (name && name.trim()) await savePreset(name.trim());
  }

  return (
    <div className="preset-bar">
      <h3>{t('presets.title')}</h3>
      <div className="preset-bar__grid">
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="preset-chip"
            onClick={() => handleQuickPreset(preset.settings)}
            title={t(preset.descriptionKey)}
          >
            <span className="preset-chip__icon" aria-hidden="true">
              {preset.icon}
            </span>
            <span className="preset-chip__label">{t(preset.labelKey)}</span>
          </button>
        ))}
      </div>

      {presets.length > 0 && (
        <>
          <h4>{t('presets.customTitle')}</h4>
          <div className="preset-bar__grid">
            {presets.map((preset) => (
              <div key={preset.id} className="preset-chip preset-chip--custom">
                <button type="button" className="preset-chip__label" onClick={() => handleCustomPreset(preset.id)}>
                  {preset.name}
                </button>
                <button type="button" className="preset-chip__delete" onClick={() => void deletePreset(preset.id)} aria-label={t('presets.delete')}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" className="button button--ghost" onClick={() => void handleSaveCurrent()}>
        {t('presets.saveCurrent')}
      </button>
    </div>
  );
}
