# Changelog

## 0.2.0 (2026-11-03)

- New purpose: audit the apps and AI agents connected to your accounts and revoke the ones you no longer use.
- `openshears audit`, `prune`, `login`, `logout`, `inspect` and `providers` commands.
- Providers: GitHub (OAuth apps, GitHub App authorizations, installations), Google (linked apps), Notion (connected apps), Stripe (installed apps, not yet verified live) and a read-only inventory of local agent credential stores and MCP configurations.
- Browser-backed providers drive an installed Chrome or Edge with a dedicated profile under `~/.openshears/browser`; nothing is downloaded.
- The OpenClaw uninstaller moved to `openshears openclaw` with support for OpenClaw v2026.9.3 (profiles, relocated state, launchd update jobs, pnpm and Bun installs).

## 0.1.0 (2026-02-04)

- Initial release as the OpenClaw uninstaller.
