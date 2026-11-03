import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebProvider } from '../src/browser/recipe.js';
import type { ProviderContext } from '../src/core/model.js';
import { vercelRecipe } from '../src/providers/vercel.js';
import { fixture } from './helpers.js';
import { startVercelFixture } from './fixtures/vercel-server.js';

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

describe('Vercel recipe against a local fixture site', async () => {
  const available = await chromeAvailable();
  let home: string;
  let cleanup: () => Promise<void>;
  let site: Awaited<ReturnType<typeof startVercelFixture>>;
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
    site = await startVercelFixture();
  });
  afterAll(async () => {
    await site?.close();
    await cleanup?.();
  });

  it.skipIf(!available)(
    'lists installations by icfg id, ignores marketplace links and removes one',
    async () => {
      const session = await createWebProvider({
        ...vercelRecipe,
        baseUrl: site.baseUrl,
      }).connect(context());
      try {
        const { connections } = await session.audit();
        expect(connections.map((item) => [item.id, item.name])).toEqual([
          ['icfg_aaa111', 'Railway'],
          ['icfg_bbb222', 'Supabase'],
          ['icfg_ccc333', 'Supabase'],
        ]);
        expect(connections[1].url).toBe(
          `${site.baseUrl}/acme/~/integrations/supabase/icfg_bbb222`,
        );
        await session.revoke(connections[1]);
        expect(site.state.removed).toEqual(['icfg_bbb222']);
        const after = await session.audit();
        expect(after.connections.map((item) => item.id)).toEqual([
          'icfg_aaa111',
          'icfg_ccc333',
        ]);
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
