import { app } from 'electron';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { getFfmpegPath } from './ffmpegBinary';
import { buildAudioArgs, buildScaleFilter, buildVideoCodecArgs } from './buildArgs';
import { resolveVideoCodecCandidates } from './hardwareEncoders';
import { getFormat, VIDEO_CODECS } from '@shared/formats';
import { AI_UPSCALE_MODEL_SCALE } from '@shared/aiUpscale';
import type { JobSettings, MediaInfo } from '@shared/types';

export function getRealesrganPaths(): { binary: string; modelsDir: string } {
  const binaryName = process.platform === 'win32' ? 'realesrgan-ncnn-vulkan.exe' : 'realesrgan-ncnn-vulkan';
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'realesrgan')
    : path.join(app.getAppPath(), 'vendor', 'realesrgan');
  return { binary: path.join(base, binaryName), modelsDir: path.join(base, 'models') };
}

export function isAiUpscaleAvailable(): boolean {
  const { binary, modelsDir } = getRealesrganPaths();
  return existsSync(binary) && existsSync(path.join(modelsDir, 'realesrgan-x4plus.bin'));
}

export interface AiUpscaleJob {
  inputPath: string;
  outputPath: string;
  settings: JobSettings;
  durationSec: number;
}

export interface AiUpscaleProgress {
  phase: string;
  percent: number;
}

export interface AiUpscaleHandle {
  /** Wird vor jedem gestarteten Kindprozess aufgerufen, damit Pause/Abbrechen ihn erreichen kann. */
  registerProcess: (proc: ChildProcessWithoutNullStreams | null) => void;
  isCanceled: () => boolean;
}

class CanceledError extends Error {}

function parseProgressLine(chunk: string): number | undefined {
  let outTimeSec: number | undefined;
  for (const line of chunk.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key === 'out_time_ms') {
      const raw = Number(line.slice(idx + 1).trim());
      if (Number.isFinite(raw)) outTimeSec = raw / 1_000_000;
    }
  }
  return outTimeSec;
}

async function runFfmpegStage(
  args: string[],
  handle: AiUpscaleHandle,
  onPercent: (percent01: number) => void
): Promise<void> {
  if (handle.isCanceled()) throw new CanceledError();
  const proc = spawn(getFfmpegPath(), args, { windowsHide: true });
  handle.registerProcess(proc);

  let stdoutBuffer = '';
  let stderrTail = '';
  proc.stdout.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString('utf8');
    const chunks = stdoutBuffer.split('progress=');
    stdoutBuffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const outTimeSec = parseProgressLine(chunk);
      if (outTimeSec !== undefined) onPercent(outTimeSec);
    }
  });
  proc.stderr.on('data', (data: Buffer) => {
    stderrTail += data.toString('utf8');
    if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', resolve);
  });
  handle.registerProcess(null);

  if (handle.isCanceled()) throw new CanceledError();
  if (code !== 0) throw new Error(stderrTail.trim().split('\n').pop() || `FFmpeg-Schritt fehlgeschlagen (Code ${code}).`);
}

async function runRealesrganStage(
  framesInDir: string,
  framesOutDir: string,
  handle: AiUpscaleHandle,
  onPercent: (percent01: number) => void
): Promise<void> {
  if (handle.isCanceled()) throw new CanceledError();
  const { binary, modelsDir } = getRealesrganPaths();
  if (!existsSync(binary)) {
    throw new Error('Das KI-Upscaling-Modell wurde nicht gefunden. Bitte die App neu installieren.');
  }

  const totalFrames = (await readdir(framesInDir)).length;
  const proc = spawn(
    binary,
    ['-i', framesInDir, '-o', framesOutDir, '-n', 'realesrgan-x4plus', '-s', String(AI_UPSCALE_MODEL_SCALE), '-m', modelsDir, '-f', 'png'],
    { windowsHide: true }
  );
  handle.registerProcess(proc);

  let stderrTail = '';
  proc.stderr?.on('data', (data: Buffer) => {
    stderrTail += data.toString('utf8');
    if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);
  });

  const pollInterval = setInterval(() => {
    readdir(framesOutDir)
      .then((files) => onPercent(totalFrames > 0 ? files.length / totalFrames : 0))
      .catch(() => undefined);
  }, 700);

  const code = await new Promise<number | null>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', resolve);
  }).finally(() => clearInterval(pollInterval));
  handle.registerProcess(null);

  if (handle.isCanceled()) throw new CanceledError();
  if (code !== 0) throw new Error(stderrTail.trim().split('\n').pop() || `KI-Upscaling fehlgeschlagen (Code ${code}).`);
}

