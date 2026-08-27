import { useCallback, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useConverterStore } from '../state/store';

export function Dropzone() {
  const { t } = useTranslation();
  const addFiles = useConverterStore((s) => s.addFiles);
  const [isDragging, setIsDragging] = useState(false);

  const handleBrowse = useCallback(async () => {
    const paths = await window.api.selectInputFiles();
    if (paths.length > 0) void addFiles(paths);
  }, [addFiles]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const paths = Array.from(e.dataTransfer.files)
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) void addFiles(paths);
    },
    [addFiles]
  );

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => void handleBrowse()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') void handleBrowse();
      }}
    >
      <div className="dropzone__icon" aria-hidden="true">
        ⬆
      </div>
      <div className="dropzone__title">{t('dropzone.title')}</div>
      <div className="dropzone__subtitle">{t('dropzone.subtitle')}</div>
      <button
        type="button"
        className="button button--primary"
        onClick={(e) => {
          e.stopPropagation();
          void handleBrowse();
        }}
      >
        {t('dropzone.button')}
      </button>
    </div>
  );
}
