import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';
import { removeArtifacts } from '../src/remover.js';
import { removalIdentity, removePath } from '../src/utils.js';
import { detectProcesses, killProcess } from '../src/processes.js';
import { stopService } from '../src/services.js';
import { uninstallPackage } from '../src/packages.js';
import type { Artifacts } from '../src/detector.js';
import { fixture, ok, failed } from './helpers.js';

vi.mock('execa');
vi.mock('../src/processes.js', () => ({
  detectProcesses: vi.fn(),
  killProcess: vi.fn(),
}));
vi.mock('../src/services.js', () => ({ stopService: vi.fn() }));
vi.mock('../src/packages.js', () => ({ uninstallPackage: vi.fn() }));

describe('removal safety gates', () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  let plan: Artifacts;
  let data: string;
  let unit: string;
  beforeEach(async () => {
    f = await fixture();
    data = path.join(f.home, '.openclaw');
    unit = path.join(f.home, 'services/openclaw-gateway.service');
    await fs.outputFile(
      path.join(data, 'memory.md'),
      'retain if teardown fails',
    );
    await fs.outputFile(unit, '[Service]');
    plan = {
      directories: [data],
      files: [],
      processes: [],
      packages: [{ manager: 'npm', name: 'openclaw', version: '2026.9.3' }],
      services: [
        { manager: 'systemd', id: 'openclaw-gateway.service', files: [unit] },
      ],
      preserved: [],
      warnings: [],
      blockers: [],
      protectedPaths: [f.home, f.cwd],
      identities: {
        [data]: await removalIdentity(data),
        [unit]: await removalIdentity(unit),
      },
      platform: 'linux',
      uid: 501,
    };
    vi.mocked(execa).mockResolvedValue(ok() as any);
    vi.mocked(detectProcesses).mockResolvedValue([]);
    vi.mocked(stopService).mockResolvedValue(undefined);
    vi.mocked(uninstallPackage).mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await f.cleanup();
    vi.resetAllMocks();
  });

  it('makes no mutations in dry-run mode', async () => {
    await removeArtifacts(plan, { dryRun: true });
    expect(await fs.pathExists(data)).toBe(true);
    expect(await fs.pathExists(unit)).toBe(true);
    expect(stopService).not.toHaveBeenCalled();
    expect(execa).not.toHaveBeenCalled();
    expect(uninstallPackage).not.toHaveBeenCalled();
  });

  it('preflights every path before touching a service', async () => {
    plan.files.push(f.home);
    plan.identities[f.home] = await removalIdentity(f.home);
    await expect(removeArtifacts(plan)).rejects.toThrow('protected directory');
    expect(stopService).not.toHaveBeenCalled();
    expect(await fs.pathExists(data)).toBe(true);
  });

  it('preserves data and packages when a service cannot stop', async () => {
    vi.mocked(stopService).mockRejectedValue(new Error('teardown failed'));
    await expect(removeArtifacts(plan)).rejects.toThrow('teardown failed');
    expect(await fs.pathExists(data)).toBe(true);
    expect(await fs.pathExists(unit)).toBe(true);
    expect(uninstallPackage).not.toHaveBeenCalled();
  });

  it('preserves data on daemon-reload failure', async () => {
    vi.mocked(execa).mockResolvedValue(failed() as any);
    await expect(removeArtifacts(plan)).rejects.toThrow('Data preserved');
    expect(await fs.pathExists(data)).toBe(true);
    expect(uninstallPackage).not.toHaveBeenCalled();
  });

  it('does not remove data or packages while processes remain', async () => {
    vi.mocked(detectProcesses).mockResolvedValue([
      { pid: 123, startedAt: 'today', command: 'openclaw-gateway' },
    ]);
    vi.mocked(killProcess).mockResolvedValue(undefined);
    await expect(removeArtifacts(plan)).rejects.toThrow('still running');
    expect(await fs.pathExists(data)).toBe(true);
    expect(uninstallPackage).not.toHaveBeenCalled();
  });

  it('removes services, packages, then data, and leaves unrelated files alone', async () => {
    const unrelated = path.join(f.home, 'important.txt');
    await fs.writeFile(unrelated, 'keep');
    vi.mocked(stopService).mockImplementation(async () => {
      expect(await fs.pathExists(unit)).toBe(true);
    });
    vi.mocked(uninstallPackage).mockImplementation(async () => {
      expect(await fs.pathExists(unit)).toBe(false);
      expect(await fs.pathExists(data)).toBe(true);
    });
    await removeArtifacts(plan);
    expect(await fs.pathExists(data)).toBe(false);
    expect(await fs.readFile(unrelated, 'utf8')).toBe('keep');
    expect(execa).toHaveBeenCalledWith(
      'systemctl',
      ['--user', 'daemon-reload'],
      expect.anything(),
    );
  });

  it('preserves data if package removal fails', async () => {
    vi.mocked(uninstallPackage).mockRejectedValue(new Error('package failed'));
    await expect(removeArtifacts(plan)).rejects.toThrow('package failed');
    expect(await fs.pathExists(data)).toBe(true);
  });

  it('unlinks a leaf symlink without deleting the target', async () => {
    const link = path.join(f.home, 'state-link');
    await fs.symlink(data, link);
    await removePath(link, [f.home]);
    expect(await fs.pathExists(data)).toBe(true);
    expect(await fs.pathExists(link)).toBe(false);
  });

  it('rejects symlinked ancestors and preserves their contents', async () => {
    const link = path.join(f.home, 'linked-parent');
    await fs.symlink(data, link);
    await expect(
      removePath(path.join(link, 'memory.md'), [f.home]),
    ).rejects.toThrow('symbolic link');
    expect(await fs.pathExists(path.join(data, 'memory.md'))).toBe(true);
  });

  it('rejects redirected paths after discovery', async () => {
    const original = path.dirname(unit);
    const moved = path.join(f.home, 'moved-services');
    await fs.move(original, moved);
    await fs.symlink(moved, original);
    await expect(removeArtifacts(plan)).rejects.toThrow('symbolic link');
    expect(stopService).not.toHaveBeenCalled();
  });
});
