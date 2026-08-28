import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { IPC } from '@shared/ipcChannels';
import { probeFile } from './probe';
import { ConversionQueue, type QueueJobInput } from './ffmpeg';
import { getAppSettings, setAppSettings, getCustomPresets, saveCustomPreset, deleteCustomPreset } from './store';
import type { AppSettings, JobUpdatePayload, Preset, StartQueueRequest } from '@shared/types';

function resolveOutputPath(
  desiredPath: string,
  onConflict: StartQueueRequest['onConflict']
): { path: string; skip: boolean } {
  if (!existsSync(desiredPath)) return { path: desiredPath, skip: false };
  if (onConflict === 'overwrite') return { path: desiredPath, skip: false };
  if (onConflict === 'skip') return { path: desiredPath, skip: true };

  const dir = path.dirname(desiredPath);
  const ext = path.extname(desiredPath);
  const base = path.basename(desiredPath, ext);
  let n = 1;
  let candidate = path.join(dir, `${base} (${n})${ext}`);
  while (existsSync(candidate)) {
    n += 1;
    candidate = path.join(dir, `${base} (${n})${ext}`);
  }
  return { path: candidate, skip: false };
}

const MEDIA_EXTENSIONS = [
  'mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'wmv', 'mxf', 'm4v', 'ts', '3gp',
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff'
];

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): ConversionQueue {
  const queue = new ConversionQueue();

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
    setAppSettings(settings);
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

  return queue;
}
