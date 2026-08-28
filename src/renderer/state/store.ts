import { create } from 'zustand';
import { getFormat } from '@shared/formats';
import { createDefaultAppSettings, createDefaultOutputOptions, createDefaultSettings } from '@shared/types';
import type { AppSettings, Job, JobSettings, JobUpdatePayload, OutputOptions, Preset } from '@shared/types';
import { basenameOf, dirnameOf, joinPath, stemOf } from '../utils/paths';

const FINISHED_STATUSES: Job['status'][] = ['done', 'error', 'canceled', 'skipped'];

function computeOutputPath(inputPath: string, settings: JobSettings, outputOptions: OutputOptions): string {
  const format = getFormat(settings.formatKey);
  const dir = outputOptions.mode === 'custom' && outputOptions.customDir ? outputOptions.customDir : dirnameOf(inputPath);
  const stem = stemOf(inputPath);
  const pattern = outputOptions.filenamePattern.trim() || '{name}_converted';
  const filename = `${pattern.replace('{name}', stem)}.${format.extension}`;
  return joinPath(dir, filename);
}

function createEmptyProgress(): Job['progress'] {
  return { percent: 0, outTimeSec: 0, speed: null, etaSec: null, fps: null, phase: null };
}

interface ConverterState {
  jobs: Job[];
  globalSettings: JobSettings;
  outputOptions: OutputOptions;
  appSettings: AppSettings;
  presets: Preset[];
  isStarting: boolean;
  ready: boolean;

  init: () => Promise<void>;
  addFiles: (paths: string[]) => Promise<void>;
  removeJob: (id: string) => void;
  clearFinished: () => void;
  updateJobSettings: (id: string, settings: JobSettings) => void;
  setGlobalSettings: (settings: JobSettings) => void;
  applyGlobalToAll: () => void;
  setOutputOptions: (options: OutputOptions) => void;
  startAll: () => Promise<void>;
  cancelJob: (id: string) => void;
  cancelAll: () => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  applyJobUpdate: (payload: JobUpdatePayload) => void;
  setLanguage: (lang: AppSettings['language']) => void;
  setConcurrency: (n: number) => void;
  savePreset: (name: string) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  applyPreset: (settings: JobSettings) => void;
}

function persistAppSettings(appSettings: AppSettings): void {
  void window.api.setAppSettings(appSettings);
}

export const useConverterStore = create<ConverterState>((set, get) => ({
  jobs: [],
  globalSettings: createDefaultSettings(),
  outputOptions: createDefaultOutputOptions(),
  appSettings: createDefaultAppSettings(),
  presets: [],
  isStarting: false,
  ready: false,

  init: async () => {
    const [appSettings, presets] = await Promise.all([window.api.getAppSettings(), window.api.getPresets()]);
    set({ appSettings, outputOptions: appSettings.output, presets, ready: true });
  },

  addFiles: async (paths) => {
    const { globalSettings, outputOptions } = get();
    const newJobs: Job[] = paths.map((p) => {
      const settings = structuredClone(globalSettings);
      return {
        id: crypto.randomUUID(),
        inputPath: p,
        inputName: basenameOf(p),
        outputPath: computeOutputPath(p, settings, outputOptions),
        outputDir: outputOptions.mode === 'custom' && outputOptions.customDir ? outputOptions.customDir : dirnameOf(p),
        settings,
        status: 'probing',
        progress: createEmptyProgress(),
        mediaInfo: null,
        error: null
      };
    });

    set((state) => ({ jobs: [...state.jobs, ...newJobs] }));

    await Promise.all(
      newJobs.map(async (job) => {
        try {
          const info = await window.api.probeFile(job.inputPath);
          set((state) => ({
            jobs: state.jobs.map((j) => (j.id === job.id ? { ...j, mediaInfo: info, status: 'pending' } : j))
          }));
        } catch (err) {
          set((state) => ({
            jobs: state.jobs.map((j) =>
              j.id === job.id ? { ...j, status: 'error', error: (err as Error).message } : j
            )
          }));
        }
      })
    );
  },

  removeJob: (id) => set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),

  clearFinished: () =>
    set((state) => ({ jobs: state.jobs.filter((j) => !FINISHED_STATUSES.includes(j.status)) })),

  updateJobSettings: (id, settings) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, settings, outputPath: computeOutputPath(j.inputPath, settings, state.outputOptions) } : j
      )
    })),

  setGlobalSettings: (settings) => set({ globalSettings: settings }),

  applyGlobalToAll: () =>
    set((state) => ({
      jobs: state.jobs.map((j) => {
        const settings = structuredClone(state.globalSettings);
        return { ...j, settings, outputPath: computeOutputPath(j.inputPath, settings, state.outputOptions) };
      })
    })),

  setOutputOptions: (options) =>
    set((state) => {
      const appSettings = { ...state.appSettings, output: options };
      persistAppSettings(appSettings);
      return {
        outputOptions: options,
        appSettings,
        jobs: state.jobs.map((j) => ({ ...j, outputPath: computeOutputPath(j.inputPath, j.settings, options) }))
      };
    }),

  startAll: async () => {
    const { jobs, appSettings, outputOptions } = get();
    const runnable = jobs.filter((j) => j.status === 'pending' || j.status === 'error');
    if (runnable.length === 0) return;

    set({ isStarting: true });
    set((state) => ({
      jobs: state.jobs.map((j) =>
        runnable.some((r) => r.id === j.id)
          ? { ...j, status: 'queued', error: null, progress: createEmptyProgress() }
          : j
      )
    }));

    try {
      await window.api.startQueue({
        jobs: runnable.map((j) => ({
          id: j.id,
          inputPath: j.inputPath,
          outputPath: j.outputPath,
          settings: j.settings,
          durationSec: j.mediaInfo?.durationSec ?? 0,
          mediaInfo: j.mediaInfo
        })),
        concurrency: appSettings.concurrency,
        onConflict: outputOptions.onConflict
      });
    } finally {
      set({ isStarting: false });
    }
  },

  cancelJob: (id) => {
    void window.api.cancelJob(id);
  },

  pauseJob: (id) => {
    void window.api.pauseJob(id);
  },

  resumeJob: (id) => {
    void window.api.resumeJob(id);
  },

  cancelAll: () => {
    void window.api.cancelAll();
  },

  applyJobUpdate: (payload) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === payload.id
          ? {
              ...j,
              status: payload.status ?? j.status,
              error: payload.error !== undefined ? payload.error : j.error,
              mediaInfo: payload.mediaInfo ?? j.mediaInfo,
              progress: payload.progress ? { ...j.progress, ...payload.progress } : j.progress
            }
          : j
      )
    })),

  setLanguage: (lang) =>
    set((state) => {
      const appSettings = { ...state.appSettings, language: lang };
      persistAppSettings(appSettings);
      return { appSettings };
    }),

  setConcurrency: (n) =>
    set((state) => {
      const appSettings = { ...state.appSettings, concurrency: n };
      persistAppSettings(appSettings);
      return { appSettings };
    }),

  savePreset: async (name) => {
    const preset = await window.api.savePreset({ name, settings: get().globalSettings });
    set((state) => ({ presets: [...state.presets, preset] }));
  },

  deletePreset: async (id) => {
    await window.api.deletePreset(id);
    set((state) => ({ presets: state.presets.filter((p) => p.id !== id) }));
  },

  applyPreset: (settings) => set({ globalSettings: structuredClone(settings) })
}));
