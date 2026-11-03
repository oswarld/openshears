import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectionsFromItems,
  createWebProvider,
  slug,
  type WebRecipe,
} from '../src/browser/recipe.js';
import type { ProviderContext } from '../src/core/model.js';
import { fixture } from './helpers.js';
import { startRowsFixture } from './fixtures/rows-server.js';

const recipe = (baseUrl: string): WebRecipe => ({
  id: 'rows',
  title: 'Rows site',
  description: 'fixture',
  baseUrl,
  loginPath: '/',
  signedOutPaths: ['/login'],
  lists: [
    {
      kind: 'oauth-app',
      label: 'Connections',
      path: '/',
      rows: {
        selector: '[role="listitem"]',
        name: 'strong',
        idAttribute: 'data-app-id',
      },
      revocable: true,
    },
  ],
  revoke: {
    'oauth-app': {
      steps: [
        { role: 'button', name: /more options/i, within: 'row' },
        { role: 'menuitem', name: /remove access/i },
        { role: 'button', name: /^confirm$/i, within: 'dialog' },
      ],
    },
  },
});

describe('row strategy parsing', () => {
  it('derives ids from attributes or name slugs and skips excluded rows', () => {
    const base = recipe('https://example.test');
    const list = { ...base.lists[0], rows: { selector: 'li' } };
    const connections = connectionsFromItems(base, list, [
      { text: 'Claude Duet', row: 'Claude Duet Last used today' },
      { id: 'abc', text: 'Meta Muse', row: 'Meta Muse' },
      { text: '', row: '' },
    ]);
    expect(
      connections.map((item) => [item.id, item.name, item.lastUsed]),
    ).toEqual([
      ['claude-duet', 'Claude Duet', 'Last used today'],
      ['abc', 'Meta Muse', undefined],
    ]);
    expect(slug('OpenAI dots (beta)!')).toBe('openai-dots-beta');
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

describe('row strategy against a single-page fixture site', async () => {
  const available = await chromeAvailable();
  let home: string;
  let cleanup: () => Promise<void>;
  let site: Awaited<ReturnType<typeof startRowsFixture>>;
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
    site = await startRowsFixture();
  });
  afterAll(async () => {
    await site?.close();
    await cleanup?.();
  });

  it.skipIf(!available)(
    'lists rows and revokes through the in-row menu and dialog',
    async () => {
      const session = await createWebProvider(recipe(site.baseUrl)).connect(
        context(),
      );
      try {
        const { connections } = await session.audit();
        expect(
          connections.map((item) => [item.id, item.name, item.lastUsed]),
        ).toEqual([
          ['app-dots', 'OpenAI dots', 'Last used today'],
          ['app-duet', 'Claude Duet', 'Last used yesterday'],
          ['app-muse', 'Meta Muse', undefined],
        ]);
        await session.revoke(connections[0]);
        expect(site.state.removed).toEqual(['app-dots']);
        const after = await session.audit();
        expect(after.connections.map((item) => item.name)).toEqual([
          'Claude Duet',
          'Meta Muse',
        ]);
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
