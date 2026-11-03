# ✂️ OpenShears

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch**

**Jeder KI-Agent wollte Zugriff auf dein GitHub. Du hast bei allen Ja gesagt.**

Claude, ChatGPT und Codex, Cursor, Grok, die Copilot-Agenten, Metas Muse, der MCP-Server, den du an einem Nachmittag ausprobiert hast: Jeder wollte dein GitHub, dein Gmail, dein Drive, deinen Kalender, dein Notion, dein Figma. Jedes „Authorize" dauerte zwei Sekunden. Niemand geht zurück. Als ich meine eigenen Konten zum ersten Mal geprüft habe, hielt ein GitHub-Konto **45 Apps** und ein Google-Konto **122 verknüpfte Apps**, die meisten davon Agenten und Tools, von denen ich vergessen hatte, dass ich sie je verbunden hatte.

OpenShears ist der Rückgängig-Knopf. Es listet jede App und jeden Agenten auf, die noch Zugriff auf deine Konten haben, lässt dich sagen, welche du wirklich benutzt, und entzieht dem Rest den Zugriff in einem Durchgang, statt dich durch sieben Einstellungsseiten zu klicken.

```bash
npx openshears audit                                      # was wo verbunden ist, nur lesend
npx openshears prune github --keep "Claude" --dry-run     # Vorschau: alles andere auf GitHub würde entfernt
npx openshears prune github --keep "Claude"               # entziehen, nach einer Bestätigung
```

## Schnellstart

```bash
npx openshears audit local      # Agenten auf diesem Rechner und die Zugangsdaten, die sie halten, ohne Anmeldung
npx openshears audit github     # einmal in einem Chrome-Fenster anmelden, dann jede App des Kontos auflisten
```

`npx openshears audit` ohne Anbieter prüft alle Anbieter und öffnet für jeden, bei dem du noch nicht angemeldet bist, ein Anmeldefenster. Prüfungen sind nur lesend; ohne `prune` und eine Bestätigung wird nichts entzogen.

So sieht eine Prüfung aus (ein echtes Konto, November 2026):

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

Genau darum geht es: Ein GitHub-Konto hatte 45 Apps und ein Google-Konto 122, die meisten vergessen.

