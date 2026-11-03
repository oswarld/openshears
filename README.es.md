# ✂️ OpenShears

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md)

**Cada agente de IA te pidió acceso a tu GitHub. Dijiste que sí a todos.**

Claude, ChatGPT y Codex, Cursor, Grok, los agentes de Copilot, Muse de Meta, ese servidor MCP que probaste una tarde: cada uno quería tu GitHub, tu Gmail, tu Drive, tu calendario, tu Notion, tu Figma. Cada "Authorize" tardó dos segundos. Nadie vuelve atrás. Cuando hice la primera auditoría de mis propias cuentas, una cuenta de GitHub tenía **45 aplicaciones** y una cuenta de Google **122 aplicaciones vinculadas**, la mayoría agentes y herramientas que ni recordaba haber conectado.

OpenShears es el botón de deshacer. Lista cada aplicación y agente que todavía tiene acceso a tus cuentas, te deja decir cuáles usas de verdad y revoca el resto de una sola pasada, en lugar de recorrer siete páginas de configuración.

```bash
npx openshears audit                                      # qué está conectado, en todas partes, solo lectura
npx openshears prune github --keep "Claude" --dry-run     # vista previa: todo lo demás en GitHub se revocaría
npx openshears prune github --keep "Claude"               # revocar, tras una confirmación
```

## Inicio rápido

```bash
npx openshears audit local      # agentes en esta máquina y las credenciales que guardan, sin iniciar sesión
npx openshears audit github     # inicia sesión una vez en una ventana de Chrome y lista cada aplicación de la cuenta
```

`npx openshears audit` sin proveedor ejecuta todos los proveedores y abre una ventana de inicio de sesión para cada uno en el que aún no hayas entrado. Las auditorías son de solo lectura; nada se revoca sin `prune` y una confirmación.

Así se ve una auditoría (una cuenta real, noviembre de 2026):

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

Ese es el punto: una cuenta de GitHub tenía 45 aplicaciones y una de Google 122, casi todas olvidadas.

