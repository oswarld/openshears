import { createWebProvider, type WebRecipe } from '../browser/recipe.js';

// Notion keeps connections inside the in-app Settings dialog and offers no
// user-level API for them. Checked against app.notion.com on 2026-11-03:
// the sidebar workspace switcher (.notion-sidebar-switcher) opens a menu whose
// "Settings" entry opens the settings dialog; its "Connections" tab has a
// "Connected" sub-tab listing each app as a table row with a "Manage <app>"
// button (aria-label; Korean UI: "<app> 관리"). The manage dialog's danger
// zone has "Disconnect" ("연결 해제하기"). Labels follow the account's UI
// language; English and Korean are covered.
export const notionRecipe: WebRecipe = {
  id: 'notion',
  title: 'Notion',
  description:
    'Apps connected to your Notion workspace (Settings → Connections → Connected)',
  // The workspace app moved to app.notion.com; www.notion.so/.com redirect there
  // when signed in and to the marketing site otherwise.
  baseUrl: 'https://app.notion.com',
  loginPath: '/login',
  signedOutPaths: ['/login', '/signup', '/onboarding'],
  signedOutHosts: [
    'www.notion.so',
    'notion.so',
    'www.notion.com',
    'notion.com',
  ],
  lists: [
    {
      kind: 'oauth-app',
      label: 'Connected',
      path: '/',
      openSteps: [
        { selector: '.notion-sidebar-switcher' },
        { role: 'text', name: /^(settings|설정)$/i },
        { role: 'tab', name: /^(connections|연결)$/i },
        { role: 'tab', name: /^(connected|연결됨)\s*\d*$/i },
      ],
      rows: {
        selector:
          '[role="dialog"] [role="button"][aria-label^="Manage "], [role="dialog"] [role="button"][aria-label$=" 관리"]',
        nameAttribute: 'aria-label',
        namePattern: /^(?:manage )?(.+?)(?: 관리)?$/i,
      },
      revocable: true,
      note: 'Built-in connections (for example GitHub link previews) are not listed; they have no Manage button.',
    },
  ],
  revoke: {
    'oauth-app': {
      clickRow: true,
      steps: [
        {
          role: 'button',
          name: /^(disconnect|연결 해제하기|연결 해제)$/i,
          within: 'dialog',
        },
        {
          role: 'button',
          name: /^(disconnect|연결 해제하기|연결 해제|confirm|확인|remove|제거)$/i,
          within: 'dialog',
          optional: true,
        },
      ],
    },
  },
};

export const notion = createWebProvider(notionRecipe);
