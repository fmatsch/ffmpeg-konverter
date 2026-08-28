import { useTranslation } from 'react-i18next';
import {
  ALL_FORMATS,
  AUDIO_CODECS,
  AUDIO_SAMPLE_RATES,
  RESOLUTION_PRESETS,
  SCALE_ALGORITHMS,
  VIDEO_CODECS,
  getFormat
} from '@shared/formats';
import type { AudioCodecKey, VideoCodecKey } from '@shared/formats';
import type { JobSettings, MediaInfo } from '@shared/types';
import { isAiUpscaleApplicable } from '@shared/aiUpscale';

const FRAMERATE_OPTIONS = [24, 25, 30, 50, 60];

interface SettingsPanelProps {
  settings: JobSettings;
  onChange: (settings: JobSettings) => void;
  mediaInfo?: MediaInfo | null;
  compact?: boolean;
}

export function SettingsPanel({ settings, onChange, mediaInfo, compact }: SettingsPanelProps) {
  const { t } = useTranslation();
  const format = getFormat(settings.formatKey);
  const isVideoFormat = format.kind === 'video';
  const isImageFormat = format.kind === 'image';
  const showVideoSection = isVideoFormat || isImageFormat;
  const showResolutionFramerate = isImageFormat || (isVideoFormat && settings.videoCodec !== 'copy');
  const showAudioSection = format.audioCodecs.some((c) => c !== 'none');

  function handleFormatChange(formatKey: string) {
    const nextFormat = getFormat(formatKey);
    const nextVideoCodec: VideoCodecKey = nextFormat.defaultVideoCodec ?? 'copy';
    const nextAudioCodec: AudioCodecKey = nextFormat.defaultAudioCodec;
    const nextAudioDefaults =
      nextAudioCodec !== 'copy' && nextAudioCodec !== 'none' ? AUDIO_CODECS[nextAudioCodec] : undefined;
    onChange({
      ...settings,
      formatKey,
      videoCodec: nextVideoCodec,
      audio: {
        ...settings.audio,
        codec: nextAudioCodec,
        bitrateKbps: nextAudioDefaults?.defaultBitrateKbps ?? settings.audio.bitrateKbps,
        mute: nextFormat.allowMuteAudio ? settings.audio.mute : false
      }
    });
  }

  function handleVideoCodecChange(codec: VideoCodecKey) {
    const defaults = codec !== 'copy' ? VIDEO_CODECS[codec] : undefined;
    onChange({
      ...settings,
      videoCodec: codec,
      quality: defaults
        ? { mode: defaults.supportsCrf ? settings.quality.mode : 'bitrate', crf: defaults.defaultCrf ?? 23, bitrateKbps: defaults.defaultBitrateKbps }
        : settings.quality
    });
  }

  function handleAudioCodecChange(codec: AudioCodecKey) {
    const defaults = codec !== 'copy' && codec !== 'none' ? AUDIO_CODECS[codec] : undefined;
    onChange({
      ...settings,
      audio: { ...settings.audio, codec, bitrateKbps: defaults?.defaultBitrateKbps ?? settings.audio.bitrateKbps }
    });
  }

  const activeVideoCodecDef =
    settings.videoCodec !== 'copy' ? VIDEO_CODECS[settings.videoCodec as keyof typeof VIDEO_CODECS] : null;
  const activeAudioCodecDef =
    settings.audio.codec !== 'copy' && settings.audio.codec !== 'none'
      ? AUDIO_CODECS[settings.audio.codec as keyof typeof AUDIO_CODECS]
      : null;
  const supportsHardwareAccel = settings.videoCodec === 'h264' || settings.videoCodec === 'h265';
  const aiUpscaleWontApply = settings.aiUpscale.enabled && mediaInfo ? !isAiUpscaleApplicable(settings, mediaInfo) : false;

  return (
    <div className={`settings-panel ${compact ? 'settings-panel--compact' : ''}`}>
      <div className="field">
        <label>{t('settings.format')}</label>
        <select value={settings.formatKey} onChange={(e) => handleFormatChange(e.target.value)}>
          <optgroup label="Video">
            {ALL_FORMATS.filter((f) => f.kind !== 'audio').map((f) => (
              <option key={f.key} value={f.key}>
                {t(f.labelKey)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Audio">
            {ALL_FORMATS.filter((f) => f.kind === 'audio').map((f) => (
              <option key={f.key} value={f.key}>
                {t(f.labelKey)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {showVideoSection && !isImageFormat && (
        <div className="field">
          <label>{t('settings.videoCodec')}</label>
          <select value={settings.videoCodec} onChange={(e) => handleVideoCodecChange(e.target.value as VideoCodecKey)}>
            {(format.videoCodecs ?? []).map((c) =>
              c === 'copy' ? (
                <option key="copy" value="copy">
                  {t('codec.copy')}
                </option>
              ) : (
                <option key={c} value={c}>
                  {t(VIDEO_CODECS[c].labelKey)}
                </option>
              )
            )}
          </select>
        </div>
      )}

      {supportsHardwareAccel && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.hardwareAcceleration}
            onChange={(e) => onChange({ ...settings, hardwareAcceleration: e.target.checked })}
          />
          {t('settings.hardwareAcceleration')}
        </label>
      )}
      {supportsHardwareAccel && settings.hardwareAcceleration && (
        <p className="hint">{t('settings.hardwareAccelerationHint')}</p>
      )}

      {activeVideoCodecDef && (
        <div className="field-row">
          <div className="field">
            <label>{t('settings.quality')}</label>
            <select
              value={settings.quality.mode}
              onChange={(e) => onChange({ ...settings, quality: { ...settings.quality, mode: e.target.value as 'crf' | 'bitrate' } })}
            >
              {activeVideoCodecDef.supportsCrf && <option value="crf">{t('settings.qualityMode.crf')}</option>}
              <option value="bitrate">{t('settings.qualityMode.bitrate')}</option>
            </select>
          </div>
          {settings.quality.mode === 'crf' ? (
            <div className="field field--grow">
              <label>
                {t('settings.crf')}: {settings.quality.crf}
              </label>
              <input
                type="range"
                min={activeVideoCodecDef.crfRange?.[0] ?? 0}
                max={activeVideoCodecDef.crfRange?.[1] ?? 51}
                value={settings.quality.crf}
                onChange={(e) => onChange({ ...settings, quality: { ...settings.quality, crf: Number(e.target.value) } })}
              />
            </div>
          ) : (
            <div className="field">
              <label>{t('settings.bitrate')}</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={settings.quality.bitrateKbps}
                  onChange={(e) => onChange({ ...settings, quality: { ...settings.quality, bitrateKbps: Number(e.target.value) } })}
                />
                <span>kbps</span>
              </div>
            </div>
          )}
        </div>
      )}

      {showResolutionFramerate && (
        <>
          <div className="field-row">
            <div className="field">
              <label>{t('settings.resolution')}</label>
              <select
                value={settings.resolution.mode === 'custom' ? 'custom' : settings.resolution.presetKey}
                onChange={(e) => {
                  const key = e.target.value;
                  if (key === 'custom') {
                    onChange({ ...settings, resolution: { ...settings.resolution, mode: 'custom' } });
                  } else {
                    onChange({ ...settings, resolution: { ...settings.resolution, mode: 'preset', presetKey: key } });
                  }
                }}
              >
                {RESOLUTION_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.resolution.keepAspectRatio}
                onChange={(e) => onChange({ ...settings, resolution: { ...settings.resolution, keepAspectRatio: e.target.checked } })}
              />
              {t('settings.keepAspectRatio')}
            </label>
          </div>

          {settings.resolution.mode === 'custom' && (
            <div className="field-row">
              <div className="field">
                <label>{t('settings.customWidth')}</label>
                <input
                  type="number"
                  min={2}
                  value={settings.resolution.width}
                  onChange={(e) => onChange({ ...settings, resolution: { ...settings.resolution, width: Number(e.target.value) } })}
                />
              </div>
              <div className="field">
                <label>{t('settings.customHeight')}</label>
                <input
                  type="number"
                  min={2}
                  value={settings.resolution.height}
                  onChange={(e) => onChange({ ...settings, resolution: { ...settings.resolution, height: Number(e.target.value) } })}
                />
              </div>
            </div>
          )}

          {settings.resolution.mode !== 'preset' || settings.resolution.presetKey !== 'original' ? (
            <div className="field">
              <label>{t('settings.scaleAlgorithm')}</label>
              <select
                value={settings.resolution.algorithm}
                onChange={(e) => onChange({ ...settings, resolution: { ...settings.resolution, algorithm: e.target.value as JobSettings['resolution']['algorithm'] } })}
              >
                {SCALE_ALGORITHMS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {t(a.labelKey)}
                  </option>
                ))}
              </select>
              {mediaInfo?.width && mediaInfo.height ? <p className="hint">{t('settings.upscaleHint')}</p> : null}
            </div>
          ) : null}

          {!isImageFormat && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.aiUpscale.enabled}
                  onChange={(e) => onChange({ ...settings, aiUpscale: { enabled: e.target.checked } })}
                />
                {t('settings.aiUpscale')}
              </label>
              <p className="hint">{aiUpscaleWontApply ? t('settings.aiUpscaleNotApplicable') : t('settings.aiUpscaleHint')}</p>
            </>
          )}

          <div className="field">
            <label>{t('settings.framerate')}</label>
            <select
              value={String(settings.framerate)}
              onChange={(e) => onChange({ ...settings, framerate: e.target.value === 'original' ? 'original' : Number(e.target.value) })}
            >
              <option value="original">{t('settings.framerateOriginal')}</option>
              {FRAMERATE_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {showAudioSection && (
        <>
          <div className="field">
            <label>{t('settings.audioCodec')}</label>
            <select value={settings.audio.codec} onChange={(e) => handleAudioCodecChange(e.target.value as AudioCodecKey)}>
              {format.audioCodecs.map((c) =>
                c === 'copy' || c === 'none' ? (
                  <option key={c} value={c}>
                    {t(c === 'copy' ? 'codec.copy' : 'settings.mute')}
                  </option>
                ) : (
                  <option key={c} value={c}>
                    {t(AUDIO_CODECS[c].labelKey)}
                  </option>
                )
              )}
            </select>
          </div>

          {activeAudioCodecDef && !activeAudioCodecDef.lossless && (
            <div className="field">
              <label>{t('settings.audioBitrate')}</label>
              <select
                value={settings.audio.bitrateKbps}
                onChange={(e) => onChange({ ...settings, audio: { ...settings.audio, bitrateKbps: Number(e.target.value) } })}
              >
                {(activeAudioCodecDef.bitrateOptionsKbps ?? [128]).map((kb) => (
                  <option key={kb} value={kb}>
                    {kb} kbps
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>{t('settings.sampleRate')}</label>
              <select
                value={String(settings.audio.sampleRate)}
                onChange={(e) => onChange({ ...settings, audio: { ...settings.audio, sampleRate: e.target.value === 'original' ? 'original' : Number(e.target.value) } })}
              >
                <option value="original">{t('settings.sampleRateOriginal')}</option>
                {AUDIO_SAMPLE_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {(rate / 1000).toFixed(1)} kHz
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('settings.channels')}</label>
              <select
                value={settings.audio.channels}
                onChange={(e) => onChange({ ...settings, audio: { ...settings.audio, channels: e.target.value as JobSettings['audio']['channels'] } })}
              >
                <option value="original">{t('settings.channelsOriginal')}</option>
                <option value="stereo">{t('settings.channelsStereo')}</option>
                <option value="mono">{t('settings.channelsMono')}</option>
              </select>
            </div>
          </div>

          {format.allowMuteAudio && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.audio.mute}
                onChange={(e) => onChange({ ...settings, audio: { ...settings.audio, mute: e.target.checked } })}
              />
              {t('settings.mute')}
            </label>
          )}
        </>
      )}
    </div>
  );
}
