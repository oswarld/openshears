# ✂️ OpenShears

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md)

**Chaque agent IA a demandé l'accès à votre GitHub. Vous avez dit oui à tous.**

Claude, ChatGPT et Codex, Cursor, Grok, les agents de Copilot, Muse de Meta, ce serveur MCP essayé un après-midi : chacun voulait votre GitHub, votre Gmail, votre Drive, votre agenda, votre Notion, votre Figma. Chaque « Authorize » a pris deux secondes. Personne ne revient en arrière. Lors du premier audit de mes propres comptes, un compte GitHub détenait **45 applications** et un compte Google **122 applications liées**, pour la plupart des agents et des outils dont j'avais oublié l'existence.

OpenShears est le bouton « annuler ». Il liste chaque application et chaque agent qui a encore accès à vos comptes, vous laisse dire lesquels vous utilisez vraiment, et révoque le reste en une seule passe au lieu de parcourir sept pages de paramètres.

```bash
npx openshears audit                                      # ce qui est connecté, partout, lecture seule
npx openshears prune github --keep "Claude" --dry-run     # aperçu : tout le reste sur GitHub serait révoqué
npx openshears prune github --keep "Claude"               # révoquer, après confirmation
```

## Démarrage rapide

```bash
npx openshears audit local      # agents sur cette machine et les identifiants qu'ils détiennent, sans connexion
npx openshears audit github     # connectez-vous une fois dans une fenêtre Chrome, puis listez chaque application du compte
```

`npx openshears audit` sans fournisseur exécute tous les fournisseurs et ouvre une fenêtre de connexion pour chacun de ceux où vous n'êtes pas encore connecté. Les audits sont en lecture seule ; rien n'est révoqué sans `prune` et une confirmation.

À quoi ressemble un audit (un vrai compte, novembre 2026) :

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

C'est tout l'enjeu : un compte GitHub avait 45 applications et un compte Google 122, presque toutes oubliées.

OpenShears tient son nom des ciseaux qui servent à découper un homard. Le projet a commencé comme désinstalleur d'[OpenClaw](https://github.com/openclaw/openclaw), toujours fourni sous `openshears openclaw`.

## Fonctionnement

La plupart des services n'offrent aucune API permettant à _vous_ de lister ou de révoquer les applications tierces que vous avez autorisées ; GitHub a supprimé son OAuth Authorizations API en 2020 et n'affiche les autorisations que sur les pages de paramètres. OpenShears pilote donc ces mêmes pages dans un navigateur déjà installé (Google Chrome ou Microsoft Edge, sans téléchargement) avec un **profil dédié** sous `~/.openshears/browser`. Vous vous connectez une fois dans une fenêtre visible ; les exécutions suivantes réutilisent cette session sans fenêtre. OpenShears ne lit jamais ce que vous tapez, ne stocke jamais de mot de passe et ne touche jamais au profil de votre navigateur habituel.

Nécessite Node.js 20 ou plus récent, et Chrome ou Edge pour les fournisseurs basés sur un navigateur. Définissez `OPENSHEARS_BROWSER` pour utiliser un autre exécutable Chromium.

## Commandes

