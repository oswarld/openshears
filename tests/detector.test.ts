import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';
import { detectArtifacts, publicPlan } from '../src/detector.js';
import { fixture, emptyCommand, ok, failed } from './helpers.js';

vi.mock('execa');

describe('artifact discovery', () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeEach(async () => {
    f = await fixture();
    vi.mocked(execa).mockImplementation(
      async (cmd, args) => emptyCommand(String(cmd), args as string[]) as any,
    );
  });
  afterEach(async () => {
    await f.cleanup();
    vi.resetAllMocks();
  });
  const scan = (options = {}) =>
    detectArtifacts({
      home: f.home,
      cwd: f.cwd,
      env: {},
      platform: 'linux',
      uid: 501,
      ...options,
    });

  it('discovers default, legacy and evidenced profile state, but not similarly named backups', async () => {
    await fs.ensureDir(path.join(f.home, '.openclaw'));
    await fs.ensureDir(path.join(f.home, '.clawdbot'));
    await fs.ensureDir(path.join(f.home, '.openclaw-backup'));
    await fs.outputFile(
      path.join(f.home, '.openclaw-work/openclaw.json'),
      '{}',
    );
    const result = await scan();
    expect(result.directories).toEqual(
      ['.clawdbot', '.openclaw', '.openclaw-work'].map((name) =>
        path.join(f.home, name),
      ),
    );
    expect(result.blockers).toEqual([]);
  });

  it('resolves OPENCLAW_HOME, profile, state, config and OAuth overrides at scan time', async () => {
    const relocated = path.join(f.home, 'relocated');
    const custom = path.join(relocated, 'custom-state');
    const config = path.join(relocated, 'settings/custom.json');
    const oauth = path.join(relocated, 'oauth');
    await fs.ensureDir(custom);
    await fs.ensureDir(oauth);
    await fs.ensureDir(path.join(relocated, '.openclaw-work'));
    await fs.outputFile(config, '{}');
    const result = await scan({
      env: {
        OPENCLAW_HOME: '~/relocated',
        OPENCLAW_PROFILE: 'work',
        OPENCLAW_STATE_DIR: '~/custom-state',
        OPENCLAW_CONFIG_PATH: '~/settings/custom.json',
        OPENCLAW_OAUTH_DIR: '~/oauth',
      },
    });
    expect(result.directories).toEqual(
      expect.arrayContaining([
        custom,
        oauth,
        path.join(relocated, '.openclaw-work'),
      ]),
    );
    expect(result.files).toContain(config);
  });

  it('reads JSON5 workspaces and preserves external workspaces unless explicitly selected', async () => {
    const external = path.join(f.home, 'writing');
    await fs.ensureDir(external);
    const state = path.join(f.home, '.openclaw');
    await fs.outputFile(
      path.join(state, 'openclaw.json'),
      `{
      // A normal OpenClaw JSON5 config
      agents: { defaults: { workspace: '~/writing' }, list: [{ id: 'main', workspace: '~/writing' }] },
    }`,
    );
    const result = await scan();
    expect(result.directories).toEqual([state]);
    expect(result.preserved).toContain(external);
    const included = await scan({ includeWorkspaces: true });
    expect(included.directories).toEqual([state, external]);
    expect(included.preserved).toEqual([]);
  });

  it('keeps state/config/credentials with --keep-data while still detecting services', async () => {
    const state = path.join(f.home, '.openclaw');
    const config = path.join(f.home, 'custom.json');
    const oauth = path.join(f.home, 'oauth');
    await fs.ensureDir(state);
    await fs.ensureDir(oauth);
    await fs.outputFile(config, '{}');
    await fs.outputFile(
      path.join(f.home, '.config/systemd/user/openclaw-node.service'),
      '[Service]',
    );
    const result = await scan({
      keepData: true,
      env: { OPENCLAW_CONFIG_PATH: config, OPENCLAW_OAUTH_DIR: oauth },
    });
    expect(result.directories).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.preserved).toEqual(
      expect.arrayContaining([state, config, oauth]),
    );
    expect(result.services[0].id).toBe('openclaw-node.service');
  });

  it('blocks dangerous overrides before removal', async () => {
    const result = await scan({ env: { OPENCLAW_STATE_DIR: f.home } });
    expect(result.directories).not.toContain(f.home);
    expect(result.blockers.join(' ')).toContain('protected directory');
  });

  it('rejects traversal in profiles', async () => {
    expect(
      (
        await scan({ env: { OPENCLAW_PROFILE: '../../outside' } })
      ).blockers.join(' '),
    ).toContain('OPENCLAW_PROFILE');
  });

  it('does not erase an installer prefix that shares the state root', async () => {
    const state = path.join(f.home, '.openclaw');
    await fs.ensureDir(path.join(state, 'tools/node'));
    expect((await scan()).blockers.join(' ')).toContain('installation prefix');
    expect((await scan({ keepData: true })).blockers).toEqual([]);
  });

  it('reports malformed configs without leaking their contents', async () => {
    await fs.outputFile(
      path.join(f.home, '.openclaw/openclaw.json'),
      '{ token: TOP_SECRET',
    );
    const result = await scan({ includeWorkspaces: true });
    expect(result.blockers.join(' ')).toContain('readable config');
    expect(JSON.stringify(publicPlan(result))).not.toContain('TOP_SECRET');
  });

  it('does not follow a state symlink or delete its target', async () => {
    const target = path.join(f.home, 'shared');
    const link = path.join(f.home, '.openclaw');
    await fs.ensureDir(target);
    await fs.symlink(target, link);
    const result = await scan();
    expect(result.directories).toContain(link);
    expect(result.directories).not.toContain(target);
    expect(result.warnings.join(' ')).toContain('target is preserved');
  });

  it('preserves a workspace that contains state, including an OAuth override inside it', async () => {
    const workspace = path.join(f.home, 'writing');
    const state = path.join(workspace, '.openclaw');
    const oauth = path.join(workspace, 'oauth');
    await fs.outputJson(path.join(state, 'openclaw.json'), {
      agents: { defaults: { workspace } },
    });
    await fs.ensureDir(oauth);
    const result = await scan({
      env: { OPENCLAW_STATE_DIR: state, OPENCLAW_OAUTH_DIR: oauth },
    });
    expect(result.directories).toEqual([]);
    expect(result.preserved).toContain(workspace);
  });

  it('keeps a state tree reached by a preserved external workspace symlink', async () => {
    const state = path.join(f.home, '.openclaw');
    const workspace = path.join(state, 'workspace');
    const link = path.join(f.home, 'writing');
    await fs.ensureDir(workspace);
    await fs.symlink(workspace, link);
    await fs.outputJson(path.join(state, 'openclaw.json'), {
      agents: { defaults: { workspace: link } },
    });
    const result = await scan();
    expect(result.directories).not.toContain(state);
    expect(result.preserved).toContain(state);
  });

  it('finds loaded profile services even after their state and service files are gone', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) => {
      if (cmd === 'launchctl')
        return ok(
          'PID Status Label\n123 0 ai.openclaw.work\n- 0 com.example.openclaw-helper',
        ) as any;
      return emptyCommand(String(cmd), args as string[]) as any;
    });
    const result = await scan({ platform: 'darwin' });
    expect(result.services).toEqual([
      { manager: 'launchd', id: 'ai.openclaw.work', files: [] },
    ]);
  });

  it('blocks teardown when the service inventory cannot be read', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) =>
      cmd === 'systemctl'
        ? (failed('Failed to connect to bus') as any)
        : (emptyCommand(String(cmd), args as string[]) as any),
    );
    expect((await scan()).blockers.join(' ')).toContain(
      'Cannot inspect systemd',
    );
  });

  it('blocks active update handoffs and unsupported Windows removal', async () => {
    vi.mocked(execa).mockImplementation(async (cmd, args) =>
      cmd === 'launchctl'
        ? (ok('- 0 ai.openclaw.work.update.123') as any)
        : (emptyCommand(String(cmd), args as string[]) as any),
    );
    expect((await scan({ platform: 'darwin' })).blockers.join(' ')).toContain(
      'update job',
    );
    expect((await scan({ platform: 'win32' })).blockers.join(' ')).toContain(
      'macOS and Linux/WSL only',
    );
  });
});
