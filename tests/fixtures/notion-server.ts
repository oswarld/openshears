import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Stand-in for Notion's settings dialog: a sidebar switcher, a "Settings" menu
 * entry (plain text, no role), a dialog with tabs, a Connected sub-tab whose
 * rows are "Manage <app>" buttons, and a manage dialog with Disconnect plus a
 * confirmation. Everything happens on one page, as in the app.
 */
export async function startNotionFixture() {
  const state = {
    apps: ['Composio', 'Pickle', 'Skills'],
    disconnected: [] as string[],
  };
  const page =
    () => `<!doctype html><html><head><title>Workspace</title></head><body>
    <div class="notion-sidebar-switcher" role="button" tabindex="0" onclick="document.getElementById('menu').hidden=false">INLEVEL9</div>
    <div id="menu" hidden><div role="presentation" onclick="document.getElementById('settings').showModal()">Settings</div></div>
    <dialog id="settings" role="dialog"><div role="tablist">
      <div role="tab" onclick="show('general')">General</div>
      <div role="tab" onclick="show('connections')">Connections</div></div>
      <div id="general">General settings</div>
      <div id="connections" hidden>
        <div role="tablist"><div role="tab" onclick="showSub('browse')">Browse connections</div>
          <div role="tab" onclick="showSub('connected')">Connected ${state.apps.length}</div></div>
        <div id="browse">Browse…</div>
        <div id="connected" hidden><table><tbody>
          <tr><td>GitHub</td><td><div role="button" aria-label="Add service to GitHub">Add service</div></td></tr>
          ${state.apps
            .map(
              (app) =>
                `<tr><td>${app}</td><td><div role="button" tabindex="0" aria-label="Manage ${app}" onclick="openManage('${app}')">Manage</div></td></tr>`,
            )
            .join('')}
        </tbody></table></div>
      </div>
    </dialog>
    <dialog id="manage" role="dialog"><h2 id="manage-title"></h2><p>Danger zone</p>
      <div role="button" tabindex="0" onclick="document.getElementById('confirm').showModal()">Disconnect</div></dialog>
    <dialog id="confirm" role="dialog"><p>Are you sure?</p>
      <div role="button" tabindex="0" onclick="disconnect()">Disconnect</div></dialog>
    <script>
      let current = null;
      function show(id) { for (const x of ['general', 'connections']) document.getElementById(x).hidden = x !== id; }
      function showSub(id) { for (const x of ['browse', 'connected']) document.getElementById(x).hidden = x !== id; }
      function openManage(app) { current = app; document.getElementById('manage-title').textContent = app; document.getElementById('manage').showModal(); }
      async function disconnect() { await fetch('/disconnect', { method: 'POST', body: current }); location.reload(); }
    </script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url === '/disconnect' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        state.disconnected.push(body);
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
