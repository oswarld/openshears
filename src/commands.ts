import { confirm, isCancel, multiselect, note, spinner } from '@clack/prompts';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import {
  KIND_LABELS,
  NotSignedInError,
  type AuditResult,
  type Connection,
  type Provider,
  type ProviderContext,
  type ProviderSession,
} from './core/model.js';
import {
  providers as defaultProviders,
  findProvider,
} from './core/registry.js';
import { hasSelection, planPrune, type PrunePlan } from './core/selection.js';
import { browserProfileDir } from './browser/session.js';
import type { WebProviderSession } from './browser/recipe.js';

export interface CommonOptions {
  json?: boolean;
  /** Show the browser window instead of running headless. */
  headed?: boolean;
  home?: string;
  providers?: Provider[];
}

export interface PruneOptions extends CommonOptions {
  keep?: string[];
  revoke?: string[];
  all?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function createContext(
  options: CommonOptions,
  interactive: boolean,
): ProviderContext {
  return {
    home: options.home ?? os.homedir(),
    env: process.env,
    platform: process.platform,
    interactive,
    headless: !options.headed,
    log: (message) => console.log(message),
  };
}

function show(interactive: boolean, body: string, title: string): void {
  if (interactive) note(body, title);
  else console.log(`${title}\n${body}`);
}

export function describeConnection(connection: Connection): string {
  const parts = [
    `[${KIND_LABELS[connection.kind]}] ${connection.name}${connection.owner ? ` (by ${connection.owner})` : ''}`,
  ];
  if (connection.lastUsed) parts.push(connection.lastUsed);
  if (connection.details?.length)
    parts.push(`servers: ${connection.details.join(', ')}`);
  if (!connection.revocable && connection.note) parts.push(connection.note);
  return parts.join(' — ');
}

function auditTitle(result: AuditResult, provider: Provider): string {
  return result.account
    ? `${provider.title} (${result.account})`
    : provider.title;
}

function describeAudit(result: AuditResult): string {
  const lines = result.connections.length
    ? result.connections.map(
        (connection) => `  ${describeConnection(connection)}`,
      )
    : ['  No connections found.'];
  return [...lines, ...result.warnings.map((warning) => `  ! ${warning}`)].join(
    '\n',
  );
}

/** Connect, and when the site has no session, let an interactive user sign in. */
async function connect(
  provider: Provider,
  context: ProviderContext,
): Promise<ProviderSession> {
  try {
    return await provider.connect(context);
  } catch (error) {
    if (!(error instanceof NotSignedInError) || !context.interactive)
      throw error;
    return provider.connect({ ...context, headless: false, signIn: true });
  }
}

export async function runAudit(
  providerIds: string[],
  options: CommonOptions = {},
): Promise<number> {
  const available = options.providers ?? defaultProviders;
  const selected = providerIds.length
    ? providerIds.map((id) => findProvider(id, available))
    : available;
  const interactive = isInteractive() && !options.json;
  const context = createContext(options, interactive);
  const progress = interactive ? spinner() : undefined;
  const results: AuditResult[] = [];
  let failed = false;
  for (const provider of selected) {
    progress?.start(`Auditing ${provider.title}...`);
    let session: ProviderSession | undefined;
    try {
      session = await connect(provider, context);
      results.push(await session.audit());
      progress?.stop(`${provider.title}: done.`);
    } catch (error) {
      failed = true;
      progress?.stop(`${provider.title}: failed.`);
      results.push({
        provider: provider.id,
        connections: [],
        warnings: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      await session?.close();
    }
  }
  if (options.json) {
    console.log(
      JSON.stringify(
        { generatedAt: new Date().toISOString(), providers: results },
        null,
        2,
      ),
    );
    return failed ? 1 : 0;
  }
  for (const result of results) {
    const provider = selected.find((item) => item.id === result.provider)!;
    show(interactive, describeAudit(result), `Audit: ${provider.title}`);
  }
  return failed ? 1 : 0;
}

function describePlan(plan: PrunePlan): string {
  const section = (title: string, items: Connection[]) =>
    items.length
      ? [`${title}:`, ...items.map((item) => `  ${describeConnection(item)}`)]
      : [];
  return [
    ...section('Revoke', plan.revoke),
    ...section('Keep', plan.keep),
    ...section('Needs manual action', plan.skipped),
  ].join('\n');
}

async function chooseKeep(
  connections: Connection[],
): Promise<string[] | undefined> {
  const answer = await multiselect({
    message:
      'Select the connections to KEEP. Everything unselected will be revoked.',
    options: connections.map((connection) => ({
      value: connection.id,
      label: connection.name,
      hint: `${KIND_LABELS[connection.kind]}${connection.lastUsed ? `, ${connection.lastUsed}` : ''}`,
    })),
    initialValues: connections.map((connection) => connection.id),
    required: false,
  });
  if (isCancel(answer)) return undefined;
  return answer as string[];
}

export async function runPrune(
  providerId: string,
  options: PruneOptions = {},
): Promise<number> {
  const provider = findProvider(
    providerId,
    options.providers ?? defaultProviders,
  );
  const preview = Boolean(options.dryRun || options.json);
  const interactive = isInteractive() && !options.json;
  const selection = {
    keep: options.keep ?? [],
    revoke: options.revoke ?? [],
    all: Boolean(options.all),
    keepIds: undefined as string[] | undefined,
  };
  if (!hasSelection(selection) && !interactive)
    throw new Error(
      'Specify --keep, --revoke or --all. Preview the audit first with "openshears audit".',
    );
  const context = createContext(options, interactive);
  const progress = interactive ? spinner() : undefined;
  progress?.start(`Auditing ${provider.title}...`);
  let session: ProviderSession;
  try {
    session = await connect(provider, context);
  } catch (error) {
    progress?.stop(`${provider.title}: failed.`);
    throw error;
  }
  try {
    const audit = await session.audit();
    progress?.stop(
      `${provider.title}: ${audit.connections.length} connection(s).`,
    );
    if (audit.warnings.length)
      show(interactive, audit.warnings.join('\n'), 'Warnings:');
    if (!hasSelection(selection)) {
      const kept = await chooseKeep(audit.connections);
      if (!kept) {
        console.log('Prune cancelled.');
        return 0;
      }
      selection.keepIds = kept;
      selection.all = true;
    }
    const plan = planPrune(audit.connections, selection);
    if (plan.unmatched.length)
      throw new Error(
        `No connection matches: ${plan.unmatched.join(', ')}. Nothing was revoked.`,
      );
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            provider: provider.id,
            account: audit.account,
            dryRun: true,
            ...plan,
          },
          null,
          2,
        ),
      );
      return 0;
    }
    show(interactive, describePlan(plan), `Prune plan: ${provider.title}`);
    if (preview) {
      console.log('Dry run complete. Nothing was revoked.');
      return 0;
    }
    if (!plan.revoke.length) {
      console.log('Nothing to revoke.');
      return 0;
    }
    if (!options.yes) {
      if (!interactive)
        throw new Error(
          'Non-interactive revocation requires --yes. Preview first with --dry-run or --json.',
        );
      const answer = await confirm({
        message: `Revoke ${plan.revoke.length} connection(s) on ${provider.title}? Revoked apps lose access until you authorize them again.`,
        initialValue: false,
      });
      // @clack/prompts returns a truthy Symbol on Ctrl-C/Escape.
      if (isCancel(answer) || answer !== true) {
        console.log('Prune cancelled. Nothing was revoked.');
        return 0;
      }
    }
    const failures: string[] = [];
    for (const connection of plan.revoke) {
      progress?.start(`Revoking ${connection.name}...`);
      try {
        await session.revoke(connection);
        progress?.stop(`Revoked ${connection.name}.`);
        if (!progress) console.log(`Revoked ${connection.name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        progress?.stop(`Failed: ${connection.name}.`);
        failures.push(`${connection.name}: ${message}`);
      }
    }
    if (failures.length) {
      show(interactive, failures.join('\n'), 'Not revoked:');
      return 1;
    }
    console.log(
      `Revoked ${plan.revoke.length} connection(s). Kept ${plan.keep.length}.`,
    );
    return 0;
  } finally {
    await session.close();
  }
}

export async function runLogin(
  providerId: string,
  options: CommonOptions = {},
): Promise<number> {
  const provider = findProvider(
    providerId,
    options.providers ?? defaultProviders,
  );
  if (provider.kind !== 'remote') {
    console.log(`${provider.title} needs no sign-in.`);
    return 0;
  }
  const context = createContext({ ...options, headed: true }, isInteractive());
  const session = await provider.connect({ ...context, signIn: true });
  try {
    const result = await session.audit();
    console.log(
      `Signed in to ${provider.title}${result.account ? ` as ${result.account}` : ''}. ` +
        `The session is stored in ${browserProfileDir(context.home)} for later runs.`,
    );
    return 0;
  } finally {
    await session.close();
  }
}

export async function runLogout(
  options: CommonOptions & { yes?: boolean } = {},
): Promise<number> {
  const home = options.home ?? os.homedir();
  const profile = browserProfileDir(home);
  if (
    !path
      .resolve(profile)
      .startsWith(path.join(path.resolve(home), '.openshears') + path.sep)
  )
    throw new Error(
      `Refusing to remove an unexpected profile path: ${profile}`,
    );
  if (!(await fs.pathExists(profile))) {
    console.log('No stored browser session.');
    return 0;
  }
  if (!options.yes) {
    if (!isInteractive())
      throw new Error('Non-interactive logout requires --yes.');
    const answer = await confirm({
      message: `Remove the stored browser session in ${profile}?`,
      initialValue: false,
    });
    if (isCancel(answer) || answer !== true) {
      console.log('Logout cancelled.');
      return 0;
    }
  }
  await fs.remove(profile);
  console.log(`Removed ${profile}. Sites will ask you to sign in again.`);
  return 0;
}

/** Read-only dump of a provider's pages (links, buttons, headings) to write or repair a recipe. */
export async function runInspect(
  providerId: string,
  paths: string[],
  options: CommonOptions = {},
): Promise<number> {
  const provider = findProvider(
    providerId,
    options.providers ?? defaultProviders,
  );
  if (provider.kind !== 'remote')
    throw new Error(`${provider.title} has no web pages to inspect.`);
  const context = createContext(options, isInteractive());
  const session = (await connect(provider, context)) as WebProviderSession;
  try {
    const pages = await session.inspect(paths);
    console.log(JSON.stringify(pages, null, 2));
    return 0;
  } finally {
    await session.close();
  }
}

export function listProviders(
  available: Provider[] = defaultProviders,
): string {
  return available
    .map(
      (provider) =>
        `${provider.id.padEnd(8)} ${provider.title}: ${provider.description}`,
    )
    .join('\n');
}
