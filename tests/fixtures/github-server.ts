import http from 'node:http';
import type { AddressInfo } from 'node:net';

interface App {
  id: string;
  name: string;
  lastUsed: string;
}

/**
 * Minimal stand-in for github.com settings pages: the same URL layout, link
 * prefixes, meta tag, sign-in redirect and revoke dialog that the GitHub
 * recipe relies on. It is not a copy of GitHub's markup.
 */
export async function startGithubFixture() {
  const state = {
    oauthApps: [
      {
        id: 'Iv1aaa',
        name: 'OpenAI dots',
        lastUsed: 'Last used within the last week',
      },
      {
        id: 'Iv1bbb',
        name: 'Claude Duet',
        lastUsed: 'Last used within the last day',
      },
      {
        id: 'Iv1ccc',
        name: 'Meta Muse',
        lastUsed: 'Last used more than a year ago',
      },
    ] as App[],
    appAuthorizations: [
      { id: 'Iv1.9001', name: 'Grok bots', lastUsed: 'Last used today' },
    ] as App[],
    installations: [{ id: '42', name: 'Gemini Spark', lastUsed: '' }] as App[],
    revokeRequests: [] as string[],
  };
  const page = (body: string) =>
    `<!doctype html><html><head><meta name="user-login" content="octocat"></head><body>${body}</body></html>`;
  const PAGE_SIZE = 2;
  // Rows mirror github.com: an image link and a name link to the same page,
  // "Last used ... · Owned by ..." text, a per-row revoke dialog and
  // a[rel=next] pagination. Installations use a "Configure" link and a
  // sub-page link that must be ignored.
  const list = (
    apps: App[],
    prefix: string,
    pageNumber: number,
    listPath: string,
    linkText?: string,
  ) => {
    const pageApps = apps.slice(
      (pageNumber - 1) * PAGE_SIZE,
      pageNumber * PAGE_SIZE,
    );
    const rows = pageApps
      .map(
        (app) =>
          `<div class="js-revoke-item"><a href="${prefix}${app.id}"><img alt=""></a>
           <strong class="text-bold">${app.name}</strong> ${linkText ? '' : `<a href="${prefix}${app.id}">${app.name}</a>`}
           <span>${app.lastUsed} · Owned by ${app.name.split(' ')[0].toLowerCase()}</span>
           ${linkText ? `<a href="${prefix}${app.id}/permissions/update">Review request</a> <a href="${prefix}${app.id}">${linkText}</a>` : ''}
           <details><summary>More options</summary><div>Revoke ${app.name}</div></details></div>`,
      )
      .join('');
    const next =
      pageNumber * PAGE_SIZE < apps.length
        ? `<a rel="next" href="${listPath}?page=${pageNumber + 1}">Next</a>`
        : '';
    return `<div>${rows}</div><button>Revoke all</button>${next}`;
  };
  const detail = (app: App, revokePath: string) =>
    `<h1>${app.name}</h1><details><summary role="button" class="btn-danger">Revoke access</summary>
     <details-dialog><form method="post" action="${revokePath}"><p>Are you sure you want to revoke authorization?</p>
     <button type="submit">I understand, revoke access</button></form></details-dialog></details>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const signedIn = (req.headers.cookie ?? '').includes('session=1');
    const redirect = (location: string) => {
      res.writeHead(302, { location });
      res.end();
    };
    if (url.pathname === '/login') {
      // A real sign-in needs the user; the fixture signs in only when asked to.
      const returnTo = url.searchParams.get('return_to') ?? '/';
      const auto = url.searchParams.get('auto') === '1';
      if (auto) res.setHeader('set-cookie', 'session=1; Path=/; Max-Age=3600');
      res.end(
        page(
          `<p>Sign in</p>${
            auto
              ? `<script>setTimeout(() => { location.href = ${JSON.stringify(returnTo)}; }, 200)</script>`
              : ''
          }`,
        ),
      );
      return;
    }
    if (!signedIn)
      return redirect(`/login?return_to=${encodeURIComponent(url.pathname)}`);
    const connection = /^\/settings\/connections\/applications\/([^/]+)$/.exec(
      url.pathname,
    );
    const pageNumber = Number(url.searchParams.get('page') ?? '1');
    let body: string | undefined;
    if (connection && req.method === 'POST') {
      // github.com posts the revoke form to the connection page itself.
      state.revokeRequests.push(url.pathname);
      for (const [apps, listPath] of [
        [state.oauthApps, '/settings/applications'],
        [state.appAuthorizations, '/settings/apps/authorizations'],
      ] as const) {
        const index = apps.findIndex((app) => app.id === connection[1]);
        if (index >= 0) {
          apps.splice(index, 1);
          return redirect(listPath);
        }
      }
      res.writeHead(404);
      res.end('not found');
      return;
    }
    if (url.pathname === '/settings/applications')
      body = list(
        state.oauthApps,
        '/settings/connections/applications/',
        pageNumber,
        url.pathname,
      );
    else if (url.pathname === '/settings/apps/authorizations')
      body = list(
        state.appAuthorizations,
        '/settings/connections/applications/',
        pageNumber,
        url.pathname,
      );
    else if (url.pathname === '/settings/installations')
      body = list(
        state.installations,
        '/settings/installations/',
        pageNumber,
        url.pathname,
        'Configure',
      );
    else if (connection) {
      const app = [...state.oauthApps, ...state.appAuthorizations].find(
        (item) => item.id === connection[1],
      );
      body = app ? detail(app, url.pathname) : undefined;
    }
    if (!body) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(page(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
