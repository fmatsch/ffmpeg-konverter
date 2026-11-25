// electron-builder afterPack: macOS-App ad-hoc signieren.
// Ohne Apple-Entwicklerzertifikat bleibt sonst die unvollständige Signatur der
// Electron-Binary zurück; macOS meldet die geladene App dann als "beschädigt"
// und bietet in den Systemeinstellungen kein "Dennoch öffnen" an.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const resources = path.join(app, 'Contents', 'Resources');
  const sign = (target, ...extra) => execFileSync('codesign', ['--force', ...extra, '--sign', '-', target], { stdio: 'inherit' });

  // --deep erfasst ausführbare Dateien unter Resources nicht, daher einzeln.
  for (const binary of ['bin/ffmpeg', 'bin/ffprobe', 'realesrgan/realesrgan-ncnn-vulkan']) {
    sign(path.join(resources, binary));
  }
  sign(app, '--deep');
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log(`  • ad-hoc signiert  ${app}`);
};
