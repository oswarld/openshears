#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { runCli } from './cli.js';
import {
  listProviders,
  runAudit,
  runLogin,
  runInspect,
  runLogout,
  runPrune,
} from './commands.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
const exit = (code: number) => {
  process.exitCode = code;
};

const program = new Command()
  .name('openshears')
  .description(
    'Audit which AI agents and apps hold access to your accounts, keep the ones you use and revoke the rest.',
  )
  .version(version);

program
  .command('audit [providers...]')
  .description('list connected apps and agents per provider (read-only)')
  .option('--json', 'print a JSON report')
  .option('--headed', 'show the browser window')
  .action(async (providers: string[], options) =>
    exit(await runAudit(providers, options)),
  );

program
  .command('prune <provider>')
  .description('revoke every connection except the ones you keep')
  .option('--keep <pattern...>', 'connections to keep (name or id, * wildcard)')
  .option(
    '--revoke <pattern...>',
    'only revoke connections matching these patterns',
  )
  .option('--all', 'revoke every revocable connection that is not kept')
  .option('--dry-run', 'show the plan without revoking anything')
  .option('--json', 'print a JSON plan; always read-only')
  .option('-y, --yes', 'confirm revocation without prompting')
  .option('--headed', 'show the browser window')
  .action(async (provider: string, options) =>
    exit(await runPrune(provider, options)),
  );

program
  .command('login <provider>')
  .description('sign in to a provider in a dedicated browser profile')
  .action(async (provider: string) => exit(await runLogin(provider)));

program
  .command('logout')
  .description('remove the stored browser sign-in sessions')
  .option('-y, --yes', 'remove without prompting')
  .action(async (options) => exit(await runLogout(options)));

program
  .command('inspect <provider> [paths...]')
  .description(
    "dump the links, buttons and headings of a provider's pages (read-only, for recipe work)",
  )
  .option('--headed', 'show the browser window')
  .action(async (provider: string, paths: string[], options) =>
    exit(await runInspect(provider, paths, options)),
  );

program
  .command('providers')
  .description('list supported providers')
  .action(() => console.log(listProviders()));

program
  .command('openclaw')
  .description('inspect and remove a local OpenClaw installation')
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
  .action(async (options) => exit(await runCli(options)));

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
