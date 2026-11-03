import {
  createWebProvider,
  type Step,
  type WebRecipe,
} from '../browser/recipe.js';

// Consumer Google Accounts expose no API for listing third-party access (the
// Directory API "tokens" resource is for Workspace admins), so OpenShears uses
// the "Linked apps" page. Checked against myaccount.google.com on 2026-11-03:
// each filter view lists apps as relative links "linkedapps/overview/<token>"
// whose token changes per page load, so connections are identified by name.
// The detail page only renders when reached from the list, and offers
// "Delete all — Remove all links and stop sharing your Google Account data
// with <app>" followed by a confirmation dialog.
const DELETE_ALL: Step[] = [
  { role: 'button', name: /delete all/i },
  {
    role: 'button',
    name: /^(confirm|delete all|delete|remove|ok)$/i,
    within: 'dialog',
  },
];

export const googleRecipe: WebRecipe = {
  id: 'google',
  title: 'Google',
  description:
    'Apps with access to your Google Account data, apps using Sign in with Google, and linked accounts',
  baseUrl: 'https://myaccount.google.com',
  loginPath: '/linkedapps?filters=3',
  signedOutPaths: ['/signin', '/intro', '/ServiceLogin'],
  signedOutHosts: ['accounts.google.com'],
  lists: [
    {
      kind: 'oauth-app',
      label: 'Access to your Google Account',
      path: '/linkedapps?filters=3',
      linkPrefix: 'linkedapps/overview/',
      idFromName: true,
      revocable: true,
    },
    {
      kind: 'sign-in',
      label: 'Sign in with Google',
      path: '/linkedapps?filters=4',
      linkPrefix: 'linkedapps/overview/',
      idFromName: true,
      revocable: true,
      note: 'Removing stops Sign in with Google for the app; data already in the app stays there.',
    },
    {
      kind: 'linked-account',
      label: 'Linked accounts',
      path: '/linkedapps?filters=2',
      linkPrefix: 'linkedapps/overview/',
      idFromName: true,
      revocable: true,
    },
  ],
  revoke: {
    'oauth-app': { clickRow: true, steps: DELETE_ALL },
    'sign-in': { clickRow: true, steps: DELETE_ALL },
    'linked-account': { clickRow: true, steps: DELETE_ALL },
  },
};

export const google = createWebProvider(googleRecipe);
