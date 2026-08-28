import { AUDIO_CODECS, VIDEO_CODECS, getFormat } from '@shared/formats';
import { resolveTargetDimensions } from '@shared/resolution';
import type { JobSettings } from '@shared/types';
import type { CodecCandidate } from './hardwareEncoders';

function toEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function buildScaleFilter(settings: JobSettings): string | null {
  const { width, height } = resolveTargetDimensions(settings);
  if (width === null || height === null) return null;
  const flags = settings.resolution.algorithm;
  if (settings.resolution.keepAspectRatio) {
    // Zielhöhe ist maßgeblich, Breite wird proportional berechnet (gerade Zahl erzwungen).
    return `scale=-2:${toEven(height)}:flags=${flags}`;
  }
  return `scale=${toEven(width)}:${toEven(height)}:flags=${flags}`;
}

/**
 * Baut nur die Video-Codec-Argumente (-c:v, Qualität, Pixelformat, Zusatzflags).
 * Wird sowohl für den normalen Ein-Schritt-Export als auch für den letzten
 * Encode-Schritt der KI-Upscaling-Pipeline verwendet, damit Software- und
 * Hardware-Kandidaten identisch behandelt werden.
 *
 * Hardware-Encoder (VideoToolbox/NVENC/QSV/AMF) haben pro Hersteller völlig
 * unterschiedliche Qualitäts-/Preset-Parameter. Um das robust zu halten,
 * wird bei Hardware-Encodern immer die Bitrate-Einstellung verwendet
 * (universell unterstützt) statt CRF, und es werden keine Software-spezifischen
 * Zusatzflags (x264-Preset o. ä.) gesetzt.
 */
export function buildVideoCodecArgs(settings: JobSettings, codecChoice: CodecCandidate): string[] {
  const args: string[] = ['-c:v', codecChoice.ffmpegCodec];

  if (codecChoice.isHardware) {
    args.push('-b:v', `${settings.quality.bitrateKbps}k`);
    return args;
  }

  const codecDef = VIDEO_CODECS[settings.videoCodec as keyof typeof VIDEO_CODECS];
  if (settings.quality.mode === 'crf' && codecDef.supportsCrf) {
    args.push('-crf', String(settings.quality.crf));
    if (codecDef.key === 'vp9' || codecDef.key === 'av1') {
      args.push('-b:v', '0');
    }
  } else {
    args.push('-b:v', `${settings.quality.bitrateKbps}k`);
  }
  if (codecDef.pixFmt) args.push('-pix_fmt', codecDef.pixFmt);
  if (codecDef.extraArgs) args.push(...codecDef.extraArgs);
  return args;
}

export function buildAudioArgs(settings: JobSettings, format: ReturnType<typeof getFormat>): string[] {
  const args: string[] = [];
  if (settings.audio.mute || format.defaultAudioCodec === 'none') {
    args.push('-an');
  } else if (settings.audio.codec === 'copy') {
    args.push('-c:a', 'copy');
  } else if (settings.audio.codec !== 'none') {
    const codecDef = AUDIO_CODECS[settings.audio.codec as keyof typeof AUDIO_CODECS];
    args.push('-c:a', codecDef.ffmpegCodec);
    if (!codecDef.lossless) {
      args.push('-b:a', `${settings.audio.bitrateKbps}k`);
    }
    if (format.key === 'mxf') {
      // Der MXF-Muxer akzeptiert ausschließlich 48 kHz, unabhängig von der
      // gewählten Samplerate-Einstellung.
      args.push('-ar', '48000');
    } else if (settings.audio.sampleRate !== 'original') {
      args.push('-ar', String(settings.audio.sampleRate));
    }
    if (settings.audio.channels !== 'original') {
      args.push('-ac', settings.audio.channels === 'mono' ? '1' : '2');
    }
  }
  return args;
}

export interface BuildArgsInput {
  inputPath: string;
  outputPath: string;
  settings: JobSettings;
  /** Video-Codec-Kandidat für den aktuellen Versuch (Hardware- oder Software-Encoder). */
  codecChoice?: CodecCandidate;
}

export function buildFfmpegArgs({ inputPath, outputPath, settings, codecChoice }: BuildArgsInput): string[] {
  const format = getFormat(settings.formatKey);
  const args: string[] = ['-y', '-i', inputPath];

  if (format.kind === 'image') {
    // GIF: Zweistufige Palette (palettegen/paletteuse) für deutlich bessere Qualität.
    const fps = settings.framerate === 'original' ? 15 : settings.framerate;
    const scale = buildScaleFilter(settings) ?? 'scale=iw:ih:flags=lanczos';
    const filter = `[0:v] fps=${fps},${scale},split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer`;
    args.push('-filter_complex', filter, '-an', '-loop', '0');
    args.push('-progress', 'pipe:1', '-nostats', outputPath);
    return args;
  }

  if (format.kind === 'audio') {
    args.push('-vn', ...buildAudioArgs(settings, format));
    if (format.muxer) args.push('-f', format.muxer);
    args.push('-progress', 'pipe:1', '-nostats', outputPath);
    return args;
  }

  // kind === 'video'
  if (settings.videoCodec === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    args.push(...buildVideoCodecArgs(settings, codecChoice ?? { ffmpegCodec: VIDEO_CODECS[settings.videoCodec as keyof typeof VIDEO_CODECS].ffmpegCodec, isHardware: false }));

    const scaleFilter = buildScaleFilter(settings);
    if (scaleFilter) args.push('-vf', scaleFilter);

    if (settings.framerate !== 'original') {
      args.push('-r', String(settings.framerate));
    }
  }

  args.push(...buildAudioArgs(settings, format));

  if (format.muxer) args.push('-f', format.muxer);
  args.push('-progress', 'pipe:1', '-nostats', outputPath);
  return args;
}
