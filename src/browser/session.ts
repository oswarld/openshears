import fs from 'fs-extra';
import path from 'node:path';
import type { BrowserContext } from 'playwright-core';

export interface BrowserOptions {
  profileDir: string;
  headless: boolean;
  env: NodeJS.ProcessEnv;
}

const CHANNELS = ['chrome', 'msedge', 'chromium'];

export function browserProfileDir(home: string): string {
  return path.join(home, '.openshears', 'browser');
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0].trim();
}

/**
 * Launch an installed Chromium-based browser with a dedicated OpenShears profile.
 * The profile keeps sign-in sessions between runs and is never the user's own
 * browser profile. No browser is downloaded.
 */
export async function launchBrowser(
  options: BrowserOptions,
): Promise<BrowserContext> {
  const { chromium } = await import('playwright-core');
  await fs.ensureDir(options.profileDir);
  await fs.chmod(options.profileDir, 0o700);
  const base = { headless: options.headless, viewport: null };
  const executablePath = options.env.OPENSHEARS_BROWSER;
  if (executablePath) {
    return chromium.launchPersistentContext(options.profileDir, {
      ...base,
      executablePath,
    });
  }
  const channels = options.env.OPENSHEARS_BROWSER_CHANNEL
    ? [options.env.OPENSHEARS_BROWSER_CHANNEL]
    : CHANNELS;
  const failures: string[] = [];
  for (const channel of channels) {
    try {
      return await chromium.launchPersistentContext(options.profileDir, {
        ...base,
        channel,
      });
    } catch (error) {
      failures.push(`${channel}: ${firstLine(error)}`);
    }
  }
  throw new Error(
    `No supported browser could be started (tried ${channels.join(', ')}). ` +
      'Install Google Chrome or Microsoft Edge, or set OPENSHEARS_BROWSER to a Chromium executable.\n' +
      failures.map((failure) => `  ${failure}`).join('\n'),
  );
}
