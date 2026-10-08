import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { probeFile } from './probe';
import { ConversionQueue, type QueueJobInput } from './ffmpeg';
import { resolveOutputPath } from './outputPath';
import { FolderWatcher } from './watcher';
import { MEDIA_EXTENSIONS } from '@shared/watch';
import { getAppSettings, setAppSettings, getCustomPresets, saveCustomPreset, deleteCustomPreset } from './store';
import type { AppSettings, JobUpdatePayload, Preset, StartQueueRequest } from '@shared/types';

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): { queue: ConversionQueue; watcher: FolderWatcher } {
  const queue = new ConversionQueue();
  const watcher = new FolderWatcher(queue, getWindow);

  queue.on('update', (payload: JobUpdatePayload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.jobUpdate, payload);
    }
  });

  ipcMain.handle(IPC.selectInputFiles, async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Medien', extensions: MEDIA_EXTENSIONS },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle(IPC.selectOutputDir, async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.probeFile, async (_event, filePath: string) => {
    return probeFile(filePath);
  });

  ipcMain.handle(IPC.startQueue, async (_event, request: StartQueueRequest) => {
    queue.setConcurrency(request.concurrency);
    const resolvedJobs: QueueJobInput[] = [];
    for (const job of request.jobs) {
      const { path: finalPath, skip } = resolveOutputPath(job.outputPath, request.onConflict);
      if (skip) {
        const win = getWindow();
        win?.webContents.send(IPC.jobUpdate, {
          id: job.id,
          status: 'skipped',
          error: 'Zieldatei existiert bereits.'
        } satisfies JobUpdatePayload);
        continue;
      }
      resolvedJobs.push({ ...job, outputPath: finalPath });
    }
    queue.enqueue(resolvedJobs);
  });

  ipcMain.handle(IPC.cancelJob, async (_event, id: string) => {
    queue.cancelJob(id);
  });

  ipcMain.handle(IPC.cancelAll, async () => {
    queue.cancelAll();
  });

  ipcMain.handle(IPC.pauseJob, async (_event, id: string) => {
    await queue.pauseJob(id);
  });

  ipcMain.handle(IPC.resumeJob, async (_event, id: string) => {
    await queue.resumeJob(id);
  });

  ipcMain.handle(IPC.getAppSettings, async () => getAppSettings());

  ipcMain.handle(IPC.setAppSettings, async (_event, settings: AppSettings) => {
    const previous = getAppSettings();
    setAppSettings(settings);
    watcher.configure(settings.watch, previous.watch, settings.concurrency);
  });

  ipcMain.handle(IPC.getPresets, async () => getCustomPresets());

  ipcMain.handle(IPC.savePreset, async (_event, preset: Omit<Preset, 'id' | 'builtIn'>) => {
    return saveCustomPreset(preset);
  });

  ipcMain.handle(IPC.deletePreset, async (_event, id: string) => {
    deleteCustomPreset(id);
  });

  ipcMain.handle(IPC.openPath, async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle(IPC.showItemInFolder, async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  return { queue, watcher };
}
