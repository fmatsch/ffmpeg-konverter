import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Echtes Pausieren/Fortsetzen auf Betriebssystemebene, ohne den FFmpeg-/
// Real-ESRGAN-Prozess zu beenden: Auf macOS/Linux per SIGSTOP/SIGCONT, unter
// Windows über NtSuspendProcess/NtResumeProcess (ntdll.dll) via PowerShell,
// da Node dort kein Äquivalent zu SIGSTOP bietet und kein zusätzliches
// natives Binary gebündelt werden soll.

const WINDOWS_SUSPEND_RESUME_SNIPPET = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class FfmpegKonverterProcCtl {
  [DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h);
  [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);
}
"@ -ErrorAction SilentlyContinue
`;

async function runWindowsProcCtl(pid: number, action: 'NtSuspendProcess' | 'NtResumeProcess'): Promise<void> {
  const script = `${WINDOWS_SUSPEND_RESUME_SNIPPET}
$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($p) { [FfmpegKonverterProcCtl]::${action}($p.Handle) | Out-Null }
`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

export async function suspendProcess(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await runWindowsProcCtl(pid, 'NtSuspendProcess');
  } else {
    process.kill(pid, 'SIGSTOP');
  }
}

export async function resumeProcess(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await runWindowsProcCtl(pid, 'NtResumeProcess');
  } else {
    process.kill(pid, 'SIGCONT');
  }
}
