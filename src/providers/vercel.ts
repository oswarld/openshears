import { createWebProvider, type WebRecipe } from '../browser/recipe.js';

// Vercel lists installed integrations per team at /<team>/~/integrations;
// the /d?to= helper redirects to the current team. Checked live on
// 2026-11-03: each installation is a row with an icon link and a "Manage"
// link to /<team>/~/integrations/<integration>/icfg_<id>; marketplace
// suggestions on the same page link to /<team>/~/integrations/<integration>
// without an icfg id and are ignored. The installation's Settings tab
// (<url>/settings) has a "Remove <integration>" button; the confirmation
// dialog has only been exercised against the local fixture.
export const vercelRecipe: WebRecipe = {
  id: 'vercel',
  title: 'Vercel',
  description:
    'Integrations installed on your Vercel account or team (Dashboard → Integrations)',
  baseUrl: 'https://vercel.com',
  loginPath: '/login',
  signedOutPaths: ['/login', '/signup'],
  lists: [
    {
      kind: 'app-installation',
      label: 'Installed Integrations',
      path: '/d?to=%2F%5Bteam%5D%2F%7E%2Fintegrations',
      linkPattern:
        /^\/[^/]+\/~\/integrations\/[^/]+\/(icfg_[A-Za-z0-9]+)(?:[?#]|$)/,
      revocable: true,
    },
  ],
  revoke: {
    'app-installation': {
      openUrl: true,
      urlSuffix: '/settings',
      steps: [
        { role: 'button', name: /^remove\b/i },
        {
          role: 'button',
          name: /remove|confirm/i,
          within: 'dialog',
          optional: true,
        },
      ],
    },
  },
};

export const vercel = createWebProvider(vercelRecipe);
