import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebProvider } from '../src/browser/recipe.js';
import type { ProviderContext } from '../src/core/model.js';
import { notionRecipe } from '../src/providers/notion.js';
import { fixture } from './helpers.js';
import { startNotionFixture } from './fixtures/notion-server.js';

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

describe('Notion recipe against a local fixture dialog', async () => {
  const available = await chromeAvailable();
  let home: string;
  let cleanup: () => Promise<void>;
  let site: Awaited<ReturnType<typeof startNotionFixture>>;
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
    site = await startNotionFixture();
  });
  afterAll(async () => {
    await site?.close();
    await cleanup?.();
  });

  it.skipIf(!available)(
    'opens the settings dialog, lists Manage rows and disconnects one',
    async () => {
      const session = await createWebProvider({
        ...notionRecipe,
        baseUrl: site.baseUrl,
      }).connect(context());
      try {
        const { connections } = await session.audit();
        expect(connections.map((item) => [item.id, item.name])).toEqual([
          ['composio', 'Composio'],
          ['pickle', 'Pickle'],
          ['skills', 'Skills'],
        ]);
        await session.revoke(connections[1]);
        expect(site.state.disconnected).toEqual(['Pickle']);
        const after = await session.audit();
        expect(after.connections.map((item) => item.name)).toEqual([
          'Composio',
          'Skills',
        ]);
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
