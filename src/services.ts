import path from 'node:path';
import type { ScanContext } from './paths.js';
import { listDirectory, run } from './utils.js';

export interface ServiceArtifact {
  manager: 'launchd' | 'systemd';
  id: string;
  files: string[];
}

export function isServiceName(
  name: string,
  manager: ServiceArtifact['manager'],
): boolean {
  return manager === 'launchd'
    ? /^ai\.openclaw\.[a-z0-9][a-z0-9_-]{0,63}$/i.test(name)
    : /^(?:openclaw-(?:gateway(?:-[a-z0-9][a-z0-9_-]{0,63})?|node)|clawdbot-gateway)\.service$/i.test(
        name,
      );
}

function listedNames(
  stdout: string,
  manager: ServiceArtifact['manager'],
): string[] {
  return stdout
    .split('\n')
    .map((line) =>
      manager === 'launchd'
        ? (line.trim().split(/\s+/).at(-1) ?? '')
        : line.trim().replace(/^●\s*/, '').split(/\s+/)[0],
    );
}

export async function detectServices(
  context: ScanContext,
): Promise<{ services: ServiceArtifact[]; blockers: string[] }> {
  const { platform, home, clawHome, env } = context;
  const blockers: string[] = [];
  const services = new Map<string, ServiceArtifact>();
  if (platform !== 'darwin' && platform !== 'linux') {
    return {
      services: [],
      blockers: [
        'Automatic removal supports macOS and Linux/WSL only. Use openclaw uninstall on this platform.',
      ],
    };
  }
  const manager = platform === 'darwin' ? 'launchd' : 'systemd';
  const add = (id: string, file?: string) => {
    if (!isServiceName(id, manager)) return;
    const service = services.get(id) ?? { manager, id, files: [] };
    if (file && !service.files.includes(file)) service.files.push(file);
    services.set(id, service);
  };
  for (const base of new Set([home, clawHome])) {
    const dir =
      manager === 'launchd'
        ? path.join(base, 'Library/LaunchAgents')
        : path.join(base, '.config/systemd/user');
    for (const name of await listDirectory(dir)) {
      const id =
        manager === 'launchd'
          ? name.replace(/\.plist(?:\.bak)?$/, '')
          : name.replace(/(?:\.bak|\.d)$/, '');
      if (manager === 'launchd' && !/\.plist(?:\.bak)?$/.test(name)) continue;
      if (
        manager === 'launchd' &&
        /^ai\.openclaw\..*(?:update\.|manual-update\.)/.test(id)
      ) {
        blockers.push(
          `OpenClaw update job definition remains: ${path.join(dir, name)}. Finish or stop the update before removal.`,
        );
      }
      add(id, path.join(dir, name));
    }
  }
  const override =
    manager === 'launchd'
      ? env.OPENCLAW_LAUNCHD_LABEL
      : env.OPENCLAW_SYSTEMD_UNIT;
  if (override?.trim()) {
    const id =
      manager === 'systemd' && !override.trim().endsWith('.service')
        ? `${override.trim()}.service`
        : override.trim();
    if (isServiceName(id, manager)) add(id);
    else
      blockers.push(
        'A custom OpenClaw service name is configured. Uninstall that service with OpenClaw before running OpenShears.',
      );
  }
  const commands: [string, string[]][] =
    manager === 'launchd'
      ? [['launchctl', ['list']]]
      : [
          [
            'systemctl',
            [
              '--user',
              'list-unit-files',
              '--type=service',
              '--no-legend',
              '--no-pager',
            ],
          ],
          [
            'systemctl',
            [
              '--user',
              'list-units',
              '--all',
              '--type=service',
              '--no-legend',
              '--no-pager',
            ],
          ],
        ];
  for (const [command, args] of commands) {
    try {
      const result = await run(command, args);
      if (result.exitCode !== 0) throw new Error('Service inventory failed');
      for (const id of listedNames(result.stdout, manager)) {
        add(id);
        if (
          manager === 'launchd' &&
          /^ai\.openclaw\..*(?:update\.|manual-update\.)/.test(id)
        ) {
          blockers.push(
            `OpenClaw update job is registered: ${id}. Finish or stop the update before removal.`,
          );
        }
      }
    } catch {
      blockers.push(
        `Cannot inspect ${manager} services. Restore access to the user service manager before removal.`,
      );
      break;
    }
  }
  // System services need their owner's teardown; never silently leave one restarting.
  const systemDir =
    manager === 'launchd' ? '/Library/LaunchDaemons' : '/etc/systemd/system';
  for (const name of await listDirectory(systemDir)) {
    const id = manager === 'launchd' ? name.replace(/\.plist$/, '') : name;
    if (isServiceName(id, manager))
      blockers.push(
        `System service requires administrator-managed removal: ${path.join(systemDir, name)}`,
      );
  }
  // Installed vendor units and services with deleted definitions can still run.
  if (manager === 'systemd') {
    for (const subcommand of ['list-unit-files', 'list-units']) {
      try {
        const result = await run('systemctl', [
          '--system',
          subcommand,
          '--all',
          '--type=service',
          '--no-legend',
          '--no-pager',
        ]);
        if (result.exitCode !== 0)
          throw new Error('System service inventory failed');
        for (const id of listedNames(result.stdout, manager)) {
          if (isServiceName(id, manager))
            blockers.push(
              `System service requires administrator-managed removal: ${id}`,
            );
        }
      } catch {
        blockers.push(
          'Cannot inspect system services; restore access to the system service manager before removal.',
        );
        break;
      }
    }
  } else {
    // Probe known identities in the system domain as well as the user's GUI domain.
    for (const id of new Set([
      'ai.openclaw.gateway',
      'ai.openclaw.node',
      ...services.keys(),
    ])) {
      try {
        const result = await run('launchctl', ['print', `system/${id}`]);
        if (result.exitCode === 0)
          blockers.push(
            `System service requires administrator-managed removal: ${id}`,
          );
        else if (!launchdAbsent(result))
          throw new Error('System service inspection failed');
      } catch {
        blockers.push(`Cannot inspect the system service identity: ${id}`);
      }
    }
  }
  return {
    services: [...services.values()].sort((a, b) => a.id.localeCompare(b.id)),
    blockers: [...new Set(blockers)],
  };
}

