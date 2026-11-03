import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Stand-in for Google's "Linked apps" page: filter views, relative links whose
 * token changes on every render, duplicate app names, a detail page that only
 * works when reached from the list, a "Delete all" button and a confirmation
 * dialog. Not a copy of Google's markup.
 */
export async function startGoogleFixture() {
  const state = {
    apps: [
      { key: 'dots', name: 'OpenAI dots', filter: '3' },
      { key: 'duet', name: 'Claude Duet', filter: '3' },
      { key: 'slack-a', name: 'Slack', filter: '4' },
      { key: 'slack-b', name: 'Slack', filter: '4' },
      { key: 'x', name: 'X', filter: '2' },
    ],
    deleted: [] as string[],
    render: 0,
  };
  const tokens = new Map<string, string>();
  const page = (body: string) =>
    `<!doctype html><html><head><title>Linked apps</title></head><body><h1>Linked apps</h1>${body}</body></html>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/linkedapps') {
      state.render += 1;
      tokens.clear();
      const filter = url.searchParams.get('filters');
      const links = state.apps
        .filter((app) => app.filter === filter)
        .map((app) => {
          const token = `T${state.render}-${app.key}`;
          tokens.set(token, app.key);
          return `<li><a href="linkedapps/overview/${token}"><img alt=""></a><a href="linkedapps/overview/${token}">${app.name}</a></li>`;
        })
        .join('');
      res.setHeader('content-type', 'text/html');
      res.end(page(`<ul>${links}</ul>`));
      return;
    }
    const overview = /^\/linkedapps\/overview\/([^/]+)$/.exec(url.pathname);
    if (overview) {
      const key = tokens.get(overview[1]);
      const app = state.apps.find((item) => item.key === key);
      const fromList = (req.headers.referer ?? '').includes('/linkedapps?');
      res.setHeader('content-type', 'text/html');
      if (!app || !fromList) {
        res.end(
          page(
            "<p>Something went wrong and the action you took can't be processed right now.</p>",
          ),
        );
        return;
      }
      res.end(
        page(`<h2>${app.name}</h2><p>See details</p>
        <button onclick="document.getElementById('d').showModal()">Delete all<span>Remove all links and stop sharing your Google Account data with ${app.name}</span></button>
        <dialog id="d"><p>Delete all links with ${app.name}?</p>
          <button onclick="document.getElementById('d').close()">Cancel</button>
          <button onclick="fetch('/delete/${app.key}', {method: 'POST'}).then(() => location.href = '/linkedapps?filters=${app.filter}')">Confirm</button>
        </dialog>`),
      );
      return;
    }
    const del = /^\/delete\/([^/]+)$/.exec(url.pathname);
    if (del && req.method === 'POST') {
      state.deleted.push(del[1]);
      state.apps = state.apps.filter((app) => app.key !== del[1]);
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
