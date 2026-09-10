import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { run } from './utils.js';

export interface ProcessArtifact {
  pid: number;
  startedAt: string;
  command: string;
}

export function isOpenClawCommand(command: string): boolean {
  const [executable, script] = command.trim().split(/\s+/);
  const name = path.basename(executable ?? '');
  if (
    [
      'openclaw',
      'openclaw-gateway',
      'openclaw-node',
      'clawdbot',
      'moltbot',
    ].includes(name)
  )
    return true;
  if (
    /^(?:\/Applications|\/Users\/[^/]+\/Applications)\/OpenClaw\.app\/Contents\/MacOS\/OpenClaw$/.test(
      executable,
    )
  )
    return true;
  if (!['node', 'bun'].includes(name) || !script) return false;
  return (
    /(?:^|\/)(?:openclaw\.mjs|clawdbot\.mjs)$/.test(script) ||
    /\/node_modules\/(?:openclaw|clawdbot|moltbot)\/dist\/(?:index|entry)\.js$/.test(
      script,
    )
  );
}

export function parseProcesses(
  stdout: string,
  uid: number,
  ownPid = process.pid,
): ProcessArtifact[] {
  const rows = stdout.split('\n').flatMap((line) => {
    const match = line
      .trim()
      .match(
        /^(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.+)$/,
      );
    return match
      ? [
          {
            pid: Number(match[1]),
            ppid: Number(match[2]),
            uid: Number(match[3]),
            startedAt: match[4],
            command: match[5],
          },
        ]
      : [];
  });
  const ancestors = new Set([ownPid]);
  let pid = ownPid;
  while (true) {
    const parent = rows.find((row) => row.pid === pid)?.ppid;
    if (!parent || ancestors.has(parent)) break;
    ancestors.add(parent);
    pid = parent;
  }
  return rows
    .filter(
      (row) =>
        row.uid === uid &&
        row.pid > 1 &&
        !ancestors.has(row.pid) &&
        isOpenClawCommand(row.command),
    )
    .map(({ pid, startedAt, command }) => ({ pid, startedAt, command }));
}

export async function detectProcesses(uid: number): Promise<ProcessArtifact[]> {
  const result = await run('ps', ['-axo', 'pid=,ppid=,uid=,lstart=,args=']);
  if (result.exitCode !== 0)
    throw new Error('Cannot inspect running processes.');
  return parseProcesses(result.stdout, uid);
}

export async function killProcess(
  target: ProcessArtifact,
  uid: number,
  force = false,
): Promise<void> {
  const stillRunning = async () =>
    (await detectProcesses(uid)).some(
      (row) =>
        row.pid === target.pid &&
        row.startedAt === target.startedAt &&
        row.command === target.command,
    );
  const signal = (value: NodeJS.Signals) => {
    try {
      process.kill(target.pid, value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  if (!(await stillRunning())) return;
  signal('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt++) {
    await delay(250);
    if (!(await stillRunning())) return;
  }
  if (!force)
    throw new Error(
      `Process ${target.pid} did not stop. Data preserved; retry with --force to allow SIGKILL.`,
    );
  if (!(await stillRunning())) return;
  signal('SIGKILL');
  for (let attempt = 0; attempt < 20; attempt++) {
    await delay(250);
    if (!(await stillRunning())) return;
  }
  throw new Error(`Process ${target.pid} is still running. Data preserved.`);
}
