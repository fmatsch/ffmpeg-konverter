import { app } from 'electron';
import path from 'node:path';

// Gepackt liegen die zur Ziel-Architektur passenden Binaries unter
// Resources/bin (siehe scripts/fetch-binaries.mjs und electron-builder.yml).
// Die npm-Pakete werden nur im Entwicklungsmodus geladen: sie sind nicht Teil
// des Pakets, und ein require beim Start würde die App abstürzen lassen.
function packagedBinary(name: string): string {
  return path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? `${name}.exe` : name);
}

export function getFfmpegPath(): string {
  if (app.isPackaged) return packagedBinary('ffmpeg');
  return require('ffmpeg-static') as string;
}

export function getFfprobePath(): string {
  if (app.isPackaged) return packagedBinary('ffprobe');
  return (require('@ffprobe-installer/ffprobe') as { path: string }).path;
}
