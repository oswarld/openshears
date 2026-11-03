# Providers

## Model

A provider returns `Connection` records (`kind`, `id`, `name`, `owner`, `lastUsed`, `revocable`, `url`) from `audit()` and revokes one record at a time with `revoke()`. The prune planner (`src/core/selection.ts`) is pure: it turns the audit and the `--keep`/`--revoke`/`--all` selection into a plan of connections to revoke, keep and skip, and refuses to run when a pattern matches nothing.

Browser-backed providers are declared as a `WebRecipe` (`src/browser/recipe.ts`), which is data, not code:

- `lists`: settings pages. Each list uses one of two strategies: `linkPrefix` (every link whose href starts with the prefix is one connection, like GitHub) or `rows` (a CSS selector matching one element per connection, with optional `name` selector and `idAttribute`, like single-page settings UIs). `openSteps` click through dialogs or tabs when the list is not directly addressable. `a[rel=next]` pagination is followed automatically.
- `signedOutPaths` / `signedOutHosts`: where the site sends a visitor without a session; reaching one raises `NotSignedInError`, and an interactive run reopens the browser visibly and waits up to five minutes for sign-in.
- `revoke[kind]`: either `detailPath` (open the connection's page) or an in-list flow (optionally `clickRow`), followed by `steps`: clicks found by accessible role and name, scoped to the page, the open dialog or the connection's row. Optional steps are skipped when absent.
- `unverified`: a warning shown in audits until the recipe has been checked against the live site.

After each revoke the list is re-read; the connection must be gone or the revoke counts as failed.

`openshears inspect <provider> [paths...]` prints, read-only, the headings, links, buttons and repeated containers of a provider's pages. That output is what a recipe is written from, and what to compare against when a site changes.

## GitHub (`github`)

| Flow                              | Page                                             | Status (live check on github.com, 2026-11-03)                                                                 |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| List Authorized OAuth Apps        | `/settings/applications`                         | Verified: names, owner ("Owned by …"), "Never used"/"Last used …" text and `a[rel=next]` pagination.          |
| List Authorized GitHub Apps       | `/settings/apps/authorizations`                  | Verified. Rows link to the same `/settings/connections/applications/<client_id>` page as OAuth apps.          |
| List Installed GitHub Apps        | `/settings/installations`                        | Verified, read-only. Names come from the row's bold text; `…/permissions/update` links are ignored.           |
| Revoke OAuth app / GitHub App     | `/settings/connections/applications/<client_id>` | Trigger and dialog verified read-only: `<summary role=button>` "Revoke access" opens a `details-dialog` whose form posts to the same path with the button "I understand, revoke access". The submit itself has only been exercised against the local fixture. |
| Uninstall GitHub App installation | `/settings/installations/<id>`                   | Not automated; the audit prints the link.                                                                     |

Why a browser: GitHub's REST API lets a user list app installations (`GET /user/installations`) but offers no endpoint to list or revoke the OAuth apps a user authorized; the OAuth Authorizations API was removed on November 13, 2020, and `DELETE /applications/{client_id}/grant` is for app owners only.

To re-verify after a GitHub UI change: run `openshears login github`, then `openshears audit github --headed` and compare the list with the three settings tabs. Then revoke one disposable app with `openshears prune github --revoke "<name>" --headed`. If GitHub's button names differ, adjust `trigger`/`confirm` in `src/providers/github.ts`.

## Google (`google`)

Page: `https://myaccount.google.com/linkedapps` ("Linked apps"), read in three filter views: `?filters=3` apps with access to your Google Account data, `?filters=4` apps using Sign in with Google, `?filters=2` linked accounts. Consumer accounts have no API; the Directory `tokens` API is for Workspace admins.

Checked live on 2026-11-03: rows are relative links `linkedapps/overview/<token>` whose token changes on every page load, so connections are identified by name (`idFromName`, duplicates get `-2`, `-3`). An app present in several views is listed once. The detail page renders only when reached by clicking the list link; it offers **Delete all** ("Remove all links and stop sharing your Google Account data with <app>") and a confirmation dialog. Audit verified live (30 apps with data access, 92 sign-in apps on the test account); the Delete all confirmation has only been exercised against the local fixture.

## Notion (`notion`)

The workspace app lives at `app.notion.com` (`www.notion.so` and `www.notion.com` redirect there when signed in and to the marketing site otherwise; the recipe treats those hosts as signed out). Connections live in the in-app Settings dialog; there is no URL and no user API.

Checked live on 2026-11-03: the sidebar workspace switcher (`.notion-sidebar-switcher`) opens a menu whose **Settings** entry (plain text, no role) opens the settings dialog; its **Connections** tab has a **Connected** sub-tab that lists each app as a table row with a **Manage <app>** button (`aria-label`; Korean UI: `<app> 관리`). The manage dialog's danger zone has **Disconnect** (`연결 해제하기`). Built-in connections such as GitHub link previews show "Add service" instead of Manage and are not listed. Labels follow the account's UI language; English and Korean are covered, other languages need the regexes extended. Audit verified live; the Disconnect click and its confirmation were exercised against the local fixture only.

## Stripe (`stripe`)

Page: `https://dashboard.stripe.com/settings/apps` ("Apps overview", **Installed** tab; the place Stripe support names for revoking a platform). Checked live on 2026-11-03: a signed-out visit redirects to `/login?redirect=…`, Google sign-in detours through accounts.google.com and returns to `/login` for the verification step, and the Installed tab shows "No apps installed yet" on the test account, so the row selector and the revoke flow could not be verified against real data. Flow from Stripe's help: open the app, "Revoke access" / "Uninstall", confirm. Stripe warns that disconnecting a platform can affect subscriptions it created, and Connect-controlled accounts may not be allowed to revoke.

## Sign-in notes

- Sign-in runs in OpenShears' own Chrome profile because the tool has to drive the pages; a session from your everyday browser cannot be reused (cookies never leave the browser they were created in).
- The user's tab is never navigated during sign-in. A second tab probes whether the first list page opens without bouncing to the login page, so identity-provider detours and two-factor pages are left alone.
- Chrome is started with its real OS keychain so passkeys and security keys backed by iCloud Keychain or Touch ID can be used. Tick "remember this device" where the site offers it; otherwise the session may end when the window closes.
- `OPENSHEARS_DEBUG=1` prints the navigation trace (hostnames and paths only).

## This machine (`local`)

Lists existing credential stores and MCP configuration files for agents installed under the home directory and, for JSON configurations, the MCP server names. Nothing is edited; OpenClaw state removal remains in `openshears openclaw`.

## Candidates

Representative "connected apps" pages that fit the same recipe model: Slack (`/apps/manage`), Discord (Authorized Apps), Vercel, Linear, Figma, Dropbox (Connected apps), Microsoft account (`account.live.com/consent/Manage`), Atlassian (Connected apps), Zoom (App Marketplace > Manage), Hugging Face (Connected applications). Microsoft Entra's `GET /me/oauth2PermissionGrants` exists but requires directory roles, so it is not usable for a typical personal account.
