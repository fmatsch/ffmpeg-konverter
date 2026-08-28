import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type { AppSettings, JobUpdatePayload, MediaInfo, Preset, StartQueueRequest } from '@shared/types';
import type { ConverterApi } from '@shared/api';

const api: ConverterApi = {
  selectInputFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.selectInputFiles),
  selectOutputDir: (): Promise<string | null> => ipcRenderer.invoke(IPC.selectOutputDir),
  probeFile: (path: string): Promise<MediaInfo> => ipcRenderer.invoke(IPC.probeFile, path),

  startQueue: (request: StartQueueRequest): Promise<void> => ipcRenderer.invoke(IPC.startQueue, request),
  cancelJob: (id: string): Promise<void> => ipcRenderer.invoke(IPC.cancelJob, id),
  cancelAll: (): Promise<void> => ipcRenderer.invoke(IPC.cancelAll),
  pauseJob: (id: string): Promise<void> => ipcRenderer.invoke(IPC.pauseJob, id),
  resumeJob: (id: string): Promise<void> => ipcRenderer.invoke(IPC.resumeJob, id),

  onJobUpdate: (callback: (payload: JobUpdatePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: JobUpdatePayload) => callback(payload);
    ipcRenderer.on(IPC.jobUpdate, listener);
    return () => ipcRenderer.removeListener(IPC.jobUpdate, listener);
  },

  onLanguageChanged: (callback: (lang: AppSettings['language']) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, lang: AppSettings['language']) => callback(lang);
    ipcRenderer.on(IPC.languageChanged, listener);
    return () => ipcRenderer.removeListener(IPC.languageChanged, listener);
  },

  getAppSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.getAppSettings),
  setAppSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke(IPC.setAppSettings, settings),

  getPresets: (): Promise<Preset[]> => ipcRenderer.invoke(IPC.getPresets),
  savePreset: (preset: Omit<Preset, 'id' | 'builtIn'>): Promise<Preset> => ipcRenderer.invoke(IPC.savePreset, preset),
  deletePreset: (id: string): Promise<void> => ipcRenderer.invoke(IPC.deletePreset, id),

  openPath: (path: string): Promise<void> => ipcRenderer.invoke(IPC.openPath, path),
  showItemInFolder: (path: string): Promise<void> => ipcRenderer.invoke(IPC.showItemInFolder, path)
};

contextBridge.exposeInMainWorld('api', api);
