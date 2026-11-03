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
- Chrome is started with its real OS keychain so passkeys and security keys backed by iCloud Keychain or Touch ID can be used. Chrome encrypts stored cookies with that keychain key, so every launch of the profile must use the same setting: a profile touched by a launch with Playwright's mock keychain (its default) loses all sessions. Tooling that opens `~/.openshears/browser` must go through `launchBrowser` in `src/browser/session.ts`. Tick "remember this device" where the site offers it.
- `OPENSHEARS_DEBUG=1` prints the navigation trace (hostnames and paths only).

## Figma (`figma`)

Settings live in a dialog opened from the file browser's profile button (`data-testid="ProfileButton"`) → **Settings** → **Security** tab. Checked live on 2026-11-03: the tab lists active sessions, personal access tokens and **Connected apps**, each app as a name, "Connected N months ago" and a **Revoke access** button (Korean UI: 보안 / 연결된 앱 / 액세스 권한 취소). The apps have no row markup of their own, so the recipe derives rows from the revoke buttons (`anchorButton`) and targets them by position. If a stored session does not survive between runs, `audit figma` opens the sign-in window and continues in the same session. Audit verified live (four connected apps on the test account); the revoke click and its confirmation were exercised against the local fixture only.

## Slack (`slack`)

Page: `slack.com/apps/manage`, which redirects to `app.slack.com/apps-manage/<team id>/integrations/installed`. Checked live on 2026-11-03: each installed app is a row linking to `/apps-manage/<team>/integrations/profile/<app id>/permissions` (five apps on the test workspace, Korean UI). Removal and authorization revocation live on the app's Configuration tab (slack.com/help/articles/360003125231), which did not render in a headless session, and workspace owners can restrict who may remove apps, so installations are listed read-only. The per-user "Connected accounts" page (`<workspace>.slack.com/apps/manage/connections`) was empty on the test account and is not read yet.

## Vercel (`vercel`)

Page: `vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fintegrations`, Vercel's redirect helper to the current team's `/<team>/~/integrations`. Checked live on 2026-11-03: each installation is a row with an icon link and a **Manage** link to `/<team>/~/integrations/<integration>/icfg_<id>`; marketplace suggestions on the same page link without an `icfg` id and are ignored. Six installations were listed on the test team. Removal: the installation's **Settings** tab (`…/icfg_<id>/settings`) has a **Remove <integration>** button (checked live); its confirmation dialog has only been exercised against the local fixture. Sessions persist across runs.

## This machine (`local`)

Lists existing credential stores and MCP configuration files for agents installed under the home directory and, for JSON configurations, the MCP server names. Nothing is edited; OpenClaw state removal remains in `openshears openclaw`.

## Candidates

Representative "connected apps" pages that fit the same recipe model: Slack (`/apps/manage`), Discord (Authorized Apps), Vercel, Linear, Figma, Dropbox (Connected apps), Microsoft account (`account.live.com/consent/Manage`), Atlassian (Connected apps), Zoom (App Marketplace > Manage), Hugging Face (Connected applications). Microsoft Entra's `GET /me/oauth2PermissionGrants` exists but requires directory roles, so it is not usable for a typical personal account.
