import { RESOLUTION_PRESETS } from './formats';
import type { JobSettings } from './types';

export function resolveTargetDimensions(settings: JobSettings): { width: number | null; height: number | null } {
  const { resolution } = settings;
  if (resolution.mode === 'preset') {
    if (resolution.presetKey === 'original') return { width: null, height: null };
    const preset = RESOLUTION_PRESETS.find((p) => p.key === resolution.presetKey);
    if (!preset || preset.width === null || preset.height === null) return { width: null, height: null };
    return { width: preset.width, height: preset.height };
  }
  return { width: resolution.width, height: resolution.height };
}
