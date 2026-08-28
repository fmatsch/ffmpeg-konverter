import type { AppSettings, JobUpdatePayload, MediaInfo, Preset, StartQueueRequest } from './types';

export interface ConverterApi {
  selectInputFiles: () => Promise<string[]>;
  selectOutputDir: () => Promise<string | null>;
  probeFile: (path: string) => Promise<MediaInfo>;

  startQueue: (request: StartQueueRequest) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;

  onJobUpdate: (callback: (payload: JobUpdatePayload) => void) => () => void;
  onLanguageChanged: (callback: (lang: AppSettings['language']) => void) => () => void;

  getAppSettings: () => Promise<AppSettings>;
  setAppSettings: (settings: AppSettings) => Promise<void>;

  getPresets: () => Promise<Preset[]>;
  savePreset: (preset: Omit<Preset, 'id' | 'builtIn'>) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;

  openPath: (path: string) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
}
