import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirm } from '@clack/prompts';
import { runCli } from '../src/cli.js';
import { detectArtifacts } from '../src/detector.js';
import { removeArtifacts } from '../src/remover.js';
import type { Artifacts } from '../src/detector.js';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn((value) => typeof value === 'symbol'),
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));
vi.mock('../src/detector.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/detector.js')>()),
  detectArtifacts: vi.fn(),
}));
vi.mock('../src/remover.js', () => ({ removeArtifacts: vi.fn() }));

const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const tty = (value: boolean) => {
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value });
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value });
};

describe('CLI confirmation and previews', () => {
  beforeEach(() => {
    tty(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(detectArtifacts).mockResolvedValue({
      directories: ['/home/test/.openclaw'],
      files: [],
      packages: [],
      services: [],
      processes: [
        {
          pid: 123,
          startedAt: 'today',
          command: 'openclaw --token SECRET_TOKEN',
        },
      ],
      preserved: [],
      warnings: [],
      blockers: [],
      identities: {},
      protectedPaths: [],
      platform: 'linux',
      uid: 501,
    } as Artifacts);
    vi.mocked(removeArtifacts).mockResolvedValue(undefined);
  });
  afterEach(() => {
    if (stdinTTY) Object.defineProperty(process.stdin, 'isTTY', stdinTTY);
    else delete (process.stdin as any).isTTY;
    if (stdoutTTY) Object.defineProperty(process.stdout, 'isTTY', stdoutTTY);
    else delete (process.stdout as any).isTTY;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each([false, Symbol('cancel')])(
    'never removes on a negative or cancelled confirmation: %s',
    async (answer) => {
      vi.mocked(confirm).mockResolvedValue(answer);
      expect(await runCli()).toBe(0);
      expect(removeArtifacts).not.toHaveBeenCalled();
    },
  );

  it('removes after explicit confirmation', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    expect(await runCli()).toBe(0);
    expect(removeArtifacts).toHaveBeenCalledOnce();
  });

  it('dry-run overrides --yes without prompting', async () => {
    expect(await runCli({ dryRun: true, yes: true })).toBe(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(removeArtifacts).not.toHaveBeenCalled();
  });

  it('JSON is read-only, valid and excludes secret-bearing command lines', async () => {
    expect(await runCli({ json: true, yes: true })).toBe(0);
    expect(console.log).toHaveBeenCalledOnce();
    const output = vi.mocked(console.log).mock.calls[0][0];
    expect(JSON.parse(output).processes).toEqual([
      { pid: 123, startedAt: 'today' },
    ]);
    expect(output).not.toContain('SECRET_TOKEN');
    expect(removeArtifacts).not.toHaveBeenCalled();
  });

  it('requires --yes when there is no TTY', async () => {
    tty(false);
    await expect(runCli()).rejects.toThrow('requires --yes');
    expect(removeArtifacts).not.toHaveBeenCalled();
    await runCli({ yes: true });
    expect(removeArtifacts).toHaveBeenCalledOnce();
  });

  it('returns failure for blockers even with --yes', async () => {
    const plan = await vi.mocked(detectArtifacts)();
    plan.blockers.push('Service inspection failed');
    expect(await runCli({ yes: true })).toBe(1);
    expect(removeArtifacts).not.toHaveBeenCalled();
  });

  it('rejects conflicting data flags before scanning', async () => {
    await expect(
      runCli({ includeWorkspaces: true, keepData: true }),
    ).rejects.toThrow('cannot be combined');
    expect(detectArtifacts).not.toHaveBeenCalled();
  });
});
