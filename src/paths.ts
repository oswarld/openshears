import os from 'node:os';
import path from 'node:path';

export const OPENCLAW_STATE_DIR = path.join(os.homedir(), '.openclaw');
export const LEGACY_STATE_DIRS = [
  path.join(os.homedir(), '.clawdbot'),
  path.join(os.homedir(), '.moltbot'),
  path.join(os.homedir(), '.moldbot'),
];

export const MACOS_LOG_DIR = path.join(os.homedir(), 'Library/Logs/OpenClaw');
export const CONFIG_FILENAME = 'openclaw.json';
export const LOCK_DIR_BASE = os.tmpdir();
