import { useTranslation } from 'react-i18next';
import { useConverterStore } from '../state/store';
import { QueueItem } from './QueueItem';

export function Queue() {
  const { t } = useTranslation();
  const jobs = useConverterStore((s) => s.jobs);
  const clearFinished = useConverterStore((s) => s.clearFinished);

  const hasFinished = jobs.some((j) => ['done', 'error', 'canceled', 'skipped'].includes(j.status));

  if (jobs.length === 0) {
    return <p className="queue-empty">{t('queue.empty')}</p>;
  }

  return (
    <div className="queue">
      <ul className="queue__list">
        {jobs.map((job) => (
          <QueueItem key={job.id} job={job} />
        ))}
      </ul>
      {hasFinished && (
        <button type="button" className="button button--ghost" onClick={clearFinished}>
          {t('queue.clearFinished')}
        </button>
      )}
    </div>
  );
}
