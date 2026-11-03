import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Stand-in for Figma's settings dialog: a profile button, a Settings menu
 * entry, a dialog with tabs, and a Security tab whose connected apps have no
 * row markup of their own, only a "Revoke access" button each, followed by a
 * confirmation dialog.
 */
export async function startFigmaFixture() {
  const state = {
    apps: ['Figma MCP in ChatGPT', 'Figma MCP in Claude', 'Muse'],
    revoked: [] as string[],
  };
  const page =
    () => `<!doctype html><html><head><title>Files</title></head><body>
    <button data-testid="ProfileButton" aria-haspopup="menu" onclick="document.getElementById('menu').hidden=false">Plan: Team</button>
    <div id="menu" hidden><div onclick="document.getElementById('settings').showModal()">Settings</div></div>
    <dialog id="settings" role="dialog">
      <div role="tablist"><div role="tab" onclick="show('account')">Account</div><div role="tab" onclick="show('security')">Security</div></div>
      <div id="account">Name, email</div>
      <div id="security" hidden>
        <h3>Sessions</h3><div><span>macOS Chrome</span><button>Log out</button></div>
        <h3>Connected apps</h3>
        ${state.apps
          .map(
            (
              app,
            ) => `<div><div><span>${app}</span><br><span>Connected 2 months ago</span></div>
              <button onclick="confirmRevoke('${app}')">Revoke access</button></div>`,
          )
          .join('')}
      </div>
    </dialog>
    <dialog id="confirm" role="dialog"><p id="confirm-text"></p>
      <button onclick="document.getElementById('confirm').close()">Cancel</button>
      <button onclick="doRevoke()">Revoke</button></dialog>
    <script>
      let pending = null;
      function show(id) { for (const x of ['account', 'security']) document.getElementById(x).hidden = x !== id; }
      function confirmRevoke(app) { pending = app; document.getElementById('confirm-text').textContent = 'Revoke ' + app + '?'; document.getElementById('confirm').showModal(); }
      async function doRevoke() { await fetch('/revoke', { method: 'POST', body: pending }); location.reload(); }
    </script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url === '/revoke' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        state.revoked.push(body);
        state.apps = state.apps.filter((app) => app !== body);
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
