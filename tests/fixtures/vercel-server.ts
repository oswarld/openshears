import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Stand-in for Vercel's integrations page: a team-scoped URL reached through
 * a redirect helper, rows with an icon link and a "Manage" link carrying an
 * icfg id, marketplace suggestions without an id, and a detail page with
 * "Remove Integration" plus a confirmation dialog.
 */
export async function startVercelFixture() {
  const state = {
    installed: [
      { slug: 'railway', id: 'icfg_aaa111', name: 'Railway' },
      { slug: 'supabase', id: 'icfg_bbb222', name: 'Supabase' },
      { slug: 'supabase', id: 'icfg_ccc333', name: 'Supabase' },
    ],
    removed: [] as string[],
  };
  const page = (body: string) =>
    `<!doctype html><html><head><title>Vercel</title></head><body>${body}</body></html>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const redirect = (location: string) => {
      res.writeHead(302, { location });
      res.end();
    };
    if (url.pathname === '/d') return redirect('/acme/~/integrations');
    if (url.pathname === '/acme/~/integrations') {
      res.setHeader('content-type', 'text/html');
      res.end(
        page(
          `<h1>Integrations</h1><ul>${state.installed
            .map(
              (item) =>
                `<li><a href="/acme/~/integrations/${item.slug}/${item.id}"><img alt=""></a><div>${item.name}</div><div>Installed</div><a href="/acme/~/integrations/${item.slug}/${item.id}">Manage</a></li>`,
            )
            .join(
              '',
            )}</ul><h2>Marketplace</h2><a href="/acme/~/integrations/aws">AWS</a>`,
        ),
      );
      return;
    }
    const detail =
      /^\/acme\/~\/integrations\/([^/]+)\/(icfg_[A-Za-z0-9]+)(\/settings)?$/.exec(
        url.pathname,
      );
    if (detail) {
      const item = state.installed.find((entry) => entry.id === detail[2]);
      if (!item) {
        res.writeHead(404);
        res.end('gone');
        return;
      }
      if (req.method === 'POST') {
        state.removed.push(item.id);
        state.installed = state.installed.filter(
          (entry) => entry.id !== item.id,
        );
        return redirect('/acme/~/integrations');
      }
      res.setHeader('content-type', 'text/html');
      if (!detail[3]) {
        res.end(
          page(
            `<h1>${item.name}</h1><p>Overview</p><a href="${url.pathname}/settings">Settings</a>`,
          ),
        );
        return;
      }
      res.end(
        page(`<h1>${item.name}</h1><p>Settings</p>
        <button onclick="document.getElementById('d').showModal()">Remove ${item.name}</button>
        <dialog id="d"><form method="post" action="${url.pathname.replace(/\/settings$/, '')}"><p>Are you sure?</p><button type="submit">Remove</button></form></dialog>`),
      );
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
