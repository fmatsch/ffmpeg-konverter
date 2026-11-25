// Legt ffmpeg/ffprobe je Zielplattform unter vendor/bin/<os>-<arch>/ ab.
// npm installiert nur die Binaries der Build-Maschine; ein Mac-Build erzeugt
// aber Intel UND Apple Silicon, daher wird die jeweils andere Architektur
// zusätzlich geladen.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OS_NAME = { darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform];
const ARCHES = process.platform === 'darwin' ? ['x64', 'arm64'] : [process.arch];
const EXT = process.platform === 'win32' ? '.exe' : '';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function fetchFfmpeg(arch, target) {
  if (arch === process.arch) {
    copyFileSync(require('ffmpeg-static'), target);
    return;
  }
  const tag = readJson(require.resolve('ffmpeg-static/package.json'))['ffmpeg-static']['binary-release-tag'];
  const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffmpeg-${process.platform}-${arch}.gz`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${url}`);
  writeFileSync(target, gunzipSync(Buffer.from(await res.arrayBuffer())));
}

function fetchFfprobe(arch, target) {
  if (arch === process.arch) {
    copyFileSync(require('@ffprobe-installer/ffprobe').path, target);
    return;
  }
  const name = `@ffprobe-installer/${process.platform}-${arch}`;
  const version = readJson(path.join(ROOT, 'node_modules/@ffprobe-installer/ffprobe/package.json')).optionalDependencies[name];
  const dir = mkdtempSync(path.join(tmpdir(), 'ffprobe-'));
  try {
    // npm pack prüft die Integrität gegen die Registry.
    const tarball = execFileSync('npm', ['pack', `${name}@${version}`, '--silent', '--pack-destination', dir], { encoding: 'utf8' }).trim();
    execFileSync('tar', ['-xzf', path.join(dir, tarball), '-C', dir]);
    copyFileSync(path.join(dir, 'package', `ffprobe${EXT}`), target);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const arch of ARCHES) {
  const outDir = path.join(ROOT, 'vendor', 'bin', `${OS_NAME}-${arch}`);
  mkdirSync(outDir, { recursive: true });
  for (const [tool, fetcher] of [['ffmpeg', fetchFfmpeg], ['ffprobe', fetchFfprobe]]) {
    const target = path.join(outDir, tool + EXT);
    if (existsSync(target)) continue;
    await fetcher(arch, target);
    chmodSync(target, 0o755);
  }
  console.log(`✓ FFmpeg-Binaries bereit: vendor/bin/${OS_NAME}-${arch}`);
}
