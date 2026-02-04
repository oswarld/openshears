import fs from 'fs-extra';
import { execa } from 'execa';
import { OPENCLAW_STATE_DIR, LEGACY_STATE_DIRS, MACOS_LOG_DIR } from './paths.js';

export interface Artifacts {
  directories: string[];
  files: string[];
  processes: string[];
  globalPackage: boolean;
}

export async function detectArtifacts(): Promise<Artifacts> {
  const artifacts: Artifacts = {
    directories: [],
    files: [],
    processes: [],
    globalPackage: false,
  };

  // 1. Check State Dirs
  if (await fs.pathExists(OPENCLAW_STATE_DIR)) {
    artifacts.directories.push(OPENCLAW_STATE_DIR);
  }
  for (const dir of LEGACY_STATE_DIRS) {
    if (await fs.pathExists(dir)) {
      artifacts.directories.push(dir);
    }
  }

  // 2. Check Logs
  if (process.platform === 'darwin') {
    if (await fs.pathExists(MACOS_LOG_DIR)) {
      artifacts.directories.push(MACOS_LOG_DIR);
    }
  }

  // 3. Check Global Package
  try {
    const { stdout } = await execa('npm', ['list', '-g', 'openclaw', '--depth=0'], { reject: false });
    // npm list returns non-zero if peer deps are missing, so we use reject: false
    // and check if 'openclaw@' is in the output
    if (stdout.includes('openclaw@') && !stdout.includes('(empty)')) {
      artifacts.globalPackage = true;
    }
  } catch {
    // Fallback or ignore
  }

  // 4. Check Processes
  try {
    const { stdout } = await execa('pgrep', ['-f', 'openclaw'], { reject: false });
    if (stdout) {
      artifacts.processes.push('openclaw');
    }
  } catch {
    // No process found
  }

  return artifacts;
}
