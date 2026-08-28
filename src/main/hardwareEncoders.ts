import type { VideoCodecKey } from '@shared/formats';

export interface CodecCandidate {
  ffmpegCodec: string;
  isHardware: boolean;
}

// Hardware-Encoder werden der Reihe nach versucht (schnellster/verbreitetster
// zuerst); schlägt ein Encoder fehl (kein passendes GPU/Treiber vorhanden),
// probiert die Warteschlange automatisch den nächsten Kandidaten, bis am
// Ende immer der Software-Encoder als garantierter Fallback steht.
const HARDWARE_ENCODERS: Partial<Record<VideoCodecKey, Partial<Record<NodeJS.Platform, string[]>>>> = {
  h264: {
    darwin: ['h264_videotoolbox'],
    win32: ['h264_nvenc', 'h264_qsv', 'h264_amf']
  },
  h265: {
    darwin: ['hevc_videotoolbox'],
    win32: ['hevc_nvenc', 'hevc_qsv', 'hevc_amf']
  }
};

export function resolveVideoCodecCandidates(
  softwareFfmpegCodec: string,
  videoCodecKey: VideoCodecKey,
  hardwareAcceleration: boolean,
  platform: NodeJS.Platform = process.platform
): CodecCandidate[] {
  const software: CodecCandidate = { ffmpegCodec: softwareFfmpegCodec, isHardware: false };
  if (!hardwareAcceleration) return [software];

  const hwList = HARDWARE_ENCODERS[videoCodecKey]?.[platform] ?? [];
  return [...hwList.map((ffmpegCodec) => ({ ffmpegCodec, isHardware: true })), software];
}