/**
 * Mehrstufige Pipeline für echtes KI-Upscaling: Frames extrahieren →
 * Real-ESRGAN (neuronales Netz, 4x) auf jedes Einzelbild anwenden → auf die
 * exakte Zielauflösung nachskalieren und mit Original-Audio neu zusammensetzen.
 * Deutlich langsamer als normale FFmpeg-Filter-Skalierung, dafür mit echter
 * Detailrekonstruktion statt reiner Interpolation.
 */
export async function runAiUpscalePipeline(
  job: AiUpscaleJob,
  mediaInfo: MediaInfo,
  onProgress: (progress: AiUpscaleProgress) => void,
  handle: AiUpscaleHandle
): Promise<'success' | 'canceled'> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'ffkonv-ai-'));
  const framesInDir = path.join(tempRoot, 'in');
  const framesOutDir = path.join(tempRoot, 'out');

  try {
    await mkdir(framesInDir, { recursive: true });
    await mkdir(framesOutDir, { recursive: true });

    const fps = settingsFps(job.settings, mediaInfo);

    // Phase 1: Frames extrahieren (0-10%)
    onProgress({ phase: 'ai.phase.extract', percent: 0 });
    const extractArgs = ['-y', '-i', job.inputPath, '-an'];
    if (job.settings.framerate !== 'original') extractArgs.push('-vf', `fps=${fps}`);
    extractArgs.push('-progress', 'pipe:1', '-nostats', path.join(framesInDir, 'frame_%06d.png'));
    await runFfmpegStage(extractArgs, handle, (outTimeSec) => {
      const percent01 = job.durationSec > 0 ? Math.min(1, Math.max(0, outTimeSec / job.durationSec)) : 0;
      onProgress({ phase: 'ai.phase.extract', percent: percent01 * 10 });
    });

    // Phase 2: KI-Upscaling pro Frame (10-85%)
    onProgress({ phase: 'ai.phase.upscale', percent: 10 });
    await runRealesrganStage(framesInDir, framesOutDir, handle, (percent01) => {
      onProgress({ phase: 'ai.phase.upscale', percent: 10 + percent01 * 75 });
    });

    // Phase 3: Zielauflösung + finaler Encode (85-100%)
    onProgress({ phase: 'ai.phase.encode', percent: 85 });
    await encodeUpscaledFrames(job, mediaInfo, framesOutDir, fps, handle, (outTimeSec) => {
      const percent01 = job.durationSec > 0 ? Math.min(1, Math.max(0, outTimeSec / job.durationSec)) : 0;
      onProgress({ phase: 'ai.phase.encode', percent: 85 + percent01 * 15 });
    });

    return 'success';
  } catch (error) {
    if (error instanceof CanceledError) return 'canceled';
    throw error;
  } finally {
    handle.registerProcess(null);
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function settingsFps(settings: JobSettings, mediaInfo: MediaInfo): number {
  if (settings.framerate !== 'original') return settings.framerate;
  return mediaInfo.fps && mediaInfo.fps > 0 ? mediaInfo.fps : 30;
}

async function encodeUpscaledFrames(
  job: AiUpscaleJob,
  mediaInfo: MediaInfo,
  framesOutDir: string,
  fps: number,
  handle: AiUpscaleHandle,
  onPercent: (outTimeSec: number) => void
): Promise<void> {
  const format = getFormat(job.settings.formatKey);
  const hasAudio = mediaInfo.hasAudio && !job.settings.audio.mute && format.defaultAudioCodec !== 'none';
  const softwareCodec = VIDEO_CODECS[job.settings.videoCodec as keyof typeof VIDEO_CODECS];
  const candidates = resolveVideoCodecCandidates(softwareCodec.ffmpegCodec, job.settings.videoCodec, job.settings.hardwareAcceleration);

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    if (handle.isCanceled()) throw new CanceledError();
    const args = ['-y', '-framerate', String(fps), '-i', path.join(framesOutDir, 'frame_%06d.png')];
    if (hasAudio) args.push('-i', job.inputPath);
    args.push('-map', '0:v');
    if (hasAudio) args.push('-map', '1:a');
    args.push(...buildVideoCodecArgs(job.settings, candidate));
    const scaleFilter = buildScaleFilter(job.settings);
    if (scaleFilter) args.push('-vf', scaleFilter);
    args.push(...buildAudioArgs(job.settings, format));
    if (hasAudio) args.push('-shortest');
    if (format.muxer) args.push('-f', format.muxer);
    args.push('-progress', 'pipe:1', '-nostats', job.outputPath);

    try {
      await runFfmpegStage(args, handle, onPercent);
      return;
    } catch (error) {
      if (error instanceof CanceledError) throw error;
      lastError = error as Error;
    }
  }
  throw lastError ?? new Error('Encodierung fehlgeschlagen.');
}
