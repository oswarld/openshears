import fs from 'fs-extra';
import { execa } from 'execa';

export async function checkPathExists(p: string): Promise<boolean> {
  return fs.pathExists(p);
}

export async function removePath(p: string): Promise<void> {
  await fs.remove(p);
}

export async function isProcessRunning(name: string): Promise<boolean> {
  try {
    const { stdout } = await execa('pgrep', ['-f', name]);
    return !!stdout;
  } catch {
    return false;
  }
}

export async function killProcess(name: string): Promise<void> {
  try {
    await execa('pkill', ['-f', name]);
  } catch (e) {
    // Ignore if not found
  }
}