function launchdAbsent(result: Awaited<ReturnType<typeof run>>): boolean {
  return (
    result.exitCode !== 0 &&
    /could not find service|no such process/i.test(
      result.stderr || result.stdout,
    )
  );
}

export async function stopService(
  service: ServiceArtifact,
  uid: number,
): Promise<void> {
  if (service.manager === 'launchd') {
    const target = `gui/${uid}/${service.id}`;
    const before = await run('launchctl', ['print', target]);
    if (launchdAbsent(before)) return;
    if (before.exitCode !== 0)
      throw new Error(`Cannot inspect service: ${service.id}`);
    const stopped = await run('launchctl', ['bootout', target]);
    if (stopped.exitCode !== 0 && !launchdAbsent(stopped))
      throw new Error(`Failed to stop service: ${service.id}`);
    if (!launchdAbsent(await run('launchctl', ['print', target])))
      throw new Error(`Service teardown could not be verified: ${service.id}`);
  } else {
    const stopped = await run('systemctl', [
      '--user',
      'disable',
      '--now',
      service.id,
    ]);
    const result = await run('systemctl', [
      '--user',
      'show',
      service.id,
      '--property=LoadState',
      '--property=ActiveState',
      '--property=UnitFileState',
    ]);
    // A lone .bak/drop-in may remain after the unit itself was uninstalled.
    if (
      result.exitCode === 0 &&
      /^LoadState=not-found$/m.test(result.stdout) &&
      /^ActiveState=inactive$/m.test(result.stdout) &&
      !/^UnitFileState=(enabled|enabled-runtime|linked|linked-runtime)$/m.test(
        result.stdout,
      )
    )
      return;
    if (stopped.exitCode !== 0)
      throw new Error(`Failed to disable service: ${service.id}`);
    if (
      result.exitCode !== 0 ||
      !/^ActiveState=(inactive|failed)$/m.test(result.stdout) ||
      /^UnitFileState=(enabled|enabled-runtime|linked|linked-runtime)$/m.test(
        result.stdout,
      )
    ) {
      throw new Error(`Service teardown could not be verified: ${service.id}`);
    }
  }
}
