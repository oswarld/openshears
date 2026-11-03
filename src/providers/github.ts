import { createWebProvider, type WebRecipe } from '../browser/recipe.js';

// github.com offers no REST or GraphQL endpoint for a user to list or revoke
// third-party OAuth grants (the OAuth Authorizations API was removed in
// November 2020), so OpenShears drives the same settings pages a user would.
// Verified against github.com on 2026-11-03: list rows carry the app name as a
// link plus "Last used ..." / "Never used · Owned by <owner>" text, lists use
// a[rel=next] pagination, and the connection page has a "Revoke access"
// <summary role=button> that opens a details-dialog with an
// "I understand, revoke access" submit button.
const REVOKE = /^(?!.*revoke all)(?=.*revoke)/i;

export const githubRecipe: WebRecipe = {
  id: 'github',
  title: 'GitHub',
  description:
    'Authorized OAuth apps, GitHub App authorizations and app installations on github.com',
  baseUrl: 'https://github.com',
  loginPath: '/login?return_to=%2Fsettings%2Fapplications',
  signedOutPaths: ['/login', '/sessions', '/session'],
  accountMeta: 'user-login',
  lists: [
    {
      kind: 'oauth-app',
      label: 'Authorized OAuth Apps',
      path: '/settings/applications',
      linkPrefix: '/settings/connections/applications/',
      revocable: true,
    },
    {
      kind: 'app-authorization',
      label: 'Authorized GitHub Apps',
      path: '/settings/apps/authorizations',
      // GitHub App authorizations share the OAuth connection page.
      linkPrefix: '/settings/connections/applications/',
      revocable: true,
    },
    {
      kind: 'app-installation',
      label: 'Installed GitHub Apps',
      path: '/settings/installations',
      linkPrefix: '/settings/installations/',
      revocable: false,
      note: 'Installations are listed read-only; uninstall from the installation page.',
    },
  ],
  revoke: {
    'oauth-app': {
      detailPath: (id) => `/settings/connections/applications/${id}`,
      steps: [
        { role: 'button', name: REVOKE },
        { role: 'button', name: REVOKE, within: 'dialog' },
      ],
    },
    'app-authorization': {
      detailPath: (id) => `/settings/connections/applications/${id}`,
      steps: [
        { role: 'button', name: REVOKE },
        { role: 'button', name: REVOKE, within: 'dialog' },
      ],
    },
  },
};

export const github = createWebProvider(githubRecipe);
