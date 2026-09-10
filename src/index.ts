#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { runCli } from './cli.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
const program = new Command()
  .name('openshears')
  .description(
    'Inspect and remove local OpenClaw installations on macOS and Linux/WSL.',
  )
  .version(version)
  .option('--dry-run', 'show the removal plan without changing anything')
  .option('--json', 'print a JSON removal plan; always read-only')
  .option('-y, --yes', 'confirm removal of the displayed artifacts')
  .option(
    '--force',
    'allow SIGKILL if a verified OpenClaw process ignores SIGTERM',
  )
  .option(
    '--include-workspaces',
    'also delete configured workspaces outside state directories',
  )
  .option('--keep-data', 'preserve state, config, credentials and workspaces')
  .action(async (options) => {
    process.exitCode = await runCli(options);
  });

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
