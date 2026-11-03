import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirm, multiselect } from '@clack/prompts';
import { runAudit, runPrune } from '../src/commands.js';
import type {
  Connection,
  Provider,
  ProviderSession,
} from '../src/core/model.js';

vi.mock('@clack/prompts', () => ({
  note: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn((value) => typeof value === 'symbol'),
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const tty = (value: boolean) => {
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value });
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value });
};

const app = (name: string, id: string, revocable = true): Connection => ({
  provider: 'fake',
  kind: 'oauth-app',
  id,
  name,
  revocable,
  lastUsed: 'Last used today',
});

let connections: Connection[];
let revoked: string[];
let closed: number;

const session = (): ProviderSession => ({
  audit: async () => ({
    provider: 'fake',
    account: 'octocat',
    connections,
    warnings: [],
  }),
  revoke: async (connection) => {
    if (connection.id === 'broken') throw new Error('page changed');
    revoked.push(connection.name);
  },
  close: async () => {
    closed += 1;
  },
});
const fake: Provider = {
  id: 'fake',
  title: 'Fake',
  description: 'test provider',
  kind: 'remote',
  connect: async () => session(),
};
const providers = [fake];

describe('audit and prune commands', () => {
  beforeEach(() => {
    tty(true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    connections = [
      app('OpenAI dots', 'aaa'),
      app('Claude Duet', 'bbb'),
      app('Meta Muse', 'ccc'),
      app('Pinned app', 'ddd', false),
    ];
    revoked = [];
    closed = 0;
  });
  afterEach(() => {
    if (stdinTTY) Object.defineProperty(process.stdin, 'isTTY', stdinTTY);
    else delete (process.stdin as any).isTTY;
    if (stdoutTTY) Object.defineProperty(process.stdout, 'isTTY', stdoutTTY);
    else delete (process.stdout as any).isTTY;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('audit --json reports every provider and closes sessions', async () => {
    expect(await runAudit([], { json: true, providers })).toBe(0);
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.providers[0].account).toBe('octocat');
    expect(output.providers[0].connections).toHaveLength(4);
    expect(closed).toBe(1);
  });

  it('audit reports a failing provider as a warning with exit 1', async () => {
    const failing: Provider = {
      ...fake,
      id: 'down',
      connect: async () => {
        throw new Error('offline');
      },
    };
    expect(await runAudit(['down'], { json: true, providers: [failing] })).toBe(
      1,
    );
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.providers[0].warnings).toEqual(['offline']);
  });

  it('keeps one agent and revokes the rest after confirmation', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    expect(await runPrune('fake', { keep: ['Claude Duet'], providers })).toBe(
      0,
    );
    expect(revoked).toEqual(['OpenAI dots', 'Meta Muse']);
    expect(closed).toBe(1);
  });

  it.each([false, Symbol('cancel')])(
    'revokes nothing on a negative or cancelled confirmation: %s',
    async (answer) => {
      vi.mocked(confirm).mockResolvedValue(answer);
      expect(await runPrune('fake', { keep: ['Claude Duet'], providers })).toBe(
        0,
      );
      expect(revoked).toEqual([]);
    },
  );

  it('dry-run and --json never revoke, even with --yes', async () => {
    expect(
      await runPrune('fake', { all: true, dryRun: true, yes: true, providers }),
    ).toBe(0);
    expect(
      await runPrune('fake', { all: true, json: true, yes: true, providers }),
    ).toBe(0);
    expect(revoked).toEqual([]);
    expect(confirm).not.toHaveBeenCalled();
    const output = JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0]);
    expect(output.dryRun).toBe(true);
    expect(output.revoke).toHaveLength(3);
    expect(output.skipped).toHaveLength(1);
  });

  it('refuses to run when a keep pattern matches nothing', async () => {
    await expect(
      runPrune('fake', { keep: ['Claude Duett'], yes: true, providers }),
    ).rejects.toThrow('No connection matches');
    expect(revoked).toEqual([]);
    expect(closed).toBe(1);
  });

  it('requires an explicit selection and --yes without a TTY', async () => {
    tty(false);
    await expect(runPrune('fake', { providers })).rejects.toThrow(
      '--keep, --revoke or --all',
    );
    await expect(
      runPrune('fake', { keep: ['Claude Duet'], providers }),
    ).rejects.toThrow('requires --yes');
    expect(revoked).toEqual([]);
    expect(
      await runPrune('fake', { keep: ['Claude Duet'], yes: true, providers }),
    ).toBe(0);
    expect(revoked).toEqual(['OpenAI dots', 'Meta Muse']);
  });

  it('uses the interactive keep selection when no flags are given', async () => {
    vi.mocked(multiselect).mockResolvedValue(['bbb', 'ccc']);
    vi.mocked(confirm).mockResolvedValue(true);
    expect(await runPrune('fake', { providers })).toBe(0);
    expect(revoked).toEqual(['OpenAI dots']);
  });

  it('continues after a failed revocation and returns 1', async () => {
    connections.push(app('Broken app', 'broken'));
    expect(
      await runPrune('fake', { keep: ['Claude Duet'], yes: true, providers }),
    ).toBe(1);
    expect(revoked).toEqual(['OpenAI dots', 'Meta Muse']);
  });
});
