import { AUDIO_CODECS, RESOLUTION_PRESETS, VIDEO_CODECS, getFormat } from '@shared/formats';
import type { JobSettings } from '@shared/types';

function toEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function resolveTargetDimensions(settings: JobSettings): { width: number | null; height: number | null } {
  const { resolution } = settings;
  if (resolution.mode === 'preset') {
    if (resolution.presetKey === 'original') return { width: null, height: null };
    const preset = RESOLUTION_PRESETS.find((p) => p.key === resolution.presetKey);
    if (!preset || preset.width === null || preset.height === null) return { width: null, height: null };
    return { width: preset.width, height: preset.height };
  }
  return { width: resolution.width, height: resolution.height };
}

function buildScaleFilter(settings: JobSettings): string | null {
  const { width, height } = resolveTargetDimensions(settings);
  if (width === null || height === null) return null;
  const flags = settings.resolution.algorithm;
  if (settings.resolution.keepAspectRatio) {
    // Zielhöhe ist maßgeblich, Breite wird proportional berechnet (gerade Zahl erzwungen).
    return `scale=-2:${toEven(height)}:flags=${flags}`;
  }
  return `scale=${toEven(width)}:${toEven(height)}:flags=${flags}`;
}

export interface BuildArgsInput {
  inputPath: string;
  outputPath: string;
  settings: JobSettings;
}

export function buildFfmpegArgs({ inputPath, outputPath, settings }: BuildArgsInput): string[] {
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
    args.push('-vn');
    const codecKey = format.defaultAudioCodec;
    if (codecKey !== 'none') {
      const codecDef = AUDIO_CODECS[codecKey as keyof typeof AUDIO_CODECS];
      args.push('-c:a', codecDef.ffmpegCodec);
      if (!codecDef.lossless) {
        args.push('-b:a', `${settings.audio.bitrateKbps}k`);
      }
      if (settings.audio.sampleRate !== 'original') {
        args.push('-ar', String(settings.audio.sampleRate));
      }
      if (settings.audio.channels !== 'original') {
        args.push('-ac', settings.audio.channels === 'mono' ? '1' : '2');
      }
    }
    if (format.muxer) args.push('-f', format.muxer);
    args.push('-progress', 'pipe:1', '-nostats', outputPath);
    return args;
  }

  // kind === 'video'
  if (settings.videoCodec === 'copy') {
    args.push('-c:v', 'copy');
  } else {
    const codecDef = VIDEO_CODECS[settings.videoCodec as keyof typeof VIDEO_CODECS];
    args.push('-c:v', codecDef.ffmpegCodec);
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

    const scaleFilter = buildScaleFilter(settings);
    if (scaleFilter) args.push('-vf', scaleFilter);

    if (settings.framerate !== 'original') {
      args.push('-r', String(settings.framerate));
    }
  }

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
    if (settings.audio.sampleRate !== 'original') {
      args.push('-ar', String(settings.audio.sampleRate));
    }
    if (settings.audio.channels !== 'original') {
      args.push('-ac', settings.audio.channels === 'mono' ? '1' : '2');
    }
  }

  if (format.muxer) args.push('-f', format.muxer);
  args.push('-progress', 'pipe:1', '-nostats', outputPath);
  return args;
}
