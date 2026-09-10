import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';
import { isWithin } from './paths.js';

// Subprocess output can contain credentials; report failures without echoing it.
export async function run(command: string, args: string[], timeout = 10_000) {
  const result = await execa(command, args, {
    reject: false,
    timeout,
    env: { LC_ALL: 'C', LANG: 'C', NO_COLOR: '1' },
    stdin: 'ignore',
  });
  // reject:false also returns spawn/timeout failures instead of throwing them.
  if ('code' in result && result.code === 'ENOENT') {
    throw Object.assign(new Error(`Command unavailable: ${command}`), {
      code: 'ENOENT',
    });
  }
  if (result.timedOut) throw new Error(`Command timed out: ${command}`);
  return result;
}

export async function listDirectory(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(`Cannot inspect directory: ${dir}`);
  }
}

export async function pathExists(file: string): Promise<boolean> {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new Error(`Cannot inspect path: ${file}`);
  }
}

// Resolve parent links but never follow the final link: removal unlinks it only.
export async function removalIdentity(file: string): Promise<string> {
  let parent = path.dirname(file);
  const suffix = [path.basename(file)];
  while (!(await pathExists(parent))) {
    suffix.unshift(path.basename(parent));
    parent = path.dirname(parent);
  }
  return path.join(await fs.realpath(parent), ...suffix);
}

export async function assertSafePath(
  file: string,
  protectedPaths: string[],
): Promise<void> {
  if (!path.isAbsolute(file) || path.resolve(file) !== file)
    throw new Error(`Unsafe removal path: ${file}`);
  const identity = await removalIdentity(file);
  for (const protectedPath of [path.parse(file).root, ...protectedPaths]) {
    const resolved = path.resolve(protectedPath);
    const real = (await pathExists(resolved))
      ? await fs.realpath(resolved)
      : resolved;
    if (isWithin(file, resolved) || isWithin(identity, real)) {
      throw new Error(
        `Refusing to remove a protected directory or its ancestor: ${file}`,
      );
    }
  }
  for (
    let parent = path.dirname(file);
    parent !== path.dirname(parent);
    parent = path.dirname(parent)
  ) {
    // macOS exposes these OS-owned aliases; user-created ancestor links are rejected.
    if (
      (await pathExists(parent)) &&
      (await fs.lstat(parent)).isSymbolicLink() &&
      !['/tmp', '/var', '/etc'].includes(parent)
    ) {
      throw new Error(`Refusing removal through a symbolic link: ${file}`);
    }
  }
}

export async function removePath(
  file: string,
  protectedPaths: string[],
  expectedIdentity?: string,
): Promise<void> {
  await assertSafePath(file, protectedPaths);
  if (expectedIdentity && (await removalIdentity(file)) !== expectedIdentity) {
    throw new Error(`Path changed after detection; scan again: ${file}`);
  }
  await fs.remove(file);
}
