import type { AudioCodecKey, ScaleAlgorithm, VideoCodecKey } from './formats';

export type QualityMode = 'crf' | 'bitrate';

export interface QualitySettings {
  mode: QualityMode;
  crf: number;
  bitrateKbps: number;
}

export type ResolutionMode = 'preset' | 'custom';

export interface ResolutionSettings {
  mode: ResolutionMode;
  presetKey: string; // used when mode === 'preset'
  width: number; // used when mode === 'custom', or resolved value for preview
  height: number;
  keepAspectRatio: boolean;
  algorithm: ScaleAlgorithm;
}

export interface AudioSettings {
  codec: AudioCodecKey;
  bitrateKbps: number;
  sampleRate: 'original' | number;
  channels: 'original' | 'mono' | 'stereo';
  mute: boolean;
}

export interface AiUpscaleSettings {
  enabled: boolean;
}

export interface JobSettings {
  formatKey: string;
  videoCodec: VideoCodecKey;
  quality: QualitySettings;
  framerate: 'original' | number;
  resolution: ResolutionSettings;
  audio: AudioSettings;
  hardwareAcceleration: boolean;
  aiUpscale: AiUpscaleSettings;
}

export function createDefaultResolution(): ResolutionSettings {
  return {
    mode: 'preset',
    presetKey: 'original',
    width: 1920,
    height: 1080,
    keepAspectRatio: true,
    algorithm: 'lanczos'
  };
}

export function createDefaultAudio(): AudioSettings {
  return {
    codec: 'aac',
    bitrateKbps: 192,
    sampleRate: 'original',
    channels: 'original',
    mute: false
  };
}

export function createDefaultSettings(): JobSettings {
  return {
    formatKey: 'mp4',
    videoCodec: 'h264',
    quality: { mode: 'crf', crf: 23, bitrateKbps: 4000 },
    framerate: 'original',
    resolution: createDefaultResolution(),
    audio: createDefaultAudio(),
    hardwareAcceleration: false,
    aiUpscale: { enabled: false }
  };
}

export interface MediaInfo {
  durationSec: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  fps: number | null;
  bitrateKbps: number | null;
  formatName: string | null;
}

export type JobStatus =
  | 'pending'
  | 'probing'
  | 'queued'
  | 'running'
  | 'paused'
  | 'done'
  | 'error'
  | 'canceled'
  | 'skipped';

export interface JobProgress {
  percent: number; // 0-100, -1 wenn unbekannt (z. B. Dauer nicht ermittelbar)
  outTimeSec: number;
  speed: number | null; // z.B. 1.5x
  etaSec: number | null;
  fps: number | null;
  phase: string | null; // z.B. "KI-Upscaling (42/150 Frames)" bei mehrstufigen Jobs
}

export interface Job {
  id: string;
  inputPath: string;
  inputName: string;
  outputPath: string;
  outputDir: string;
  settings: JobSettings;
  status: JobStatus;
  progress: JobProgress;
  mediaInfo: MediaInfo | null;
  error: string | null;
}

export interface OutputOptions {
  mode: 'sameAsSource' | 'custom';
  customDir: string | null;
  filenamePattern: string; // z.B. "{name}_converted"
  onConflict: 'rename' | 'overwrite' | 'skip';
}

export function createDefaultOutputOptions(): OutputOptions {
  return {
    mode: 'sameAsSource',
    customDir: null,
    filenamePattern: '{name}_converted',
    onConflict: 'rename'
  };
}

export interface Preset {
  id: string;
  name: string;
  settings: JobSettings;
  builtIn: boolean;
}

export interface StartQueueRequest {
  jobs: {
    id: string;
    inputPath: string;
    outputPath: string;
    settings: JobSettings;
    durationSec: number;
    mediaInfo: MediaInfo | null;
  }[];
  concurrency: number;
  onConflict: OutputOptions['onConflict'];
}

export interface JobUpdatePayload {
  id: string;
  status?: JobStatus;
  progress?: Partial<JobProgress>;
  error?: string | null;
  mediaInfo?: MediaInfo;
}

export interface AppSettings {
  language: 'de' | 'en';
  concurrency: number;
  output: OutputOptions;
}

export function createDefaultAppSettings(): AppSettings {
  return {
    language: 'de',
    concurrency: 1,
    output: createDefaultOutputOptions()
  };
}
