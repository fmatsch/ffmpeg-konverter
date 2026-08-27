import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getFfmpegPath } from './ffmpegBinary';
import { buildFfmpegArgs } from './buildArgs';
import type { JobSettings, JobUpdatePayload } from '@shared/types';

export interface QueueJobInput {
  id: string;
  inputPath: string;
  outputPath: string;
  settings: JobSettings;
  durationSec: number;
}

interface RunningJob {
  process: ChildProcessWithoutNullStreams;
  canceled: boolean;
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
      job.process.kill();
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
    for (const [id, job] of this.running) {
      job.canceled = true;
      job.process.kill();
      void id;
    }
  }

  private emitUpdate(payload: JobUpdatePayload): void {
    this.emit('update', payload);
  }

  private pump(): void {
    while (this.running.size < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (job) this.runJob(job);
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

    const args = buildFfmpegArgs({ inputPath: job.inputPath, outputPath: job.outputPath, settings: job.settings });
    const proc = spawn(getFfmpegPath(), args, { windowsHide: true });
    const runningEntry: RunningJob = { process: proc, canceled: false };
    this.running.set(job.id, runningEntry);

    let stderrTail = '';
    let stdoutBuffer = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString('utf8');
      const chunks = stdoutBuffer.split('progress=');
      // Letztes (evtl. unvollständiges) Fragment für den nächsten Durchlauf aufheben.
      stdoutBuffer = chunks.pop() ?? '';
      for (const rawChunk of chunks) {
        const fields = parseProgressChunk(rawChunk);
        this.handleProgressFields(job, fields);
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderrTail += data.toString('utf8');
      if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);
    });

    proc.on('error', (error) => {
      this.emitUpdate({ id: job.id, status: 'error', error: error.message });
    });

    proc.on('close', (code) => {
      this.running.delete(job.id);
      if (runningEntry.canceled) {
        this.emitUpdate({ id: job.id, status: 'canceled' });
      } else if (code === 0) {
        this.emitUpdate({
          id: job.id,
          status: 'done',
          progress: { percent: 100 }
        });
      } else {
        const message = extractFfmpegError(stderrTail) ?? `FFmpeg wurde mit Code ${code} beendet.`;
        this.emitUpdate({ id: job.id, status: 'error', error: message });
      }
      this.pump();
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
