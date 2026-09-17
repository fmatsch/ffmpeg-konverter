import { app } from 'electron';
import ffmpegPathImport from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

// ffmpeg-static / @ffprobe-installer liefern Pfade, die bei einer gepackten
// App innerhalb von app.asar liegen. Binaries können dort nicht ausgeführt
// werden, deshalb werden sie per electron-builder "asarUnpack" parallel in
// app.asar.unpacked abgelegt. Die zurückgegebenen Pfade müssen entsprechend
// umgeschrieben werden, siehe electron-builder.yml.
//
// Hinweis: "ffprobe-static" (früher hier verwendet) liefert unter
// bin/darwin/arm64 tatsächlich eine x86_64-Binary (Packaging-Bug, seit 2022
// nicht mehr gepflegt) – lief nur, solange Rosetta 2 installiert war. Ohne
// Rosetta (z. B. nach einem macOS-Upgrade) schlägt der Aufruf mit
// "spawn Unknown system error -86" (EBADARCH) fehl. @ffprobe-installer nutzt
// npm optionalDependencies und installiert dadurch garantiert nur die zur
// aktuellen Architektur passende Binary.
function unpackAsarPath(originalPath: string): string {
  if (!app.isPackaged) return originalPath;
  return originalPath.replace('app.asar', 'app.asar.unpacked');
}

export function getFfmpegPath(): string {
  const raw = (ffmpegPathImport as unknown as string) ?? '';
  if (!raw) {
    throw new Error('ffmpeg-static konnte keinen Binary-Pfad liefern.');
  }
  return unpackAsarPath(raw);
}

export function getFfprobePath(): string {
  const raw = ffprobeInstaller.path;
  if (!raw) {
    throw new Error('@ffprobe-installer/ffprobe konnte keinen Binary-Pfad liefern.');
  }
  return unpackAsarPath(raw);
}
