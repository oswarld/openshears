import { assertSafePath, removalIdentity, removePath, run } from './utils.js';
import { detectProcesses, killProcess } from './processes.js';
import { stopService } from './services.js';
import { uninstallPackage } from './packages.js';
import type { Artifacts } from './detector.js';

export async function removeArtifacts(
  artifacts: Artifacts,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<void> {
  if (options.dryRun) return;
  if (artifacts.blockers.length)
    throw new Error(`Removal blocked: ${artifacts.blockers.join(' ')}`);
  if (
    artifacts.uid === undefined ||
    !['darwin', 'linux'].includes(artifacts.platform)
  )
    throw new Error('Unsupported removal platform.');
  const files = [
    ...artifacts.services.flatMap((service) => service.files),
    ...artifacts.files,
    ...artifacts.directories,
  ];
  // Validate the entire reviewed plan before any service/package/filesystem mutation.
  for (const file of files) {
    await assertSafePath(file, artifacts.protectedPaths);
    if (
      !artifacts.identities[file] ||
      (await removalIdentity(file)) !== artifacts.identities[file]
    ) {
      throw new Error(`Path changed after detection; scan again: ${file}`);
    }
  }
  for (const service of artifacts.services)
    await stopService(service, artifacts.uid);
  for (const service of artifacts.services) {
    for (const file of service.files)
      await removePath(
        file,
        artifacts.protectedPaths,
        artifacts.identities[file],
      );
  }
  if (artifacts.services.some((service) => service.manager === 'systemd')) {
    const result = await run('systemctl', ['--user', 'daemon-reload']);
    if (result.exitCode !== 0)
      throw new Error('systemd reload failed. Data preserved.');
  }
  // Rescan after disabling restart sources; a service may have replaced its PID.
  for (const target of await detectProcesses(artifacts.uid))
    await killProcess(target, artifacts.uid, options.force);
  if ((await detectProcesses(artifacts.uid)).length)
    throw new Error('OpenClaw processes are still running. Data preserved.');
  for (const pkg of artifacts.packages) await uninstallPackage(pkg);
  for (const file of [...artifacts.files, ...artifacts.directories]) {
    await removePath(
      file,
      artifacts.protectedPaths,
      artifacts.identities[file],
    );
  }
}