| Commande                                         | Rôle                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openshears audit [provider...]`                 | Liste les connexions de tous les fournisseurs (ou de ceux indiqués). Lecture seule. `--json` pour un rapport, `--headed` pour voir le navigateur. |
| `openshears prune <provider> --keep <name...>`   | Révoque chaque connexion révocable qui ne correspond pas à un nom conservé. Affiche le plan et demande confirmation.                              |
| `openshears prune <provider> --revoke <name...>` | Révoque uniquement les connexions correspondantes.                                                                                                |
| `openshears prune <provider>`                    | Interactif : choisissez dans une liste les connexions à conserver (toutes conservées par défaut).                                                 |
| `openshears login <provider>`                    | Ouvre le profil du navigateur et se connecte.                                                                                                     |
| `openshears logout`                              | Supprime les sessions de navigateur enregistrées.                                                                                                 |
| `openshears providers`                           | Liste les fournisseurs.                                                                                                                           |
| `openshears inspect <provider>`                  | Exporte les pages d'un fournisseur (titres, liens, boutons) en lecture seule, pour écrire ou réparer une recette.                                 |
| `openshears openclaw`                            | Le désinstalleur OpenClaw d'origine (voir plus bas).                                                                                              |

Les motifs correspondent au nom ou à l'identifiant de la connexion, sans distinction de casse, avec `*` comme joker (`"Claude*"` conserve toutes les applications Claude). Un motif qui ne correspond à rien interrompt l'exécution avant toute révocation : une faute de frappe dans `--keep` ne peut jamais tout révoquer.

`--dry-run` et `--json` ne révoquent jamais. Sans terminal, `prune` exige un `--keep`/`--revoke`/`--all` explicite et `--yes`. Ctrl-C, Échap et une réponse négative annulent.

Exemple : garder Claude et Cursor sur GitHub et couper tout le reste, avec un aperçu d'abord :

```bash
npx openshears prune github --keep "Claude" "Cursor" --dry-run
```

```bash
npx openshears prune github --keep "Claude" "Cursor"
```

## Fournisseurs

| Fournisseur | Couverture                                                                                                                                                    | Révocation                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `github`    | Authorized OAuth Apps, Authorized GitHub Apps et Installed GitHub Apps dans les paramètres de github.com                                                      | Applications OAuth et autorisations de GitHub Apps. Les installations sont listées avec un lien pour désinstaller à la main. Vérifié en réel. |
| `google`    | Linked apps : applications ayant accès aux données de votre compte Google (Gmail, Drive, Calendar…), applications avec Sign in with Google, comptes liés      | « Delete all » par application. Audit et révocation vérifiés sur un vrai compte (applications supprimées avec l'outil).                       |
| `notion`    | Applications connectées à votre espace Notion (Settings → Connections → Connected)                                                                            | Déconnexion par application. Audit vérifié en réel (interface anglais/coréen) ; déconnexion vérifiée sur le fixture.                          |
| `stripe`    | Applications installées et plateformes tierces sur votre compte Stripe (Apps overview → Installed)                                                            | Révocation d'accès par application. Page et connexion vérifiées en réel ; les lignes attendent un compte avec des applications.               |
| `figma`     | Applications tierces connectées à votre compte Figma (Settings → Security → Connected apps)                                                                   | Révocation d'accès par application. Audit vérifié en réel (interface anglais/coréen) ; confirmation vérifiée sur le fixture.                  |
| `vercel`    | Intégrations installées sur votre équipe Vercel (Dashboard → Integrations)                                                                                    | Suppression d'intégration. Liste et bouton Remove vérifiés en réel ; confirmation vérifiée sur le fixture.                                    |
| `slack`     | Applications installées dans votre espace Slack (Manage apps → Installed apps)                                                                                | Liste en lecture seule, vérifiée en réel. La suppression dépend de la politique de l'espace ; faites-la depuis l'onglet Configuration.        |
| `local`     | Magasins d'identifiants et configurations MCP des agents installés sur cette machine (Claude, Codex, Gemini, Cursor, Windsurf, VS Code, OpenClaw, GitHub CLI) | Inventaire en lecture seule. Seuls les _noms_ de serveurs MCP sont lus ; jetons et commandes ne sont jamais relus.                            |

Chaque révocation ouvre la page de détail de l'application, confirme la boîte de dialogue, puis recharge la liste pour vérifier que l'application a disparu. Si elle est toujours listée, l'exécution signale un échec pour cette application et continue avec les autres.

## Ce qui est vérifié, honnêtement

Les pages de paramètres ne sont pas une API stable. Les recettes utilisent les noms accessibles et la structure des liens plutôt que les classes du balisage, suivent la pagination, et chaque recette dispose d'un site de substitution local dans la suite de tests qui exerce le listage et la révocation de bout en bout. En plus :

- **Les audits ont été exécutés sur de vrais comptes** GitHub, Google, Notion, Figma, Vercel et Slack le 2026-11-03, et les boutons de révocation ont été localisés sur les vraies pages.
- **De vraies révocations avec l'outil** ont été faites sur Google (le flux « Delete all », vérifié en relisant la liste). Sur GitHub, Notion, Figma et Vercel, le clic final de confirmation n'a jusqu'ici été exercé que sur les sites de substitution ; la première vraie révocation sur ceux-ci est le moment d'utiliser `--revoke "<une application jetable>"` et de regarder avec `--headed`.
- **Slack** est listé en lecture seule ; les lignes **Stripe** restent non vérifiées tant qu'un compte avec des applications installées ne l'a pas exécuté.
- Les libellés suivent la langue d'interface du compte. L'anglais et le coréen sont couverts là où cela comptait ; les autres langues demandent d'étendre les expressions régulières dans `src/providers/`.

L'état complet par flux se trouve dans [docs/providers.md](docs/providers.md). Quand un site change sa page, `openshears inspect <provider>` montre sur quoi la recette peut s'appuyer.

## Suppression d'OpenClaw

`openshears openclaw` inspecte et supprime les installations locales d'OpenClaw sur macOS et Linux/WSL. Aperçu avec `--dry-run` ou `--json` ; `--keep-data` préserve l'état et les espaces de travail ; `--include-workspaces` supprime aussi les espaces externes. La suppression est définitive et les répertoires d'état contiennent identifiants, sessions et mémoire. Le comportement, les limites et la compatibilité sont documentés dans [docs/openclaw-compatibility.md](docs/openclaw-compatibility.md).

## Développement

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js audit local
```

