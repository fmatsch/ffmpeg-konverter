import { getFormat } from './formats';
import { resolveTargetDimensions } from './resolution';
import type { JobSettings, MediaInfo } from './types';

// Das mitgelieferte Real-ESRGAN-Modell (realesrgan-x4plus) skaliert fest um
// den Faktor 4; für abweichende Zielauflösungen wird danach mit dem
// gewohnten Lanczos-Filter exakt auf die Zielgröße nachskaliert.
export const AI_UPSCALE_MODEL_SCALE = 4;

export function isAiUpscaleApplicable(settings: JobSettings, mediaInfo: MediaInfo | null | undefined): boolean {
  if (!settings.aiUpscale.enabled) return false;
  if (!mediaInfo || !mediaInfo.hasVideo || !mediaInfo.width || !mediaInfo.height) return false;
  const format = getFormat(settings.formatKey);
  if (format.kind !== 'video') return false;
  if (settings.videoCodec === 'copy') return false;

  const target = resolveTargetDimensions(settings);
  if (target.height === null) return false; // "Original" gewählt -> kein Upscale-Ziel

  return target.height > mediaInfo.height;
}
