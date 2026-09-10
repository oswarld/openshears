import os from 'node:os';
import path from 'node:path';

export const PROFILE_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export const STATE_NAMES = ['.openclaw', '.clawdbot', '.moltbot', '.moldbot'];
export const CONFIG_NAMES = ['openclaw.json', 'clawdbot.json'];

export interface ScanOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  cwd?: string;
  platform?: NodeJS.Platform;
  uid?: number;
  includeWorkspaces?: boolean;
  keepData?: boolean;
}

export function expandPath(value: string, home: string, cwd: string): string {
  const trimmed = value.trim();
  return path.resolve(
    cwd,
    trimmed === '~'
      ? home
      : trimmed.startsWith('~/')
        ? path.join(home, trimmed.slice(2))
        : trimmed,
  );
}

export function resolveContext(options: ScanOptions = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const home = path.resolve(
    options.home ?? env.HOME ?? env.USERPROFILE ?? os.homedir(),
  );
  const clawHome = env.OPENCLAW_HOME?.trim()
    ? expandPath(env.OPENCLAW_HOME, home, cwd)
    : home;
  return {
    env,
    cwd,
    home,
    clawHome,
    platform: options.platform ?? process.platform,
    uid: options.uid ?? process.getuid?.(),
  };
}

export type ScanContext = ReturnType<typeof resolveContext>;

export function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}