OpenShears toma su nombre de las tijeras con las que se despieza una langosta. Empezó como el desinstalador de [OpenClaw](https://github.com/openclaw/openclaw), que sigue incluido como `openshears openclaw`.

## Cómo funciona

La mayoría de los servicios no ofrecen una API para que _tú_ listes o revoques las aplicaciones de terceros que autorizaste; GitHub eliminó su OAuth Authorizations API en 2020 y solo muestra las autorizaciones en las páginas de configuración. Por eso OpenShears maneja esas mismas páginas en un navegador que ya tienes instalado (Google Chrome o Microsoft Edge, sin descargas) usando un **perfil dedicado** en `~/.openshears/browser`. Inicias sesión una vez en una ventana visible; las ejecuciones posteriores reutilizan esa sesión sin ventana. OpenShears nunca lee lo que escribes, nunca guarda contraseñas y nunca toca el perfil de tu navegador habitual.

Requiere Node.js 20 o superior y Chrome o Edge para los proveedores basados en navegador. Define `OPENSHEARS_BROWSER` para usar otro ejecutable de Chromium.

## Comandos

| Comando                                          | Qué hace                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `openshears audit [provider...]`                 | Lista las conexiones de todos los proveedores (o de los indicados). Solo lectura. `--json` para un informe, `--headed` para ver el navegador. |
| `openshears prune <provider> --keep <name...>`   | Revoca toda conexión revocable que no coincida con un nombre conservado. Muestra el plan y pregunta.                                          |
| `openshears prune <provider> --revoke <name...>` | Revoca solo las conexiones que coinciden.                                                                                                     |
| `openshears prune <provider>`                    | Interactivo: elige en una lista qué conexiones conservar (por defecto, todas).                                                                |
| `openshears login <provider>`                    | Abre el perfil del navegador e inicia sesión.                                                                                                 |
| `openshears logout`                              | Borra las sesiones de navegador guardadas.                                                                                                    |
| `openshears providers`                           | Lista los proveedores.                                                                                                                        |
| `openshears inspect <provider>`                  | Vuelca las páginas de un proveedor (encabezados, enlaces, botones) en solo lectura, para escribir o reparar una receta.                       |
| `openshears openclaw`                            | El desinstalador original de OpenClaw (ver abajo).                                                                                            |

Los patrones coinciden con el nombre o el id de la conexión, sin distinguir mayúsculas, con `*` como comodín (`"Claude*"` conserva todas las aplicaciones de Claude). Un patrón que no coincide con nada aborta la ejecución antes de revocar, así que una errata en `--keep` nunca puede revocarlo todo.

`--dry-run` y `--json` nunca revocan. Sin terminal, `prune` necesita un `--keep`/`--revoke`/`--all` explícito y `--yes`. Ctrl-C, Escape y una respuesta negativa cancelan.

Ejemplo: conservar Claude y Cursor en GitHub y cortar todo lo demás, con vista previa primero:

```bash
npx openshears prune github --keep "Claude" "Cursor" --dry-run
```

```bash
npx openshears prune github --keep "Claude" "Cursor"
```

## Proveedores

| Proveedor | Cubre                                                                                                                                                              | Revocación                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `github`  | Authorized OAuth Apps, Authorized GitHub Apps e Installed GitHub Apps en la configuración de github.com                                                            | Aplicaciones OAuth y autorizaciones de GitHub Apps. Las instalaciones se listan con un enlace para desinstalar a mano. Verificado en real. |
| `google`  | Linked apps: aplicaciones con acceso a los datos de tu cuenta de Google (Gmail, Drive, Calendar…), aplicaciones con Sign in with Google, cuentas vinculadas        | "Delete all" por aplicación. Auditoría y revocación verificadas en una cuenta real (aplicaciones eliminadas con la herramienta).           |
| `notion`  | Aplicaciones conectadas a tu espacio de Notion (Settings → Connections → Connected)                                                                                | Desconectar por aplicación. Auditoría verificada en real (UI en inglés/coreano); desconexión verificada con el fixture.                    |
| `stripe`  | Aplicaciones instaladas y plataformas de terceros en tu cuenta de Stripe (Apps overview → Installed)                                                               | Revocar acceso por aplicación. Página e inicio de sesión verificados en real; las filas esperan una cuenta con aplicaciones.               |
| `figma`   | Aplicaciones de terceros conectadas a tu cuenta de Figma (Settings → Security → Connected apps)                                                                    | Revocar acceso por aplicación. Auditoría verificada en real (UI en inglés/coreano); confirmación verificada con el fixture.                |
| `vercel`  | Integraciones instaladas en tu equipo de Vercel (Dashboard → Integrations)                                                                                         | Quitar integración. Lista y botón Remove verificados en real; confirmación verificada con el fixture.                                      |
| `slack`   | Aplicaciones instaladas en tu espacio de Slack (Manage apps → Installed apps)                                                                                      | Lista de solo lectura, verificada en real. La eliminación depende de la política del espacio; hazla desde la pestaña Configuration.        |
| `local`   | Almacenes de credenciales y configuraciones MCP de los agentes instalados en esta máquina (Claude, Codex, Gemini, Cursor, Windsurf, VS Code, OpenClaw, GitHub CLI) | Inventario de solo lectura. Solo se leen los _nombres_ de servidores MCP; tokens y comandos nunca se leen.                                 |

Cada revocación abre la página de detalle de la aplicación, confirma el diálogo y recarga la lista para verificar que la aplicación desapareció. Si sigue listada, la ejecución informa un fallo para esa aplicación y continúa con las demás.

## Qué está verificado, con honestidad

Las páginas de configuración no son una API estable. Las recetas usan nombres accesibles y la estructura de enlaces en lugar de clases de marcado, siguen la paginación, y cada receta tiene un sitio sustituto local en la suite de pruebas que ejercita el listado y la revocación de principio a fin. Además:

- **Las auditorías se ejecutaron contra cuentas reales** de GitHub, Google, Notion, Figma, Vercel y Slack el 2026-11-03, y los botones de revocación se localizaron en las páginas reales.
- **Revocaciones reales con la herramienta** se han hecho en Google (el flujo "Delete all", verificado releyendo la lista). En GitHub, Notion, Figma y Vercel el clic final de confirmación solo se ha ejercitado contra los sitios sustitutos; la primera revocación real en ellos es el momento de usar `--revoke "<una aplicación prescindible>"` y mirar con `--headed`.
- **Slack** se lista en solo lectura; las filas de **Stripe** quedan sin verificar hasta que lo ejecute una cuenta con aplicaciones instaladas.
- Las etiquetas siguen el idioma de la interfaz de la cuenta. Inglés y coreano están cubiertos donde importaba; otros idiomas requieren ampliar las expresiones regulares en `src/providers/`.

El estado completo por flujo está en [docs/providers.md](docs/providers.md). Cuando un sitio cambie su página, `openshears inspect <provider>` muestra a qué puede engancharse la receta.

## Eliminación de OpenClaw

`openshears openclaw` inspecciona y elimina instalaciones locales de OpenClaw en macOS y Linux/WSL. Previsualiza con `--dry-run` o `--json`; `--keep-data` conserva estado y espacios de trabajo; `--include-workspaces` elimina también los espacios externos. La eliminación es permanente y los directorios de estado contienen credenciales, sesiones y memoria. El comportamiento, los límites y la compatibilidad están documentados en [docs/openclaw-compatibility.md](docs/openclaw-compatibility.md).

## Desarrollo

```bash
git clone https://github.com/oswarld/openshears.git
cd openshears
npm ci
npm run build
npm test
npm run lint
node dist/index.js audit local
```

Las pruebas usan directorios temporales, proveedores simulados y fixtures HTTP locales que imitan las páginas de configuración de cada servicio; nunca inician sesión en una cuenta real ni revocan nada. Las pruebas con fixtures ejecutan Chrome sin ventana cuando está instalado y se omiten en caso contrario.

## Contribuir: añade los servicios que quieras cortar

Todo SaaS tiene una página de "aplicaciones conectadas" y casi ninguno tiene API para ella. OpenShears cubre hoy GitHub, Google, Notion, Stripe, Figma, Vercel y Slack; **añade los servicios que uses.** Discord, Linear, Dropbox, Microsoft, Atlassian, Zoom, Hugging Face, X, LinkedIn y Shopify tienen esa página y encajan en el mismo modelo.

Un proveedor es un `WebRecipe` en `src/providers/<service>.ts`: la URL de la página de configuración, cómo se encuentran las filas (prefijo de enlace o selector de fila) y los clics de revocación nombrados por rol y etiqueta accesibles. No hace falta código específico del servicio.

1. Inicia sesión una vez: `openshears login <service>` (o añade primero la receta solo con `baseUrl`, `loginPath` y `signedOutPaths`).
2. Ejecuta `openshears inspect <service>` en la página de aplicaciones conectadas. Imprime, en solo lectura, los encabezados, enlaces, botones y contenedores repetidos a los que la receta puede engancharse.
3. Rellena `lists` y `revoke`, y verifica con `openshears audit <service>` y una aplicación prescindible mediante `openshears prune <service> --revoke "<name>"`.
4. Añade un pequeño sitio fixture en `tests/fixtures/` que imite la forma de la página (mira los de GitHub, Google, Notion, Figma y Vercel) y una prueba que audite y revoque contra él.
5. Anota la fecha de verificación y las etiquetas específicas del idioma en [docs/providers.md](docs/providers.md).

Mantén las auditorías en solo lectura, verifica cada revocación releyendo la lista y nunca registres tokens ni contenidos de formularios. Un pull request con una receta nueva es la contribución más útil que puede recibir este proyecto.

## Licencia

MIT. Ver [LICENSE](LICENSE).
