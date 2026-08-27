// Zentrale Definition aller unterstützten Formate/Codecs.
// Wird sowohl vom Main-Prozess (Argument-Aufbau für FFmpeg) als auch vom
// Renderer (Auswahlmöglichkeiten im UI) verwendet.

export type VideoCodecKey = 'h264' | 'h265' | 'vp9' | 'av1' | 'wmv2' | 'copy';
export type AudioCodecKey = 'aac' | 'mp3' | 'opus' | 'vorbis' | 'flac' | 'pcm' | 'wma' | 'copy' | 'none';

export interface VideoCodecDef {
  key: VideoCodecKey;
  ffmpegCodec: string;
  labelKey: string;
  supportsCrf: boolean;
  crfRange?: [number, number];
  defaultCrf?: number;
  defaultBitrateKbps: number;
  pixFmt?: string;
  extraArgs?: string[];
}

export interface AudioCodecDef {
  key: AudioCodecKey;
  ffmpegCodec: string;
  labelKey: string;
  lossless: boolean;
  bitrateOptionsKbps?: number[];
  defaultBitrateKbps?: number;
}

export type OutputFormatKind = 'video' | 'audio' | 'image';

export interface OutputFormatDef {
  key: string;
  extension: string;
  kind: OutputFormatKind;
  labelKey: string;
  muxer?: string;
  videoCodecs?: VideoCodecKey[];
  defaultVideoCodec?: VideoCodecKey;
  audioCodecs: AudioCodecKey[];
  defaultAudioCodec: AudioCodecKey;
  allowMuteAudio?: boolean;
}

export const VIDEO_CODECS: Record<Exclude<VideoCodecKey, 'copy'>, VideoCodecDef> = {
  h264: {
    key: 'h264',
    ffmpegCodec: 'libx264',
    labelKey: 'codec.h264',
    supportsCrf: true,
    crfRange: [0, 51],
    defaultCrf: 23,
    defaultBitrateKbps: 4000,
    pixFmt: 'yuv420p',
    extraArgs: ['-preset', 'medium']
  },
  h265: {
    key: 'h265',
    ffmpegCodec: 'libx265',
    labelKey: 'codec.h265',
    supportsCrf: true,
    crfRange: [0, 51],
    defaultCrf: 28,
    defaultBitrateKbps: 2500,
    pixFmt: 'yuv420p',
    extraArgs: ['-preset', 'medium']
  },
  vp9: {
    key: 'vp9',
    ffmpegCodec: 'libvpx-vp9',
    labelKey: 'codec.vp9',
    supportsCrf: true,
    crfRange: [0, 63],
    defaultCrf: 31,
    defaultBitrateKbps: 2000,
    pixFmt: 'yuv420p',
    extraArgs: ['-row-mt', '1']
  },
  av1: {
    key: 'av1',
    ffmpegCodec: 'libaom-av1',
    labelKey: 'codec.av1',
    supportsCrf: true,
    crfRange: [0, 63],
    defaultCrf: 30,
    defaultBitrateKbps: 1500,
    pixFmt: 'yuv420p',
    extraArgs: ['-cpu-used', '4', '-row-mt', '1']
  },
  wmv2: {
    key: 'wmv2',
    ffmpegCodec: 'wmv2',
    labelKey: 'codec.wmv2',
    supportsCrf: false,
    defaultBitrateKbps: 3000
  }
};

