import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';
import { detectServices, isServiceName, stopService } from '../src/services.js';
import { resolveContext } from '../src/paths.js';
import { fixture, emptyCommand, ok, failed } from './helpers.js';

vi.mock('execa');
afterEach(() => vi.resetAllMocks());

describe('service teardown', () => {
  it('allows a leftover backup when systemd confirms the unit is absent', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce(failed('Unit does not exist') as any)
      .mockResolvedValueOnce(
        ok('LoadState=not-found\nActiveState=inactive\nUnitFileState=') as any,
      );
    await stopService(
      {
        manager: 'systemd',
        id: 'openclaw-gateway.service',
        files: ['/unused/openclaw-gateway.service.bak'],
      },
      501,
    );
  });
  it('blocks registered system units even without a file in /etc/systemd/system', async () => {
    const f = await fixture();
    try {
      vi.mocked(execa).mockImplementation(async (cmd, args) =>
        args?.includes('--system')
          ? (ok(
              'openclaw-gateway.service loaded active running OpenClaw',
            ) as any)
          : (emptyCommand(String(cmd), args as string[]) as any),
      );
      const result = await detectServices(
        resolveContext({
          home: f.home,
          cwd: f.cwd,
          env: {},
          platform: 'linux',
          uid: 501,
        }),
      );
      expect(result.blockers).toContain(
        'System service requires administrator-managed removal: openclaw-gateway.service',
      );
      expect(result.services).toEqual([]);
    } finally {
      await f.cleanup();
    }
  });
  it('matches gateway, node, profiles and the documented legacy unit exactly', () => {
    for (const name of [
      'openclaw-gateway.service',
      'openclaw-node.service',
      'openclaw-gateway-work.service',
      'clawdbot-gateway.service',
    ])
      expect(isServiceName(name, 'systemd')).toBe(true);
    for (const name of [
      'other-openclaw-gateway.service',
      'openclaw-gateway.service.bak',
      '../openclaw-node.service',
    ])
      expect(isServiceName(name, 'systemd')).toBe(false);
    expect(isServiceName('ai.openclaw.work', 'launchd')).toBe(true);
    expect(isServiceName('com.example.openclaw', 'launchd')).toBe(false);
  });

  it('collects systemd units, backups and drop-ins but not unrelated files', async () => {
    const f = await fixture();
    try {
      const dir = path.join(f.home, '.config/systemd/user');
      for (const name of [
        'openclaw-gateway.service',
        'openclaw-gateway.service.bak',
        'openclaw-gateway.service.d/override.conf',
        'not-openclaw.service',
      ])
        await fs.outputFile(path.join(dir, name), '[Service]');
      vi.mocked(execa).mockImplementation(
        async (cmd, args) => emptyCommand(String(cmd), args as string[]) as any,
      );
      const result = await detectServices(
        resolveContext({
          home: f.home,
          cwd: f.cwd,
          env: {},
          platform: 'linux',
          uid: 501,
        }),
      );
      expect(result.services).toEqual([
        {
          manager: 'systemd',
          id: 'openclaw-gateway.service',
          files: [
            path.join(dir, 'openclaw-gateway.service'),
            path.join(dir, 'openclaw-gateway.service.bak'),
            path.join(dir, 'openclaw-gateway.service.d'),
          ],
        },
      ]);
    } finally {
      await f.cleanup();
    }
  });

  it('uses the GUI domain, boots out launchd and verifies absence', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce(ok('service exists') as any)
      .mockResolvedValueOnce(ok() as any)
      .mockResolvedValueOnce(failed('Could not find service') as any);
    await stopService(
      { manager: 'launchd', id: 'ai.openclaw.work', files: [] },
      501,
    );
    expect(vi.mocked(execa).mock.calls.map((call) => call[1])).toEqual([
      ['print', 'gui/501/ai.openclaw.work'],
      ['bootout', 'gui/501/ai.openclaw.work'],
      ['print', 'gui/501/ai.openclaw.work'],
    ]);
  });

  it('allows already-unloaded launchd definitions without swallowing access failures', async () => {
    vi.mocked(execa).mockResolvedValueOnce(
      failed('Could not find service') as any,
    );
    await stopService(
      { manager: 'launchd', id: 'ai.openclaw.gateway', files: [] },
      501,
    );
    vi.mocked(execa).mockResolvedValueOnce(
      failed('Operation not permitted') as any,
    );
    await expect(
      stopService(
        { manager: 'launchd', id: 'ai.openclaw.gateway', files: [] },
        501,
      ),
    ).rejects.toThrow('Cannot inspect');
  });

  it('does not accept an active or still-enabled systemd unit', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce(ok() as any)
      .mockResolvedValueOnce(
        ok('ActiveState=active\nUnitFileState=disabled') as any,
      );
    await expect(
      stopService(
        { manager: 'systemd', id: 'openclaw-gateway.service', files: [] },
        501,
      ),
    ).rejects.toThrow('could not be verified');
    vi.mocked(execa)
      .mockResolvedValueOnce(ok() as any)
      .mockResolvedValueOnce(
        ok('ActiveState=inactive\nUnitFileState=enabled') as any,
      );
    await expect(
      stopService(
        { manager: 'systemd', id: 'openclaw-gateway.service', files: [] },
        501,
      ),
    ).rejects.toThrow('could not be verified');
  });

  it('accepts an inactive, disabled systemd unit', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce(ok() as any)
      .mockResolvedValueOnce(
        ok('ActiveState=inactive\nUnitFileState=disabled') as any,
      );
    await stopService(
      { manager: 'systemd', id: 'openclaw-node.service', files: [] },
      501,
    );
    expect(execa).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'disable', '--now', 'openclaw-node.service'],
      expect.anything(),
    );
  });
});
