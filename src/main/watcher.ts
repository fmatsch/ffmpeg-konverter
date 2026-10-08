import { Notification, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { IPC } from '@shared/ipcChannels';
import { getFormat } from '@shared/formats';
import { MEDIA_EXTENSIONS, WATCH_OUTPUT_SUBFOLDER } from '@shared/watch';
import type { Job, JobUpdatePayload, WatchSettings } from '@shared/types';
import type { ConversionQueue } from './ffmpeg';
import { probeFile } from './probe';
import { resolveOutputPath } from './outputPath';
import { getWatchProcessed, setWatchProcessed } from './store';

const POLL_INTERVAL_MS = 2000;
const MEDIA_EXTENSION_SET = new Set(MEDIA_EXTENSIONS);

interface FileSignature {
  size: number;
  mtimeMs: number;
}

// Beobachtet einen Ordner per Polling (plattformübergreifend zuverlässiger als
// fs.watch, v. a. bei Netzlaufwerken und Kopiervorgängen). Eine Datei gilt erst
// als "fertig", wenn Größe und Änderungszeit über zwei Durchläufe gleich
// geblieben sind – so werden halb kopierte oder gerade ladende Dateien nicht
// zu früh angefasst. Die Ausgabe landet standardmäßig in einem Unterordner und
// wird nie rekursiv gescannt, damit Ergebnisse nicht erneut konvertiert werden.
export class FolderWatcher {
  private config: WatchSettings | null = null;
  private concurrency = 1;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private seen = new Map<string, FileSignature>();
  private processed: Set<string>;
  private ownOutputs = new Set<string>();
  private watchJobs = new Map<string, string>();

  constructor(
    private readonly queue: ConversionQueue,
    private readonly getWindow: () => BrowserWindow | null
  ) {
    this.processed = new Set(getWatchProcessed());
    queue.on('update', (payload: JobUpdatePayload) => this.onQueueUpdate(payload));
  }

  configure(next: WatchSettings, previous: WatchSettings | null, concurrency: number): void {
    this.concurrency = concurrency;
    this.config = next;

    const shouldRun = next.enabled && Boolean(next.folder);
    if (!shouldRun) {
      this.stop();
      return;
    }

    const justActivated = !previous || !previous.enabled || previous.folder !== next.folder;
    if (this.timer && !justActivated) return;

    this.stop();
    this.seen.clear();
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    if (previous && justActivated) {
      // Beim (Neu-)Aktivieren im laufenden Betrieb gilt der aktuelle Ordnerinhalt als "bereits vorhanden".
      void this.snapshotExisting(next);
    } else {
      void this.tick();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async snapshotExisting(config: WatchSettings): Promise<void> {
    if (config.folder) {
      for (const file of await this.listMediaFiles(config.folder)) {
        const signature = await this.signatureOf(file);
        if (!signature) continue;
        if (config.processExisting) {
          this.processed.delete(`i:${this.keyOf(file, signature)}`);
        } else if (!this.isProcessed(file, signature)) {
          this.processed.add(`i:${this.keyOf(file, signature)}`);
        }
      }
      this.persistProcessed();
    }
    void this.tick();
  }

  private async listMediaFiles(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => null);
    if (!entries) return [];
    return entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .filter((e) => MEDIA_EXTENSION_SET.has(path.extname(e.name).slice(1).toLowerCase()))
      .map((e) => path.join(folder, e.name));
  }

  private async signatureOf(file: string): Promise<FileSignature | null> {
    const info = await stat(file).catch(() => null);
    return info ? { size: info.size, mtimeMs: Math.floor(info.mtimeMs) } : null;
  }

  private keyOf(file: string, signature: FileSignature): string {
    return `${file}|${signature.size}|${signature.mtimeMs}`;
  }

  // "i:" = beim Aktivieren bewusst ignoriert, "c:" = konvertiert. Ignorierte
  // Dateien können später (Option "vorhandene Dateien konvertieren") doch noch
  // dran kommen, bereits konvertierte nie ein zweites Mal.
  private markProcessed(file: string, signature: FileSignature, kind: 'i' | 'c'): void {
    this.processed.add(`${kind}:${this.keyOf(file, signature)}`);
    this.persistProcessed();
  }

  private isProcessed(file: string, signature: FileSignature): boolean {
    const key = this.keyOf(file, signature);
    return this.processed.has(`c:${key}`) || this.processed.has(`i:${key}`);
  }

  private persistProcessed(): void {
    setWatchProcessed([...this.processed]);
  }

  private async tick(): Promise<void> {
    const config = this.config;
    if (this.busy || !config || !config.enabled || !config.folder) return;
    this.busy = true;
    try {
      const files = await this.listMediaFiles(config.folder);
      const present = new Set(files);
      for (const known of this.seen.keys()) if (!present.has(known)) this.seen.delete(known);

      for (const file of files) {
        if (this.ownOutputs.has(file)) continue;
        const signature = await this.signatureOf(file);
        if (!signature || signature.size === 0) continue;
        if (this.isProcessed(file, signature)) continue;

        const previous = this.seen.get(file);
        if (!previous || previous.size !== signature.size || previous.mtimeMs !== signature.mtimeMs) {
          this.seen.set(file, signature);
          continue;
        }

        this.seen.delete(file);
        this.markProcessed(file, signature, 'c');
        await this.handleFile(file, config);
      }
    } finally {
      this.busy = false;
    }
  }

  private outputDirFor(config: WatchSettings): string {
    const folder = config.folder as string;
    if (config.outputMode === 'custom' && config.customOutputDir && path.resolve(config.customOutputDir) !== path.resolve(folder)) {
      return config.customOutputDir;
    }
    return path.join(folder, WATCH_OUTPUT_SUBFOLDER);
  }

  private async handleFile(file: string, config: WatchSettings): Promise<void> {
    const format = getFormat(config.settings.formatKey);
    const stem = path.basename(file, path.extname(file));
    const desired = path.join(this.outputDirFor(config), `${stem}.${format.extension}`);
    const { path: outputPath } = resolveOutputPath(desired, 'rename');
    this.ownOutputs.add(outputPath);

    const job: Job = {
      id: randomUUID(),
      inputPath: file,
      inputName: path.basename(file),
      outputPath,
      outputDir: path.dirname(outputPath),
      settings: structuredClone(config.settings),
      status: 'queued',
      progress: { percent: 0, outTimeSec: 0, speed: null, etaSec: null, fps: null, phase: null },
      mediaInfo: null,
      error: null
    };

    try {
      job.mediaInfo = await probeFile(file);
    } catch (error) {
      job.status = 'error';
      job.error = (error as Error).message;
      this.sendToWindow(job);
      return;
    }

    this.sendToWindow(job);
    this.watchJobs.set(job.id, job.inputName);
    this.queue.setConcurrency(this.concurrency);
    this.queue.enqueue([
      {
        id: job.id,
        inputPath: job.inputPath,
        outputPath: job.outputPath,
        settings: job.settings,
        durationSec: job.mediaInfo.durationSec,
        mediaInfo: job.mediaInfo
      }
    ]);
  }

  private sendToWindow(job: Job): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(IPC.watchJobAdded, job);
  }

  private onQueueUpdate(payload: JobUpdatePayload): void {
    const name = this.watchJobs.get(payload.id);
    if (!name || !payload.status) return;
    if (payload.status === 'done') {
      this.watchJobs.delete(payload.id);
      if (Notification.isSupported()) new Notification({ title: 'FFmpeg Konverter', body: `✓ ${name}`, silent: true }).show();
    } else if (payload.status === 'error' || payload.status === 'canceled') {
      this.watchJobs.delete(payload.id);
    }
  }
}
