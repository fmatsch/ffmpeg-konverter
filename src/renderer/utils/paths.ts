// Leichte Pfad-Hilfsfunktionen für den Renderer (kein Zugriff auf node:path).
// Unterstützt sowohl POSIX- als auch Windows-Trennzeichen.

export function dirnameOf(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx === -1 ? '.' : p.slice(0, idx);
}

export function basenameOf(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx === -1 ? p : p.slice(idx + 1);
}

export function stemOf(p: string): string {
  const base = basenameOf(p);
  const dotIdx = base.lastIndexOf('.');
  return dotIdx <= 0 ? base : base.slice(0, dotIdx);
}

export function joinPath(dir: string, file: string): string {
  const usesBackslash = dir.includes('\\') && !dir.includes('/');
  const sep = usesBackslash ? '\\' : '/';
  const trimmedDir = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${trimmedDir}${sep}${file}`;
}
