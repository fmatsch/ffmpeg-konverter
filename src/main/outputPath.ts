import { existsSync } from 'node:fs';
import path from 'node:path';
import type { OutputOptions } from '@shared/types';

export function resolveOutputPath(
  desiredPath: string,
  onConflict: OutputOptions['onConflict']
): { path: string; skip: boolean } {
  if (!existsSync(desiredPath)) return { path: desiredPath, skip: false };
  if (onConflict === 'overwrite') return { path: desiredPath, skip: false };
  if (onConflict === 'skip') return { path: desiredPath, skip: true };

  const dir = path.dirname(desiredPath);
  const ext = path.extname(desiredPath);
  const base = path.basename(desiredPath, ext);
  let n = 1;
  let candidate = path.join(dir, `${base} (${n})${ext}`);
  while (existsSync(candidate)) {
    n += 1;
    candidate = path.join(dir, `${base} (${n})${ext}`);
  }
  return { path: candidate, skip: false };
}
