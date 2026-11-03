import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectionsFromItems,
  createWebProvider,
  parseLastUsed,
} from '../src/browser/recipe.js';
import { NotSignedInError, type ProviderContext } from '../src/core/model.js';
import { githubRecipe } from '../src/providers/github.js';
import { fixture } from './helpers.js';
import { startGithubFixture } from './fixtures/github-server.js';

describe('GitHub recipe parsing', () => {
  it('builds connections from settings links and ignores unsafe ids', () => {
    const list = githubRecipe.lists[0];
    const connections = connectionsFromItems(githubRecipe, list, [
      {
        href: '/settings/connections/applications/Iv1abc',
        text: 'Claude Duet',
        row: 'Claude Duet Last used within the last week · Owned by anthropic',
      },
      {
        href: '/settings/connections/applications/Iv1abc?tab=x',
        text: 'Claude Duet',
        row: '',
      },
      {
        href: '/settings/connections/applications/../evil',
        text: 'x',
        row: '',
      },
      { href: '/settings/connections/applications/', text: '', row: '' },
    ]);
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      id: 'Iv1abc',
      name: 'Claude Duet',
      kind: 'oauth-app',
      revocable: true,
      owner: 'anthropic',
      lastUsed: 'Last used within the last week',
      url: 'https://github.com/settings/connections/applications/Iv1abc',
    });
  });

  it('names installations from the row when the link says Configure', () => {
    const list = githubRecipe.lists[2];
    const [connection] = connectionsFromItems(githubRecipe, list, [
      {
        href: '/settings/installations/42',
        text: 'Configure',
        row: 'Gemini Spark\nConfigure',
      },
    ]);
    expect(connection.name).toBe('Gemini Spark');
    expect(connection.revocable).toBe(false);
  });

  it('extracts last-used text', () => {
    expect(parseLastUsed('Foo Last used within the last month')).toBe(
      'Last used within the last month',
    );
    expect(
      parseLastUsed('Foo Last used within the last 6 months · Owned by x'),
    ).toBe('Last used within the last 6 months');
    expect(parseLastUsed('Foo Never used · Owned by x')).toBe('Never used');
    expect(parseLastUsed('Foo')).toBeUndefined();
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

describe('GitHub recipe against a local fixture site', async () => {
  const available = await chromeAvailable();
  let home: string;
  let cleanup: () => Promise<void>;
  let site: Awaited<ReturnType<typeof startGithubFixture>>;
  const context = (
    overrides: Partial<ProviderContext> = {},
  ): ProviderContext => ({
    home,
    env: {},
    platform: process.platform,
    interactive: false,
    headless: true,
    log: () => {},
    ...overrides,
  });
  const provider = () =>
    createWebProvider({
      ...githubRecipe,
      baseUrl: site.baseUrl,
      loginPath: '/login?return_to=%2Fsettings%2Fapplications&auto=1',
    });

  beforeAll(async () => {
    ({ home, cleanup } = await fixture());
    site = await startGithubFixture();
  });
  afterAll(async () => {
    await site?.close();
    await cleanup?.();
  });

  it.skipIf(!available)(
    'fails clearly without a session, then signs in and audits',
    async () => {
      await expect(provider().connect(context())).rejects.toBeInstanceOf(
        NotSignedInError,
      );
      const session = await provider().connect(context({ signIn: true }));
      try {
        const result = await session.audit();
        expect(result.account).toBe('octocat');
        expect(
          result.connections.map((item) => [
            item.kind,
            item.name,
            item.revocable,
          ]),
        ).toEqual([
          ['oauth-app', 'OpenAI dots', true],
          ['oauth-app', 'Claude Duet', true],
          ['oauth-app', 'Meta Muse', true],
          ['app-authorization', 'Grok bots', true],
          ['app-installation', 'Gemini Spark', false],
        ]);
        expect(result.connections[2].lastUsed).toBe(
          'Last used more than a year ago',
        );
      } finally {
        await session.close();
      }
    },
    60_000,
  );

  it.skipIf(!available)(
    'revokes through the detail page dialog and verifies the list',
    async () => {
      const session = await provider().connect(context());
      try {
        const { connections } = await session.audit();
        const dots = connections.find((item) => item.name === 'OpenAI dots')!;
        const grok = connections.find((item) => item.name === 'Grok bots')!;
        await session.revoke(dots);
        await session.revoke(grok);
        expect(site.state.revokeRequests).toEqual([
          '/settings/connections/applications/Iv1aaa',
          '/settings/connections/applications/Iv1.9001',
        ]);
        const after = await session.audit();
        expect(after.connections.map((item) => item.name)).toEqual([
          'Claude Duet',
          'Meta Muse',
          'Gemini Spark',
        ]);
        await expect(
          session.revoke(
            after.connections.find((item) => item.name === 'Gemini Spark')!,
          ),
        ).rejects.toThrow('cannot be revoked');
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
