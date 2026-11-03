# Changelog

## 0.2.1 (2026-11-03)

- Sign-in no longer navigates your tab: a second tab checks for a session, so identity-provider detours and two-factor or security-key steps are left alone.
- The launched Chrome uses the real OS keychain, so passkeys and security keys backed by iCloud Keychain or Touch ID work on sign-in pages.
- Clear errors when the sign-in window is closed early or a site drops the session right after sign-in; `OPENSHEARS_DEBUG=1` prints the navigation trace (hostnames and paths only).
- Stripe: `/auth` counts as signed out; the Installed apps page and sign-in flow are verified live, rows await an account with installed apps.
- README invites recipes for more services and documents the `inspect` workflow for writing them.

## 0.2.0 (2026-11-03)

- New purpose: audit the apps and AI agents connected to your accounts and revoke the ones you no longer use.
- `openshears audit`, `prune`, `login`, `logout`, `inspect` and `providers` commands.
- Providers: GitHub (OAuth apps, GitHub App authorizations, installations), Google (linked apps), Notion (connected apps), Stripe (installed apps, not yet verified live) and a read-only inventory of local agent credential stores and MCP configurations.
- Browser-backed providers drive an installed Chrome or Edge with a dedicated profile under `~/.openshears/browser`; nothing is downloaded.
- The OpenClaw uninstaller moved to `openshears openclaw` with support for OpenClaw v2026.9.3 (profiles, relocated state, launchd update jobs, pnpm and Bun installs).

## 0.1.0 (2026-02-04)

- Initial release as the OpenClaw uninstaller.
