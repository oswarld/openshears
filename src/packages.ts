import { run } from './utils.js';

export interface GlobalPackage {
  manager: 'npm' | 'pnpm' | 'bun';
  name: 'openclaw' | 'clawdbot' | 'moltbot';
  version: string;
}

const PACKAGE_NAMES = ['openclaw', 'clawdbot', 'moltbot'] as const;

export async function detectPackages(): Promise<{
  packages: GlobalPackage[];
  warnings: string[];
}> {
  const packages: GlobalPackage[] = [];
  const warnings: string[] = [];
  for (const manager of ['npm', 'pnpm', 'bun'] as const) {
    try {
      const args =
        manager === 'bun'
          ? ['pm', 'ls', '-g']
          : ['list', '-g', '--depth=0', '--json'];
      const result = await run(manager, args);
      if (manager === 'bun') {
        if (result.exitCode !== 0) throw new Error('Package inventory failed');
        for (const name of PACKAGE_NAMES) {
          const version = result.stdout.match(
            new RegExp(`^[\\s├└│─]*${name}@([^\\s]+)\\s*$`, 'm'),
          )?.[1];
          if (version) packages.push({ manager, name, version });
        }
      } else {
        if (
          manager === 'pnpm' &&
          /ERR_PNPM_NO_GLOBAL_(?:DIR|BIN_DIR)/.test(
            result.stderr + result.stdout,
          )
        )
          continue;
        const parsed = JSON.parse(result.stdout);
        const entries = Array.isArray(parsed) ? parsed : [parsed];
        let found = false;
        for (const entry of entries) {
          for (const name of PACKAGE_NAMES) {
            const version = entry?.dependencies?.[name]?.version;
            if (typeof version === 'string') {
              found = true;
              if (
                !packages.some(
                  (pkg) => pkg.manager === manager && pkg.name === name,
                )
              )
                packages.push({ manager, name, version });
            }
          }
        }
        // npm may return ELSPROBLEMS alongside usable dependency inventory.
        if (result.exitCode !== 0 && !found)
          throw new Error('Package inventory failed');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        warnings.push(
          `Could not fully inspect ${manager} global packages; check that installation manually.`,
        );
    }
  }
  return { packages, warnings };
}

export async function uninstallPackage(pkg: GlobalPackage): Promise<void> {
  const args =
    pkg.manager === 'npm'
      ? ['uninstall', '-g', '--ignore-scripts', pkg.name]
      : ['remove', '-g', '--ignore-scripts', pkg.name];
  const result = await run(pkg.manager, args, 120_000);
  if (result.exitCode !== 0)
    throw new Error(`Failed to uninstall ${pkg.name} with ${pkg.manager}.`);
}
