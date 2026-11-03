import { createWebProvider, type WebRecipe } from '../browser/recipe.js';

// Figma lists third-party apps under Settings → Security → "Connected apps",
// each with a "Revoke access" button. Checked against www.figma.com on
// 2026-11-03: the profile button in the file browser (data-testid
// "ProfileButton") opens a menu whose "Settings" entry opens the settings
// dialog; the Security tab lists sessions, personal access tokens and
// connected apps (Korean UI: 보안 / 연결된 앱 / 액세스 권한 취소). If the stored
// session has lapsed, an interactive audit asks you to sign in and continues.
const REVOKE = /revoke access|액세스 권한 취소/i;

export const figmaRecipe: WebRecipe = {
  id: 'figma',
  title: 'Figma',
  description:
    'Third-party apps connected to your Figma account (Settings → Security → Connected apps)',
  baseUrl: 'https://www.figma.com',
  loginPath: '/login',
  signedOutPaths: ['/login', '/signup'],
  lists: [
    {
      kind: 'oauth-app',
      label: 'Connected apps',
      path: '/files',
      openSteps: [
        { selector: '[data-testid="ProfileButton"]' },
        { role: 'text', name: /^(settings|설정)$/i },
        { role: 'tab', name: /^(security|보안)/i },
      ],
      rows: { anchorButton: REVOKE },
      revocable: true,
    },
  ],
  revoke: {
    'oauth-app': {
      steps: [
        { role: 'button', name: REVOKE, within: 'row' },
        {
          role: 'button',
          name: /revoke|취소|confirm|확인|remove|제거/i,
          within: 'dialog',
          optional: true,
        },
      ],
    },
  },
};

export const figma = createWebProvider(figmaRecipe);
