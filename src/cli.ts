import { intro, outro, confirm, isCancel, spinner, note } from '@clack/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import { artifactCount, detectArtifacts, publicPlan } from './detector.js';
import { removeArtifacts } from './remover.js';

export interface CliOptions {
  dryRun?: boolean;
  json?: boolean;
  yes?: boolean;
  force?: boolean;
  includeWorkspaces?: boolean;
  keepData?: boolean;
}

export async function runCli(options: CliOptions = {}): Promise<number> {
  if (options.includeWorkspaces && options.keepData)
    throw new Error(
      '--include-workspaces cannot be combined with --keep-data.',
    );
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const preview = options.dryRun || options.json;
  if (interactive && !options.json) {
    console.log(
      chalk.red.bold(figlet.textSync('OpenShears', { font: 'Slant' })),
    );
    intro('OpenClaw removal');
  }
  const progress = interactive && !options.json ? spinner() : undefined;
  progress?.start('Detecting OpenClaw artifacts...');
  let artifacts;
  try {
    artifacts = await detectArtifacts(options);
  } catch (error) {
    progress?.stop('Detection failed.');
    throw error;
  }
  progress?.stop('Detection complete.');
  if (options.json) {
    console.log(JSON.stringify(publicPlan(artifacts), null, 2));
    return artifacts.blockers.length ? 1 : 0;
  }
  const items = [
    ...artifacts.services.map((service) =>
      `Service: ${service.manager} ${service.id}\n${service.files.map((file) => `  ${file}`).join('\n')}`.trimEnd(),
    ),
    ...artifacts.processes.map(
      (proc) => `Process: PID ${proc.pid} (started ${proc.startedAt})`,
    ),
    ...artifacts.packages.map(
      (pkg) => `Package: ${pkg.manager} ${pkg.name}@${pkg.version}`,
    ),
    ...artifacts.directories.map((dir) => `Directory: ${dir}`),
    ...artifacts.files.map((file) => `File: ${file}`),
  ];
  const show = (body: string, title: string) =>
    interactive ? note(body, title) : console.log(`${title}\n${body}`);
  if (items.length)
    show(items.join('\n'), 'Removal plan (all detected local profiles):');
  if (artifacts.preserved.length)
    show(artifacts.preserved.join('\n'), 'Preserved paths:');
  if (artifacts.warnings.length)
    show(artifacts.warnings.join('\n'), 'Manual checks:');
  if (artifacts.blockers.length)
    show(artifacts.blockers.join('\n'), 'Removal blocked:');
  if (preview) {
    console.log('Dry run complete. No changes made.');
    return artifacts.blockers.length ? 1 : 0;
  }
  if (artifacts.blockers.length) return 1;
  if (artifactCount(artifacts) === 0) {
    console.log(
      'No removable OpenClaw artifacts detected in the scanned locations.',
    );
    return 0;
  }
  if (!options.yes) {
    if (!interactive)
      throw new Error(
        'Non-interactive removal requires --yes. Preview first with --dry-run or --json.',
      );
    const answer = await confirm({
      message:
        'Remove these artifacts permanently? State directories include credentials, sessions, memory and internal workspaces.',
      initialValue: false,
    });
    // @clack/prompts returns a truthy Symbol on Ctrl-C/Escape.
    if (isCancel(answer) || answer !== true) {
      outro('Uninstall cancelled.');
      return 0;
    }
  }
  progress?.start('Stopping services and removing artifacts...');
  try {
    await removeArtifacts(artifacts, { force: options.force });
  } catch (error) {
    progress?.stop('Removal incomplete.');
    throw error;
  }
  progress?.stop('Removal complete.');
  console.log(
    'Removed the detected artifacts. Preserved paths and manual checks above still apply.',
  );
  return 0;
}