OpenShears ist nach der Schere benannt, mit der man einen Hummer zerlegt. Das Projekt begann als Deinstallationswerkzeug für [OpenClaw](https://github.com/openclaw/openclaw), das weiterhin als `openshears openclaw` enthalten ist.

## So funktioniert es

Die meisten Dienste bieten keine API, mit der _du_ die von dir autorisierten Drittanbieter-Apps auflisten oder entziehen könntest; GitHub hat seine OAuth Authorizations API 2020 entfernt und zeigt Freigaben nur noch auf den Einstellungsseiten. OpenShears steuert deshalb genau diese Seiten in einem bereits installierten Browser (Google Chrome oder Microsoft Edge, kein Download) mit einem **eigenen Profil** unter `~/.openshears/browser`. Du meldest dich einmal in einem sichtbaren Fenster an; spätere Läufe nutzen diese Sitzung ohne Fenster weiter. OpenShears liest nie, was du tippst, speichert keine Passwörter und rührt dein alltägliches Browserprofil nicht an.

Benötigt Node.js 20 oder neuer sowie Chrome oder Edge für browserbasierte Anbieter. Setze `OPENSHEARS_BROWSER`, um ein anderes Chromium-Programm zu verwenden.

## Befehle

| Befehl                                           | Wirkung                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `openshears audit [provider...]`                 | Listet die Verbindungen aller (oder der genannten) Anbieter. Nur lesend. `--json` für einen Bericht, `--headed` zeigt den Browser.   |
| `openshears prune <provider> --keep <name...>`   | Entzieht jeder entziehbaren Verbindung den Zugriff, die keinem behaltenen Namen entspricht. Zeigt den Plan und fragt nach.           |
| `openshears prune <provider> --revoke <name...>` | Entzieht nur den passenden Verbindungen den Zugriff.                                                                                 |
| `openshears prune <provider>`                    | Interaktiv: Wähle in einer Liste, welche Verbindungen bleiben (standardmäßig alle).                                                  |
| `openshears login <provider>`                    | Öffnet das Browserprofil und meldet dich an.                                                                                         |
| `openshears logout`                              | Löscht die gespeicherten Browsersitzungen.                                                                                           |
| `openshears providers`                           | Listet die Anbieter.                                                                                                                 |
| `openshears inspect <provider>`                  | Gibt die Seiten eines Anbieters (Überschriften, Links, Schaltflächen) nur lesend aus, um ein Rezept zu schreiben oder zu reparieren. |
| `openshears openclaw`                            | Das ursprüngliche OpenClaw-Deinstallationswerkzeug (siehe unten).                                                                    |

Muster passen auf den Namen oder die ID der Verbindung, ohne Groß-/Kleinschreibung, mit `*` als Platzhalter (`"Claude*"` behält alle Claude-Apps). Ein Muster, das auf nichts passt, bricht den Lauf vor jedem Entzug ab, sodass ein Tippfehler in `--keep` nie alles entfernen kann.

`--dry-run` und `--json` entziehen nie etwas. Ohne Terminal braucht `prune` ein ausdrückliches `--keep`/`--revoke`/`--all` sowie `--yes`. Strg-C, Escape und eine verneinende Antwort brechen ab.

Beispiel: Claude und Cursor auf GitHub behalten und alles andere kappen, zuerst als Vorschau:

```bash
npx openshears prune github --keep "Claude" "Cursor" --dry-run
```

```bash
npx openshears prune github --keep "Claude" "Cursor"
```

## Anbieter

| Anbieter | Umfang                                                                                                                                                             | Entzug                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `github` | Authorized OAuth Apps, Authorized GitHub Apps und Installed GitHub Apps in den Einstellungen von github.com                                                        | OAuth-Apps und GitHub-App-Freigaben. Installationen werden mit einem Link zum manuellen Entfernen gelistet. Live verifiziert.   |
| `google` | Linked apps: Apps mit Zugriff auf deine Google-Kontodaten (Gmail, Drive, Calendar …), Apps mit Sign in with Google, verknüpfte Konten                              | „Delete all" pro App. Prüfung und Entzug an einem echten Konto verifiziert (Apps mit dem Werkzeug entfernt).                    |
| `notion` | Mit deinem Notion-Workspace verbundene Apps (Settings → Connections → Connected)                                                                                   | Trennen pro App. Prüfung live verifiziert (englische/koreanische Oberfläche); Trennung am Fixture verifiziert.                  |
| `stripe` | Installierte Apps und Drittplattformen in deinem Stripe-Konto (Apps overview → Installed)                                                                          | Zugriff pro App entziehen. Seite und Anmeldung live verifiziert; die Zeilen warten auf ein Konto mit installierten Apps.        |
| `figma`  | Mit deinem Figma-Konto verbundene Drittanbieter-Apps (Settings → Security → Connected apps)                                                                        | Zugriff pro App entziehen. Prüfung live verifiziert (englische/koreanische Oberfläche); Bestätigung am Fixture verifiziert.     |
| `vercel` | In deinem Vercel-Team installierte Integrationen (Dashboard → Integrations)                                                                                        | Integration entfernen. Liste und Remove-Schaltfläche live verifiziert; Bestätigung am Fixture verifiziert.                      |
| `slack`  | In deinem Slack-Workspace installierte Apps (Manage apps → Installed apps)                                                                                         | Nur lesende Liste, live verifiziert. Entfernen hängt von der Workspace-Richtlinie ab; erledige es im Configuration-Tab der App. |
| `local`  | Zugangsdatenspeicher und MCP-Konfigurationen der auf diesem Rechner installierten Agenten (Claude, Codex, Gemini, Cursor, Windsurf, VS Code, OpenClaw, GitHub CLI) | Nur lesendes Inventar. Nur die _Namen_ der MCP-Server werden gelesen; Tokens und Befehle nie.                                   |

Jeder Entzug öffnet die Detailseite der App, bestätigt den Dialog und lädt dann die Liste neu, um zu prüfen, dass die App verschwunden ist. Steht sie noch da, meldet der Lauf für diese App einen Fehler und macht mit den übrigen weiter.

## Was verifiziert ist, ehrlich gesagt

Einstellungsseiten sind keine stabile API. Rezepte verwenden zugängliche Namen und die Linkstruktur statt Markup-Klassen, folgen der Seitennummerierung, und jedes Rezept hat in der Testsuite eine lokale Ersatzseite, die Auflisten und Entziehen von Anfang bis Ende durchspielt. Darüber hinaus:

- **Prüfungen liefen gegen echte Konten** bei GitHub, Google, Notion, Figma, Vercel und Slack am 2026-11-03, und die Entzugs-Schaltflächen wurden auf den echten Seiten gefunden.
- **Echte Entzüge mit dem Werkzeug** wurden bei Google durchgeführt (der „Delete all"-Ablauf, verifiziert durch erneutes Lesen der Liste). Bei GitHub, Notion, Figma und Vercel wurde der letzte Bestätigungsklick bisher nur an den Ersatzseiten ausgeführt; der erste echte Entzug dort ist der Moment für `--revoke "<eine entbehrliche App>"` und Zuschauen mit `--headed`.
- **Slack** wird nur lesend gelistet; die **Stripe**-Zeilen bleiben unverifiziert, bis ein Konto mit installierten Apps es ausführt.
- Beschriftungen folgen der Oberflächensprache des Kontos. Englisch und Koreanisch sind abgedeckt, wo es darauf ankam; andere Sprachen erfordern erweiterte reguläre Ausdrücke in `src/providers/`.

Der vollständige Stand je Ablauf steht in [docs/providers.md](docs/providers.md). Ändert eine Seite ihren Aufbau, zeigt `openshears inspect <provider>`, woran das Rezept anknüpfen kann.

## OpenClaw entfernen

`openshears openclaw` untersucht und entfernt lokale OpenClaw-Installationen unter macOS und Linux/WSL. Vorschau mit `--dry-run` oder `--json`; `--keep-data` bewahrt Zustand und Arbeitsbereiche; `--include-workspaces` entfernt auch externe Arbeitsbereiche. Das Entfernen ist endgültig, und Zustandsverzeichnisse enthalten Zugangsdaten, Sitzungen und Gedächtnis. Verhalten, Grenzen und Kompatibilität sind in [docs/openclaw-compatibility.md](docs/openclaw-compatibility.md) dokumentiert.

## Entwicklung

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js audit local
```

Die Tests verwenden temporäre Verzeichnisse, simulierte Anbieter und lokale HTTP-Fixtures, die die Einstellungsseiten der Dienste nachbilden; sie melden sich nie an einem echten Konto an und entziehen nichts. Die Fixture-Tests laufen mit Chrome ohne Fenster, wenn es installiert ist, und werden sonst übersprungen.

## Mitwirken: Füge die Dienste hinzu, die du kappen willst

Jedes SaaS hat eine Seite „verbundene Apps", und fast keines hat eine API dafür. OpenShears deckt heute GitHub, Google, Notion, Stripe, Figma, Vercel und Slack ab; **füge die Dienste hinzu, die du benutzt.** Discord, Linear, Dropbox, Microsoft, Atlassian, Zoom, Hugging Face, X, LinkedIn und Shopify haben alle eine solche Seite und passen in dasselbe Modell.

Ein Anbieter ist ein `WebRecipe` in `src/providers/<service>.ts`: die URL der Einstellungsseite, wie Zeilen gefunden werden (Linkpräfix oder Zeilenselektor) und die Entzugs-Klicks, benannt nach zugänglicher Rolle und Beschriftung. Dienstspezifischer Code ist nicht nötig.

1. Einmal anmelden: `openshears login <service>` (oder zuerst das Rezept nur mit `baseUrl`, `loginPath` und `signedOutPaths` anlegen).
2. `openshears inspect <service>` auf der Seite der verbundenen Apps ausführen. Es gibt nur lesend die Überschriften, Links, Schaltflächen und wiederholten Container aus, an die das Rezept anknüpfen kann.
3. `lists` und `revoke` ausfüllen, dann mit `openshears audit <service>` und einer entbehrlichen App über `openshears prune <service> --revoke "<name>"` verifizieren.
4. Eine kleine Fixture-Seite unter `tests/fixtures/` anlegen, die den Seitenaufbau nachbildet (siehe die für GitHub, Google, Notion, Figma und Vercel), und einen Test, der dagegen prüft und entzieht.
5. Verifizierungsdatum und sprachspezifische Beschriftungen in [docs/providers.md](docs/providers.md) festhalten.

Halte Prüfungen nur lesend, verifiziere jeden Entzug durch erneutes Lesen der Liste und protokolliere nie Tokens oder Formularinhalte. Ein Pull Request mit einem neuen Rezept ist der nützlichste Beitrag, den dieses Projekt bekommen kann.

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
