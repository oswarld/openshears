import { afterEach, describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';
import { detectPackages, uninstallPackage } from '../src/packages.js';
import { ok, failed } from './helpers.js';

vi.mock('execa');
afterEach(() => vi.resetAllMocks());

describe('package managers', () => {
  it('uses exact package keys across npm, pnpm and Bun', async () => {
    vi.mocked(execa).mockImplementation(async (cmd) => {
      if (cmd === 'npm')
        return {
          ...ok(
            JSON.stringify({
              dependencies: {
                openclaw: { version: '2026.9.3' },
                'openclaw-helper': { version: '1.0' },
              },
            }),
          ),
          exitCode: 1,
        } as any;
      if (cmd === 'pnpm')
        return ok(
          '[{"dependencies":{"openclaw":{"version":"2026.9.3"}}}]',
        ) as any;
      return ok(
        '/home/user/.bun/install/global node_modules\n├── openclaw@2026.9.3\n└── openclaw-helper@1.0',
      ) as any;
    });
    const result = await detectPackages();
    expect(result.packages.map((pkg) => `${pkg.manager}:${pkg.name}`)).toEqual([
      'npm:openclaw',
      'pnpm:openclaw',
      'bun:openclaw',
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('ignores missing managers and reports broken inventories', async () => {
    vi.mocked(execa).mockImplementation(async (cmd) => {
      if (cmd === 'bun')
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      if (cmd === 'pnpm') return failed('ERR_PNPM_NO_GLOBAL_DIR') as any;
      return ok('invalid json') as any;
    });
    const result = await detectPackages();
    expect(result.packages).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('npm');
  });

  it('handles ENOENT returned by execa with reject:false', async () => {
    vi.mocked(execa).mockResolvedValue({
      ...failed(),
      code: 'ENOENT',
      exitCode: undefined,
    } as any);
    expect(await detectPackages()).toEqual({ packages: [], warnings: [] });
  });

  it('reports timed-out inventory commands', async () => {
    vi.mocked(execa).mockResolvedValue({ ...failed(), timedOut: true } as any);
    expect((await detectPackages()).warnings).toHaveLength(3);
  });

  it.each(['npm', 'pnpm', 'bun'] as const)(
    'removes with the detected %s manager without lifecycle scripts',
    async (manager) => {
      vi.mocked(execa).mockResolvedValue(ok() as any);
      await uninstallPackage({
        manager,
        name: 'openclaw',
        version: '2026.9.3',
      });
      expect(execa).toHaveBeenCalledWith(
        manager,
        [
          manager === 'npm' ? 'uninstall' : 'remove',
          '-g',
          '--ignore-scripts',
          'openclaw',
        ],
        expect.anything(),
      );
    },
  );

  it('propagates uninstall failures', async () => {
    vi.mocked(execa).mockResolvedValue(failed() as any);
    await expect(
      uninstallPackage({
        manager: 'npm',
        name: 'openclaw',
        version: '2026.9.3',
      }),
    ).rejects.toThrow('Failed to uninstall');
  });
});