export const AUDIO_CODECS: Record<Exclude<AudioCodecKey, 'copy' | 'none'>, AudioCodecDef> = {
  aac: {
    key: 'aac',
    ffmpegCodec: 'aac',
    labelKey: 'codec.aac',
    lossless: false,
    bitrateOptionsKbps: [96, 128, 160, 192, 256, 320],
    defaultBitrateKbps: 192
  },
  mp3: {
    key: 'mp3',
    ffmpegCodec: 'libmp3lame',
    labelKey: 'codec.mp3',
    lossless: false,
    bitrateOptionsKbps: [96, 128, 160, 192, 256, 320],
    defaultBitrateKbps: 192
  },
  opus: {
    key: 'opus',
    ffmpegCodec: 'libopus',
    labelKey: 'codec.opus',
    lossless: false,
    bitrateOptionsKbps: [64, 96, 128, 160, 192, 256],
    defaultBitrateKbps: 128
  },
  vorbis: {
    key: 'vorbis',
    ffmpegCodec: 'libvorbis',
    labelKey: 'codec.vorbis',
    lossless: false,
    bitrateOptionsKbps: [96, 128, 160, 192, 256, 320],
    defaultBitrateKbps: 192
  },
  flac: {
    key: 'flac',
    ffmpegCodec: 'flac',
    labelKey: 'codec.flac',
    lossless: true
  },
  pcm: {
    key: 'pcm',
    ffmpegCodec: 'pcm_s16le',
    labelKey: 'codec.pcm',
    lossless: true
  },
  wma: {
    key: 'wma',
    ffmpegCodec: 'wmav2',
    labelKey: 'codec.wma',
    lossless: false,
    bitrateOptionsKbps: [128, 192, 256],
    defaultBitrateKbps: 192
  }
};

export const VIDEO_FORMATS: OutputFormatDef[] = [
  {
    key: 'mp4',
    extension: 'mp4',
    kind: 'video',
    labelKey: 'format.mp4',
    videoCodecs: ['h264', 'h265', 'copy'],
    defaultVideoCodec: 'h264',
    audioCodecs: ['aac', 'mp3', 'copy', 'none'],
    defaultAudioCodec: 'aac',
    allowMuteAudio: true
  },
  {
    key: 'mkv',
    extension: 'mkv',
    kind: 'video',
    labelKey: 'format.mkv',
    videoCodecs: ['h264', 'h265', 'vp9', 'av1', 'copy'],
    defaultVideoCodec: 'h264',
    audioCodecs: ['aac', 'mp3', 'opus', 'flac', 'copy', 'none'],
    defaultAudioCodec: 'aac',
    allowMuteAudio: true
  },
  {
    key: 'mov',
    extension: 'mov',
    kind: 'video',
    labelKey: 'format.mov',
    videoCodecs: ['h264', 'h265', 'copy'],
    defaultVideoCodec: 'h264',
    audioCodecs: ['aac', 'copy', 'none'],
    defaultAudioCodec: 'aac',
    allowMuteAudio: true
  },
  {
    key: 'webm',
    extension: 'webm',
    kind: 'video',
    labelKey: 'format.webm',
    videoCodecs: ['vp9', 'av1', 'copy'],
    defaultVideoCodec: 'vp9',
    audioCodecs: ['opus', 'vorbis', 'copy', 'none'],
    defaultAudioCodec: 'opus',
    allowMuteAudio: true
  },
  {
    key: 'avi',
    extension: 'avi',
    kind: 'video',
    labelKey: 'format.avi',
    videoCodecs: ['h264', 'copy'],
    defaultVideoCodec: 'h264',
    audioCodecs: ['mp3', 'copy', 'none'],
    defaultAudioCodec: 'mp3',
    allowMuteAudio: true
  },
  {
    key: 'flv',
    extension: 'flv',
    kind: 'video',
    labelKey: 'format.flv',
    videoCodecs: ['h264', 'copy'],
    defaultVideoCodec: 'h264',
    audioCodecs: ['aac', 'mp3', 'copy', 'none'],
    defaultAudioCodec: 'aac',
    allowMuteAudio: true
  },
  {
    key: 'wmv',
    extension: 'wmv',
    kind: 'video',
    labelKey: 'format.wmv',
    muxer: 'asf',
    videoCodecs: ['wmv2', 'copy'],
    defaultVideoCodec: 'wmv2',
    audioCodecs: ['wma', 'copy', 'none'],
    defaultAudioCodec: 'wma',
    allowMuteAudio: true
  },
  {
    key: 'gif',
    extension: 'gif',
    kind: 'image',
    labelKey: 'format.gif',
    videoCodecs: ['copy'],
    audioCodecs: ['none'],
    defaultAudioCodec: 'none'
  }
];

