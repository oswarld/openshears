import { afterEach, describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';
import {
  detectProcesses,
  isOpenClawCommand,
  killProcess,
  parseProcesses,
} from '../src/processes.js';
import { ok, failed } from './helpers.js';

vi.mock('execa');
vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));
const row = (
  pid: number,
  command: string,
  uid = 501,
  parent = 1,
  second = '00',
) => `${pid} ${parent} ${uid} Thu Sep 10 12:00:${second} 2026 ${command}`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('process identity', () => {
  it.each([
    'openclaw-gateway',
    '/usr/local/bin/openclaw gateway',
    '/usr/bin/node /opt/openclaw/openclaw.mjs gateway',
    'node /opt/lib/node_modules/openclaw/dist/index.js gateway',
    '/Applications/OpenClaw.app/Contents/MacOS/OpenClaw',
  ])('recognizes the executable or entry point: %s', (command) =>
    expect(isOpenClawCommand(command)).toBe(true),
  );

  it.each([
    'node /project/openclaw-demo/server.js',
    'vim /home/me/.openclaw/openclaw.json',
    'sh -c openclaw',
    'pgrep -f openclaw',
    'node /project/openshears/dist/index.js',
    'node -e "openclaw"',
    'openclaw-helper',
    'node /project/script.js openclaw.mjs',
  ])('does not target incidental mentions: %s', (command) =>
    expect(isOpenClawCommand(command)).toBe(false),
  );

  it('excludes other users, itself and all its ancestors', () => {
    const stdout = [
      row(10, 'openclaw-gateway'),
      row(11, 'openclaw-gateway', 0),
      row(12, 'openclaw-gateway', 501, 13),
      row(13, 'openclaw-gateway'),
    ].join('\n');
    expect(parseProcesses(stdout, 501, 12).map((proc) => proc.pid)).toEqual([
      10,
    ]);
  });

  it('treats ps failures as errors rather than an empty process list', async () => {
    vi.mocked(execa).mockResolvedValue(failed() as any);
    await expect(detectProcesses(501)).rejects.toThrow('Cannot inspect');
  });

  it('never signals a reused PID', async () => {
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    const target = parseProcesses(row(10, 'openclaw-gateway'), 501)[0];
    vi.mocked(execa).mockResolvedValue(
      ok(row(10, 'openclaw-gateway', 501, 1, '01')) as any,
    );
    await killProcess(target, 501, true);
    expect(kill).not.toHaveBeenCalled();
  });

  it('waits for graceful exit and does not escalate without --force', async () => {
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    const text = row(10, 'openclaw-gateway');
    vi.mocked(execa).mockResolvedValue(ok(text) as any);
    await expect(
      killProcess(parseProcesses(text, 501)[0], 501),
    ).rejects.toThrow('Data preserved');
    expect(kill.mock.calls).toEqual([[10, 'SIGTERM']]);
  });

  it('escalates only the verified PID with --force and verifies exit', async () => {
    const text = row(10, 'openclaw-gateway');
    let alive = true;
    const kill = vi
      .spyOn(process, 'kill')
      .mockImplementation((_pid, signal) => {
        if (signal === 'SIGKILL') alive = false;
        return true;
      });
    vi.mocked(execa).mockImplementation(
      async () => ok(alive ? text : '') as any,
    );
    await killProcess(parseProcesses(text, 501)[0], 501, true);
    expect(kill.mock.calls).toEqual([
      [10, 'SIGTERM'],
      [10, 'SIGKILL'],
    ]);
  });
});
