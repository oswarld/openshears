import { execa } from 'execa';
import { removePath, killProcess } from './utils.js';
import type { Artifacts } from './detector.js';

export async function removeArtifacts(artifacts: Artifacts): Promise<void> {
  // 1. Kill Processes
  for (const proc of artifacts.processes) {
    await killProcess(proc);
  }

  // 2. Uninstall Global Package
  if (artifacts.globalPackage) {
    await execa('npm', ['uninstall', '-g', 'openclaw']);
  }

  // 3. Delete Directories & Files
  for (const dir of artifacts.directories) {
    await removePath(dir);
  }
  for (const file of artifacts.files) {
    await removePath(file);
  }
}
