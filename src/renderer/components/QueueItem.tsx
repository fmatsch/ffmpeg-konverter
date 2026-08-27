import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormat, RESOLUTION_PRESETS, VIDEO_CODECS } from '@shared/formats';
import type { Job } from '@shared/types';
import { useConverterStore } from '../state/store';
import { formatDuration, formatSpeed } from '../utils/format';
import { SettingsPanel } from './SettingsPanel';

const ACTIVE_STATUSES: Job['status'][] = ['queued', 'running'];
const FINISHED_STATUSES: Job['status'][] = ['done', 'error', 'canceled', 'skipped'];

function summarize(job: Job, t: (key: string) => string): string {
  const format = getFormat(job.settings.formatKey);
  const parts = [t(format.labelKey)];
  if (format.kind !== 'audio' && job.settings.videoCodec !== 'copy') {
    parts.push(t(VIDEO_CODECS[job.settings.videoCodec as keyof typeof VIDEO_CODECS].labelKey));
  }
  if (format.kind !== 'audio') {
    const res = job.settings.resolution;
    if (res.mode === 'preset' && res.presetKey !== 'original') {
      const preset = RESOLUTION_PRESETS.find((p) => p.key === res.presetKey);
      if (preset) parts.push(t(preset.labelKey));
    } else if (res.mode === 'custom') {
      parts.push(`${res.width}×${res.height}`);
    }
  }
  return parts.join(' · ');
}

export function QueueItem({ job }: { job: Job }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const removeJob = useConverterStore((s) => s.removeJob);
  const cancelJob = useConverterStore((s) => s.cancelJob);
  const updateJobSettings = useConverterStore((s) => s.updateJobSettings);

  const isActive = ACTIVE_STATUSES.includes(job.status);
  const isFinished = FINISHED_STATUSES.includes(job.status);
  const percent = Math.min(100, Math.max(0, job.progress.percent));

  return (
    <li className={`queue-item queue-item--${job.status}`}>
      <div className="queue-item__row">
        <div className="queue-item__main">
          <div className="queue-item__name" title={job.inputPath}>
            {job.inputName}
          </div>
          <div className="queue-item__meta">
            <span className={`status-badge status-badge--${job.status}`}>{t(`queue.status.${job.status}`)}</span>
            <span className="queue-item__summary">{summarize(job, t)}</span>
            {job.mediaInfo && <span className="queue-item__duration">{formatDuration(job.mediaInfo.durationSec)}</span>}
          </div>
          {isActive && (
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
            </div>
          )}
          {job.status === 'running' && (
            <div className="queue-item__stats">
              <span>{percent.toFixed(0)}%</span>
              <span>{formatSpeed(job.progress.speed)}</span>
              {job.progress.etaSec !== null && <span>{t('queue.eta', { time: formatDuration(job.progress.etaSec) })}</span>}
            </div>
          )}
          {job.status === 'error' && job.error && <div className="queue-item__error">{job.error}</div>}
        </div>

        <div className="queue-item__actions">
          {!isFinished && (
            <button type="button" className="button button--ghost" onClick={() => setExpanded((v) => !v)}>
              ⚙
            </button>
          )}
          {isActive && (
            <button type="button" className="button button--ghost" onClick={() => cancelJob(job.id)}>
              {t('queue.cancel')}
            </button>
          )}
          {job.status === 'done' && (
            <button type="button" className="button button--ghost" onClick={() => void window.api.showItemInFolder(job.outputPath)}>
              {t('queue.showInFolder')}
            </button>
          )}
          <button type="button" className="button button--ghost" onClick={() => removeJob(job.id)}>
            {t('queue.remove')}
          </button>
        </div>
      </div>

      {expanded && !isFinished && (
        <div className="queue-item__editor">
          <p className="hint">{t('settings.perFileOverride')}</p>
          <SettingsPanel
            settings={job.settings}
            onChange={(settings) => updateJobSettings(job.id, settings)}
            mediaInfo={job.mediaInfo}
            compact
          />
        </div>
      )}
    </li>
  );
}
