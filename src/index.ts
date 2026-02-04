#!/usr/bin/env node
import { intro, outro, confirm, spinner, note } from '@clack/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import { detectArtifacts } from './detector.js';
import { removeArtifacts } from './remover.js';

async function main() {
  console.clear();
  const banner = figlet.textSync('OpenShears', { font: 'Slant' });
  console.log(chalk.red.bold(banner));
  console.log(chalk.red('      🔪 THE OPENCLAW TERMINATOR 🦞\n'));
  
  intro(chalk.bgRed.white.bold(' 🦞 OpenShears: The OpenClaw Uninstaller '));

  const s = spinner();
  s.start('Detecting OpenClaw artifacts...');
  
  const artifacts = await detectArtifacts();
  s.stop('Detection complete.');

  const items: string[] = [];
  if (artifacts.globalPackage) items.push(chalk.yellow('📦 Global NPM Package (openclaw)'));
  artifacts.processes.forEach(p => items.push(chalk.red(`⚙️  Running Process (${p})`)));
  artifacts.directories.forEach(d => items.push(chalk.blue(`📂 Directory (${d})`)));
  artifacts.files.forEach(f => items.push(chalk.blue(`📄 File (${f})`)));

  if (items.length === 0) {
    outro(chalk.green('No OpenClaw artifacts found. Your system is clean! ✨'));
    return;
  }

  note(items.join('\n'), 'Found the following artifacts:');

  const shouldUninstall = await confirm({
    message: 'Do you want to remove all these artifacts? (This cannot be undone)',
  });

  if (!shouldUninstall) {
    outro(chalk.gray('Uninstall cancelled.'));
    return;
  }

  s.start('Removing artifacts...');
  try {
    await removeArtifacts(artifacts);
    s.stop('Removal complete.');
    outro(chalk.green('OpenClaw has been successfully removed from your system. 🦞✂️'));
  } catch (error) {
    s.stop('Removal failed.');
    if (error instanceof Error) {
        process.stderr.write(chalk.red(`Error: ${error.message}\n`));
    }
    process.exit(1);
  }
}

main().catch((err) => {
    process.stderr.write(String(err));
});
