import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebProvider } from '../src/browser/recipe.js';
import type { ProviderContext } from '../src/core/model.js';
import { figmaRecipe } from '../src/providers/figma.js';
import { fixture } from './helpers.js';
import { startFigmaFixture } from './fixtures/figma-server.js';

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

describe('Figma recipe against a local fixture dialog', async () => {
  const available = await chromeAvailable();
  let home: string;
  let cleanup: () => Promise<void>;
  let site: Awaited<ReturnType<typeof startFigmaFixture>>;
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
    site = await startFigmaFixture();
  });
  afterAll(async () => {
    await site?.close();
    await cleanup?.();
  });

  it.skipIf(!available)(
    'lists connected apps from their revoke buttons and revokes the second one',
    async () => {
      const session = await createWebProvider({
        ...figmaRecipe,
        baseUrl: site.baseUrl,
      }).connect(context());
      try {
        const { connections } = await session.audit();
        expect(connections.map((item) => [item.id, item.name])).toEqual([
          ['figma-mcp-in-chatgpt', 'Figma MCP in ChatGPT'],
          ['figma-mcp-in-claude', 'Figma MCP in Claude'],
          ['muse', 'Muse'],
        ]);
        await session.revoke(connections[1]);
        expect(site.state.revoked).toEqual(['Figma MCP in Claude']);
        const after = await session.audit();
        expect(after.connections.map((item) => item.name)).toEqual([
          'Figma MCP in ChatGPT',
          'Muse',
        ]);
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
