import { createWebProvider, type WebRecipe } from '../browser/recipe.js';

// Stripe lists installed apps and OAuth-connected platforms under
// Settings > Installed apps (support.stripe.com, "revoke access of a platform").
// Names await a live check.
export const stripeRecipe: WebRecipe = {
  id: 'stripe',
  title: 'Stripe',
  description:
    'Installed apps and third-party platforms authorized on your Stripe account',
  baseUrl: 'https://dashboard.stripe.com',
  loginPath: '/login?redirect=%2Fsettings%2Fapps',
  signedOutPaths: ['/login', '/register'],
  unverified:
    'The Stripe recipe has not been checked against the live dashboard yet; compare with "openshears inspect stripe".',
  lists: [
    {
      kind: 'app-installation',
      label: 'Installed apps',
      path: '/settings/apps',
      rows: {
        selector: 'a[href*="/settings/apps/"], [role="row"], [role="listitem"]',
        exclude: /^(name|installed apps|app marketplace|browse)/i,
      },
      revocable: true,
    },
  ],
  revoke: {
    'app-installation': {
      clickRow: true,
      steps: [
        { role: 'button', name: /revoke access|uninstall|remove/i },
        {
          role: 'button',
          name: /revoke|uninstall|remove|confirm/i,
          within: 'dialog',
        },
      ],
    },
  },
};

export const stripe = createWebProvider(stripeRecipe);
