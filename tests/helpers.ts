import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

export const ok = (stdout = '') => ({ stdout, stderr: '', exitCode: 0 });
export const failed = (stderr = 'Access denied') => ({
  stdout: '',
  stderr,
  exitCode: 1,
});

export async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'openshears-test-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  await fs.ensureDir(home);
  await fs.ensureDir(cwd);
  return { root, home, cwd, cleanup: () => fs.remove(root) };
}

export function emptyCommand(command: string, args: readonly string[] = []) {
  if (command === 'npm') return ok('{}');
  if (command === 'pnpm') return ok('[]');
  if (command === 'launchctl' && args[0] === 'print')
    return failed('Could not find service');
  return ok();
}
