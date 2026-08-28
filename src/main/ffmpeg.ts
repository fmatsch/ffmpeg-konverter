import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getFfmpegPath } from './ffmpegBinary';
import { buildFfmpegArgs } from './buildArgs';
import { resolveVideoCodecCandidates } from './hardwareEncoders';
import { runAiUpscalePipeline } from './aiUpscale';
import { suspendProcess, resumeProcess } from './processControl';
import { getFormat, VIDEO_CODECS } from '@shared/formats';
import { isAiUpscaleApplicable } from '@shared/aiUpscale';
import type { JobSettings, JobUpdatePayload, MediaInfo } from '@shared/types';

export interface QueueJobInput {
  id: string;
  inputPath: string;
  outputPath: string;
  settings: JobSettings;
  durationSec: number;
  mediaInfo: MediaInfo | null;
}

interface RunningJob {
  process: ChildProcessWithoutNullStreams | null;
  canceled: boolean;
  paused: boolean;
}

function parseProgressChunk(chunk: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of chunk.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

export class ConversionQueue extends EventEmitter {
  private concurrency = 1;
  private pending: QueueJobInput[] = [];
  private running = new Map<string, RunningJob>();

  setConcurrency(value: number): void {
    this.concurrency = Math.max(1, Math.min(4, value));
  }

  enqueue(jobs: QueueJobInput[]): void {
    this.pending.push(...jobs);
    this.pump();
  }

  cancelJob(id: string): void {
    const job = this.running.get(id);
    if (job) {
      job.canceled = true;
      job.process?.kill('SIGKILL');
      return;
    }
    const idx = this.pending.findIndex((j) => j.id === id);
    if (idx !== -1) {
      this.pending.splice(idx, 1);
      this.emitUpdate({ id, status: 'canceled' });
    }
  }

  cancelAll(): void {
    this.pending = [];
    for (const job of this.running.values()) {
      job.canceled = true;
      job.process?.kill('SIGKILL');
    }
  }

  async pauseJob(id: string): Promise<void> {
    const job = this.running.get(id);
    if (!job || job.canceled) return;
    job.paused = true;
    if (job.process?.pid) await suspendProcess(job.process.pid);
    this.emitUpdate({ id, status: 'paused' });
  }

  async resumeJob(id: string): Promise<void> {
    const job = this.running.get(id);
    if (!job || job.canceled) return;
    job.paused = false;
    if (job.process?.pid) await resumeProcess(job.process.pid);
    this.emitUpdate({ id, status: 'running' });
  }

  private emitUpdate(payload: JobUpdatePayload): void {
    this.emit('update', payload);
  }

  private pump(): void {
    while (this.running.size < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (job) void this.runJob(job);
    }
  }

  private async runJob(job: QueueJobInput): Promise<void> {
    this.emitUpdate({ id: job.id, status: 'running' });
    try {
      await mkdir(dirname(job.outputPath), { recursive: true });
    } catch (error) {
      this.emitUpdate({ id: job.id, status: 'error', error: (error as Error).message });
      this.pump();
      return;
    }

    const runningEntry: RunningJob = { process: null, canceled: false, paused: false };
    this.running.set(job.id, runningEntry);

    const registerProcess = (proc: ChildProcessWithoutNullStreams | null): void => {
      runningEntry.process = proc;
      // Falls während einer Pause die nächste Pipeline-Stufe (KI-Upscaling
      // z. B.) startet, sofort wieder anhalten statt kurz weiterlaufen zu lassen.
      if (proc?.pid && runningEntry.paused) void suspendProcess(proc.pid);
    };

    try {
      const format = getFormat(job.settings.formatKey);
      if (format.kind === 'video' && isAiUpscaleApplicable(job.settings, job.mediaInfo) && job.mediaInfo) {
        const result = await runAiUpscalePipeline(
          { inputPath: job.inputPath, outputPath: job.outputPath, settings: job.settings, durationSec: job.durationSec },
          job.mediaInfo,
          (progress) => {
            this.emitUpdate({ id: job.id, progress: { percent: progress.percent, phase: progress.phase } });
          },
          { registerProcess, isCanceled: () => runningEntry.canceled }
        );
        this.running.delete(job.id);
        this.emitUpdate(
          result === 'canceled'
            ? { id: job.id, status: 'canceled' }
            : { id: job.id, status: 'done', progress: { percent: 100, phase: null } }
        );
      } else {
        await this.runSinglePass(job, runningEntry);
      }
    } catch (error) {
      this.running.delete(job.id);
      if (!runningEntry.canceled) {
        this.emitUpdate({ id: job.id, status: 'error', error: (error as Error).message });
      } else {
        this.emitUpdate({ id: job.id, status: 'canceled' });
      }
    }

    this.pump();
  }

  private async runSinglePass(job: QueueJobInput, runningEntry: RunningJob): Promise<void> {
    const format = getFormat(job.settings.formatKey);
    const candidates =
      format.kind === 'video' && job.settings.videoCodec !== 'copy'
        ? resolveVideoCodecCandidates(
            VIDEO_CODECS[job.settings.videoCodec as keyof typeof VIDEO_CODECS].ffmpegCodec,
            job.settings.videoCodec,
            job.settings.hardwareAcceleration
          )
        : [undefined];

    let lastError: string | null = null;
    for (const codecChoice of candidates) {
      if (runningEntry.canceled) return;
      const args = buildFfmpegArgs({
        inputPath: job.inputPath,
        outputPath: job.outputPath,
        settings: job.settings,
        codecChoice
      });

      const outcome = await this.spawnAttempt(job, args, runningEntry);
      if (outcome.status === 'success') {
        this.running.delete(job.id);
        this.emitUpdate({ id: job.id, status: 'done', progress: { percent: 100 } });
        return;
      }
      if (outcome.status === 'canceled') {
        this.running.delete(job.id);
        this.emitUpdate({ id: job.id, status: 'canceled' });
        return;
      }
      lastError = outcome.error;
      // Bei Fehlschlag (z. B. Hardware-Encoder ohne passende GPU) mit dem
      // nächsten Kandidaten weiterprobieren; der letzte Kandidat ist immer
      // der Software-Encoder als garantierter Fallback.
    }

    this.running.delete(job.id);
    this.emitUpdate({ id: job.id, status: 'error', error: lastError ?? 'Konvertierung fehlgeschlagen.' });
  }

  private spawnAttempt(
    job: QueueJobInput,
    args: string[],
    runningEntry: RunningJob
  ): Promise<{ status: 'success' } | { status: 'canceled' } | { status: 'failed'; error: string }> {
    return new Promise((resolve) => {
      const proc = spawn(getFfmpegPath(), args, { windowsHide: true });
      runningEntry.process = proc;
      if (runningEntry.paused && proc.pid) void suspendProcess(proc.pid);

      let stderrTail = '';
      let stdoutBuffer = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString('utf8');
        const chunks = stdoutBuffer.split('progress=');
        stdoutBuffer = chunks.pop() ?? '';
        for (const rawChunk of chunks) {
          this.handleProgressFields(job, parseProgressChunk(rawChunk));
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderrTail += data.toString('utf8');
        if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);
      });

      proc.on('error', (error) => {
        resolve({ status: 'failed', error: error.message });
      });

      proc.on('close', (code) => {
        if (runningEntry.canceled) {
          resolve({ status: 'canceled' });
        } else if (code === 0) {
          resolve({ status: 'success' });
        } else {
          resolve({ status: 'failed', error: extractFfmpegError(stderrTail) ?? `FFmpeg wurde mit Code ${code} beendet.` });
        }
      });
    });
  }

  private handleProgressFields(job: QueueJobInput, fields: Record<string, string>): void {
    const outTimeMs = fields['out_time_ms'] ? Number(fields['out_time_ms']) / 1000 : undefined;
    const outTimeSec = outTimeMs !== undefined && Number.isFinite(outTimeMs) ? outTimeMs / 1000 : undefined;
    const speedRaw = fields['speed'];
    const speed = speedRaw ? Number(speedRaw.replace('x', '')) : undefined;
    const fpsRaw = fields['fps'];
    const fps = fpsRaw ? Number(fpsRaw) : undefined;

    let percent: number | undefined;
    let etaSec: number | null | undefined;
    if (outTimeSec !== undefined && job.durationSec > 0) {
      percent = Math.min(100, Math.max(0, (outTimeSec / job.durationSec) * 100));
      if (speed && speed > 0) {
        etaSec = Math.max(0, (job.durationSec - outTimeSec) / speed);
      } else {
        etaSec = null;
      }
    }

    this.emitUpdate({
      id: job.id,
      progress: {
        ...(percent !== undefined ? { percent } : {}),
        ...(outTimeSec !== undefined ? { outTimeSec } : {}),
        ...(speed !== undefined && Number.isFinite(speed) ? { speed } : {}),
        ...(etaSec !== undefined ? { etaSec } : {}),
        ...(fps !== undefined && Number.isFinite(fps) ? { fps } : {})
      }
    });
  }
}

function extractFfmpegError(stderrTail: string): string | null {
  const lines = stderrTail
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const errorLine = [...lines].reverse().find((l) => /error|invalid|not found|permission denied/i.test(l));
  return errorLine ?? (lines.length > 0 ? lines[lines.length - 1] : null);
}
