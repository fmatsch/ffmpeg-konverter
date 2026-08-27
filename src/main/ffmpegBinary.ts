import { app } from 'electron';
import ffmpegPathImport from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// ffmpeg-static / ffprobe-static liefern Pfade, die bei einer gepackten App
// innerhalb von app.asar liegen. Binaries können dort nicht ausgeführt werden,
// deshalb werden sie per electron-builder "asarUnpack" parallel in
// app.asar.unpacked abgelegt. Die zurückgegebenen Pfade müssen entsprechend
// umgeschrieben werden, siehe electron-builder.yml.
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
  const raw = (ffprobeStatic as unknown as { path: string }).path;
  if (!raw) {
    throw new Error('ffprobe-static konnte keinen Binary-Pfad liefern.');
  }
  return unpackAsarPath(raw);
}
