import { execFile } from 'node:child_process';
import { getFfprobePath } from './ffmpegBinary';
import type { MediaInfo } from '@shared/types';

interface FfprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  duration?: string;
}

interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
  format_name?: string;
}

interface FfprobeOutput {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}

function parseFrameRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [num, den] = rate.split('/').map(Number);
  if (!den || Number.isNaN(num) || Number.isNaN(den)) return null;
  const fps = num / den;
  return Number.isFinite(fps) && fps > 0 ? fps : null;
}

export function probeFile(inputPath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath];
    execFile(getFfprobePath(), args, { maxBuffer: 1024 * 1024 * 16 }, (error, stdout) => {
      if (error) {
        reject(new Error(`Datei konnte nicht gelesen werden: ${error.message}`));
        return;
      }
      try {
        const data: FfprobeOutput = JSON.parse(stdout);
        const videoStream = data.streams.find((s) => s.codec_type === 'video');
        const audioStream = data.streams.find((s) => s.codec_type === 'audio');
        const durationSec = Number(data.format?.duration ?? videoStream?.duration ?? audioStream?.duration ?? 0);
        const bitrateRaw = data.format?.bit_rate ?? videoStream?.bit_rate;

        const info: MediaInfo = {
          durationSec: Number.isFinite(durationSec) ? durationSec : 0,
          width: videoStream?.width ?? null,
          height: videoStream?.height ?? null,
          videoCodec: videoStream?.codec_name ?? null,
          audioCodec: audioStream?.codec_name ?? null,
          hasVideo: Boolean(videoStream),
          hasAudio: Boolean(audioStream),
          fps: parseFrameRate(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate),
          bitrateKbps: bitrateRaw ? Math.round(Number(bitrateRaw) / 1000) : null,
          formatName: data.format?.format_name ?? null
        };
        resolve(info);
      } catch (parseError) {
        reject(new Error(`Metadaten konnten nicht gelesen werden: ${(parseError as Error).message}`));
      }
    });
  });
}
