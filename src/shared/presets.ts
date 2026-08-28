import type { JobSettings } from './types';
import { createDefaultAudio, createDefaultResolution, createDefaultSettings } from './types';

export interface QuickPresetDef {
  key: string;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  settings: JobSettings;
}

export const QUICK_PRESETS: QuickPresetDef[] = [
  {
    key: 'compatible',
    labelKey: 'preset.compatible.label',
    descriptionKey: 'preset.compatible.description',
    icon: '📱',
    settings: {
      ...createDefaultSettings(),
      formatKey: 'mp4',
      videoCodec: 'h264',
      quality: { mode: 'crf', crf: 23, bitrateKbps: 4000 },
      resolution: { ...createDefaultResolution(), mode: 'preset', presetKey: '720p' },
      audio: { ...createDefaultAudio(), codec: 'aac', bitrateKbps: 128 }
    }
  },
  {
    key: 'smallest',
    labelKey: 'preset.smallest.label',
    descriptionKey: 'preset.smallest.description',
    icon: '🗜️',
    settings: {
      ...createDefaultSettings(),
      formatKey: 'mp4',
      videoCodec: 'h265',
      quality: { mode: 'crf', crf: 28, bitrateKbps: 1500 },
      audio: { ...createDefaultAudio(), codec: 'aac', bitrateKbps: 96 }
    }
  },
  {
    key: 'bestQuality',
    labelKey: 'preset.bestQuality.label',
    descriptionKey: 'preset.bestQuality.description',
    icon: '✨',
    settings: {
      ...createDefaultSettings(),
      formatKey: 'mkv',
      videoCodec: 'h265',
      quality: { mode: 'crf', crf: 18, bitrateKbps: 8000 },
      audio: { ...createDefaultAudio(), codec: 'flac' }
    }
  },
  {
    key: 'audioOnly',
    labelKey: 'preset.audioOnly.label',
    descriptionKey: 'preset.audioOnly.description',
    icon: '🎵',
    settings: {
      ...createDefaultSettings(),
      formatKey: 'mp3',
      videoCodec: 'copy',
      audio: { ...createDefaultAudio(), codec: 'mp3', bitrateKbps: 192 }
    }
  },
  {
    key: 'losslessAudio',
    labelKey: 'preset.losslessAudio.label',
    descriptionKey: 'preset.losslessAudio.description',
    icon: '🎧',
    settings: {
      ...createDefaultSettings(),
      formatKey: 'flac',
      videoCodec: 'copy',
      audio: { ...createDefaultAudio(), codec: 'flac' }
    }
  },
  {
    key: 'gif',
    labelKey: 'preset.gif.label',
    descriptionKey: 'preset.gif.description',
    icon: '🖼️',
    settings: {
      ...createDefaultSettings(),
      formatKey: 'gif',
      videoCodec: 'copy',
      framerate: 15,
      resolution: { ...createDefaultResolution(), mode: 'preset', presetKey: '480p' },
      audio: { ...createDefaultAudio(), mute: true }
    }
  }
];
