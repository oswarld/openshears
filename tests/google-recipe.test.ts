import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectionsFromItems,
  createWebProvider,
} from '../src/browser/recipe.js';
import type { ProviderContext } from '../src/core/model.js';
import { googleRecipe } from '../src/providers/google.js';
import { fixture } from './helpers.js';
import { startGoogleFixture } from './fixtures/google-server.js';

describe('Google recipe parsing', () => {
  it('uses name-based ids, keeps duplicates apart and merges icon links', () => {
    const list = googleRecipe.lists[1];
    const connections = connectionsFromItems(googleRecipe, list, [
      { href: 'linkedapps/overview/T1-a', text: '', row: 'Slack' },
      { href: 'linkedapps/overview/T1-a', text: 'Slack', row: 'Slack' },
      { href: 'linkedapps/overview/T1-b', text: 'Slack', row: 'Slack' },
      {
        href: 'linkedapps/overview/T1-c',
        text: 'Notion: AI Workspace',
        row: 'Notion: AI Workspace',
      },
    ]);
    expect(connections.map((item) => [item.id, item.name, item.url])).toEqual([
      ['slack', 'Slack', 'https://myaccount.google.com/linkedapps?filters=4'],
      ['slack-2', 'Slack', 'https://myaccount.google.com/linkedapps?filters=4'],
      [
        'notion-ai-workspace',
        'Notion: AI Workspace',
        'https://myaccount.google.com/linkedapps?filters=4',
      ],
    ]);
    expect(connections[0].kind).toBe('sign-in');
  });
});

async function chromeAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

describe('Google recipe against a local fixture site', async () => {
  const available = await chromeAvailable();
  let home: string;
  let cleanup: () => Promise<void>;
  let site: Awaited<ReturnType<typeof startGoogleFixture>>;
  const context = (): ProviderContext => ({
    home,
    env: {},
    platform: process.platform,
    interactive: false,
    headless: true,
    log: () => {},
  });

  beforeAll(async () => {
    ({ home, cleanup } = await fixture());
    site = await startGoogleFixture();
  });
  afterAll(async () => {
    await site?.close();
    await cleanup?.();
  });

  it.skipIf(!available)(
    'audits all filter views and revokes a duplicate-named app via the list',
    async () => {
      const session = await createWebProvider({
        ...googleRecipe,
        baseUrl: site.baseUrl,
      }).connect(context());
      try {
        const { connections } = await session.audit();
        expect(connections.map((item) => [item.kind, item.id])).toEqual([
          ['oauth-app', 'openai-dots'],
          ['oauth-app', 'claude-duet'],
          ['sign-in', 'slack'],
          ['sign-in', 'slack-2'],
          ['linked-account', 'x'],
        ]);
        await session.revoke(
          connections.find((item) => item.id === 'slack-2')!,
        );
        await session.revoke(
          connections.find((item) => item.id === 'openai-dots')!,
        );
        expect(site.state.deleted).toEqual(['slack-b', 'dots']);
        const after = await session.audit();
        expect(after.connections.map((item) => item.id)).toEqual([
          'claude-duet',
          'slack',
          'x',
        ]);
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
