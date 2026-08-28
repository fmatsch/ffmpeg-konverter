// Lädt das Real-ESRGAN-ncnn-vulkan-Binary (+ ein Modell) für die aktuelle
// Plattform herunter und legt es unter vendor/realesrgan/ ab. Wird lokal vor
// dem Dev-Start bzw. in CI vor dem electron-builder-Build ausgeführt, damit
// keine ~50-100 MB großen Binärdateien im Git-Repo landen müssen.

import { mkdir, rm, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(ROOT, 'vendor', 'realesrgan');

const RELEASE_BASE = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0';
const ASSET_BY_PLATFORM = {
  darwin: 'realesrgan-ncnn-vulkan-20220424-macos.zip',
  win32: 'realesrgan-ncnn-vulkan-20220424-windows.zip'
};
const BINARY_BY_PLATFORM = {
  darwin: 'realesrgan-ncnn-vulkan',
  win32: 'realesrgan-ncnn-vulkan.exe'
};
// Nur das Allzweck-Modell behalten (Foto/Video, x4). Die Anime-Modelle aus
// dem Original-Zip werden verworfen, um die Paketgröße klein zu halten.
const KEEP_MODEL_FILES = ['realesrgan-x4plus.param', 'realesrgan-x4plus.bin'];
// Windows-Build benötigt diese beiden Laufzeit-DLLs (OpenMP) neben der exe.
const WINDOWS_EXTRA_FILES = ['vcomp140.dll', 'vcomp140d.dll'];

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await import('node:fs/promises').then((fs) => fs.writeFile(destPath, buffer));
}

async function main() {
  const platform = process.platform;
  const asset = ASSET_BY_PLATFORM[platform];
  if (!asset) {
    console.warn(`⚠ Real-ESRGAN wird für Plattform "${platform}" nicht unterstützt, KI-Upscaling bleibt deaktiviert.`);
    return;
  }

  const binaryName = BINARY_BY_PLATFORM[platform];
  const targetBinary = path.join(VENDOR_DIR, binaryName);
  const targetModelParam = path.join(VENDOR_DIR, 'models', 'realesrgan-x4plus.param');
  if (existsSync(targetBinary) && existsSync(targetModelParam)) {
    console.log('✓ Real-ESRGAN bereits vorhanden, überspringe Download.');
    return;
  }

  await rm(VENDOR_DIR, { recursive: true, force: true });
  await mkdir(VENDOR_DIR, { recursive: true });

  const zipPath = path.join(VENDOR_DIR, asset);
  console.log(`↓ Lade ${asset} …`);
  await download(`${RELEASE_BASE}/${asset}`, zipPath);

  console.log('… entpacke');
  const extractDir = path.join(VENDOR_DIR, '_extract');
  await mkdir(extractDir, { recursive: true });
  if (platform === 'win32') {
    await execFileAsync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`]);
  } else {
    await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', extractDir]);
  }

  const entries = await readdir(extractDir);
  const sourceRoot = entries.length === 1 ? path.join(extractDir, entries[0]) : extractDir;
  const sourceIsDir = existsSync(path.join(sourceRoot, binaryName));

  const flatRoot = sourceIsDir ? sourceRoot : extractDir;
  await rename(path.join(flatRoot, binaryName), targetBinary);
  await mkdir(path.join(VENDOR_DIR, 'models'), { recursive: true });
  for (const modelFile of KEEP_MODEL_FILES) {
    await rename(path.join(flatRoot, 'models', modelFile), path.join(VENDOR_DIR, 'models', modelFile));
  }

  if (platform === 'win32') {
    for (const dll of WINDOWS_EXTRA_FILES) {
      const src = path.join(flatRoot, dll);
      if (existsSync(src)) await rename(src, path.join(VENDOR_DIR, dll));
    }
  } else {
    await execFileAsync('chmod', ['+x', targetBinary]);
  }

  await rm(extractDir, { recursive: true, force: true });
  await rm(zipPath, { force: true });

  console.log(`✓ Real-ESRGAN bereit unter ${path.relative(ROOT, targetBinary)}`);
}

main().catch((error) => {
  console.error('Real-ESRGAN-Download fehlgeschlagen:', error);
  process.exitCode = 1;
});
