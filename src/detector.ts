import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import JSON5 from 'json5';
import {
  CONFIG_NAMES,
  STATE_NAMES,
  PROFILE_NAME,
  expandPath,
  isWithin,
  resolveContext,
  type ScanOptions,
} from './paths.js';
import {
  assertSafePath,
  listDirectory,
  pathExists,
  removalIdentity,
} from './utils.js';
import { detectProcesses, type ProcessArtifact } from './processes.js';
import { detectPackages, type GlobalPackage } from './packages.js';
import { detectServices, type ServiceArtifact } from './services.js';

export interface Artifacts {
  directories: string[];
  files: string[];
  processes: ProcessArtifact[];
  packages: GlobalPackage[];
  services: ServiceArtifact[];
  preserved: string[];
  warnings: string[];
  blockers: string[];
  protectedPaths: string[];
  identities: Record<string, string>;
  uid?: number;
  platform: NodeJS.Platform;
}

export async function detectArtifacts(
  options: ScanOptions = {},
): Promise<Artifacts> {
  const context = resolveContext(options);
  const { home, clawHome, env, cwd, platform, uid } = context;
  const protectedPaths = [
    ...new Set([
      home,
      clawHome,
      cwd,
      os.homedir(),
      os.tmpdir(),
      '/Users',
      '/home',
      '/usr',
      '/usr/local',
      '/opt',
      '/srv',
      '/etc',
      '/var',
      '/tmp',
      '/Applications',
      ...[home, clawHome].flatMap((base) =>
        [
          'Desktop',
          'Documents',
          'Downloads',
          'Library',
          '.config',
          '.local',
          '.local/share',
          '.local/bin',
        ].map((name) => path.join(base, name)),
      ),
    ]),
  ];
  const artifacts: Artifacts = {
    directories: [],
    files: [],
    processes: [],
    packages: [],
    services: [],
    preserved: [],
    warnings: [],
    blockers: [],
    protectedPaths,
    identities: {},
    uid,
    platform,
  };
  const addPath = async (file: string, kind: 'directories' | 'files') => {
    if (!(await pathExists(file))) return;
    try {
      await assertSafePath(file, protectedPaths);
      const stat = await fs.lstat(file);
      if (
        !stat.isSymbolicLink() &&
        (kind === 'directories' ? !stat.isDirectory() : !stat.isFile())
      ) {
        throw new Error(`Unexpected artifact type: ${file}`);
      }
      artifacts.identities[file] = await removalIdentity(file);
      if (!artifacts[kind].includes(file)) artifacts[kind].push(file);
    } catch (error) {
      artifacts.blockers.push((error as Error).message);
    }
  };
  const stateDirs = new Set<string>();
  for (const base of new Set([home, clawHome])) {
    for (const name of STATE_NAMES) stateDirs.add(path.join(base, name));
    for (const name of await listDirectory(base)) {
      if (
        !name.startsWith('.openclaw-') ||
        !PROFILE_NAME.test(name.slice('.openclaw-'.length))
      )
        continue;
      const dir = path.join(base, name);
      // A name alone could be an unrelated backup. Require a config as profile evidence.
      if (await pathExists(path.join(dir, 'openclaw.json'))) stateDirs.add(dir);
    }
  }
  const profile = env.OPENCLAW_PROFILE?.trim();
  if (profile && profile.toLowerCase() !== 'default') {
    if (PROFILE_NAME.test(profile))
      stateDirs.add(path.join(clawHome, `.openclaw-${profile}`));
    else
      artifacts.blockers.push(
        'OPENCLAW_PROFILE is invalid; expected 1–64 letters, digits, underscores or hyphens.',
      );
  }
  if (env.OPENCLAW_STATE_DIR?.trim())
    stateDirs.add(expandPath(env.OPENCLAW_STATE_DIR, clawHome, cwd));
  const configs = new Set<string>();
  for (const dir of stateDirs) {
    if (!(await pathExists(dir))) continue;
    if (options.keepData) artifacts.preserved.push(dir);
    else {
      // install-cli.sh can put a Node runtime and shared packages inside the state root.
      if (
        (await pathExists(path.join(dir, 'tools'))) ||
        (await pathExists(path.join(dir, 'lib/node_modules')))
      ) {
        artifacts.blockers.push(
          `State directory also contains an installation prefix: ${dir}. Use --keep-data and inspect shared tools manually.`,
        );
      } else await addPath(dir, 'directories');
    }
    if ((await fs.lstat(dir)).isSymbolicLink()) {
      artifacts.warnings.push(
        `State symbolic link will only be unlinked; its target is preserved: ${dir}`,
      );
      continue;
    }
    for (const name of CONFIG_NAMES) configs.add(path.join(dir, name));
  }
  if (env.OPENCLAW_CONFIG_PATH?.trim()) {
    const file = expandPath(env.OPENCLAW_CONFIG_PATH, clawHome, cwd);
    configs.add(file);
    if (options.keepData) artifacts.preserved.push(file);
    else await addPath(file, 'files');
  }
  const workspaceDirs = new Set<string>();
  for (const file of configs) {
    if (!(await pathExists(file))) continue;
    try {
      const config = JSON5.parse(await fs.readFile(file, 'utf8'));
      const values: unknown[] = [
        config?.agents?.defaults?.workspace,
        config?.agent?.workspace,
      ];
      if (Array.isArray(config?.agents?.list))
        values.push(
          ...config.agents.list.map(
            (agent: { workspace?: unknown } | null) => agent?.workspace,
          ),
        );
      for (const value of values) {
        if (typeof value === 'string' && value.trim())
          workspaceDirs.add(expandPath(value, clawHome, cwd));
      }
      if (config?.$include)
        artifacts.warnings.push(
          `Config includes are not followed; inspect their workspace paths manually: ${file}`,
        );
    } catch {
      artifacts.warnings.push(
        `Could not read JSON/JSON5 config; external workspaces were not discovered: ${file}`,
      );
      if (options.includeWorkspaces)
        artifacts.blockers.push(
          `Workspace removal requires a readable config: ${file}`,
        );
    }
  }
  for (const dir of workspaceDirs) {
    if (!(await pathExists(dir))) continue;
    if ([...stateDirs].some((state) => isWithin(state, dir))) continue;
    if (options.includeWorkspaces && !options.keepData)
      await addPath(dir, 'directories');
    else {
      artifacts.preserved.push(dir);
      // A workspace can be an ancestor of a state root; preserve that intersection too.
      for (const file of [...artifacts.directories, ...artifacts.files]) {
        if (isWithin(dir, file)) {
          artifacts.directories = artifacts.directories.filter(
            (item) => item !== file,
          );
          artifacts.files = artifacts.files.filter((item) => item !== file);
          artifacts.preserved.push(file);
        }
      }
    }
  }
  if (env.OPENCLAW_OAUTH_DIR?.trim()) {
    const dir = expandPath(env.OPENCLAW_OAUTH_DIR, clawHome, cwd);
    if (options.keepData) artifacts.preserved.push(dir);
    else await addPath(dir, 'directories');
  }
  if (platform === 'darwin') {
    await addPath(path.join(home, 'Library/Logs/OpenClaw'), 'directories');
    await addPath('/Applications/OpenClaw.app', 'directories');
    await addPath(path.join(home, 'Applications/OpenClaw.app'), 'directories');
  }
  if (env.OPENCLAW_NIX_MODE === '1')
    artifacts.blockers.push(
      'Nix owns this installation. Remove it through the Nix configuration.',
    );
  if (env.OPENCLAW_PREFIX?.trim() || env.OPENCLAW_GIT_DIR?.trim()) {
    artifacts.warnings.push(
      'An installer prefix or source checkout is configured; inspect its CLI wrapper, shared runtime and checkout manually.',
    );
  }
  const services = await detectServices(context);
  artifacts.services = services.services;
  artifacts.blockers.push(...services.blockers);
  for (const service of artifacts.services) {
    for (const file of service.files) {
      try {
        await assertSafePath(file, protectedPaths);
        artifacts.identities[file] = await removalIdentity(file);
      } catch (error) {
        artifacts.blockers.push((error as Error).message);
      }
    }
  }
  const packages = await detectPackages();
  artifacts.packages = packages.packages;
  artifacts.warnings.push(...packages.warnings);
  if ((platform === 'darwin' || platform === 'linux') && uid !== undefined) {
    try {
      artifacts.processes = await detectProcesses(uid);
    } catch {
      artifacts.blockers.push(
        'Cannot inspect running processes; removal is blocked.',
      );
    }
  } else if (uid === undefined)
    artifacts.blockers.push(
      'Cannot establish the current user ID for safe process removal.',
    );
  // Preserve overlaps too, including workspace links that point into a state tree.
  const preservedIdentities = new Set(artifacts.preserved);
  for (const file of artifacts.preserved) {
    if (await pathExists(file))
      preservedIdentities.add(await fs.realpath(file));
  }
  for (const key of ['directories', 'files'] as const) {
    const removable: string[] = [];
    for (const file of artifacts[key]) {
      const identity = artifacts.identities[file];
      if (
        [...preservedIdentities].some(
          (kept) =>
            isWithin(file, kept) ||
            isWithin(kept, file) ||
            isWithin(identity, kept) ||
            isWithin(kept, identity),
        )
      ) {
        artifacts.preserved.push(file);
      } else removable.push(file);
    }
    artifacts[key] = removable;
  }
  protectedPaths.push(...preservedIdentities);
  // Collapse nested artifacts only after discovery and protection checks.
  artifacts.directories = artifacts.directories
    .filter(
      (dir) =>
        !artifacts.directories.some(
          (parent) => parent !== dir && isWithin(parent, dir),
        ),
    )
    .sort();
  artifacts.files = artifacts.files
    .filter((file) => !artifacts.directories.some((dir) => isWithin(dir, file)))
    .sort();
  artifacts.preserved = [...new Set(artifacts.preserved)].sort();
  return artifacts;
}

export function artifactCount(artifacts: Artifacts): number {
  return (
    artifacts.directories.length +
    artifacts.files.length +
    artifacts.packages.length +
    artifacts.processes.length +
    artifacts.services.length
  );
}

export function publicPlan(artifacts: Artifacts) {
  return {
    directories: artifacts.directories,
    files: artifacts.files,
    packages: artifacts.packages,
    services: artifacts.services,
    processes: artifacts.processes.map(({ pid, startedAt }) => ({
      pid,
      startedAt,
    })),
    preserved: artifacts.preserved,
    warnings: artifacts.warnings,
    blockers: artifacts.blockers,
  };
}
