# ✂️ OpenShears

**Every AI agent asks for your GitHub. You said yes to all of them.**

Claude, ChatGPT and Codex, Cursor, Grok, Copilot's agents, Meta's Muse, that MCP server you tried for an afternoon: each one wanted your GitHub, your Gmail, your Drive, your calendar, your Notion, your Figma. Each "Authorize" took two seconds. Nobody goes back. When I ran the first audit on my own accounts, one GitHub account was holding **45 apps** and one Google account **122 linked apps**, most of them agents and tools I had forgotten I ever connected.

OpenShears is the undo button. It lists every app and agent that still holds access to your accounts, lets you say which ones you actually use, and revokes the rest in one pass instead of clicking through seven settings pages.

```bash
npx openshears audit                                      # what is connected, everywhere, read-only
npx openshears prune github --keep "Claude" --dry-run     # preview: everything else on GitHub would go
npx openshears prune github --keep "Claude"               # revoke, after a confirmation
```

## Quick start

```bash
npx openshears audit local      # agents on this machine and the credentials they hold, no sign-in needed
npx openshears audit github     # sign in once in a Chrome window, then list every app on the account
```

`npx openshears audit` with no provider runs every provider and opens a sign-in window for each one you have not signed in to yet. Audits are read-only; nothing is revoked without `prune` and a confirmation.

What an audit looks like (a real account, November 2026):

```
Audit: GitHub (oswarld)
  [OAuth app] GitHub CLI (by github) — Last used within the last week
  [OAuth app] Notion (by integration-notion) — Last used within the last 4 months
  [App authorization] ChatGPT Codex Connector (by openai) — Last used within the last week
  [App authorization] Claude (by anthropics) — Last used within the last 2 weeks
  [App authorization] Cursor (by cursor) — Last used within the last week
  [App authorization] Grok (by xAI) (by xai-org) — Last used within the last week
  [App authorization] Meta Muse AI (by meta) — Never used
  … 45 connections

Audit: Google
  [OAuth app] Claude for Gmail
  [OAuth app] Claude for Google Drive
  [Sign-in] ChatGPT
  [Sign-in] Pickle
  … 122 linked apps
```

That is the point: one GitHub account had 45 apps and one Google account 122, most of them forgotten.

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

Patterns match the connection name or id, case-insensitively, with `*` as a wildcard (`"Claude*"` keeps every Claude app). A pattern that matches nothing aborts the run before anything is revoked, so a typo in `--keep` can never revoke everything.

`--dry-run` and `--json` never revoke. Without a terminal, `prune` needs an explicit `--keep`/`--revoke`/`--all` and `--yes`. Ctrl-C, Escape and a negative answer cancel.

Example: keep Claude and Cursor on GitHub and cut everything else, previewing first:

```bash
npx openshears prune github --keep "Claude" "Cursor" --dry-run
```

```bash
npx openshears prune github --keep "Claude" "Cursor"
```

## Providers

| Provider | Covers                                                                                                                                                | Revoke                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `github` | Authorized OAuth Apps, Authorized GitHub Apps and Installed GitHub Apps under github.com settings                                                     | OAuth apps and GitHub App authorizations. Installations are listed with a link for manual uninstall. Verified live. |
| `google` | Linked apps: apps with access to your Google Account data (Gmail, Drive, Calendar, …), apps using Sign in with Google, linked accounts                | "Delete all" per app. Audit verified live; revoke dialog verified against the fixture.                              |
| `notion` | Apps connected to your Notion workspace (Settings → Connections → Connected)                                                                          | Disconnect per app. Audit verified live (English/Korean UI); disconnect verified against the fixture.               |
| `stripe` | Installed apps and third-party platforms on your Stripe account (Apps overview → Installed)                                                           | Revoke access per app. Page and sign-in verified live; rows await an account with apps installed.                   |
| `figma`  | Third-party apps connected to your Figma account (Settings → Security → Connected apps)                                                               | Revoke access per app. Audit verified live (English/Korean UI); the confirmation verified against the fixture.      |
| `vercel` | Integrations installed on your Vercel team (Dashboard → Integrations)                                                                                 | Remove integration. List and the Remove button verified live; the confirmation verified against the fixture.        |
| `slack`  | Apps installed in your Slack workspace (Manage apps → Installed apps)                                                                                 | Read-only list, verified live. Removal depends on workspace policy; do it from the app's Configuration tab.         |
| `local`  | Credential stores and MCP configurations of agents installed on this machine (Claude, Codex, Gemini, Cursor, Windsurf, VS Code, OpenClaw, GitHub CLI) | Read-only inventory. Only MCP server _names_ are read; tokens and commands are never read back.                     |

Each revocation opens the app's detail page, confirms the revoke dialog, then reloads the list to verify the app is gone. If it is still listed, the run reports a failure for that app and continues with the others.

## What is verified, honestly

Settings pages are not a stable API. Recipes use accessible names and link structure rather than markup classes, follow pagination, and every recipe has a local stand-in site in the test suite that exercises listing and revocation end to end. On top of that:

- **Audits were run against real accounts** for GitHub, Google, Notion, Figma, Vercel and Slack on 2026-11-03, and the revoke buttons were located on the real pages.
- **The final confirmation click** of each revoke flow has only been exercised against the stand-in sites. The first real revoke on a service is the moment to use `--revoke "<one disposable app>"` and watch with `--headed`.
- **Slack** is listed read-only; **Stripe** rows are unverified until an account with installed apps runs it.
- Labels follow the account's UI language. English and Korean are covered where it mattered; other languages need the regexes in `src/providers/` extended.

The full status per flow is in [docs/providers.md](docs/providers.md). When a site changes its page, `openshears inspect <provider>` shows what the recipe can hook into.

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

Tests use temporary directories, mocked providers and local HTTP fixtures that mimic each service's settings pages; they never sign in to a real account or revoke anything. The fixture tests run headless Chrome when it is installed and are skipped otherwise.

## Contributing: add the services you want to cut

Every SaaS has a "connected apps" page and almost none of them have an API for it. OpenShears covers GitHub, Google, Notion, Stripe, Figma, Vercel and Slack today; **please add the services you use.** Discord, Linear, Dropbox, Microsoft, Atlassian, Zoom, Hugging Face, X, LinkedIn and Shopify all have such a page and fit the same model.

A provider is a `WebRecipe` in `src/providers/<service>.ts`: the settings page URL, how rows are found (link prefix or row selector), and the revoke clicks named by accessible role and label. No service-specific code is needed.

1. Sign in once: `openshears login <service>` (or add the recipe first with just `baseUrl`, `loginPath` and `signedOutPaths`).
2. Run `openshears inspect <service>` on the connected-apps page. It prints, read-only, the headings, links, buttons and repeated containers the recipe can hook into.
3. Fill in `lists` and `revoke`, then verify with `openshears audit <service>` and one disposable app through `openshears prune <service> --revoke "<name>"`.
4. Add a small fixture site under `tests/fixtures/` that mimics the page shape (see the GitHub, Google, Notion, Figma and Vercel ones) and a test that audits and revokes against it.
5. Note the verification date and any locale-specific labels in [docs/providers.md](docs/providers.md).

Keep audits read-only, verify every revocation by re-reading the list, never log tokens or form contents. A pull request with a new recipe is the most useful contribution this project can get.

## License

MIT. See [LICENSE](LICENSE).
