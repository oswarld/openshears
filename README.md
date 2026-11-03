# ✂️ OpenShears

Too many agents, too many grants. OpenAI dots, Grok bots, Gemini Spark, Claude Duet, Meta Muse, Instinct, Pickle: every one of them asks for your GitHub, your calendar, your files. OpenShears lets you **audit** which apps and agents still hold access to your accounts, decide which ones you actually use, and **revoke the rest in one pass** instead of clicking through every settings page.

## Quick start

```bash
npx openshears audit local                                 # agents on this machine, no sign-in needed
npx openshears audit github                                # sign in once in a Chrome window, then list every app
npx openshears prune github --keep "Claude Duet" --dry-run # preview: everything else would be revoked
npx openshears prune github --keep "Claude Duet"           # revoke, after a confirmation
```

`npx openshears audit` with no provider runs every provider and opens a sign-in window for each one you have not signed in to yet (GitHub, Google, Notion, Stripe). Audits are read-only; nothing is revoked without `prune` and a confirmation.

OpenShears is named after the shears used to take a lobster apart. It started as the [OpenClaw](https://github.com/openclaw/openclaw) uninstaller, which still ships as `openshears openclaw`.

## How it works

Most services offer no API for _you_ to list or revoke the third-party apps you authorized; GitHub removed its OAuth Authorizations API in 2020 and only shows grants on the settings pages. OpenShears therefore drives those same pages in a browser you already have installed (Google Chrome or Microsoft Edge, no download) using a **dedicated profile** under `~/.openshears/browser`. You sign in once in a visible window; later runs reuse that session headlessly. OpenShears never reads what you type, never stores passwords and never touches your everyday browser profile.

Requires Node.js 20 or newer and Chrome or Edge for browser-backed providers. Set `OPENSHEARS_BROWSER` to another Chromium executable if needed.

## Commands

| Command                                          | What it does                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `openshears audit [provider...]`                 | List connections for every provider (or the named ones). Read-only. `--json` for a report, `--headed` to watch the browser. |
| `openshears prune <provider> --keep <name...>`   | Revoke every revocable connection that does not match a kept name. Shows the plan and asks.                                 |
| `openshears prune <provider> --revoke <name...>` | Revoke only the matching connections.                                                                                       |
| `openshears prune <provider>`                    | Interactive: pick the connections to keep from a checklist (all kept by default).                                           |
| `openshears login <provider>`                    | Open the browser profile and sign in.                                                                                       |
| `openshears logout`                              | Delete the stored browser sessions.                                                                                         |
| `openshears providers`                           | List providers.                                                                                                             |
| `openshears inspect <provider>`                  | Dump a provider's pages (headings, links, buttons) read-only, to write or repair a recipe.                                  |
| `openshears openclaw`                            | The original OpenClaw uninstaller (see below).                                                                              |

Patterns match the connection name or id, case-insensitively, with `*` as a wildcard. A pattern that matches nothing aborts the run before anything is revoked, so a typo in `--keep` can never revoke everything.

`--dry-run` and `--json` never revoke. Without a terminal, `prune` needs an explicit `--keep`/`--revoke`/`--all` and `--yes`. Ctrl-C, Escape and a negative answer cancel.

Example: keep Claude Duet on GitHub and cut everything else, previewing first:

```bash
npx openshears prune github --keep "Claude Duet" --dry-run
```

```bash
npx openshears prune github --keep "Claude Duet"
```

## Providers

| Provider | Covers                                                                                                                                                | Revoke                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `github` | Authorized OAuth Apps, Authorized GitHub Apps and Installed GitHub Apps under github.com settings                                                     | OAuth apps and GitHub App authorizations. Installations are listed with a link for manual uninstall. Verified live. |
| `google` | Linked apps: apps with access to your Google Account data (Gmail, Drive, Calendar, …), apps using Sign in with Google, linked accounts                | "Delete all" per app. Audit verified live; revoke dialog verified against the fixture.                              |
| `notion` | Apps connected to your Notion workspace (Settings → Connections → Connected)                                                                          | Disconnect per app. Audit verified live (English/Korean UI); disconnect verified against the fixture.               |
| `stripe` | Installed apps and third-party platforms on your Stripe account (Settings → Installed apps)                                                           | Revoke access per app. Live verification pending.                                                                   |
| `local`  | Credential stores and MCP configurations of agents installed on this machine (Claude, Codex, Gemini, Cursor, Windsurf, VS Code, OpenClaw, GitHub CLI) | Read-only inventory. Only MCP server _names_ are read; tokens and commands are never read back.                     |

Each revocation opens the app's detail page, confirms the revoke dialog, then reloads the list to verify the app is gone. If it is still listed, the run reports a failure for that app and continues with the others.

GitHub's settings pages are not a stable API. The recipe uses accessible names and link structure rather than markup classes, follows pagination, and the test suite exercises it against a local stand-in site. The audit and the revoke dialog were checked against a real github.com account on 2026-11-03. See [docs/providers.md](docs/providers.md) for the verification status of each flow and how to add a provider.

## OpenClaw removal

`openshears openclaw` inspects and removes local OpenClaw installations on macOS and Linux/WSL. Preview with `--dry-run` or `--json`; `--keep-data` preserves state and workspaces; `--include-workspaces` also removes external workspaces. Removal is permanent and state directories contain credentials, sessions and memory. The behavior, boundaries and compatibility notes are documented in [docs/openclaw-compatibility.md](docs/openclaw-compatibility.md).

## Development

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js audit local
```

Tests use temporary directories, mocked providers and a local HTTP fixture that mimics GitHub's settings URLs; they never sign in to a real account or revoke anything. The fixture tests run headless Chrome when it is installed and are skipped otherwise.

## Contributing

A new provider is a `WebRecipe` (list pages as link prefixes or row selectors, plus revoke steps named by accessible role and label) or a `Provider` implementation for services with a real API. Start from `openshears inspect` output of the signed-in page. Keep audits read-only, verify every revocation by re-reading the list, never log tokens or form contents, and add a fixture test.

## License

MIT. See [LICENSE](LICENSE).
