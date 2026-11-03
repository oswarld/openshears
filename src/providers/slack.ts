import { createWebProvider, type WebRecipe } from '../browser/recipe.js';

// Slack manages apps per workspace. Checked live on 2026-11-03:
// slack.com/apps/manage redirects to app.slack.com/apps-manage/<team id>/
// integrations/installed, where each installed app is a row linking to
// /apps-manage/<team>/integrations/profile/<app id>/permissions. Removal and
// authorization revocation live on the app's Configuration tab
// (slack.com/help/articles/360003125231) and can be restricted by workspace
// owners; that flow still awaits a live check, so installations are listed
// read-only.
export const slackRecipe: WebRecipe = {
  id: 'slack',
  title: 'Slack',
  description:
    'Apps installed in your Slack workspace (Manage apps → Installed apps)',
  baseUrl: 'https://slack.com',
  loginPath: '/signin',
  signedOutPaths: ['/signin', '/get-started', '/workspace-signin', '/ssb'],
  siteHosts: /(^|\.)slack\.com$/,
  lists: [
    {
      kind: 'app-installation',
      label: 'Installed apps',
      path: '/apps/manage',
      linkPattern:
        /^\/apps-manage\/[A-Z0-9]+\/integrations\/profile\/([A-Z0-9]+)(?:\/|[?#]|$)/,
      revocable: false,
      note: 'Listed read-only; remove or revoke from the app’s Configuration tab in Slack.',
    },
  ],
  revoke: {},
};

export const slack = createWebProvider(slackRecipe);
