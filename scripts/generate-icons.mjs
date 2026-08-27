import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_SVG = path.join(ROOT, 'build', 'icon-source.svg');
const ICONS_DIR = path.join(ROOT, 'build', 'icons');
const PUBLIC_DIR = path.join(ROOT, 'public');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024];

async function renderPng(size, outPath) {
  await sharp(SRC_SVG, { density: 384 }).resize(size, size).png().toFile(outPath);
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  await mkdir(PUBLIC_DIR, { recursive: true });

  // Haupt-PNG (u. a. für Fenster-Icon unter Linux/Dev)
  await renderPng(1024, path.join(PUBLIC_DIR, 'icon.png'));
  await renderPng(512, path.join(ICONS_DIR, 'icon.png'));
  console.log('✓ icon.png erzeugt');

  // Windows .ico
  const icoBuffers = await Promise.all(
    ICO_SIZES.map(async (size) => {
      const tmp = path.join(ICONS_DIR, `_ico_${size}.png`);
      await renderPng(size, tmp);
      return tmp;
    })
  );
  const icoBuffer = await pngToIco(icoBuffers);
  await writeFile(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
  await Promise.all(icoBuffers.map((p) => rm(p)));
  console.log('✓ icon.ico erzeugt');

  // macOS .icns (benötigt iconutil, nur auf macOS verfügbar)
  if (process.platform === 'darwin') {
    const iconsetDir = path.join(ICONS_DIR, 'icon.iconset');
    await mkdir(iconsetDir, { recursive: true });
    for (const size of ICNS_SIZES) {
      await renderPng(size, path.join(iconsetDir, `icon_${size}x${size}.png`));
      if (size !== 16 && size !== 32) {
        await renderPng(size, path.join(iconsetDir, `icon_${size / 2}x${size / 2}@2x.png`));
      }
    }
    await renderPng(32, path.join(iconsetDir, 'icon_16x16@2x.png'));
    await renderPng(64, path.join(iconsetDir, 'icon_32x32@2x.png'));
    await execFileAsync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(ICONS_DIR, 'icon.icns')]);
    await rm(iconsetDir, { recursive: true, force: true });
    console.log('✓ icon.icns erzeugt');
  } else {
    console.warn('⚠ icon.icns übersprungen (iconutil ist nur auf macOS verfügbar). Auf einem Mac erneut ausführen.');
  }
}

main().catch((error) => {
  console.error('Icon-Generierung fehlgeschlagen:', error);
  process.exitCode = 1;
});