export const AUDIO_FORMATS: OutputFormatDef[] = [
  {
    key: 'mp3',
    extension: 'mp3',
    kind: 'audio',
    labelKey: 'format.mp3',
    audioCodecs: ['mp3'],
    defaultAudioCodec: 'mp3'
  },
  {
    key: 'm4a',
    extension: 'm4a',
    kind: 'audio',
    labelKey: 'format.m4a',
    audioCodecs: ['aac'],
    defaultAudioCodec: 'aac'
  },
  {
    key: 'wav',
    extension: 'wav',
    kind: 'audio',
    labelKey: 'format.wav',
    audioCodecs: ['pcm'],
    defaultAudioCodec: 'pcm'
  },
  {
    key: 'flac',
    extension: 'flac',
    kind: 'audio',
    labelKey: 'format.flac',
    audioCodecs: ['flac'],
    defaultAudioCodec: 'flac'
  },
  {
    key: 'ogg',
    extension: 'ogg',
    kind: 'audio',
    labelKey: 'format.ogg',
    audioCodecs: ['vorbis'],
    defaultAudioCodec: 'vorbis'
  },
  {
    key: 'opus',
    extension: 'opus',
    kind: 'audio',
    labelKey: 'format.opus',
    muxer: 'ogg',
    audioCodecs: ['opus'],
    defaultAudioCodec: 'opus'
  },
  {
    key: 'wma',
    extension: 'wma',
    kind: 'audio',
    labelKey: 'format.wma',
    muxer: 'asf',
    audioCodecs: ['wma'],
    defaultAudioCodec: 'wma'
  }
];

export const ALL_FORMATS: OutputFormatDef[] = [...VIDEO_FORMATS, ...AUDIO_FORMATS];

export function getFormat(key: string): OutputFormatDef {
  const format = ALL_FORMATS.find((f) => f.key === key);
  if (!format) throw new Error(`Unbekanntes Ausgabeformat: ${key}`);
  return format;
}

export interface ResolutionPresetDef {
  key: string;
  labelKey: string;
  width: number | null;
  height: number | null;
}

export const RESOLUTION_PRESETS: ResolutionPresetDef[] = [
  { key: 'original', labelKey: 'resolution.original', width: null, height: null },
  { key: '480p', labelKey: 'resolution.480p', width: 854, height: 480 },
  { key: '720p', labelKey: 'resolution.720p', width: 1280, height: 720 },
  { key: '1080p', labelKey: 'resolution.1080p', width: 1920, height: 1080 },
  { key: '1440p', labelKey: 'resolution.1440p', width: 2560, height: 1440 },
  { key: '2160p', labelKey: 'resolution.2160p', width: 3840, height: 2160 },
  { key: '4320p', labelKey: 'resolution.4320p', width: 7680, height: 4320 },
  { key: 'custom', labelKey: 'resolution.custom', width: null, height: null }
];

export type ScaleAlgorithm = 'lanczos' | 'bicubic' | 'bilinear' | 'neighbor';

export const SCALE_ALGORITHMS: { key: ScaleAlgorithm; labelKey: string }[] = [
  { key: 'lanczos', labelKey: 'scaleAlgo.lanczos' },
  { key: 'bicubic', labelKey: 'scaleAlgo.bicubic' },
  { key: 'bilinear', labelKey: 'scaleAlgo.bilinear' },
  { key: 'neighbor', labelKey: 'scaleAlgo.neighbor' }
];

export const AUDIO_SAMPLE_RATES = [22050, 44100, 48000, 96000] as const;
