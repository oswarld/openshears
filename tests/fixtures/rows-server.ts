import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A single-page "connected apps" site in the style of Google/Stripe settings:
 * no per-app links, rows rendered as list items, an in-row menu with a
 * "Remove access" item and a confirmation dialog. Revocation happens through
 * a POST issued by page script, as SPAs do.
 */
export async function startRowsFixture() {
  const state = {
    apps: [
      {
        id: 'app-dots',
        name: 'OpenAI dots',
        detail: 'Has access to Gmail · Last used today',
      },
      {
        id: 'app-duet',
        name: 'Claude Duet',
        detail: 'Has access to Drive · Last used yesterday',
      },
      { id: 'app-muse', name: 'Meta Muse', detail: 'Sign in with Google' },
    ],
    removed: [] as string[],
  };
  const page =
    () => `<!doctype html><html><head><title>Connections</title></head><body>
    <h1>Third-party apps &amp; services</h1>
    <ul>${state.apps
      .map(
        (app) => `<li role="listitem" data-app-id="${app.id}">
          <strong>${app.name}</strong><span>${app.detail}</span>
          <button aria-label="More options for ${app.name}" aria-haspopup="menu" onclick="this.nextElementSibling.hidden=false">⋮</button>
          <div role="menu" hidden><button role="menuitem" onclick="openDialog('${app.id}', '${app.name}')">Remove access</button></div>
        </li>`,
      )
      .join('')}</ul>
    <dialog id="confirm"><p id="confirm-text"></p><form method="dialog">
      <button value="cancel">Cancel</button><button value="ok" id="ok">Confirm</button></form></dialog>
    <script>
      let pending = null;
      function openDialog(id, name) {
        pending = id;
        document.getElementById('confirm-text').textContent = 'Remove ' + name + '?';
        document.getElementById('confirm').showModal();
      }
      document.getElementById('confirm').addEventListener('close', async () => {
        if (document.getElementById('confirm').returnValue !== 'ok') return;
        await fetch('/api/remove', { method: 'POST', body: pending });
        location.reload();
      });
    </script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/remove' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        state.removed.push(body);
        state.apps = state.apps.filter((app) => app.id !== body);
        res.end('ok');
      });
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(page());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