Les tests utilisent des répertoires temporaires, des fournisseurs simulés et des fixtures HTTP locaux qui imitent les pages de paramètres de chaque service ; ils ne se connectent jamais à un vrai compte et ne révoquent rien. Les tests sur fixtures exécutent Chrome sans fenêtre s'il est installé, et sont ignorés sinon.

## Contribuer : ajoutez les services que vous voulez couper

Chaque SaaS a une page « applications connectées » et presque aucun n'a d'API pour elle. OpenShears couvre aujourd'hui GitHub, Google, Notion, Stripe, Figma, Vercel et Slack ; **ajoutez les services que vous utilisez.** Discord, Linear, Dropbox, Microsoft, Atlassian, Zoom, Hugging Face, X, LinkedIn et Shopify ont tous une telle page et entrent dans le même modèle.

Un fournisseur est un `WebRecipe` dans `src/providers/<service>.ts` : l'URL de la page de paramètres, la façon de trouver les lignes (préfixe de lien ou sélecteur de ligne) et les clics de révocation nommés par rôle et libellé accessibles. Aucun code spécifique au service n'est nécessaire.

1. Connectez-vous une fois : `openshears login <service>` (ou ajoutez d'abord la recette avec seulement `baseUrl`, `loginPath` et `signedOutPaths`).
2. Lancez `openshears inspect <service>` sur la page des applications connectées. Il affiche, en lecture seule, les titres, liens, boutons et conteneurs répétés sur lesquels la recette peut s'appuyer.
3. Remplissez `lists` et `revoke`, puis vérifiez avec `openshears audit <service>` et une application jetable via `openshears prune <service> --revoke "<name>"`.
4. Ajoutez un petit site fixture sous `tests/fixtures/` qui imite la forme de la page (voir ceux de GitHub, Google, Notion, Figma et Vercel) et un test qui audite et révoque contre lui.
5. Notez la date de vérification et les libellés propres à la langue dans [docs/providers.md](docs/providers.md).

Gardez les audits en lecture seule, vérifiez chaque révocation en relisant la liste, ne journalisez jamais de jetons ni de contenus de formulaires. Une pull request avec une nouvelle recette est la contribution la plus utile que ce projet puisse recevoir.

## Licence

MIT. Voir [LICENSE](LICENSE).
